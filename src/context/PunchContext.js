import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import LocationService from '../services/LocationService';
import GeocodingService from '../services/GeocodingService';
import BackgroundTrackingService from '../services/BackgroundTrackingService';
import LiveTrackingService from '../services/LiveTrackingService';
import { parseApiError } from '../core/error/AppErrorHandler';

const IS_DEV = __DEV__;
const GEOCODE_TIMEOUT_MS = 6000;

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
  const [error, setError] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [punchState, setPunchState] = useState(STATES.IDLE);
  const [isActive, setIsActive] = useState(false);
  const [capturedLocation, setCapturedLocation] = useState(null);
  const [isMockLocation, setIsMockLocation] = useState(false);
  
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
    }
  }, []);

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

      const location = await LocationService.getCurrentLocation();

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
    
    try {
      const payload = {
        punch_type: 'PUNCH_IN',  // Always PUNCH_IN for initial punch
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.current_address || '',
        accuracy: locationData.accuracy ?? null,
        customer_name: formData.customer_name || '',
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

      // Auto-start background route tracking using the session created by the backend
      const trackingSessionId = res.data?.tracking_session_id;
      if (trackingSessionId) {
        BackgroundTrackingService.start(trackingSessionId).catch((e) => {
          if (IS_DEV) console.warn('[Punch] BTS start error:', e.message);
        });
      }

      // Separate live route tracker (10s GPS pings) — independent session.
      LiveTrackingService.start().catch((e) => {
        if (IS_DEV) console.warn('[Punch] Live start error:', e.message);
      });

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

      try {
        const currentLocation = await LocationService.getCurrentLocation();
        if (!currentLocation.error) {
          lat = currentLocation.latitude;
          lng = currentLocation.longitude;
          accuracy = currentLocation.accuracy ?? accuracy;
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
        notes: 'Punch Out',
      };

      if (IS_DEV) console.log('[Punch] Submitting punch out:', JSON.stringify(payload, null, 2));

      // Flush remaining GPS points to backend before submitting punch-out
      await BackgroundTrackingService.stop().catch((e) => {
        if (IS_DEV) console.warn('[Punch] BTS stop error:', e.message);
      });

      // Stop the separate live route tracker and flush remaining pings.
      await LiveTrackingService.stop().catch((e) => {
        if (IS_DEV) console.warn('[Punch] Live stop error:', e.message);
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
  }, [fetchTodayPunches]);

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
    fetchTodayPunches,
    addPunch: punchIn,
    punchIn,
    punchOut,
    fetchLocation,
    resetForm,
    dismissError,
    clearError,
    getTotalDistance,
    getTrackingDuration,
    LocationService,
  }), [
    punches, loading, error, errorMessage, success, punchState, isActive, 
    isMockLocation, capturedLocation, fetchTodayPunches, punchIn, punchOut, 
    fetchLocation, resetForm, dismissError, clearError, getTotalDistance, getTrackingDuration
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
      fetchTodayPunches: () => {},
      addPunch: () => Promise.resolve({ success: false, error: 'Context not ready' }),
      punchIn: () => Promise.resolve({ success: false, error: 'Context not ready' }),
      punchOut: () => Promise.resolve({ success: false, error: 'Context not ready' }),
      fetchLocation: () => Promise.resolve({ success: false, error: 'Context not ready' }),
      resetForm: () => {},
      dismissError: () => {},
      clearError: () => {},
      getTotalDistance: () => 0,
      getTrackingDuration: () => 0,
      LocationService: null,
    };
  }
  return ctx;
};

export default PunchContext;