// src/context/AuthContext.js

import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null);
    const [refreshToken, setRefreshToken] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState(null);

    const saveTokensAndUser = async (access, refresh, userData) => {
        await AsyncStorage.setItem('access', access);
        await AsyncStorage.setItem('refresh', refresh);
        if (userData) {
            await AsyncStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            setRole(userData.role || null);
        }

        setToken(access);
        setRefreshToken(refresh);
    };

    const loadData = async () => {
        try {
            const access = await AsyncStorage.getItem('access');
            const refresh = await AsyncStorage.getItem('refresh');
            const userDataStr = await AsyncStorage.getItem('user');

            if (access && refresh) {
                setToken(access);
                setRefreshToken(refresh);
                if (userDataStr) {
                    const userData = JSON.parse(userDataStr);
                    setUser(userData);
                    setRole(userData.role || null);
                }
            }
        } catch (err) {
            console.log("Load error:", err);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        await AsyncStorage.removeItem('access');
        await AsyncStorage.removeItem('refresh');
        await AsyncStorage.removeItem('user');

        setToken(null);
        setRefreshToken(null);
        setUser(null);
        setRole(null);
    };

    // Check if user has admin/super admin access
    const isAdmin = useCallback(() => {
        return role === 'ADMIN' || role === 'SUPER_ADMIN';
    }, [role]);

    const isSuperAdmin = useCallback(() => {
        return role === 'SUPER_ADMIN';
    }, [role]);

    const isEmployee = useCallback(() => {
        return role === 'EMPLOYEE';
    }, [role]);

    useEffect(() => {
        loadData();
    }, []);

    return (
        <AuthContext.Provider
            value={{ 
                token, 
                refreshToken, 
                user, 
                role,
                saveTokensAndUser, 
                logout, 
                loading,
                isAdmin,
                isSuperAdmin,
                isEmployee
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};