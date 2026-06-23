import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useAuth } from '../../context/AuthContext';
import HeroHeader from '../../components/HeroHeader';
import api from '../../api/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';

// ─── helpers ──────────────────────────────────────────────────────────────────

const getTodayStr = () => new Date().toISOString().split('T')[0];

const getTodayLabel = () =>
    new Date().toLocaleDateString('default', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
    });

const isVisitPunch = (p) => {
    const t = (p.punch_type || p.visit_type || '').toUpperCase();
    return t.includes('VISIT') || (p.visit_type && p.visit_type !== '' && !t.includes('PUNCH'));
};

// ─── stat tile ────────────────────────────────────────────────────────────────

const StatTile = ({ icon, iconColor, bgColor, label, value, loading }) => (
    <View style={styles.tile}>
        <View style={[styles.tileIconWrap, { backgroundColor: bgColor }]}>
            <Icon name={icon} size={17} color={iconColor} />
        </View>
        {loading ? (
            <ActivityIndicator size="small" color={iconColor} style={{ marginVertical: 4 }} />
        ) : (
            <Text style={[styles.tileValue, { color: iconColor }]}>{value}</Text>
        )}
        <Text style={styles.tileLabel}>{label}</Text>
    </View>
);

// ─── activity snapshot card ───────────────────────────────────────────────────

const SnapshotCard = ({ accentColor, icon, title, subtitle, stats, loading, error, onRetry }) => (
    <View style={[styles.snapCard, { borderLeftColor: accentColor }]}>
        {/* card header */}
        <View style={styles.snapHeader}>
            <View style={[styles.snapIconWrap, { backgroundColor: accentColor + '18' }]}>
                <Icon name={icon} size={18} color={accentColor} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.snapTitle}>{title}</Text>
                <Text style={styles.snapSub}>{subtitle}</Text>
            </View>
        </View>

        {/* divider */}
        <View style={styles.snapDivider} />

        {/* body */}
        {error ? (
            <View style={styles.snapError}>
                <Icon name="wifi-off" size={14} color={colors.textMuted} />
                <Text style={styles.snapErrorText}>{error}</Text>
                {onRetry && (
                    <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                )}
            </View>
        ) : (
            <View style={styles.tileGrid}>
                {stats.map((s) => (
                    <StatTile
                        key={s.label}
                        icon={s.icon}
                        iconColor={s.iconColor}
                        bgColor={s.bgColor}
                        label={s.label}
                        value={s.value}
                        loading={loading}
                    />
                ))}
            </View>
        )}
    </View>
);

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

    const emptyStats = { distance: 0, punches: 0, collection: 0, visits: 0 };

    const [todayStats, setTodayStats]       = useState(emptyStats);
    const [todayLoading, setTodayLoading]   = useState(true);
    const [todayError, setTodayError]       = useState(null);

    const [refreshing, setRefreshing]       = useState(false);

    // ── fetch today ────────────────────────────────────────────────────────────
    const loadToday = useCallback(async () => {
        setTodayLoading(true);
        setTodayError(null);
        try {
            const res       = await api.getDailySummary({ date: getTodayStr() });
            const d         = res.data;
            const punches   = Array.isArray(d.punches) ? d.punches : [];
            setTodayStats({
                distance:   Math.round(parseFloat(d.total_distance_today || 0) * 10) / 10,
                punches:    d.punch_count || 0,
                collection: Math.round(parseFloat(d.total_collection || 0)),
                visits:     punches.filter(isVisitPunch).length,
            });
        } catch (err) {
            setTodayError("Could not load today data");
        } finally {
            setTodayLoading(false);
        }
    }, []);

    useEffect(() => {
        loadToday();
    }, [loadToday]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadToday();
        setRefreshing(false);
    }, [loadToday]);

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

    // ── stat definitions ───────────────────────────────────────────────────────

    const STAT_DEFS = (data) => [
        {
            label:     'Distance',
            value:     `${data.distance} km`,
            icon:      'map-pin',
            iconColor: colors.primary,
            bgColor:   colors.primaryLight,
        },
        {
            label:     'Punches',
            value:     data.punches,
            icon:      'clock',
            iconColor: colors.punchBlue,
            bgColor:   colors.punchBlueLight,
        },
        {
            label:     'Collection',
            value:     `₹${data.collection}`,
            icon:      'trending-up',
            iconColor: colors.success,
            bgColor:   colors.successLight,
        },
        {
            label:     'Visits',
            value:     data.visits,
            icon:      'navigation',
            iconColor: colors.info,
            bgColor:   colors.infoLight,
        },
    ];

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

                {/* ── Activity Snapshots ───────────────────────────────────────── */}
                <SectionLabel title="Activity" />

                {/* Today */}
                <SnapshotCard
                    accentColor={colors.primary}
                    icon="sun"
                    title={getTodayLabel()}
                    subtitle="Live — pull down to refresh"
                    stats={STAT_DEFS(todayStats)}
                    loading={todayLoading}
                    error={todayError}
                    onRetry={loadToday}
                />

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
                    title="My Profile"
                    subtitle="View personal and work details"
                    icon="user"
                    iconColor={colors.primary}
                    onPress={() => navigation.navigate('Profile')}
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

    // ── Snapshot card
    snapCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderLeftWidth: 4,
        marginBottom: spacing.sm,
        ...shadows.sm,
        overflow: 'hidden',
    },
    snapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        gap: spacing.sm,
    },
    snapIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.xs,
    },
    snapTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    snapSub: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 1,
    },
    snapDivider: {
        height: 1,
        backgroundColor: colors.background,
        marginHorizontal: spacing.md,
    },
    snapError: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        gap: spacing.xs,
    },
    snapErrorText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    retryBtn: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.primaryLight,
    },
    retryText: {
        fontSize: typography.sizes.xs,
        color: colors.primary,
        fontWeight: typography.weights.semibold,
    },

    // ── Tile grid (2×2)
    tileGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.sm,
        paddingBottom: spacing.md,
        paddingTop: spacing.sm,
    },
    tile: {
        width: '50%',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    tileIconWrap: {
        width: 38,
        height: 38,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    tileValue: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
    },
    tileLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
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
