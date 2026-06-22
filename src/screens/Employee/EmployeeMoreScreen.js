import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useAuth } from '../../context/AuthContext';
import HeroHeader from '../../components/HeroHeader';
import { colors, typography, spacing } from '../../theme/tokens';

const EmployeeMoreScreen = ({ navigation }) => {
    const auth = useAuth();
    const user = auth?.user;

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try { await auth.logout(); } catch {}
                    },
                },
            ]
        );
    };

    const MenuItem = ({ title, subtitle, icon, color, onPress }) => (
        <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: `${color}15` }]}>
                <Icon name={icon} size={22} color={color} />
            </View>
            <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{title}</Text>
                {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
            </View>
            <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>
    );

    const SectionTitle = ({ title }) => (
        <Text style={styles.sectionTitle}>{title}</Text>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <HeroHeader
                user={user}
                role="Employee"
                showStatus={false}
                onLogout={handleLogout}
            />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <TouchableOpacity
                    style={styles.profileCard}
                    onPress={() => navigation.navigate('Profile')}
                    activeOpacity={0.8}
                >
                    <View style={styles.profileIcon}>
                        <Icon name="user" size={32} color={colors.primary} />
                    </View>
                    <View style={styles.profileContent}>
                        <Text style={styles.profileTitle}>
                            {user?.first_name && user?.last_name
                                ? `${user.first_name} ${user.last_name}`
                                : user?.username || 'Employee'}
                        </Text>
                        <Text style={styles.profileSubtitle}>
                            {user?.employee_id || 'Employee ID not set'}
                        </Text>
                        <Text style={styles.profileTap}>Tap to view full profile →</Text>
                    </View>
                </TouchableOpacity>

                <SectionTitle title="Account" />
                <MenuItem
                    title="My Profile"
                    subtitle="View personal & work details"
                    icon="user"
                    color={colors.primary}
                    onPress={() => navigation.navigate('Profile')}
                />

                <SectionTitle title="History" />
                <MenuItem
                    title="Punch History"
                    subtitle="View your punch records"
                    icon="clock"
                    color={colors.primary}
                    onPress={() => navigation.navigate('PunchHistory')}
                />
                <MenuItem
                    title="Punch Corrections"
                    subtitle="Request punch corrections"
                    icon="edit-2"
                    color={colors.warning}
                    onPress={() => navigation.navigate('PunchCorrection')}
                />
                <MenuItem
                    title="Allowance History"
                    subtitle="View your allowances"
                    icon="dollar-sign"
                    color={colors.success}
                    onPress={() => navigation.navigate('AllowanceHistory')}
                />
                <MenuItem
                    title="Daily Summary"
                    subtitle="View daily summaries"
                    icon="bar-chart-2"
                    color={colors.info}
                    onPress={() => navigation.navigate('DailySummary')}
                />

                <SectionTitle title="Analytics" />
                <MenuItem
                    title="My Performance"
                    subtitle="Daily, weekly & monthly metrics"
                    icon="trending-up"
                    color="#7C3AED"
                    onPress={() => navigation.navigate('MyPerformance')}
                />
                <MenuItem
                    title="Missed Punches"
                    subtitle="Track your correction requests"
                    icon="alert-circle"
                    color={colors.warning}
                    onPress={() => navigation.navigate('MissedPunchDashboard')}
                />

                <SectionTitle title="Settings" />
                <MenuItem
                    title="Change Password"
                    subtitle="Update your password"
                    icon="lock"
                    color={colors.warning}
                    onPress={() => navigation.navigate('ChangePassword')}
                />
                <MenuItem
                    title="Route Map"
                    subtitle="View your route map"
                    icon="map"
                    color={colors.danger}
                    onPress={() => navigation.navigate('RouteMap')}
                />

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Traveling Allowance System</Text>
                    <Text style={styles.footerVersion}>Version 1.0.0</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 140,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        marginTop: spacing.md,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    profileIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    profileContent: {
        flex: 1,
    },
    profileTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    profileSubtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    profileTap: {
        fontSize: typography.sizes.xs,
        color: colors.primary,
        marginTop: 4,
        fontWeight: typography.weights.medium,
    },
    sectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        marginBottom: spacing.xs,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
    },
    menuIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    menuContent: {
        flex: 1,
    },
    menuTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.medium,
        color: colors.textDark,
    },
    menuSubtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    footer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        marginTop: spacing.lg,
    },
    footerText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    footerVersion: {
        fontSize: typography.sizes.xs,
        color: colors.textLight,
        marginTop: spacing.xs,
    },
});

export default EmployeeMoreScreen;
