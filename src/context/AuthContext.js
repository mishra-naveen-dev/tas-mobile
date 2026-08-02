import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import api, { setSessionExpiredCallback, resetSessionHandler, loadCustomBaseURL } from '../api/api';
import { secureGetItem, secureSetItem, secureMultiRemove } from '../utils/secureStorage';
import { parseApiError } from '../core/error/AppErrorHandler';
import { SSEClient } from '../services/SSEClient';
import LocationService from '../services/LocationService';
import LiveTrackingService from '../services/LiveTrackingService';

const AuthContext = createContext(null);
let sessionExpiredAlertShown = false;

export const ROLES = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    EMPLOYEE: 'EMPLOYEE',
};

const STORAGE_KEYS = {
    ACCESS: 'access',
    REFRESH: 'refresh',
    USER: 'user',
    SESSION: 'session_token',
};

const normalizeUser = (userData) => {
    if (!userData) return null;
    return {
        ...userData,
        forcePasswordChange: userData.force_password_change || userData.forcePasswordChange || false,
        // Whether background location tracking is required for this user
        // (Super Admin controls it; defaults ON for employees).
        tracking_enabled: userData.tracking_enabled !== undefined
            ? userData.tracking_enabled
            : (String(userData.role || userData.role_name || '').toUpperCase() === 'EMPLOYEE'),
        // Whether the Collections "Near Me" distance filter is shown (Super
        // Admin can extend it to other roles/users via Feature Assignment;
        // defaults ON for employees, matching the backend's fallback, so
        // older cached logins behave correctly before their next refresh).
        near_me_enabled: userData.near_me_enabled !== undefined
            ? userData.near_me_enabled
            : (String(userData.role || userData.role_name || '').toUpperCase() === 'EMPLOYEE'),
    };
};

const clearAuthSession = async () => {
    try {
        await Promise.all([
            secureMultiRemove([STORAGE_KEYS.ACCESS, STORAGE_KEYS.REFRESH, STORAGE_KEYS.SESSION, 'accessToken']),
            AsyncStorage.removeItem(STORAGE_KEYS.USER),
        ]);
    } catch (e) {
        if (__DEV__) console.error('[Auth] Error clearing auth session keys:', e);
    }
};

export const AuthProvider = ({ children }) => {
    const [accessToken, setAccessToken] = useState(null);
    const [refreshToken, setRefreshToken] = useState(null);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const [navigationRef, setNavigationRef] = useState(null);

    const role = useMemo(() => user?.role || null, [user]);

    const isAuthenticated = useMemo(() => {
        return !!accessToken && !!user;
    }, [accessToken, user]);

    const isSuperAdmin = useCallback(() => {
        return role === ROLES.SUPER_ADMIN;
    }, [role]);

    const isAdmin = useCallback(() => {
        return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;
    }, [role]);

    const isManager = useCallback(() => {
        return role === ROLES.MANAGER || role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;
    }, [role]);

    const isEmployee = useCallback(() => {
        return role === ROLES.EMPLOYEE;
    }, [role]);

    const isAdminOrAbove = useCallback(() => {
        return isAdmin() || isSuperAdmin();
    }, [isAdmin, isSuperAdmin]);

    const initializeAuth = useCallback(async () => {
        const startTime = Date.now();
        try {
            await loadCustomBaseURL();
            let storedAccess = await secureGetItem(STORAGE_KEYS.ACCESS);
            if (!storedAccess) {
                storedAccess = await secureGetItem('accessToken');
            }
            const storedRefresh = await secureGetItem(STORAGE_KEYS.REFRESH);
            const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);

            if (storedAccess && storedRefresh) {
                setAccessToken(storedAccess);
                setRefreshToken(storedRefresh);

                if (storedUser) {
                    try {
                        setUser(normalizeUser(JSON.parse(storedUser)));
                    } catch {
                        setUser(null);
                    }
                }
            } else {
                // No valid tokens, ensure clean state
                await clearAuthSession();
                setAccessToken(null);
                setRefreshToken(null);
                setUser(null);
            }
        } catch (error) {
            if (__DEV__) console.error('Auth initialization error:', error);
            await clearAuthSession();
            setAccessToken(null);
            setRefreshToken(null);
            setUser(null);
        } finally {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 1500 - elapsed);
            if (remaining > 0) {
                await new Promise(resolve => setTimeout(resolve, remaining));
            }
            setIsLoading(false);
            setIsInitialized(true);
        }
    }, []);

    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);

    const login = useCallback(async (username, password) => {
        try {
            const response = await api.login(username, password);

            const data = response.data;
            const access = data.access;
            const refresh = data.refresh;
            const userData = data.user;

            if (!access || !refresh) {
                Alert.alert('Login Error', 'Invalid server response. Please try again.');
                return { success: false, error: 'Invalid server response' };
            }

            const storageOps = [
                secureSetItem(STORAGE_KEYS.ACCESS, access),
                secureSetItem(STORAGE_KEYS.REFRESH, refresh),
            ];

            if (data.session_token) {
                storageOps.push(secureSetItem(STORAGE_KEYS.SESSION, data.session_token));
            }

            await Promise.all(storageOps);

            if (userData) {
                const normalized = normalizeUser(userData);
                await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalized));
                setUser(normalized);
            }

            sessionExpiredAlertShown = false;
            setAccessToken(access);
            setRefreshToken(refresh);

            try {
                SSEClient.connect();
            } catch (e) {
                if (__DEV__) console.error('[Auth] SSE connection error:', e.message);
            }

            return { success: true, user: userData };
        } catch (error) {
            const parsed = parseApiError(error);

            return {
                success: false,
                error: parsed.message,
                type: parsed.type,
                code: parsed.code,
            };
        }
    }, []);

    const logout = useCallback(async () => {
        // Stop background GPS tracking if running
        try { await LocationService.stopTracking(); } catch {}
        try { await LiveTrackingService.detach(); } catch {}
        // Notify backend of logout (best-effort)
        try { await api.logout(); } catch {}
        // Disconnect SSE polling
        try { SSEClient.disconnect(); } catch {}
        // Clear stored tokens and user data
        await clearAuthSession();
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
        resetSessionHandler();
    }, []);

    // Handle session expiration - only once
    useEffect(() => {
        if (typeof setSessionExpiredCallback !== 'function') {
            if (__DEV__) console.warn('[Auth] setSessionExpiredCallback not available from api');
            return;
        }
        setSessionExpiredCallback(() => {
            if (!sessionExpiredAlertShown) {
                sessionExpiredAlertShown = true;
                Alert.alert(
                    'Session Expired',
                    'Your session has expired. Please login again.'
                );
            }
            // Prevent multiple calls
            SSEClient.disconnect();
            clearAuthSession().then(() => {
                setAccessToken(null);
                setRefreshToken(null);
                setUser(null);
                resetSessionHandler();
            });
        });

        return () => {
            setSessionExpiredCallback(null);
        };
    }, []);

    const updateUser = useCallback((updatedUser) => {
        if (updatedUser) {
            const normalized = normalizeUser(updatedUser);
            setUser(normalized);
            AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalized));
        }
    }, []);

    // Re-fetch the canonical user from the backend (/me) and update state.
    // Used after a password change so navigation reacts to the server's truth
    // (e.g. force_password_change flips to false) even if the local update was
    // missed due to a slow/timed-out response.
    const refreshUser = useCallback(async () => {
        try {
            const res = await api.getUserProfile();
            if (res?.data) {
                const normalized = normalizeUser(res.data);
                setUser(normalized);
                await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalized));
                return normalized;
            }
        } catch (e) {
            if (__DEV__) console.warn('[Auth] refreshUser failed:', e?.message);
        }
        return null;
    }, []);

    const value = useMemo(() => ({
        user,
        role,
        token: accessToken,
        accessToken,
        isAuthenticated,
        isLoading,
        isInitialized,
        navigationRef,
        setNavigationRef,
        isSuperAdmin: isSuperAdmin(),
        isAdmin: isAdmin(),
        isManager: isManager(),
        isEmployee: isEmployee(),
        isAdminOrAbove: isAdminOrAbove(),
        login,
        logout,
        updateUser,
        refreshUser,
    }), [
        user,
        role,
        accessToken,
        isAuthenticated,
        isLoading,
        isInitialized,
        navigationRef,
        isSuperAdmin,
        isAdmin,
        isManager,
        isEmployee,
        isAdminOrAbove,
        login,
        logout,
        updateUser,
        refreshUser,
    ]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (context === null) {
        if (__DEV__) console.warn('useAuth must be used within an AuthProvider');
        return {
            user: null,
            role: null,
            token: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: true,
            isInitialized: false,
            navigationRef: null,
            setNavigationRef: () => {},
            isSuperAdmin: false,
            isAdmin: false,
            isManager: false,
            isEmployee: false,
            isAdminOrAbove: false,
            login: () => Promise.resolve({ success: false, error: 'Auth not initialized' }),
            logout: () => Promise.resolve(),
            updateUser: () => {},
            refreshUser: () => Promise.resolve(null),
        };
    }

    return context;
};

export default AuthContext;