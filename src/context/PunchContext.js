import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';

const PunchContext = createContext(null);

const PUNCH_STATES = {
    IDLE: 'IDLE',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
};

const STORAGE_KEYS = {
    PUNCH_STATE: '@punch_state',
    PUNCH_START_TIME: '@punch_start_time',
    TRACKING_COORDS: '@tracking_coords',
};

export const PunchProvider = ({ children }) => {
    const [punchState, setPunchState] = useState(PUNCH_STATES.IDLE);
    const [punchStartTime, setPunchStartTime] = useState(null);
    const [trackingCoords, setTrackingCoords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [todayPunches, setTodayPunches] = useState([]);
    const [currentSession, setCurrentSession] = useState(null);

    useEffect(() => {
        loadPunchState();
        checkTodayPunches();
    }, []);

    const loadPunchState = async () => {
        try {
            const storedState = await AsyncStorage.getItem(STORAGE_KEYS.PUNCH_STATE);
            const storedStartTime = await AsyncStorage.getItem(STORAGE_KEYS.PUNCH_START_TIME);
            
            if (storedState === PUNCH_STATES.ACTIVE && storedStartTime) {
                const startDate = new Date(storedStartTime);
                const today = new Date();
                
                if (startDate.toDateString() === today.toDateString()) {
                    setPunchState(PUNCH_STATES.ACTIVE);
                    setPunchStartTime(storedStartTime);
                } else {
                    await clearPunchState();
                }
            }
        } catch (err) {
            console.log('Error loading punch state:', err);
        }
    };

    const clearPunchState = async () => {
        try {
            await AsyncStorage.multiRemove([
                STORAGE_KEYS.PUNCH_STATE,
                STORAGE_KEYS.PUNCH_START_TIME,
                STORAGE_KEYS.TRACKING_COORDS,
            ]);
            setPunchState(PUNCH_STATES.IDLE);
            setPunchStartTime(null);
            setTrackingCoords([]);
            setCurrentSession(null);
        } catch (err) {
            console.log('Error clearing punch state:', err);
        }
    };

    const checkTodayPunches = async () => {
        try {
            const res = await api.get('/attendance/punches/today_punches/');
            const punches = res.data?.results || res.data || [];
            setTodayPunches(punches);
            
            const punchOut = punches.find(p => p.punch_type === 'PUNCH_OUT');
            if (punchOut) {
                setPunchState(PUNCH_STATES.COMPLETED);
            } else {
                const punchIn = punches.find(p => p.punch_type === 'PUNCH_IN');
                if (punchIn) {
                    setPunchState(PUNCH_STATES.ACTIVE);
                    setPunchStartTime(punchIn.punched_at);
                }
            }
        } catch (err) {
            console.log('Error checking punches:', err);
        }
    };

    const punchIn = useCallback(async () => {
        setIsLoading(true);
        try {
            const payload = {
                punch_type: 'PUNCH_IN',
            };

            const res = await api.post('/attendance/punches/', payload);
            
            const startTime = new Date().toISOString();
            await AsyncStorage.setItem(STORAGE_KEYS.PUNCH_STATE, PUNCH_STATES.ACTIVE);
            await AsyncStorage.setItem(STORAGE_KEYS.PUNCH_START_TIME, startTime);
            
            setPunchState(PUNCH_STATES.ACTIVE);
            setPunchStartTime(startTime);
            setCurrentSession(res.data);
            
            await checkTodayPunches();
            
            return { success: true };
        } catch (err) {
            console.log('Punch in error:', err);
            return { success: false, error: err?.response?.data?.error || 'Failed to punch in' };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const punchOut = useCallback(async () => {
        setIsLoading(true);
        try {
            const payload = {
                punch_type: 'PUNCH_OUT',
            };

            await api.post('/attendance/punches/', payload);
            
            await clearPunchState();
            await checkTodayPunches();
            
            return { success: true };
        } catch (err) {
            console.log('Punch out error:', err);
            return { success: false, error: err?.response?.data?.error || 'Failed to punch out' };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addTrackingCoord = useCallback(async (coord) => {
        const newCoord = {
            ...coord,
            timestamp: Date.now(),
        };
        
        setTrackingCoords(prev => {
            const updated = [...prev, newCoord];
            AsyncStorage.setItem(STORAGE_KEYS.TRACKING_COORDS, JSON.stringify(updated));
            return updated;
        });
    }, []);

    const getTotalDistance = useCallback(() => {
        if (trackingCoords.length < 2) return 0;
        
        let total = 0;
        for (let i = 1; i < trackingCoords.length; i++) {
            const prev = trackingCoords[i - 1];
            const curr = trackingCoords[i];
            total += calculateDistance(
                prev.latitude, prev.longitude,
                curr.latitude, curr.longitude
            );
        }
        return total;
    }, [trackingCoords]);

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    const getTrackingDuration = useCallback(() => {
        if (!punchStartTime) return 0;
        const start = new Date(punchStartTime);
        const now = new Date();
        return Math.floor((now - start) / 1000 / 60);
    }, [punchStartTime]);

    const value = {
        punchState,
        punchStartTime,
        trackingCoords,
        isLoading,
        todayPunches,
        currentSession,
        isIdle: punchState === PUNCH_STATES.IDLE,
        isActive: punchState === PUNCH_STATES.ACTIVE,
        isCompleted: punchState === PUNCH_STATES.COMPLETED,
        punchIn,
        punchOut,
        addTrackingCoord,
        getTotalDistance,
        getTrackingDuration,
        refreshPunches: checkTodayPunches,
    };

    return (
        <PunchContext.Provider value={value}>
            {children}
        </PunchContext.Provider>
    );
};

export const usePunch = () => {
    const context = useContext(PunchContext);
    if (!context) {
        throw new Error('usePunch must be used within PunchProvider');
    }
    return context;
};

export default PunchContext;
