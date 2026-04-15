import React, { memo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import DashboardScreen from '../screens/DashboardScreen';
import ApplyAllowanceScreen from '../screens/ApplyAllowanceScreen';
import PunchCorrectionScreen from '../screens/PunchCorrectionScreen';
import HistoryHubScreen from '../screens/HistoryHubScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import MoreScreen from '../screens/MoreScreen';
import CustomTabBar from '../components/CustomTabBar';

import { colors, spacing, typography } from '../theme/tokens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const AllowanceHomeScreen = memo(({ navigation }) => {
    const handleApplyPress = () => {
        navigation.navigate('ApplyAllowance');
    };

    const handleHistoryPress = () => {
        navigation.getParent()?.navigate('HistoryTab', { screen: 'AllowanceHistory' });
    };

    return (
        <SafeAreaView style={styles.screenContainer} edges={['top']}>
            <View style={styles.homeContainer}>
                <View style={styles.homeHeader}>
                    <View style={styles.headerIconWrapper}>
                        <Icon name="file-text" size={32} color={colors.primary} />
                    </View>
                    <Text style={styles.homeTitle}>Travel Allowance</Text>
                    <Text style={styles.homeSubtitle}>
                        Submit your travel allowance claims based on distance covered
                    </Text>
                </View>

                <View style={styles.actionCards}>
                    <TouchableOpacity
                        style={styles.primaryActionCard}
                        onPress={handleApplyPress}
                        activeOpacity={0.85}
                    >
                        <View style={styles.actionIconWrapper}>
                            <Icon name="plus-circle" size={28} color={colors.white} />
                        </View>
                        <View style={styles.actionContent}>
                            <Text style={styles.primaryActionTitle}>Apply for Allowance</Text>
                            <Text style={styles.primaryActionDesc}>
                                Submit a new travel claim
                            </Text>
                        </View>
                        <Icon name="chevron-right" size={24} color={colors.white} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryActionCard}
                        onPress={handleHistoryPress}
                        activeOpacity={0.85}
                    >
                        <View style={[styles.actionIconWrapper, styles.secondaryIconWrapper]}>
                            <Icon name="clock" size={24} color={colors.primary} />
                        </View>
                        <View style={styles.actionContent}>
                            <Text style={styles.secondaryActionTitle}>View History</Text>
                            <Text style={styles.secondaryActionDesc}>
                                Check past claims
                            </Text>
                        </View>
                        <Icon name="chevron-right" size={24} color={colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
});

const CorrectionHomeScreen = memo(({ navigation }) => {
    const handleRequestPress = () => {
        navigation.navigate('RequestCorrection');
    };

    return (
        <SafeAreaView style={styles.screenContainer} edges={['top']}>
            <View style={styles.homeContainer}>
                <View style={styles.homeHeader}>
                    <View style={[styles.headerIconWrapper, styles.warningIconWrapper]}>
                        <Icon name="edit-3" size={32} color={colors.warning} />
                    </View>
                    <Text style={styles.homeTitle}>Punch Correction</Text>
                    <Text style={styles.homeSubtitle}>
                        Request correction for missed or incorrect punches
                    </Text>
                </View>

                <View style={styles.actionCards}>
                    <TouchableOpacity
                        style={[styles.primaryActionCard, styles.warningCard]}
                        onPress={handleRequestPress}
                        activeOpacity={0.85}
                    >
                        <View style={[styles.actionIconWrapper, styles.warningActionIcon]}>
                            <Icon name="plus-circle" size={28} color={colors.white} />
                        </View>
                        <View style={styles.actionContent}>
                            <Text style={styles.primaryActionTitle}>Request Correction</Text>
                            <Text style={styles.primaryActionDesc}>
                                Fix missed punches
                            </Text>
                        </View>
                        <Icon name="chevron-right" size={24} color={colors.white} />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
});

const AllowanceStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AllowanceHome" component={AllowanceHomeScreen} />
        <Stack.Screen name="ApplyAllowance" component={ApplyAllowanceScreen} />
    </Stack.Navigator>
);

const CorrectionStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="CorrectionHome" component={CorrectionHomeScreen} />
        <Stack.Screen name="RequestCorrection" component={PunchCorrectionScreen} />
    </Stack.Navigator>
);

const HistoryStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="HistoryHub" component={HistoryHubScreen} />
        <Stack.Screen name="PunchHistory" component={HistoryHubScreen} />
        <Stack.Screen name="AllowanceHistory" component={HistoryHubScreen} />
        <Stack.Screen name="DailySummary" component={HistoryHubScreen} />
    </Stack.Navigator>
);

const ProfileStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ProfileHome" component={ProfileScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </Stack.Navigator>
);

const MoreStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MoreHome" component={MoreScreen} />
    </Stack.Navigator>
);

const MainTabNavigator = () => {
    return (
        <Tab.Navigator
            tabBar={props => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
            }}
        >
            <Tab.Screen name="HomeTab" component={DashboardScreen} />
            <Tab.Screen name="CorrectionTab" component={CorrectionStack} />
            <Tab.Screen name="AllowanceTab" component={AllowanceStack} />
            <Tab.Screen name="MoreTab" component={MoreStack} />
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    screenContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    homeContainer: {
        flex: 1,
        paddingHorizontal: spacing.lg,
    },
    homeHeader: {
        alignItems: 'center',
        paddingTop: spacing.xl,
        paddingBottom: spacing.xl,
    },
    headerIconWrapper: {
        width: 72,
        height: 72,
        borderRadius: 20,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        ...Platform.select({
            ios: {
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    warningIconWrapper: {
        backgroundColor: colors.warningLight,
    },
    homeTitle: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.xs,
    },
    homeSubtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        textAlign: 'center',
        paddingHorizontal: spacing.lg,
        lineHeight: 22,
    },
    actionCards: {
        paddingTop: spacing.md,
    },
    primaryActionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        padding: spacing.lg,
        borderRadius: 16,
        marginBottom: spacing.md,
        ...Platform.select({
            ios: {
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    warningCard: {
        backgroundColor: colors.warning,
    },
    actionIconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    secondaryIconWrapper: {
        backgroundColor: colors.primaryLight,
    },
    warningActionIcon: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    actionContent: {
        flex: 1,
    },
    primaryActionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.white,
        marginBottom: 2,
    },
    primaryActionDesc: {
        fontSize: typography.sizes.sm,
        color: 'rgba(255,255,255,0.8)',
    },
    secondaryActionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        ...Platform.select({
            ios: {
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    secondaryActionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginBottom: 2,
    },
    secondaryActionDesc: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
});

export default MainTabNavigator;
