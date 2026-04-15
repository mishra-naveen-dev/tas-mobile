import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator } from 'react-native';

// AUTH SCREENS
import LoginScreen from '../screens/LoginScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';

// MAIN SCREENS
import PunchScreen from '../screens/PunchScreen';
import MapViewScreen from '../components/MapViewScreen';
import RouteMapScreen from '../screens/RouteMapScreen';
import MainTabNavigator from './MainTabNavigator';

// HISTORY SCREENS
import PunchHistoryScreen from '../screens/PunchHistoryScreen';
import AllowanceHistoryScreen from '../screens/AllowanceHistoryScreen';
import DailySummaryScreen from '../screens/DailySummaryScreen';

// ADMIN SCREENS
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminApprovalsScreen from '../screens/AdminApprovalsScreen';
import AdminDevicesScreen from '../screens/AdminDevicesScreen';

// SUPER ADMIN SCREENS
import SuperAdminDashboardScreen from '../screens/SuperAdminDashboardScreen';

import { AuthContext } from '../context/AuthContext';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const authContext = useContext(AuthContext);
    
    // Handle case where context might be undefined (during development/testing)
    if (!authContext) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={{ marginTop: 10, color: '#666' }}>Initializing...</Text>
            </View>
        );
    }
    
    const { token, user, loading, role, isAdmin, isSuperAdmin, isEmployee } = authContext;

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={{ marginTop: 10, color: '#666' }}>Loading...</Text>
            </View>
        );
    }

    if (!token) {
        return (
            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Login" component={LoginScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        );
    }

    if (user?.force_password_change === true) {
        return (
            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        );
    }

    // Get actual role from user object as fallback
    const userRole = role || user?.role || user?.user?.role;
    
    const checkIsSuperAdmin = () => {
        if (typeof isSuperAdmin === 'function') return isSuperAdmin();
        return userRole === 'SUPER_ADMIN';
    };
    
    const checkIsAdmin = () => {
        if (typeof isAdmin === 'function') return isAdmin();
        return userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    };

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                
                {checkIsSuperAdmin() ? (
                    // Super Admin Navigation
                    <>
                        <Stack.Screen name="SuperAdminHome" component={SuperAdminDashboardScreen} />
                        <Stack.Screen name="AdminApprovals" component={AdminApprovalsScreen} />
                        <Stack.Screen name="AdminDevices" component={AdminDevicesScreen} />
                        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                    </>
                ) : checkIsAdmin() ? (
                    // Admin Navigation
                    <>
                        <Stack.Screen name="AdminHome" component={AdminDashboardScreen} />
                        <Stack.Screen name="AdminApprovals" component={AdminApprovalsScreen} />
                        <Stack.Screen name="AdminDevices" component={AdminDevicesScreen} />
                        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                    </>
                ) : (
                    // Employee Navigation (default)
                    <>
                        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
                        <Stack.Screen name="Punch" component={PunchScreen} />
                        <Stack.Screen name="Map" component={MapViewScreen} />
                        <Stack.Screen name="RouteMap" component={RouteMapScreen} />
                        <Stack.Screen name="PunchHistory" component={PunchHistoryScreen} />
                        <Stack.Screen name="AllowanceHistory" component={AllowanceHistoryScreen} />
                        <Stack.Screen name="DailySummary" component={DailySummaryScreen} />
                        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;