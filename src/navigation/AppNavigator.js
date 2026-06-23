import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Text } from 'react-native';

// AUTH SCREENS
import LoginScreen from '../screens/Auth/LoginScreen';
import ChangePasswordScreen from '../screens/Auth/ChangePasswordScreen';

// MAIN SCREENS
import EmployeePunchScreen from '../screens/Employee/EmployeePunchScreen';
import MapViewScreen from '../components/MapViewScreen';
import RouteMapScreen from '../screens/Common/RouteMapScreen';
import MainTabNavigator from './MainTabNavigator';

// HISTORY SCREENS
import PunchHistoryScreen from '../screens/Common/PunchHistoryScreen';
import AllowanceHistoryScreen from '../screens/Common/AllowanceHistoryScreen';
import DailySummaryScreen from '../screens/Common/DailySummaryScreen';
import ProfileScreen from '../screens/Common/ProfileScreen';

// ADMIN SCREENS
import AdminDashboardScreen from '../screens/Admin/AdminDashboardScreen';
import AdminApprovalsScreen from '../screens/Admin/AdminApprovalsScreen';
import AdminDevicesScreen from '../screens/Admin/AdminDevicesScreen';

// SUPER ADMIN SCREENS
import SuperAdminDashboardScreen from '../screens/SuperAdmin/SuperAdminDashboardScreen';

import { AuthContext } from '../context/AuthContext';

const Stack = createNativeStackNavigator();

// Placeholder screens
const UserManagementScreen = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>User Management</Text>
    </View>
);

const EmployeeTrackingScreen = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Employee Tracking</Text>
    </View>
);

const AppNavigator = () => {
    const { token, user, loading, role, isAdmin, isSuperAdmin, isEmployee } = useContext(AuthContext);

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

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>

                {isSuperAdmin() ? (
                    // Super Admin Navigation
                    <>
                        <Stack.Screen name="SuperAdminHome" component={SuperAdminDashboardScreen} />
                        <Stack.Screen name="AdminApprovals" component={AdminApprovalsScreen} />
                        <Stack.Screen name="AdminDevices" component={AdminDevicesScreen} />
                        <Stack.Screen name="UserManagement" component={UserManagementScreen} />
                        <Stack.Screen name="EmployeeTracking" component={EmployeeTrackingScreen} />
                        <Stack.Screen name="DailySummary" component={DailySummaryScreen} />
                        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                        <Stack.Screen name="Profile" component={ProfileScreen} />
                    </>
                ) : isAdmin() ? (
                    // Admin Navigation
                    <>
                        <Stack.Screen name="AdminHome" component={AdminDashboardScreen} />
                        <Stack.Screen name="AdminApprovals" component={AdminApprovalsScreen} />
                        <Stack.Screen name="AdminDevices" component={AdminDevicesScreen} />
                        <Stack.Screen name="EmployeeTracking" component={EmployeeTrackingScreen} />
                        <Stack.Screen name="DailySummary" component={DailySummaryScreen} />
                        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                        <Stack.Screen name="Profile" component={ProfileScreen} />
                    </>
                ) : (
                    // Employee Navigation (default)
                    <>
                        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
                        <Stack.Screen name="Punch" component={EmployeePunchScreen} />
                        <Stack.Screen name="Map" component={MapViewScreen} />
                        <Stack.Screen name="RouteMap" component={RouteMapScreen} />
                        <Stack.Screen name="PunchHistory" component={PunchHistoryScreen} />
                        <Stack.Screen name="AllowanceHistory" component={AllowanceHistoryScreen} />
                        <Stack.Screen name="DailySummary" component={DailySummaryScreen} />
                        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                        <Stack.Screen name="EmployeePunch" component={EmployeePunchScreen} />
                        <Stack.Screen name="Profile" component={ProfileScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;