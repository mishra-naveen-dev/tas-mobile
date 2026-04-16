import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import { logger } from '../core/monitoring/Logger';
import LocationService from '../services/LocationService';

const PunchContext = createContext(null);

export const PUNCH_STATES = {
  IDLE: 'IDLE',
  FETCHING_LOCATION: 'FETCHING_LOCATION',
  FORM_OPEN: 'FORM_OPEN',
  SUBMITTING: 'SUBMITTING',
  ACTIVE: 'ACTIVE',
  ERROR: 'ERROR',
};

const STORAGE_KEYS = {
  PUNCH_ACTIVE: '@punch_active',
  PUNCH_START_TIME: '@punch_start_time',
  TRACKING_COORDS: '@tracking_coords',
  PUNCH_LOCATION: '@punch_location',
};

const initialState = {
  punchState: PUNCH_STATES.IDLE,
  isActive: false,
  isIdle: true,
  punchStartTime: null,
  punchLocation: null,
  trackingCoords: [],
  currentLocation: null,
  todayPunches: [],
  capturedLocation: null,
  isMockLocation: false,
  locationError: null,
  submitError: null,
  submitSuccess: false,
  isLoading: false,
};

export const PunchProvider = ({ children }) => {
  const [state, setState] = useState(initialState);
  const watchIdRef = useRef(null);
  const lastClickTime = useRef(0);
  const DEBOUNCE_MS = 2000;

  useEffect(() => {
    loadPunchState();
    fetchTodayPunches();

    return () => {
      if (watchIdRef.current !== null) {
        LocationService.stopWatching();
      }
    };
  }, []);

  const setPunchState = (updates) => {
    setState((prev) => {
      const newState = { ...prev, ...updates };

      newState.isActive = newState.punchState === PUNCH_STATES.ACTIVE;
      newState.isIdle = newState.punchState === PUNCH_STATES.IDLE;

      return newState;
    });
  };

  const loadPunchState = async () => {
    try {
      const storedActive = await AsyncStorage.getItem(STORAGE_KEYS.PUNCH_ACTIVE);
      const storedStartTime = await AsyncStorage.getItem(STORAGE_KEYS.PUNCH_START_TIME);
      const storedCoords = await AsyncStorage.getItem(STORAGE_KEYS.TRACKING_COORDS);
      const storedLocation = await AsyncStorage.getItem(STORAGE_KEYS.PUNCH_LOCATION);

      if (storedCoords) {
        setPunchState({ trackingCoords: JSON.parse(storedCoords) });
      }

      if (storedLocation) {
        setPunchState({ punchLocation: JSON.parse(storedLocation) });
      }

      if (storedActive === 'true' && storedStartTime) {
        const startDate = new Date(storedStartTime);
        const today = new Date();

        if (startDate.toDateString() === today.toDateString()) {
          setPunchState({
            punchState: PUNCH_STATES.ACTIVE,
            punchStartTime: storedStartTime,
          });
          startRouteTracking();
        } else {
          await resetPunchState();
        }
      }
    } catch (err) {
      logger.error('Error loading punch state', { error: err.message });
    }
  };

  const resetPunchState = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.PUNCH_ACTIVE,
        STORAGE_KEYS.PUNCH_START_TIME,
        STORAGE_KEYS.TRACKING_COORDS,
        STORAGE_KEYS.PUNCH_LOCATION,
      ]);
      setPunchState({
        ...initialState,
        todayPunches: state.todayPunches,
      });
      stopRouteTracking();
    } catch (err) {
      logger.error('Error resetting punch state', { error: err.message });
    }
  };

  const startRouteTracking = async () => {
    try {
      const result = await LocationService.startWatching({
        interval: 30000,
        distanceFilter: 20,
      });

      if (result.success) {
        watchIdRef.current = true;
        LocationService.addListener(handleLocationUpdate);
      }
    } catch (err) {
      logger.error('Failed to start route tracking', { error: err.message });
    }
  };

  const stopRouteTracking = () => {
    if (watchIdRef.current) {
      LocationService.stopWatching();
      watchIdRef.current = null;
    }
  };

  const handleLocationUpdate = (location) => {
    if (location && LocationService.isValidLocation(location)) {
      setPunchState({ currentLocation: location });
      addTrackingCoord(location);
    }
  };

  const addTrackingCoord = (coord) => {
    const newCoord = {
      latitude: coord.latitude,
      longitude: coord.longitude,
      timestamp: coord.timestamp || Date.now(),
      accuracy: coord.accuracy || null,
      speed: coord.speed || null,
    };

    setState((prev) => {
      const updated = [...prev.trackingCoords, newCoord];
      if (updated.length > 1000) {
        updated.shift();
      }
      AsyncStorage.setItem(STORAGE_KEYS.TRACKING_COORDS, JSON.stringify(updated));
      return { ...prev, trackingCoords: updated };
    });
  };

  const fetchTodayPunches = async () => {
    try {
      const res = await api.get('/attendance/punches/today_punches/');
      const punches = res.data?.results || res.data || [];
      setState((prev) => ({ ...prev, todayPunches: punches }));
    } catch (err) {
      logger.error('Error fetching today punches', { error: err.message });
    }
  };

  const canProcessPunchClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClickTime.current < DEBOUNCE_MS) {
      logger.info('Punch click debounced');
      return false;
    }
    lastClickTime.current = now;
    return true;
  }, []);

  const fetchLocation = useCallback(async () => {
    logger.info('PunchContext: fetchLocation called');

    setPunchState({
      punchState: PUNCH_STATES.FETCHING_LOCATION,
      locationError: null,
      isLoading: true,
      capturedLocation: null,
      isMockLocation: false,
    });

    try {
      const locationData = await LocationService.getCurrentLocationInfo({
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 0,
        useCache: false,
        forceRefresh: true,
      });

      logger.info('PunchContext: Location result', locationData);

      if (locationData.error) {
        setPunchState({
          punchState: PUNCH_STATES.IDLE,
          locationError: locationData.error,
          isLoading: false,
        });
        return { success: false, error: locationData.error };
      }

      const capturedLoc = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address || '',
        accuracy: locationData.accuracy,
        speed: locationData.speed,
        isMock: locationData.isMock || false,
      };

      logger.info('PunchContext: Setting capturedLocation and opening form', capturedLoc);

      setPunchState((prev) => ({
        ...prev,
        capturedLocation: capturedLoc,
        isMockLocation: capturedLoc.isMock,
        punchState: PUNCH_STATES.FORM_OPEN,
        isLoading: false,
      }));

      return { success: true, data: locationData, capturedLocation: capturedLoc };
    } catch (err) {
      const errorMsg = err.message || 'Failed to get location';
      logger.error('PunchContext: Location fetch error', { error: err.message });
      setPunchState({
        punchState: PUNCH_STATES.IDLE,
        locationError: errorMsg,
        isLoading: false,
      });
      return { success: false, error: errorMsg };
    }
  }, []);

  const punchIn = useCallback(async (formData, preCapturedLocation = null) => {
    setPunchState({
      punchState: PUNCH_STATES.SUBMITTING,
      submitError: null,
      submitSuccess: false,
      isLoading: true,
    });

    try {
      let latitude, longitude, address, accuracy, speed, isMock;

      if (preCapturedLocation) {
        latitude = preCapturedLocation.latitude;
        longitude = preCapturedLocation.longitude;
        address = preCapturedLocation.address || '';
        accuracy = preCapturedLocation.accuracy || null;
        speed = preCapturedLocation.speed || null;
        isMock = preCapturedLocation.isMock || false;
      } else {
        const locationResult = await LocationService.getCurrentLocationInfo({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
          useCache: false,
        });

        if (locationResult.error) {
          setPunchState({
            punchState: PUNCH_STATES.ERROR,
            locationError: locationResult.error,
            isLoading: false,
          });
          return { success: false, error: locationResult.error };
        }

        latitude = locationResult.latitude;
        longitude = locationResult.longitude;
        address = locationResult.address;
        accuracy = locationResult.accuracy;
        speed = locationResult.speed;
        isMock = locationResult.isMock || false;
      }

      const payload = {
        latitude,
        longitude,
        current_address: address || formData?.current_address || '',
        visit_type: formData?.visit_type || 'OTHER',
        reason: formData?.reason || '',
        loan_id: formData?.loan_id || '',
        amount: formData?.amount || null,
        payment_mode: formData?.payment_mode || '',
        customer_address: formData?.customer_address || '',
        customer_name: formData?.customer_name || '',
        travel_with: formData?.travel_with || 'ALONE',
        co_employee_id: formData?.co_employee_id || '',
        co_employee_name: formData?.co_employee_name || '',
        accuracy,
        speed,
        is_mock: isMock,
      };

      logger.info('Punch In - Creating record', { payload, isMock });

      await api.createPunchRecord(payload);

      const startTime = new Date().toISOString();
      const punchData = {
        latitude,
        longitude,
        address,
        accuracy,
        timestamp: startTime,
        isMock,
      };

      await AsyncStorage.setItem(STORAGE_KEYS.PUNCH_ACTIVE, 'true');
      await AsyncStorage.setItem(STORAGE_KEYS.PUNCH_START_TIME, startTime);
      await AsyncStorage.setItem(STORAGE_KEYS.PUNCH_LOCATION, JSON.stringify(punchData));
      await AsyncStorage.setItem(STORAGE_KEYS.TRACKING_COORDS, JSON.stringify([punchData]));

      setPunchState((prev) => ({
        ...prev,
        punchState: PUNCH_STATES.ACTIVE,
        isActive: true,
        isIdle: false,
        punchStartTime: startTime,
        punchLocation: punchData,
        trackingCoords: [punchData],
        currentLocation: { latitude, longitude, address, accuracy, speed, isMock },
        capturedLocation: null,
        submitSuccess: true,
        isLoading: false,
      }));

      await startRouteTracking();
      await fetchTodayPunches();

      logger.info('Punch In - Success', { isMock });

      setTimeout(() => {
        setPunchState((prev) => ({ ...prev, submitSuccess: false }));
      }, 3000);

      return { success: true, data: punchData };
    } catch (err) {
      logger.error('Punch In - Error', { error: err.message });
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Failed to punch in. Please try again.';

      setPunchState((prev) => ({
        ...prev,
        punchState: PUNCH_STATES.ACTIVE,
        submitError: errorMsg,
        isLoading: false,
      }));

      setTimeout(() => {
        setPunchState((prev) => ({ ...prev, submitError: null }));
      }, 5000);

      return { success: false, error: errorMsg };
    }
  }, []);

  const resetForm = useCallback(() => {
    setPunchState({
      punchState: state.isActive ? PUNCH_STATES.ACTIVE : PUNCH_STATES.IDLE,
      capturedLocation: null,
      isMockLocation: false,
      locationError: null,
    });
  }, [state.isActive]);

  const dismissError = useCallback(() => {
    setPunchState({
      punchState: state.isActive ? PUNCH_STATES.ACTIVE : PUNCH_STATES.IDLE,
      locationError: null,
      submitError: null,
    });
  }, [state.isActive]);

  const getTotalDistance = useCallback(() => {
    if (state.trackingCoords.length < 2) return 0;

    let total = 0;
    for (let i = 1; i < state.trackingCoords.length; i++) {
      const prev = state.trackingCoords[i - 1];
      const curr = state.trackingCoords[i];
      total += LocationService.calculateDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
    }
    return total;
  }, [state.trackingCoords]);

  const getTrackingDuration = useCallback(() => {
    if (!state.punchStartTime) return 0;
    const start = new Date(state.punchStartTime);
    const now = new Date();
    return Math.floor((now - start) / 1000 / 60);
  }, [state.punchStartTime]);

  const openInGoogleMaps = useCallback((lat, lng) => {
    LocationService.openInGoogleMaps(lat, lng);
  }, []);

  const value = {
    ...state,
    punchIn,
    fetchLocation,
    resetForm,
    dismissError,
    canProcessPunchClick,
    getTotalDistance,
    getTrackingDuration,
    openInGoogleMaps,
    refreshPunches: fetchTodayPunches,
  };

  return <PunchContext.Provider value={value}>{children}</PunchContext.Provider>;
};

export const usePunch = () => {
  const context = useContext(PunchContext);
  if (!context) {
    throw new Error('usePunch must be used within PunchProvider');
  }
  return context;
};

export default PunchContext;
