import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useAuth } from '../../context/AuthContext';
import HeroHeader from '../../components/HeroHeader';
import { colors, typography, spacing, shadows } from '../../theme/tokens';

// ─── section header ───────────────────────────────────────────────────────────

const SectionLabel = ({ title }) => (
    <Text style={styles.sectionLabel}>{title}</Text>
);

// ─── menu row ─────────────────────────────────────────────────────────────────

const MenuRow = ({ title, subtitle, icon, iconColor, onPress }) => (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.menuIconWrap, { backgroundColor: iconColor + '15' }]}>
            <Icon name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.menuText}>
            <Text style={styles.menuTitle}>{title}</Text>
            {subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}
        </View>
        <Icon name="chevron-right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
);

// ─── main screen ──────────────────────────────────────────────────────────────

const EmployeeMoreScreen = ({ navigation }) => {
    const auth = useAuth();
    const user = auth?.user;

    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try { await auth.refreshUser(); } catch (_) {}
        setRefreshing(false);
    }, [auth]);

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
                        try { await auth.logout(); } catch (_) {}
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <HeroHeader
                user={user}
                role="Employee"
                showStatus={false}
                onLogout={handleLogout}
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
            >
                {/* ── Profile card ────────────────────────────────────────────── */}
                <TouchableOpacity
                    style={styles.profileCard}
                    onPress={() => navigation.navigate('Profile')}
                    activeOpacity={0.85}
                >
                    <View style={styles.profileAvatar}>
                        <Icon name="user" size={28} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.profileName}>
                            {user?.first_name && user?.last_name
                                ? `${user.first_name} ${user.last_name}`
                                : user?.username || 'Employee'}
                        </Text>
                        <Text style={styles.profileId}>
                            {user?.employee_id || 'ID not set'}
                        </Text>
                    </View>
                    <View style={styles.profileChevron}>
                        <Icon name="chevron-right" size={18} color={colors.primary} />
                    </View>
                </TouchableOpacity>

                {/* ── Filter by Date ───────────────────────────────────────────── */}
                <SectionLabel title="By Date" />
                <TouchableOpacity
                    style={styles.filterCard}
                    onPress={() => navigation.navigate('DailySummary')}
                    activeOpacity={0.8}
                >
                    <View style={[styles.menuIconWrap, { backgroundColor: colors.info + '15', marginRight: spacing.md }]}>
                        <Icon name="filter" size={20} color={colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.filterTitle}>Custom Date Filter</Text>
                        <Text style={styles.menuSub}>Pick any date — see full stats + punch list</Text>
                    </View>
                    <View style={styles.filterBadge}>
                        <Icon name="arrow-right" size={15} color={colors.surface} />
                    </View>
                </TouchableOpacity>

                {/* ── History ──────────────────────────────────────────────────── */}
                <SectionLabel title="History" />
                <MenuRow
                    title="My Requests"
                    subtitle="Track all your requests and their approval status"
                    icon="list"
                    iconColor={colors.info}
                    onPress={() => navigation.navigate('MyRequests')}
                />
                <MenuRow
                    title="Punch History"
                    subtitle="View all your punch records"
                    icon="clock"
                    iconColor={colors.primary}
                    onPress={() => navigation.navigate('PunchHistory')}
                />
                <MenuRow
                    title="Punch Corrections"
                    subtitle="Submit correction requests"
                    icon="edit-2"
                    iconColor={colors.warning}
                    onPress={() => navigation.navigate('PunchCorrection')}
                />
                <MenuRow
                    title="Allowance History"
                    subtitle="View your travel allowances"
                    icon="dollar-sign"
                    iconColor={colors.success}
                    onPress={() => navigation.navigate('AllowanceHistory')}
                />
                <MenuRow
                    title="Collection Done"
                    subtitle="Customers marked Collected or Partial"
                    icon="check-circle"
                    iconColor={colors.success}
                    onPress={() => navigation.navigate('CollectionDone')}
                />
                <MenuRow
                    title="Collection Corrections"
                    subtitle="Track your collection correction requests"
                    icon="edit-3"
                    iconColor={colors.warning}
                    onPress={() => navigation.navigate('MyCollectionCorrections')}
                />

                {/* ── Team ─────────────────────────────────────────────────────── */}
                <SectionLabel title="Team" />
                <MenuRow
                    title="Travel Companion History"
                    subtitle="See every time a colleague named you as their travel companion"
                    icon="users"
                    iconColor="#7C3AED"
                    onPress={() => navigation.navigate('CompanionHistory')}
                />

                {/* ── Analytics ────────────────────────────────────────────────── */}
                <SectionLabel title="Analytics" />
                <MenuRow
                    title="My Performance"
                    subtitle="Daily, weekly and monthly metrics"
                    icon="trending-up"
                    iconColor="#7C3AED"
                    onPress={() => navigation.navigate('MyPerformance')}
                />
                <MenuRow
                    title="Missed Punches"
                    subtitle="Track correction requests"
                    icon="alert-circle"
                    iconColor={colors.warning}
                    onPress={() => navigation.navigate('MissedPunchDashboard')}
                />

                {/* ── Settings ─────────────────────────────────────────────────── */}
                <SectionLabel title="Settings" />
                <MenuRow
                    title="Change Password"
                    subtitle="Update your login password"
                    icon="lock"
                    iconColor={colors.warning}
                    onPress={() => navigation.navigate('ChangePassword')}
                />
                <MenuRow
                    title="Route Map"
                    subtitle="View your travel route"
                    icon="map"
                    iconColor={colors.danger}
                    onPress={() => navigation.navigate('RouteMap')}
                />
                <MenuRow
                    title="Customer Map"
                    subtitle="See assigned customers on the map"
                    icon="map-pin"
                    iconColor={colors.success}
                    onPress={() => navigation.navigate('CustomerMap')}
                />
                <MenuRow
                    title="My Profile"
                    subtitle="View personal and work details"
                    icon="user"
                    iconColor={colors.primary}
                    onPress={() => navigation.navigate('Profile')}
                />
                <MenuRow
                    title="Profile Update Request"
                    subtitle="Request a change to your phone number"
                    icon="user-check"
                    iconColor={colors.info}
                    onPress={() => navigation.navigate('ProfileUpdateRequest')}
                />

                {/* ── Support ──────────────────────────────────────────────────── */}
                <SectionLabel title="Support" />
                <MenuRow
                    title="Help & Support"
                    subtitle="Company info, FAQs and IT Technical Support"
                    icon="help-circle"
                    iconColor={colors.info}
                    onPress={() => navigation.navigate('HelpSupport')}
                />

                {/* ── Footer ───────────────────────────────────────────────────── */}
                <View style={styles.footer}>
                    <Text style={styles.footerApp}>Traveling Allowance System</Text>
                    <Text style={styles.footerVer}>v 1.0.0</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default EmployeeMoreScreen;

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

    screen: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 150,
    },

    // ── Profile card
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        marginTop: spacing.md,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        ...shadows.md,
    },
    profileAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    profileName: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    profileId: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    profileChevron: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Section label
    sectionLabel: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
        marginLeft: 2,
    },

    // ── Filter card
    filterCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        ...shadows.sm,
        borderLeftWidth: 4,
        borderLeftColor: colors.info,
    },
    filterTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    filterBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.info,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Menu rows
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        marginBottom: spacing.xs,
        ...shadows.xs,
    },
    menuIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    menuText: { flex: 1 },
    menuTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.medium,
        color: colors.textDark,
    },
    menuSub: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },

    // ── Footer
    footer: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
        marginTop: spacing.md,
    },
    footerApp: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    },
    footerVer: {
        fontSize: typography.sizes.xs,
        color: colors.textLight,
        marginTop: 4,
    },
});
