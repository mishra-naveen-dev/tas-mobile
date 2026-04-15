import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Text } from 'react-native';

// AUTH SCREENS
import LoginScreen from '../screens/LoginScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';

// MAIN SCREENS
import PunchScreen from '../screens/PunchScreen';
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

// PROFILE
import ProfileScreen from '../screens/ProfileScreen';

import { AuthContext } from '../context/AuthContext';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const authContext = useContext(AuthContext);
    
    if (!authContext) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={{ marginTop: 10, color: '#666' }}>Initializing...</Text>
            </View>
        );
    }
    
    const { token, user, loading, role, isAdmin, isSuperAdmin, logout } = authContext;

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

    const userRole = role || user?.role || user?.user?.role;
    
    const isUserSuperAdmin = (typeof isSuperAdmin === 'function') 
        ? isSuperAdmin() 
        : userRole === 'SUPER_ADMIN';
    
    const isUserAdmin = (typeof isAdmin === 'function') 
        ? isAdmin() 
        : userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

    if (isUserSuperAdmin) {
        return (
            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="SuperAdminHome" component={SuperAdminDashboardScreen} />
                    <Stack.Screen name="AdminApprovals" component={AdminApprovalsScreen} />
                    <Stack.Screen name="AdminDevices" component={AdminDevicesScreen} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        );
    }

    if (isUserAdmin) {
        return (
            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="AdminHome" component={AdminDashboardScreen} />
                    <Stack.Screen name="AdminApprovals" component={AdminApprovalsScreen} />
                    <Stack.Screen name="AdminDevices" component={AdminDevicesScreen} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainTabs" component={MainTabNavigator} />
                <Stack.Screen name="Punch" component={PunchScreen} />
                <Stack.Screen name="RouteMap" component={RouteMapScreen} />
                <Stack.Screen name="PunchHistory" component={PunchHistoryScreen} />
                <Stack.Screen name="AllowanceHistory" component={AllowanceHistoryScreen} />
                <Stack.Screen name="DailySummary" component={DailySummaryScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
