import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import { loginUser } from '../api/authApi';

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
            const response = await loginUser(username, password);
            const { access, refresh, user: userData } = response.data;

            if (!access || !refresh) {
                throw new Error('Invalid server response: missing tokens');
            }

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

            return { success: true, user: userData };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error?.response?.data?.detail || error?.message || 'Login failed',
            };
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
        } catch (error) {
            console.error('Logout cleanup error:', error);
        } finally {
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
