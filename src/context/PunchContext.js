import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import LocationService from '../services/LocationService';

const PunchContext = createContext(null);

export const STATES = {
  IDLE: 'IDLE',
  FETCHING_LOCATION: 'FETCHING_LOCATION',
  FORM_OPEN: 'FORM_OPEN',
  SUBMITTING: 'SUBMITTING',
  TRACKING: 'TRACKING',
  PUNCHING_OUT: 'PUNCHING_OUT',
  ERROR: 'ERROR',
};

const STORAGE_KEYS = {
  TRACKING_SESSION_ID: '@punch_tracking_session_id',
  PUNCH_ACTIVE: '@punch_active',
};

const initialState = {
  punchState: STATES.IDLE,
  isActive: false,
  isIdle: true,
  isLoading: false,
  trackingSessionId: null,
  currentPunch: null,
  todayPunches: [],
  capturedLocation: null,
  isMockLocation: false,
  error: null,
  success: false,
  errorMessage: null,
};

export const PunchProvider = ({ children }) => {
  const [data, setData] = useState(initialState);
  const lastClickTime = useRef(0);
  const DEBOUNCE_MS = 2000;

  useEffect(() => {
    loadSavedSession();
    fetchTodayPunches();
  }, []);

  const setPunchState = (updates) => {
    setData((prev) => {
      const next = { ...prev, ...updates };
      next.isActive = [STATES.TRACKING, STATES.PUNCHING_OUT].includes(next.punchState);
      next.isIdle = next.punchState === STATES.IDLE;
      next.isLoading = [STATES.FETCHING_LOCATION, STATES.SUBMITTING, STATES.PUNCHING_OUT].includes(next.punchState);
      return next;
    });
  };

  const loadSavedSession = async () => {
    try {
      const sessionId = await AsyncStorage.getItem(STORAGE_KEYS.TRACKING_SESSION_ID);
      const isActive = await AsyncStorage.getItem(STORAGE_KEYS.PUNCH_ACTIVE);

      if (sessionId && isActive === 'true') {
        setPunchState({
          punchState: STATES.TRACKING,
          trackingSessionId: sessionId,
        });
      }
    } catch (err) {
      console.error('[Punch] Load session error:', err);
    }
  };

  const fetchTodayPunches = async () => {
    try {
      const res = await api.get('/attendance/punches/today_punches/');
      const rawPunches = Array.isArray(res.data) ? res.data : [];
      const seen = new Set();
      const uniquePunches = rawPunches.filter(p => {
        if (!p?.id) return true;
        if (seen.has(p.id)) {
          console.warn('[Punch] Duplicate punch ID:', p.id);
          return false;
        }
        seen.add(p.id);
        return true;
      });
      console.log('[Punch] Today punches - Raw:', rawPunches.length, 'Unique:', uniquePunches.length);
      setData((prev) => ({ ...prev, todayPunches: uniquePunches }));
    } catch (err) {
      console.error('[Punch] Fetch punches error:', err);
    }
  };

  const canProcessClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClickTime.current < DEBOUNCE_MS) {
      return false;
    }
    lastClickTime.current = now;
    return true;
  }, []);

  const fetchLocation = useCallback(async () => {
    if (!canProcessClick()) {
      return { success: false, error: 'Please wait...' };
    }

    setPunchState({
      punchState: STATES.FETCHING_LOCATION,
      error: null,
      errorMessage: null,
    });

    try {
      const location = await LocationService.getCurrentLocation();

      if (location.error) {
        setPunchState({
          punchState: STATES.IDLE,
          error: true,
          errorMessage: location.error,
        });
        return { success: false, error: location.error };
      }

      const address = location.address || await LocationService.reverseGeocode(
        location.latitude,
        location.longitude
      );

      const capturedLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
        current_address: address,
        accuracy: location.accuracy,
        speed: location.speed,
        isMock: location.isMock,
      };

      setPunchState({
        punchState: STATES.FORM_OPEN,
        capturedLocation,
        isMockLocation: location.isMock,
      });

      return { success: true, location: capturedLocation };
    } catch (err) {
      console.error('[Punch] Location error:', err);
      const errorMsg = 'Failed to get location. Please try again.';
      setPunchState({
        punchState: STATES.IDLE,
        error: true,
        errorMessage: errorMsg,
      });
      return { success: false, error: errorMsg };
    }
  }, [canProcessClick]);

  const punchIn = useCallback(async (formData, location) => {
    setPunchState({
      punchState: STATES.SUBMITTING,
      error: null,
      errorMessage: null,
    });

    try {
      if (!location || !location.latitude || !location.longitude) {
        throw new Error('Location not available');
      }

      const payload = {
        punch_type: 'PUNCH_IN',
        latitude: location.latitude,
        longitude: location.longitude,
        current_address: location.current_address || '',
        customer_address: formData?.customer_address || '',
        reason: formData?.reason || '',
        notes: formData?.reason || '',
        visit_type: formData?.visit_type || 'OTHER',
        loan_id: formData?.loan_id || '',
        amount: formData?.amount ? parseFloat(formData.amount) : null,
        payment_mode: formData?.payment_mode || '',
        upi_ref: formData?.upi_ref || '',
        cheque_no: formData?.cheque_no || '',
        customer_name: formData?.customer_name || '',
        travel_with: formData?.travel_with || 'ALONE',
        co_employee_id: formData?.co_employee_id || '',
        co_employee_name: formData?.co_employee_name || '',
        vehicle_number: formData?.vehicle_number || '',
      };

      console.log('[Punch] Punch In payload:', JSON.stringify(payload, null, 2));

      const response = await api.createPunchRecord(payload);
      const punchData = response.data;

      console.log('[Punch] Punch In response:', JSON.stringify(punchData, null, 2));

      const trackingSessionId = punchData?.tracking_session_id;

      if (trackingSessionId) {
        await AsyncStorage.setItem(STORAGE_KEYS.TRACKING_SESSION_ID, String(trackingSessionId));
        await AsyncStorage.setItem(STORAGE_KEYS.PUNCH_ACTIVE, 'true');
      }

      setPunchState({
        punchState: STATES.TRACKING,
        isActive: true,
        isIdle: false,
        success: true,
        error: null,
        errorMessage: null,
        trackingSessionId,
        currentPunch: punchData,
      });

      await fetchTodayPunches();

      setTimeout(() => {
        setData((prev) => ({ ...prev, success: false }));
      }, 3000);

      return { success: true, data: punchData, trackingSessionId };
    } catch (err) {
      console.error('[Punch] Punch In error:', err);
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.join(', ') ||
        err.message ||
        'Failed to punch in. Please try again.';

      setPunchState({
        punchState: STATES.IDLE,
        error: true,
        errorMessage: errorMsg,
      });

      setTimeout(() => {
        setData((prev) => ({ ...prev, error: false, errorMessage: null }));
      }, 5000);

      return { success: false, error: errorMsg };
    }
  }, []);

  const punchOut = useCallback(async () => {
    if (!data.isActive) {
      return { success: false, error: 'No active punch' };
    }

    setPunchState({
      punchState: STATES.PUNCHING_OUT,
      error: null,
      errorMessage: null,
    });

    try {
      const location = LocationService.lastLocation || data.currentPunch;

      const payload = {
        punch_type: 'PUNCH_OUT',
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
        current_address: location?.address || '',
        notes: 'Punch Out',
      };

      console.log('[Punch] Punch Out payload:', JSON.stringify(payload, null, 2));

      const response = await api.punchOut(data.trackingSessionId, payload);
      const punchData = response.data;

      console.log('[Punch] Punch Out response:', JSON.stringify(punchData, null, 2));

      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TRACKING_SESSION_ID,
        STORAGE_KEYS.PUNCH_ACTIVE,
      ]);

      LocationService.stopTracking();
      LocationService.clearRoute();

      setPunchState({
        ...initialState,
        todayPunches: data.todayPunches,
        success: true,
      });

      await fetchTodayPunches();

      setTimeout(() => {
        setData((prev) => ({ ...prev, success: false }));
      }, 3000);

      return {
        success: true,
        data: punchData,
        totalDistance: punchData?.total_tracking_distance || 0
      };
    } catch (err) {
      console.error('[Punch] Punch Out error:', err);
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err.message ||
        'Failed to punch out. Please try again.';

      setPunchState({
        punchState: STATES.TRACKING,
        error: true,
        errorMessage: errorMsg,
      });

      setTimeout(() => {
        setData((prev) => ({ ...prev, error: false, errorMessage: null }));
      }, 5000);

      return { success: false, error: errorMsg };
    }
  }, [data.isActive, data.trackingSessionId, data.currentPunch, data.todayPunches]);

  const resetForm = useCallback(() => {
    setPunchState({
      capturedLocation: null,
      isMockLocation: false,
      punchState: data.isActive ? STATES.TRACKING : STATES.IDLE,
    });
  }, [data.isActive]);

  const dismissError = useCallback(() => {
    setPunchState({
      error: false,
      errorMessage: null,
      punchState: data.isActive ? STATES.TRACKING : STATES.IDLE,
    });
  }, [data.isActive]);

  const getTotalDistance = useCallback(() => {
    return LocationService.getTotalDistance();
  }, []);

  const getTrackingDuration = useCallback(() => {
    if (!data.currentPunch?.punched_at) return 0;
    const start = new Date(data.currentPunch.punched_at);
    return Math.floor((Date.now() - start.getTime()) / 60000);
  }, [data.currentPunch?.punched_at]);

  const value = {
    punchState: data.punchState,
    isActive: data.isActive,
    isIdle: data.isIdle,
    isLoading: data.isLoading,
    isTracking: data.punchState === STATES.TRACKING,
    isMockLocation: data.isMockLocation,
    capturedLocation: data.capturedLocation,
    trackingSessionId: data.trackingSessionId,
    currentPunch: data.currentPunch,
    todayPunches: data.todayPunches,
    error: data.error,
    errorMessage: data.errorMessage,
    success: data.success,
    punchIn,
    punchOut,
    fetchLocation,
    resetForm,
    dismissError,
    fetchTodayPunches,
    getTotalDistance,
    getTrackingDuration,
    LocationService,
  };

  return <PunchContext.Provider value={value}>{children}</PunchContext.Provider>;
};

export const usePunch = () => {
  const ctx = useContext(PunchContext);
  if (!ctx) {
    console.warn('usePunch: Context is null, returning safe defaults');
    return {
      punchState: STATES.IDLE,
      isActive: false,
      isIdle: true,
      isLoading: false,
      isTracking: false,
      isMockLocation: false,
      capturedLocation: null,
      trackingSessionId: null,
      currentPunch: null,
      todayPunches: [],
      error: false,
      errorMessage: null,
      success: false,
      punchIn: () => Promise.resolve({ success: false, error: 'Context not ready' }),
      punchOut: () => Promise.resolve({ success: false, error: 'Context not ready' }),
      fetchLocation: () => Promise.resolve({ success: false, error: 'Context not ready' }),
      resetForm: () => {},
      dismissError: () => {},
      fetchTodayPunches: () => {},
      getTotalDistance: () => 0,
      getTrackingDuration: () => 0,
      LocationService: null,
    };
  }
  return ctx;
};

export default PunchContext;
