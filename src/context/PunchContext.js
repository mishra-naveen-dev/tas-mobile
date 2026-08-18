import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import LocationService from '../services/LocationService';
import { captureFieldActivityLocation } from '../hooks/useFieldActivityLocation';
import GeocodingService from '../services/GeocodingService';
import LiveTrackingService from '../services/LiveTrackingService';
import { parseApiError } from '../core/error/AppErrorHandler';
import { enqueue, isNetworkError, registerReplayer } from '../services/OfflineQueue';

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
      } else {
        setIsActive(false);
      }
    } catch (err) {
      // 401 is already handled by the axios interceptor (session-expired flow)
      // Logging or setting error for 401 causes duplicate noise in LogBox
      if (err?.response?.status !== 401) {
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
      const errorMsg = err?.response?.data?.error ||
                      err?.response?.data?.detail ||
                      err?.message || 'Failed to submit review request';
      return { success: false, error: errorMsg };
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
      // Only sent on resubmission after the operator confirms an out-of-range
      // punch with a reason (see the location_out_of_range handling below).
      if (formData.out_of_range_reason) {
        payload.out_of_range_reason = formData.out_of_range_reason;
        payload.out_of_range_comment = formData.out_of_range_comment || '';
      }
      // Only sent on resubmission after the operator confirms punching from
      // the same spot as another customer today (see same_location_duplicate
      // handling below).
      if (formData.duplicate_location_reason) {
        payload.duplicate_location_reason = formData.duplicate_location_reason;
        payload.duplicate_location_comment = formData.duplicate_location_comment || '';
      }

      if (IS_DEV) console.log('[Punch] Submitting punch:', JSON.stringify(payload, null, 2));

      const res = await api.post('/attendance/punches/', payload);

      if (IS_DEV) console.log('[Punch] Success:', JSON.stringify(res.data, null, 2));

      setIsActive(true);
      setPunchState(STATES.IDLE);
      setSuccess(true);
      trackingStartTime.current = Date.now();
      routePoints.current = [];

      // Lightweight, foreground-only live-distance counter powering the "Live
      // Stats" card on screen (getTotalDistance() below) — independent of the
      // server-orchestrated tracking engine, which is what actually keeps
      // recording once the app is backgrounded/killed (see LiveTrackingService
      // below). Not battery-critical since it only runs while this screen is
      // open, so a plain JS watch is fine here.
      LocationService.startTracking().catch((e) => {
        if (IS_DEV) console.warn('[Punch] Local distance tracking error:', e.message);
      });

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
      const respData = err?.response?.data;

      // Distinct from a hard failure — the operator can still punch after
      // picking a reason, so don't drop into the generic error state.
      if (respData?.error === 'location_out_of_range') {
        setPunchState(STATES.FORM_OPEN);
        return {
          success: false,
          locationOutOfRange: true,
          distanceM: respData.distance_m,
          error: respData.message,
        };
      }
      if (respData?.error === 'same_location_duplicate') {
        setPunchState(STATES.FORM_OPEN);
        return {
          success: false,
          sameLocationDuplicate: true,
          otherLoanId: respData.other_loan_id,
          error: respData.message,
        };
      }

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

      const errorMsg = respData?.error ||
                      respData?.detail ||
                      respData?.message ||
                      JSON.stringify(respData) ||
                      err?.message || 'Failed to punch in';
      setPunchState(STATES.ERROR);
      setErrorMessage(errorMsg);
      return { success: false, error: errorMsg };
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

    try {
      // Try to get a fresh GPS fix for punch out accuracy
      let lat = capturedLocation?.latitude || 0;
      let lng = capturedLocation?.longitude || 0;
      let address = capturedLocation?.current_address || '';
      let accuracy = capturedLocation?.accuracy ?? null;
      let gpsExtra = {
        altitude: capturedLocation?.altitude ?? null,
        heading: capturedLocation?.heading ?? null,
        battery_level: capturedLocation?.battery_level ?? null,
        is_mock_location: capturedLocation?.is_mock_location ?? false,
        mock_detection_method: capturedLocation?.mock_detection_method || '',
        gps_provider: capturedLocation?.gps_provider || '',
        network_status: capturedLocation?.network_status || '',
        device_timestamp: capturedLocation?.device_timestamp || undefined,
      };

      try {
        const currentLocation = await captureFieldActivityLocation();
        if (!currentLocation.error) {
          lat = currentLocation.latitude;
          lng = currentLocation.longitude;
          accuracy = currentLocation.accuracy ?? accuracy;
          gpsExtra = {
            altitude: currentLocation.altitude ?? null,
            heading: currentLocation.heading ?? null,
            battery_level: currentLocation.battery_level ?? null,
            is_mock_location: currentLocation.is_mock_location ?? false,
            mock_detection_method: currentLocation.mock_detection_method || '',
            gps_provider: currentLocation.gps_provider || '',
            network_status: currentLocation.network_status || '',
            device_timestamp: currentLocation.device_timestamp || undefined,
          };
          try {
            const geo = await reverseGeocodeWithTimeout(lat, lng);
            address = geo?.fullAddress || geo?.shortAddress || address;
          } catch (geoErr) {
            if (IS_DEV) console.warn('[Punch] Reverse geocode failed on punch out:', geoErr.message);
          }
          if (!address) address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
      } catch (locErr) {
        if (IS_DEV) console.warn('[Punch] GPS unavailable for punch out, using last known location');
      }

      const payload = {
        punch_type: 'PUNCH_OUT',
        latitude: lat,
        longitude: lng,
        address,
        accuracy,
        ...gpsExtra,
        notes: 'Punch Out',
      };

      if (IS_DEV) console.log('[Punch] Submitting punch out:', JSON.stringify(payload, null, 2));

      // Stop the local distance-stat tracker. Synchronous (not Promise-based)
      // — it already catches its own errors internally and never throws, so
      // no .catch() here (chaining one on a non-Promise return value throws
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
      routePoints.current = [];

      await fetchTodayPunches();

      return { success: true };
    } catch (err) {
      const errorMsg = err?.response?.data?.error || err?.response?.data?.detail || err?.message || 'Failed to punch out';
      setPunchState(STATES.ERROR);
      setErrorMessage(errorMsg);
      return { success: false, error: errorMsg };
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
    return LocationService.getTotalDistance();
  }, []);

  const getTrackingDuration = useCallback(() => {
    if (!trackingStartTime.current) return 0;
    const durationMs = Date.now() - trackingStartTime.current;
    return Math.floor(durationMs / 60000);
  }, []);

  useEffect(() => {
    fetchTodayPunches();
    checkPendingAutoClosure();
  }, [fetchTodayPunches, checkPendingAutoClosure]);

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
    LocationService,
    pendingAutoClosure,
    checkPendingAutoClosure,
    submitForgotPunchRequest,
  }), [
    punches, loading, error, errorMessage, success, punchState, isActive,
    isMockLocation, capturedLocation, initialFetchDone, fetchTodayPunches, punchIn, punchOut, registerExternalPunchIn,
    fetchLocation, resetForm, dismissError, clearError, getTotalDistance, getTrackingDuration,
    pendingAutoClosure, checkPendingAutoClosure, submitForgotPunchRequest,
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
      LocationService: null,
      pendingAutoClosure: null,
      checkPendingAutoClosure: () => {},
      submitForgotPunchRequest: () => Promise.resolve({ success: false, error: 'Context not ready' }),
    };
  }
  return ctx;
};

export default PunchContext;