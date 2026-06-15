import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography } from '../theme/tokens';

// Auth Screens
// Auth Screens
import LoginScreen from '../screens/Auth/LoginScreen';
import ChangePasswordScreen from '../screens/Auth/ChangePasswordScreen';

// Employee Screens
import EmployeeHomeScreen from '../screens/Employee/EmployeeHomeScreen';
import EmployeePunchScreen from '../screens/Employee/EmployeePunchScreen';
import PunchScreen from '../screens/Employee/PunchScreen';
import EmployeeCorrectionScreen from '../screens/Employee/EmployeeCorrectionScreen';
import EmployeeAllowanceScreen from '../screens/Employee/EmployeeAllowanceScreen';
import EmployeeMoreScreen from '../screens/Employee/EmployeeMoreScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/Admin/AdminDashboardScreen';
import AdminApprovalsScreen from '../screens/Admin/AdminApprovalsScreen';
import AdminDevicesScreen from '../screens/Admin/AdminDevicesScreen';
import EmployeeTrackingScreen from '../screens/Admin/EmployeeTrackingScreen';

// SuperAdmin Screens
import SuperAdminHomeScreen from '../screens/SuperAdmin/SuperAdminHomeScreen';
import SuperAdminDashboardScreen from '../screens/SuperAdmin/SuperAdminDashboardScreen';
import SuperAdminAnalyticsScreen from '../screens/SuperAdmin/SuperAdminAnalyticsScreen';
import SuperAdminEmployeesScreen from '../screens/SuperAdmin/SuperAdminEmployeesScreen';
import SuperAdminMoreScreen from '../screens/SuperAdmin/SuperAdminMoreScreen';
import UserManagementScreen from '../screens/SuperAdmin/UserManagementScreen';
import CreateUserScreen from '../screens/SuperAdmin/CreateUserScreen';
import ApprovalRoutesScreen from '../screens/SuperAdmin/ApprovalRoutesScreen';
import OrgSettingsScreen from '../screens/SuperAdmin/OrgSettingsScreen';
import ReportsScreen from '../screens/SuperAdmin/ReportsScreen';

// Common Screens
import RouteMapScreen from '../screens/Common/RouteMapScreen';
import PunchHistoryScreen from '../screens/Common/PunchHistoryScreen';
import PunchCorrectionScreen from '../screens/Common/PunchCorrectionScreen';
import AllowanceHistoryScreen from '../screens/Common/AllowanceHistoryScreen';
import ApplyAllowanceScreen from '../screens/Common/ApplyAllowanceScreen';
import DailySummaryScreen from '../screens/Common/DailySummaryScreen';
import DashboardScreen from '../screens/Common/DashboardScreen';
import EmployeeListScreen from '../screens/Common/EmployeeListScreen';
import MyPerformanceScreen from '../screens/Employee/MyPerformanceScreen';


import CustomTabBar from '../components/CustomTabBar';
import { useAuth } from '../context/AuthContext';

const AuthStack = createNativeStackNavigator();
const EmployeeTab = createBottomTabNavigator();
const EmployeeStack = createNativeStackNavigator();
const AdminStack = createNativeStackNavigator();
const SuperAdminTab = createBottomTabNavigator();
const SuperAdminStack = createNativeStackNavigator();

const commonScreenOptions = {
    headerShown: false,
};

const AuthStackNavigator = () => (
    <AuthStack.Navigator screenOptions={commonScreenOptions}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </AuthStack.Navigator>
);

const EmployeeTabNavigator = () => {
    const navigation = useNavigation();
    
    const handlePunchPress = () => {
        navigation.navigate('Punch');
    };
    
    return (
        <EmployeeTab.Navigator
            tabBar={(props) => <CustomTabBar {...props} onPunchPress={handlePunchPress} />}
            screenOptions={{
                headerShown: false,
            }}
        >
            <EmployeeTab.Screen name="EmployeeHome" component={EmployeeHomeScreen} />
            <EmployeeTab.Screen name="EmployeeCorrection" component={EmployeeCorrectionScreen} />
            <EmployeeTab.Screen name="EmployeePunch" component={EmployeePunchScreen} />
            <EmployeeTab.Screen name="EmployeeAllowance" component={EmployeeAllowanceScreen} />
            <EmployeeTab.Screen name="EmployeeMore" component={EmployeeMoreScreen} />
        </EmployeeTab.Navigator>
    );
};

const EmployeeStackNavigator = () => (
    <EmployeeStack.Navigator screenOptions={commonScreenOptions}>
        <EmployeeStack.Screen name="EmployeeTabs" component={EmployeeTabNavigator} />
        <EmployeeStack.Screen name="Punch" component={EmployeePunchScreen} />
        <EmployeeStack.Screen name="RouteMap" component={RouteMapScreen} />
        <EmployeeStack.Screen name="PunchHistory" component={PunchHistoryScreen} />
        <EmployeeStack.Screen name="PunchCorrection" component={PunchCorrectionScreen} />
        <EmployeeStack.Screen name="AllowanceHistory" component={AllowanceHistoryScreen} />
        <EmployeeStack.Screen name="ApplyAllowance" component={ApplyAllowanceScreen} />
        <EmployeeStack.Screen name="DailySummary" component={DailySummaryScreen} />
        <EmployeeStack.Screen name="MyPerformance" component={MyPerformanceScreen} />
        <EmployeeStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </EmployeeStack.Navigator>
);

const AdminStackNavigator = () => (
    <AdminStack.Navigator screenOptions={commonScreenOptions}>
        <AdminStack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <AdminStack.Screen name="AdminApprovals" component={AdminApprovalsScreen} />
        <AdminStack.Screen name="AdminDevices" component={AdminDevicesScreen} />
        <AdminStack.Screen name="EmployeeTracking" component={EmployeeTrackingScreen} />
        <AdminStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </AdminStack.Navigator>
);

const SuperAdminTabNavigator = () => (
    <SuperAdminTab.Navigator
        screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ color, focused }) => {
                let iconName;
                switch (route.name) {
                    case 'SuperAdminHome':
                        iconName = 'home';
                        break;
                    case 'SuperAdminAnalytics':
                        iconName = 'bar-chart-2';
                        break;
                    case 'SuperAdminEmployees':
                        iconName = 'users';
                        break;
                    case 'SuperAdminMore':
                        iconName = 'menu';
                        break;
                    default:
                        iconName = 'circle';
                }
                return (
                    <View style={[styles.tabIconContainer, focused && styles.tabIconFocused]}>
                        <Icon name={iconName} size={22} color={color} />
                    </View>
                );
            },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                height: 70,
                paddingBottom: 10,
                paddingTop: 10,
                position: 'absolute',
                elevation: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            tabBarLabelStyle: {
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.semibold,
            },
        })}
    >
        <SuperAdminTab.Screen
            name="SuperAdminHome"
            component={SuperAdminHomeScreen}
            options={{ tabBarLabel: 'Home' }}
        />
        <SuperAdminTab.Screen
            name="SuperAdminAnalytics"
            component={SuperAdminAnalyticsScreen}
            options={{ tabBarLabel: 'Analytics' }}
        />
        <SuperAdminTab.Screen
            name="SuperAdminEmployees"
            component={SuperAdminEmployeesScreen}
            options={{ tabBarLabel: 'Employees' }}
        />
        <SuperAdminTab.Screen
            name="SuperAdminMore"
            component={SuperAdminMoreScreen}
            options={{ tabBarLabel: 'More' }}
        />
    </SuperAdminTab.Navigator>
);

const SuperAdminStackNavigator = () => (
    <SuperAdminStack.Navigator screenOptions={commonScreenOptions}>
        <SuperAdminStack.Screen name="SuperAdminTabs" component={SuperAdminTabNavigator} />
        <SuperAdminStack.Screen name="SuperAdminDashboard" component={SuperAdminDashboardScreen} />
        <SuperAdminStack.Screen name="AdminApprovals" component={AdminApprovalsScreen} />
        <SuperAdminStack.Screen name="AdminDevices" component={AdminDevicesScreen} />
        <SuperAdminStack.Screen name="EmployeeTracking" component={EmployeeTrackingScreen} />
        <SuperAdminStack.Screen name="UserManagement" component={UserManagementScreen} />
        <SuperAdminStack.Screen name="EmployeeList" component={EmployeeListScreen} />
        <SuperAdminStack.Screen name="ApprovalRoutes" component={ApprovalRoutesScreen} />
        <SuperAdminStack.Screen name="OrgSettings" component={OrgSettingsScreen} />
        <SuperAdminStack.Screen name="Reports" component={ReportsScreen} />
        <SuperAdminStack.Screen name="CreateUser" component={CreateUserScreen} />
        <SuperAdminStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </SuperAdminStack.Navigator>
);

const RootNavigator = () => {
    const auth = useAuth();
    const isAuthenticated = auth?.isAuthenticated ?? false;
    const forcePasswordChange = auth?.user?.force_password_change ?? false;
    const isSuperAdmin = auth?.isSuperAdmin ?? false;
    const isAdmin = auth?.isAdmin ?? false;

    if (!isAuthenticated) {
        return <AuthStackNavigator />;
    }

    if (forcePasswordChange) {
        return (
            <AuthStack.Navigator screenOptions={commonScreenOptions}>
                <AuthStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            </AuthStack.Navigator>
        );
    }

    if (isSuperAdmin) {
        return <SuperAdminStackNavigator />;
    }

    if (isAdmin) {
        return <AdminStackNavigator />;
    }

    return <EmployeeStackNavigator />;
};

export default RootNavigator;

const styles = StyleSheet.create({
    tabIconContainer: {
        width: 44,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    tabIconFocused: {
        backgroundColor: colors.primaryLight,
    },
});
