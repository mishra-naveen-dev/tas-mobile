import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import api from '../api/api';
import { parseApiError } from '../core/error/AppErrorHandler';
import SSEClient from '../services/SSEClient';

const AuthContext = createContext(null);

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
        try {
            const [storedAccess, storedRefresh, storedUser] = await Promise.all([
                AsyncStorage.getItem(STORAGE_KEYS.ACCESS),
                AsyncStorage.getItem(STORAGE_KEYS.REFRESH),
                AsyncStorage.getItem(STORAGE_KEYS.USER),
            ]);

            if (storedAccess && storedRefresh) {
                setAccessToken(storedAccess);
                setRefreshToken(storedRefresh);

                if (storedUser) {
                    try {
                        setUser(JSON.parse(storedUser));
                    } catch {
                        setUser(null);
                    }
                }
            }
        } catch (error) {
            console.error('Auth initialization error:', error);
        } finally {
            setIsLoading(false);
            setIsInitialized(true);
        }
    }, []);

    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);

    const login = useCallback(async (username, password) => {
        try {
            console.log('[Auth] Attempting login for:', username);
            
            const response = await api.login(username, password);
            console.log('[Auth] Login response:', response.status);
            
            const data = response.data;
            const access = data.access;
            const refresh = data.refresh;
            const userData = data.user;

            if (!access || !refresh) {
                console.log('[Auth] Invalid response - missing tokens');
                Alert.alert('Login Error', 'Invalid server response. Please try again.');
                return { success: false, error: 'Invalid server response' };
            }

            console.log('[Auth] Login success! User:', userData?.username);

            await Promise.all([
                AsyncStorage.setItem(STORAGE_KEYS.ACCESS, access),
                AsyncStorage.setItem(STORAGE_KEYS.REFRESH, refresh),
            ]);

            if (userData) {
                await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
                setUser(userData);
            }

            setAccessToken(access);
            setRefreshToken(refresh);

            try {
                SSEClient.connect();
                console.log('[Auth] SSE connected after login');
            } catch (e) {
                console.log('[Auth] SSE connection error:', e.message);
            }

            return { success: true, user: userData };
        } catch (error) {
            const parsed = parseApiError(error);
            console.log('[Auth] Login failed:', parsed);
            
            // Show user-friendly error message
            Alert.alert('Login Failed', parsed.message);
            
            return {
                success: false,
                error: parsed.message,
                type: parsed.type,
            };
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.logout();
        } catch (error) {
            console.log('Logout API error:', error?.message);
        } finally {
            SSEClient.disconnect();
            await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
            setAccessToken(null);
            setRefreshToken(null);
            setUser(null);
        }
    }, []);

    const updateUser = useCallback((updatedUser) => {
        if (updatedUser) {
            setUser(updatedUser);
            AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        }
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
        console.warn('useAuth must be used within an AuthProvider');
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
        };
    }

    return context;
};

export default AuthContext;