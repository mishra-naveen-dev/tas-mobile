import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import LocationService from '../services/LocationService';
import BackgroundTrackingService from '../services/BackgroundTrackingService';

const IS_DEV = __DEV__;

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
      
      const uniquePunches = Array.from(map.values());
      setPunches(uniquePunches.sort((a, b) => 
        new Date(b.punched_at) - new Date(a.punched_at)
      ));
    } catch (err) {
      if (IS_DEV) console.error('[Punch] Fetch error:', err);
      setError(err.message);
    }
  }, []);

  const fetchLocation = useCallback(async () => {
    setPunchState(STATES.FETCHING_LOCATION);
    setErrorMessage(null);
    setSuccess(false);
    
    try {
      const location = await LocationService.getCurrentLocation();
      
      if (location.error) {
        setPunchState(STATES.ERROR);
        setErrorMessage(location.error);
        return { success: false, error: location.error };
      }
      
      const address = location.address || `${location.latitude?.toFixed(5)}, ${location.longitude?.toFixed(5)}`;
      
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
        current_address: locationData.current_address || '',
        customer_address: formData.customer_address || '',
        customer_name: formData.customer_name || '',
        notes: formData.reason || '',
        visit_type: formData.visit_type || 'VISIT',
        loan_id: formData.loan_id || '',
        amount: formData.amount ? parseFloat(formData.amount) : null,
        payment_mode: formData.payment_mode || '',
        upi_ref: formData.upi_ref || '',
        cheque_no: formData.cheque_no || '',
        travel_with: formData.travel_with || 'ALONE',
        co_employee_id: formData.co_employee_id || '',
        co_employee_name: formData.co_employee_name || '',
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

      // Auto-start background route tracking using the session created by the backend
      const trackingSessionId = res.data?.tracking_session_id;
      if (trackingSessionId) {
        BackgroundTrackingService.start(trackingSessionId).catch((e) => {
          if (IS_DEV) console.warn('[Punch] BTS start error:', e.message);
        });
      }

      await fetchTodayPunches();

      return { success: true, data: res.data };
    } catch (err) {
      if (IS_DEV) console.error('[Punch] Error:', err?.response?.data || err.message);
      const errorMsg = err?.response?.data?.detail || 
                      err?.response?.data?.message ||
                      JSON.stringify(err?.response?.data) || 
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

      try {
        const currentLocation = await LocationService.getCurrentLocation();
        if (!currentLocation.error) {
          lat = currentLocation.latitude;
          lng = currentLocation.longitude;
          address = currentLocation.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
      } catch (locErr) {
        if (IS_DEV) console.warn('[Punch] GPS unavailable for punch out, using last known location');
      }

      const payload = {
        punch_type: 'PUNCH_OUT',
        latitude: lat,
        longitude: lng,
        current_address: address,
        notes: 'Punch Out',
      };

      if (IS_DEV) console.log('[Punch] Submitting punch out:', JSON.stringify(payload, null, 2));

      // Flush remaining GPS points to backend before submitting punch-out
      await BackgroundTrackingService.stop().catch((e) => {
        if (IS_DEV) console.warn('[Punch] BTS stop error:', e.message);
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
      const errorMsg = err?.response?.data?.detail || err?.message || 'Failed to punch out';
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