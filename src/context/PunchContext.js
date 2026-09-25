import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import LocationService from '../services/LocationService';
import { captureFieldActivityLocation } from '../hooks/useFieldActivityLocation';
import GeocodingService from '../services/GeocodingService';
import LiveTrackingService from '../services/LiveTrackingService';
import { parseApiError } from '../core/error/AppErrorHandler';
import { enqueue, isNetworkError, registerReplayer, generateTransactionId } from '../services/OfflineQueue';
import { istDateStr } from '../utils/businessDate';

const IS_DEV = __DEV__;
const GEOCODE_TIMEOUT_MS = 6000;

// The punch-in payload built below is already a plain, JSON-safe object
// (no Date/File instances), so it can be queued and replayed as-is. Not
// optimistic about live/tracking state on queue — isActive/LiveTracking are
// only ever flipped once the server actually confirms the punch, so the UI
// never claims "you're punched in and tracking" for something that hasn't
// landed yet; fetchTodayPunches() picks up the real state once it does.
registerReplayer('PUNCH_IN', async (payload) => {
  await api.post('/attendance/punches/', payload);
});

// Same endpoint, same idempotency guard (AttendancePunchViewSet.create()'s
// client_transaction_id short-circuit) — a queued punch-out replayed after
// the app already restarted still resolves to the one real punch-out event.
registerReplayer('PUNCH_OUT', async (payload) => {
  await api.post('/attendance/punches/', payload);
});

// Reverse geocoding must never be able to hang the punch flow — race it
// against a timeout and fall back to null (caller uses raw coordinates).
const reverseGeocodeWithTimeout = (lat, lng, timeoutMs = GEOCODE_TIMEOUT_MS) =>
  Promise.race([
    GeocodingService.reverseGeocode(lat, lng),
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);

export const STATES = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  FETCHING_LOCATION: 'FETCHING_LOCATION',
  FORM_OPEN: 'FORM_OPEN',
  SUBMITTING: 'SUBMITTING',
  PUNCHING_OUT: 'PUNCHING_OUT',
  ERROR: 'ERROR',
};

const PunchContext = createContext(null);

export const PunchProvider = ({ children }) => {
  const [punches, setPunches] = useState([]);
  const [loading, setLoading] = useState(false);
  // Flips true after the first fetchTodayPunches() call resolves (success or
  // failure) — lets a consumer tell "no punches yet today" (punches === [])
  // apart from "haven't checked yet" (also punches === [] initially), which
  // matters for anything that reacts to an empty punch list on first render
  // (e.g. the daily punch-in reminder).
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [error, setError] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [punchState, setPunchState] = useState(STATES.IDLE);
  const [isActive, setIsActive] = useState(false);
  const [capturedLocation, setCapturedLocation] = useState(null);
  const [isMockLocation, setIsMockLocation] = useState(false);
  // Milestone 2a: the employee's most recent auto-closed session, if any,
  // that hasn't been submitted for review yet — powers a "request a review"
  // banner. See apps.punchverification on the backend.
  const [pendingAutoClosure, setPendingAutoClosure] = useState(null);

  const trackingStartTime = useRef(null);
  const routePoints = useRef([]);
  // Lifecycle marks of the server-owned live session (persisted start +
  // 11h/13.5h marks from /livetracking/sessions/active/) — display-only input
  // for the ACTIVE/GRACE/EXPIRED banner. The backend remains authoritative
  // for actual closing; these marks can never drift (absolute ISO instants)
  // and are re-seeded from the server on every punch-state restore, so an
  // app restart never creates a new start time.
  const [trackingMarks, setTrackingMarks] = useState(null);

  // The OFFICIAL distance for today. ONE source, read from the backend's
  // authoritative daily summary - never a local accumulation, never the raw
  // GPS chain, never a second endpoint.
  //
  // Null means "the server has no answer yet" (still uploading, offline, or no
  // tracking session that day). The screens show an em dash rather than a
  // guess: a number that is not the route is worse than no number.
  const [dailySummary, setDailySummary] = useState(null);
  const trustedDistanceKm = dailySummary?.distance?.kilometers ?? null;
  const trustedRouteStatus = dailySummary?.tracking_status ?? null;
  // Declared before refreshTrustedDistance/the reset effect below — both
  // reference it in their useCallback/useEffect dependency arrays, which are
  // evaluated synchronously during this render, so businessDate must already
  // be initialized by then (a `const` declared later in the same scope is in
  // its temporal dead zone until its own line runs).
  const businessDate = istDateStr();

  // Refresh can be triggered from several places at once: the 60s interval, a
  // pull-to-refresh, a focus event, an AppState change back to foreground. Two
  // overlapping requests can complete out of order, and the slower one would
  // then overwrite a newer answer - which is one of the ways a distance appeared
  // to move backwards. Only the newest request is allowed to write.
  const requestSeq = useRef(0);
  const lastWrittenRevision = useRef(null);
  const lastWrittenRecalcs = useRef(null);
  // Mirror of the accepted payload, so a comparison against the currently
  // displayed value does not need the callback to depend on state (which
  // would re-create it on every update and restart the poll).
  const dailySummaryRef = useRef(null);
  useEffect(() => { dailySummaryRef.current = dailySummary; }, [dailySummary]);

  const refreshTrustedDistance = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const res = await api.getTrackingDailySummary({ date: businessDate });
      // A response that a newer request has already superseded is discarded.
      if (seq !== requestSeq.current) return;
      const data = res?.data || null;
      if (!data) return;

      // A response carrying an OLDER revision than the one already on screen is
      // a stale replay (cache, out-of-order request) and is ignored.
      const revision = data.distance_revision ?? null;
      if (
        revision != null
        && lastWrittenRevision.current != null
        && revision < lastWrittenRevision.current
      ) {
        if (IS_DEV) {
          console.warn('[Punch] Ignoring stale daily summary revision',
            revision, '<', lastWrittenRevision.current);
        }
        return;
      }

      // Defence in depth. The backend already refuses to publish a lower
      // distance during normal operation, so a decrease should not arrive at
      // all - but a cumulative distance that visibly goes backwards because a
      // screen refreshed is indefensible regardless of whose bug it is. It is
      // only accepted when the backend says it deliberately recalculated the
      // value (recalculation_count advanced), which is the one legitimate
      // reason a day's total can be revised.
      const km = data.distance?.kilometers;
      const previous = dailySummaryRef.current?.distance?.kilometers ?? null;
      const recalcs = data.recalculation_count ?? null;
      const explicitCorrection = recalcs != null
        && lastWrittenRecalcs.current != null
        && recalcs > lastWrittenRecalcs.current;

      if (
        typeof km === 'number'
        && previous != null
        && km < previous
        && !explicitCorrection
      ) {
        if (IS_DEV) {
          console.warn('[Punch] Refusing a lower daily distance',
            km, '<', previous, '- keeping', previous);
        }
        return;
      }

      lastWrittenRevision.current = revision;
      lastWrittenRecalcs.current = recalcs;
      setDailySummary(data);
    } catch {
      // Offline, or the summary has not been built yet. Leave the last known
      // value alone rather than replacing it with a guess.
    }
  }, [businessDate]);

  // A new business date is a different journey: the previous day's distance
  // must not survive into it, or the Home card would open on a stale number.
  // This is also what makes the app correct across midnight IST - at 00:00 the
  // key changes, the stale value is dropped, and the next refresh fetches the
  // new day's distance.
  useEffect(() => {
    lastWrittenRevision.current = null;
    lastWrittenRecalcs.current = null;
    dailySummaryRef.current = null;
    setDailySummary(null);
  }, [businessDate]);

  const fetchTodayPunches = useCallback(async () => {
    try {
      const res = await api.get('/attendance/punches/today_punches/');
      const rawPunches = Array.isArray(res.data) ? res.data :
                         Array.isArray(res.data?.results) ? res.data.results : [];

      const map = new Map();
      rawPunches.forEach(p => {
        if (p?.id && !map.has(p.id)) {
          map.set(p.id, p);
        }
      });

      const uniquePunches = Array.from(map.values()).sort((a, b) =>
        new Date(b.punched_at) - new Date(a.punched_at)
      );
      setPunches(uniquePunches);
      setError(null);

      // Restore isActive from server state — last punch determines current status
      if (uniquePunches.length > 0) {
        const lastPunch = uniquePunches[0]; // sorted descending, so [0] = latest
        const active = lastPunch.punch_type === 'PUNCH_IN';
        setIsActive(active);
        if (IS_DEV) console.log('[Punch] Restored isActive:', active, 'from last punch type:', lastPunch.punch_type);

        // trackingStartTime/LocationService's route-point distance are both
        // pure in-memory session state — they reset to nothing whenever this
        // JS runtime restarts (app reopen, background kill, or an app
        // update — Android kills the process to install the new APK) even
        // though the punch-in session itself is still open server-side.
        // Without this, the Home Screen's Distance/working-time display
        // silently drops to 0 for an employee who is still actively clocked
        // in. Re-seed both from the server's own record of the active
        // session so they resume from the truth instead of from zero.
        if (active) {
          trackingStartTime.current = new Date(lastPunch.punched_at).getTime();
          // lastPunch.total_distance_day is a snapshot taken AT punch-in
          // time, not updated again until the next punch — using it alone
          // means every km walked since punch-in (the entire point of a
          // restore-after-restart) is missing until the next punch event.
          // apps.livetracking's LiveSession.total_distance is the real,
          // continuously-updated distance for the session in progress, so
          // ADD it to the punch-chain snapshot rather than replacing it —
          // total_distance_day already covers everything up through this
          // punch-in (including any earlier, already-closed sessions today),
          // and the live session covers movement since punch-in, so summing
          // reconstructs the full day instead of discarding earlier sessions.
          LocationService.setBaseDistance(lastPunch.total_distance_day);
          try {
            const liveRes = await api.getActiveLiveSession();
            if (liveRes.data?.active && liveRes.data.session?.total_distance != null) {
              LocationService.setBaseDistance(
                Number(lastPunch.total_distance_day || 0) + Number(liveRes.data.session.total_distance || 0)
              );
            }
            // Seed display marks from the persisted server session (phase +
            // remaining are derived at render from these absolute instants).
            if (liveRes.data?.active && liveRes.data.session) {
              const s = liveRes.data.session;
              const ph = liveRes.data.phase || {};
              setTrackingMarks({
                startIso: s.start_time || null,
                maxDurationEndsAt: ph.max_duration_ends_at || s.max_duration_ends_at || null,
                absoluteExpiresAt: ph.absolute_expires_at || s.absolute_expires_at || null,
              });
            } else {
              setTrackingMarks(null);
            }
          } catch (e) {
            if (IS_DEV) console.warn('[Punch] getActiveLiveSession restore error:', e.message);
          }
        } else {
          trackingStartTime.current = null;
          setTrackingMarks(null);
          LocationService.setBaseDistance(0);
        }
      } else {
        setIsActive(false);
        trackingStartTime.current = null;
        setTrackingMarks(null);
        LocationService.setBaseDistance(0);
      }
    } catch (err) {
      // 401 is already handled by the axios interceptor (session-expired flow)
      // Logging or setting error for 401 causes duplicate noise in LogBox.
      // 403 LEGAL_ACKNOWLEDGEMENT_REQUIRED is the server-side legal gate: the
      // LegalGate screen takes over the UI (it re-checks /legal/status/), so
      // surfacing it here would only duplicate an already-visible screen.
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      if (status !== 401 && !(status === 403 && code === 'LEGAL_ACKNOWLEDGEMENT_REQUIRED')) {
        const { message } = parseApiError(err);
        setError(message);
      }
    } finally {
      setInitialFetchDone(true);
    }
  }, []);

  const checkPendingAutoClosure = useCallback(async () => {
    try {
      const res = await api.getLastAutoClosure();
      setPendingAutoClosure(res.data?.pending ? res.data : null);
    } catch (err) {
      // Best-effort only — a failure here must never block the punch screen.
      if (IS_DEV) console.warn('[Punch] checkPendingAutoClosure error:', err.message);
    }
  }, []);

  const submitForgotPunchRequest = useCallback(async (employeeRemarks) => {
    if (!pendingAutoClosure?.session?.id) {
      return { success: false, error: 'No auto-closed session to submit' };
    }
    try {
      await api.submitForgotPunchRequest({
        session: pendingAutoClosure.session.id,
        employee_remarks: employeeRemarks || '',
      });
      setPendingAutoClosure(null);
      return { success: true };
    } catch (err) {
      const { message } = parseApiError(err);
      return { success: false, error: message };
    }
  }, [pendingAutoClosure]);

  const fetchLocation = useCallback(async () => {
    setPunchState(STATES.FETCHING_LOCATION);
    setErrorMessage(null);
    setSuccess(false);

    try {
      // Request background + notification permissions here too (not just
      // foreground), so live route tracking works the moment this punch-in
      // completes — bundled into the same user-initiated action instead of
      // prompting at app launch before the user has done anything. Awaited
      // (not fire-and-forget) since the OS can only show one permission
      // dialog at a time — running this concurrently with the foreground
      // location request below could make one of the two prompts misfire.
      try {
        await LiveTrackingService.bootstrapPermissions();
      } catch (e) {
        if (IS_DEV) console.warn('[Punch] Permission bootstrap error:', e.message);
      }

      const location = await captureFieldActivityLocation();

      if (location.error) {
        setPunchState(STATES.ERROR);
        setErrorMessage(location.error);
        return { success: false, error: location.error, errorType: location.errorType };
      }

      // Reverse-geocode the fix into a human-readable address (Google, with
      // an on-device coordinate fallback if the API/network is unavailable).
      let address = location.address || '';
      try {
        const geo = await reverseGeocodeWithTimeout(location.latitude, location.longitude);
        address = geo?.fullAddress || geo?.shortAddress || address;
      } catch (e) {
        if (IS_DEV) console.warn('[Punch] Reverse geocode failed:', e.message);
      }
      if (!address) {
        address = `${location.latitude?.toFixed(5)}, ${location.longitude?.toFixed(5)}`;
      }

      setCapturedLocation({
        latitude: location.latitude,
        longitude: location.longitude,
        current_address: address,
        accuracy: location.accuracy,
        speed: location.speed,
        isMock: location.isMock,
        altitude: location.altitude,
        heading: location.heading,
        battery_level: location.battery_level,
        is_mock_location: location.is_mock_location,
        mock_detection_method: location.mock_detection_method,
        gps_provider: location.gps_provider,
        network_status: location.network_status,
        device_timestamp: location.device_timestamp,
        location_source: location.location_source,
      });
      
      setIsMockLocation(location.isMock || false);
      setPunchState(STATES.FORM_OPEN);
      
      return { success: true, location: { ...location, current_address: address } };
    } catch (err) {
      const errorMsg = err?.message || 'Failed to get location';
      setPunchState(STATES.ERROR);
      setErrorMessage(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  const punchIn = useCallback(async (formData, locationData) => {
    setPunchState(STATES.SUBMITTING);
    setErrorMessage(null);
    setSuccess(false);

    // Declared outside the try block so the catch handler can still queue
    // it for offline sync on a network failure.
    let payload;
    try {
      payload = {
        // Generated once per real submission, reused unchanged for both the
        // live attempt and the offline-queued retry (if it falls through to
        // that) — see AttendancePunch.client_transaction_id server-side.
        client_transaction_id: generateTransactionId(),
        punch_type: 'PUNCH_IN',  // Always PUNCH_IN for initial punch
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.current_address || '',
        accuracy: locationData.accuracy ?? null,
        altitude: locationData.altitude ?? null,
        heading: locationData.heading ?? null,
        battery_level: locationData.battery_level ?? null,
        is_mock_location: locationData.is_mock_location ?? false,
        mock_detection_method: locationData.mock_detection_method || '',
        gps_provider: locationData.gps_provider || '',
        network_status: locationData.network_status || '',
        device_timestamp: locationData.device_timestamp || undefined,
        location_source: locationData.location_source || 'LIVE',
        customer_name: formData.customer_name || '',
        customer_phone: formData.customer_phone || '',
        reason: formData.reason || '',
        visit_type: formData.visit_type || 'VISIT',
        loan_id: formData.loan_id || '',
        amount: formData.amount ? parseFloat(formData.amount) : null,
        payment_method: formData.payment_mode || '',
        upi_ref: formData.upi_ref || '',
        cheque_no: formData.cheque_no || '',
        travel_type: formData.travel_with || 'ALONE',
        co_employee_id: formData.co_employee_id || '',
        companion_name: formData.co_employee_name || '',
        companion_phone: formData.co_employee_phone || '',
        vehicle_number: formData.vehicle_number || '',
      };

      if (IS_DEV) console.log('[Punch] Submitting punch:', JSON.stringify(payload, null, 2));

      const res = await api.post('/attendance/punches/', payload);

      if (IS_DEV) console.log('[Punch] Success:', JSON.stringify(res.data, null, 2));

      setIsActive(true);
      setPunchState(STATES.IDLE);
      setSuccess(true);
      trackingStartTime.current = Date.now();
      routePoints.current = [];

      // The distance this shift shows comes from the SERVER's trusted route
      // (see refreshTrustedDistance below) - the same road-matched figure the
      // Route Map draws. A local, second watchPosition counter used to run
      // alongside the live-tracking engine purely to fill the "Live Stats"
      // card. It produced a DIFFERENT number for the same shift: a raw
      // point-to-point chain that knew nothing about GPS gaps, rejected
      // outliers or the road network, and it doubled the high-accuracy GPS
      // listeners for no capture benefit (it never uploaded anything). One
      // engine, one number.

      // Server-orchestrated GPS tracking engine (Milestone 1): the backend
      // already opened this employee's LiveSession as part of the punch-in
      // call above (apps.livetracking.orchestration.start_session_for_punch)
      // — attach() hands that existing session id to the native/background
      // capture path instead of opening a second one.
      const liveSessionId = res.data?.live_session_id;
      if (liveSessionId) {
        LiveTrackingService.attach(liveSessionId, {
          battery_level: locationData.battery_level ?? null,
        }).catch((e) => {
          if (IS_DEV) console.warn('[Punch] Live attach error:', e.message);
        });
      } else if (IS_DEV) {
        console.warn('[Punch] No live_session_id on punch-in response — background tracking not started');
      }

      await fetchTodayPunches();

      return { success: true, data: res.data };
    } catch (err) {
      if (IS_DEV) console.error('[Punch] Error:', err?.response?.data || err.message);
      if (isNetworkError(err)) {
        await enqueue('PUNCH_IN', payload);
        setPunchState(STATES.IDLE);
        setErrorMessage(null);
        return {
          success: false,
          queuedOffline: true,
          error: "No internet connection. Your punch has been saved on this device and will sync automatically once you're back online.",
        };
      }

      const parsed = parseApiError(err);
      const errorMsg = parsed.reference ? `${parsed.message}\n\nRef: ${parsed.reference}` : parsed.message;
      setPunchState(STATES.ERROR);
      setErrorMessage(errorMsg);
      return { success: false, error: errorMsg, code: parsed.code, reference: parsed.reference };
    }
  }, [fetchTodayPunches]);

  // Called by the unified Collection Visit flow (CollectionVisitScreen) after
  // api.completeVisit() succeeds — that endpoint already did the actual
  // PUNCH_IN server-side (via AttendancePunchViewSet.create(), reused
  // internally), so this just mirrors punchIn()'s success branch (client
  // state + starting the background tracking engine) instead of re-punching.
  const registerExternalPunchIn = useCallback(async (responseData, locationData = {}) => {
    setIsActive(true);
    setPunchState(STATES.IDLE);
    setSuccess(true);
    trackingStartTime.current = Date.now();
    routePoints.current = [];

    LocationService.startTracking().catch((e) => {
      if (IS_DEV) console.warn('[Punch] Local distance tracking error:', e.message);
    });

    const liveSessionId = responseData?.live_session_id;
    if (liveSessionId) {
      LiveTrackingService.attach(liveSessionId, {
        battery_level: locationData.battery_level ?? null,
      }).catch((e) => {
        if (IS_DEV) console.warn('[Punch] Live attach error:', e.message);
      });
    } else if (IS_DEV) {
      console.warn('[Punch] No live_session_id on complete_visit response — background tracking not started');
    }

    await fetchTodayPunches();
  }, [fetchTodayPunches]);

  const punchOut = useCallback(async () => {
    setPunchState(STATES.PUNCHING_OUT);
    setErrorMessage(null);
    setSuccess(false);

    // Declared outside the try block so the catch handler can still queue
    // it for offline sync on a network failure — mirrors punchIn()'s pattern.
    let payload;
    try {
      // Try to get a fresh GPS fix for punch out accuracy. Never fabricate
      // (0, 0) as a fallback — a real production bug this replaced: when
      // capturedLocation was null (e.g. the app restarted between punch-in
      // and punch-out, resetting this in-memory state) the old `|| 0`
      // default silently submitted exact null-island coordinates, which
      // the backend correctly rejects as INVALID_COORD. The fallback chain
      // is now: fresh GPS (captureFieldActivityLocation already retries
      // live GPS and falls back to LocationService's own persisted
      // last-known-good fix internally) → this session's punch-in reading,
      // still real coordinates, never a fabricated default → a clear
      // client-side error instead of ever submitting nothing.
      let lat, lng, address, accuracy, gpsExtra;
      // Generated once per tap, before any network attempt, and reused
      // unchanged if this falls through to the offline queue below — same
      // pattern as punchIn()'s client_transaction_id.
      const clientTransactionId = generateTransactionId();

      const currentLocation = await captureFieldActivityLocation();
      if (!currentLocation.error) {
        lat = currentLocation.latitude;
        lng = currentLocation.longitude;
        accuracy = currentLocation.accuracy ?? null;
        address = capturedLocation?.current_address || '';
        gpsExtra = {
          altitude: currentLocation.altitude ?? null,
          heading: currentLocation.heading ?? null,
          battery_level: currentLocation.battery_level ?? null,
          is_mock_location: currentLocation.is_mock_location ?? false,
          mock_detection_method: currentLocation.mock_detection_method || '',
          gps_provider: currentLocation.gps_provider || '',
          network_status: currentLocation.network_status || '',
          device_timestamp: currentLocation.device_timestamp || undefined,
          location_source: currentLocation.location_source || 'LIVE',
        };
        try {
          const geo = await reverseGeocodeWithTimeout(lat, lng);
          address = geo?.fullAddress || geo?.shortAddress || address;
        } catch (geoErr) {
          if (IS_DEV) console.warn('[Punch] Reverse geocode failed on punch out:', geoErr.message);
        }
        if (!address) address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      } else if (capturedLocation?.latitude != null && capturedLocation?.longitude != null) {
        // captureFieldActivityLocation() already tried live GPS (with retries) and
        // its own persisted cache — this in-session punch-in reading is a
        // last resort on top of that, still a real captured fix, not a
        // fabricated one.
        lat = capturedLocation.latitude;
        lng = capturedLocation.longitude;
        address = capturedLocation.current_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        accuracy = capturedLocation.accuracy ?? null;
        gpsExtra = {
          altitude: capturedLocation.altitude ?? null,
          heading: capturedLocation.heading ?? null,
          battery_level: capturedLocation.battery_level ?? null,
          is_mock_location: capturedLocation.is_mock_location ?? false,
          mock_detection_method: capturedLocation.mock_detection_method || '',
          gps_provider: capturedLocation.gps_provider || '',
          network_status: capturedLocation.network_status || '',
          device_timestamp: capturedLocation.device_timestamp || undefined,
          location_source: 'CACHED',
        };
        if (IS_DEV) console.warn('[Punch] Live GPS unavailable for punch out, using this session\'s punch-in location');
      } else {
        // Nothing usable anywhere — a clear client-side error beats a
        // confusing server-side "null-island" rejection.
        const errorMsg = currentLocation.error || 'Could not get your location. Please try again.';
        setPunchState(STATES.ERROR);
        setErrorMessage(errorMsg);
        return { success: false, error: errorMsg };
      }

      payload = {
        client_transaction_id: clientTransactionId,
        punch_type: 'PUNCH_OUT',
        latitude: lat,
        longitude: lng,
        address,
        accuracy,
        ...gpsExtra,
        notes: 'Punch Out',
      };

      if (IS_DEV) console.log('[Punch] Submitting punch out:', JSON.stringify(payload, null, 2));

      // Stop the local distance-stat tracker (now a no-op that only clears the
      // retired local counters - see the note at punch-in). Synchronous, not
      // Promise-based: it catches its own errors and never throws, so no
      // .catch() here (chaining one on a non-Promise return value throws
      // "Cannot read property 'catch' of undefined" on every call).
      LocationService.stopTracking();

      // Detach from the server-orchestrated tracking engine — flushes any
      // buffered points and stops native capture. The backend itself closes
      // the LiveSession as part of the punch-out call below.
      await LiveTrackingService.detach().catch((e) => {
        if (IS_DEV) console.warn('[Punch] Live detach error:', e.message);
      });

      await api.post('/attendance/punches/', payload);

      if (IS_DEV) console.log('[Punch] Punch out success');

      setIsActive(false);
      setPunchState(STATES.IDLE);
      setSuccess(true);
      setCapturedLocation(null);
      trackingStartTime.current = null;
      setTrackingMarks(null);
      routePoints.current = [];

      await fetchTodayPunches();

      return { success: true };
    } catch (err) {
      if (IS_DEV) console.error('[Punch] Punch out failed:', err?.response?.data || err.message);
      if (isNetworkError(err) && payload) {
        await enqueue('PUNCH_OUT', payload);
        setIsActive(false);
        setPunchState(STATES.IDLE);
        setCapturedLocation(null);
        trackingStartTime.current = null;
        setTrackingMarks(null);
        routePoints.current = [];
        setErrorMessage(null);
        return {
          success: false,
          queuedOffline: true,
          error: "No internet connection. Your punch out has been saved on this device and will sync automatically once you're back online.",
        };
      }

      const parsed = parseApiError(err);
      const errorMsg = parsed.reference ? `${parsed.message}\n\nRef: ${parsed.reference}` : parsed.message;
      setPunchState(STATES.ERROR);
      setErrorMessage(errorMsg);
      return { success: false, error: errorMsg, code: parsed.code, reference: parsed.reference };
    }
  }, [capturedLocation, fetchTodayPunches]);

  const resetForm = useCallback(() => {
    setPunchState(STATES.IDLE);
    setCapturedLocation(null);
    setErrorMessage(null);
    setSuccess(false);
  }, []);

  const dismissError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setErrorMessage(null);
  }, []);

  const getTotalDistance = useCallback(() => {
    // The OFFICIAL distance for the current shift: the backend's trusted
    // route distance, measured along the road-matched geometry the Route Map
    // draws. Null until the server has a complete answer - and null when it
    // could not match part of the route, because a number that disagrees with
    // the map is worse than no number.
    return trustedDistanceKm;
  }, [trustedDistanceKm]);

  const getTrackingDuration = useCallback(() => {
    if (!trackingStartTime.current) return 0;
    const durationMs = Date.now() - trackingStartTime.current;
    return Math.floor(durationMs / 60000);
  }, []);

  useEffect(() => {
    fetchTodayPunches();
    checkPendingAutoClosure();
  }, [fetchTodayPunches, checkPendingAutoClosure]);

  // Keep the official distance current. The backend rebuilds the day's trusted
  // route as fixes arrive, so this converges on the same figure the Route Map
  // shows. Polled only while a shift is running - on a fixed interval, and not
  // at all when offline, because the request is uncacheable by design and
  // hammering it in the background would drain the battery for a number that
  // only changes when a batch is flushed.
  useEffect(() => {
    refreshTrustedDistance();
    if (!isActive) return undefined;
    // A failed request is a no-op that keeps the last good value, so a briefly
    // offline phone does not need a connectivity guard here - it simply costs
    // one failed request per interval.
    const timer = setInterval(refreshTrustedDistance, 60000);
    return () => clearInterval(timer);
  }, [isActive, refreshTrustedDistance]);

  const value = useMemo(() => ({
    punches,
    loading,
    error,
    errorMessage,
    success,
    punchState,
    isActive,
    isIdle: punchState === STATES.IDLE,
    isTracking: isActive,
    isMockLocation,
    capturedLocation,
    todayPunches: punches,
    initialFetchDone,
    fetchTodayPunches,
    addPunch: punchIn,
    punchIn,
    punchOut,
    registerExternalPunchIn,
    fetchLocation,
    resetForm,
    dismissError,
    clearError,
    getTotalDistance,
    getTrackingDuration,
    dailySummary,
    distanceKm: trustedDistanceKm,
    trackingStatus: trustedRouteStatus,
    refreshTrustedDistance,
    LocationService,
    trackingMarks,
    pendingAutoClosure,
    checkPendingAutoClosure,
    submitForgotPunchRequest,
  }), [
    punches, loading, error, errorMessage, success, punchState, isActive,
    isMockLocation, capturedLocation, initialFetchDone, fetchTodayPunches, punchIn, punchOut, registerExternalPunchIn,
    fetchLocation, resetForm, dismissError, clearError, getTotalDistance, getTrackingDuration,
    dailySummary, trustedDistanceKm, trustedRouteStatus, refreshTrustedDistance,
    trackingMarks, pendingAutoClosure, checkPendingAutoClosure, submitForgotPunchRequest,
  ]);

  return <PunchContext.Provider value={value}>{children}</PunchContext.Provider>;
};

export const usePunch = () => {
  const ctx = useContext(PunchContext);
  if (!ctx) {
    if (IS_DEV) console.warn('usePunch: Context is null, returning safe defaults');
    return {
      punches: [],
      loading: false,
      error: null,
      errorMessage: null,
      success: false,
      punchState: STATES.IDLE,
      isActive: false,
      isIdle: true,
      isTracking: false,
      isMockLocation: false,
      capturedLocation: null,
      todayPunches: [],
      initialFetchDone: false,
      fetchTodayPunches: () => {},
      addPunch: () => Promise.resolve({ success: false, error: 'Context not ready' }),
      punchIn: () => Promise.resolve({ success: false, error: 'Context not ready' }),
      punchOut: () => Promise.resolve({ success: false, error: 'Context not ready' }),
      registerExternalPunchIn: () => Promise.resolve(),
      fetchLocation: () => Promise.resolve({ success: false, error: 'Context not ready' }),
      resetForm: () => {},
      dismissError: () => {},
      clearError: () => {},
      getTotalDistance: () => 0,
      getTrackingDuration: () => 0,
      dailySummary: null,
      distanceKm: null,
      trackingStatus: null,
      refreshTrustedDistance: () => {},
      LocationService: null,
      trackingMarks: null,
      pendingAutoClosure: null,
      checkPendingAutoClosure: () => {},
      submitForgotPunchRequest: () => Promise.resolve({ success: false, error: 'Context not ready' }),
    };
  }
  return ctx;
};

export default PunchContext;