import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';

const IS_DEV = __DEV__;

const PunchContext = createContext(null);

export const STATES = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  ERROR: 'ERROR',
};

export const PunchProvider = ({ children }) => {
  const [punches, setPunches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const addPunch = useCallback(async (punchData) => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await api.post('/attendance/punches/', punchData);
      await fetchTodayPunches();
      return { success: true, data: res.data };
    } catch (err) {
      if (IS_DEV) console.error('[Punch] Add error:', err);
      const errorMsg = err?.response?.data?.detail || err.message || 'Failed to add punch';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [fetchTodayPunches]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    fetchTodayPunches();
  }, [fetchTodayPunches]);

  const value = useMemo(() => ({
    punches,
    loading,
    error,
    fetchTodayPunches,
    addPunch,
    clearError,
    punchCount: punches.length,
  }), [punches, loading, error, fetchTodayPunches, addPunch, clearError]);

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
      fetchTodayPunches: () => {},
      addPunch: () => Promise.resolve({ success: false, error: 'Context not ready' }),
      clearError: () => {},
      punchCount: 0,
    };
  }
  return ctx;
};

export default PunchContext;
