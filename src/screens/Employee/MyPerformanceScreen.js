import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { useApiQuery } from '../../hooks/useApiQuery';
import { parseApiError } from '../../core/error/AppErrorHandler';
import { colors, typography, spacing } from '../../theme/tokens';
import { SkeletonStatsGrid, SkeletonCard } from '../../components/SkeletonComponents';

const PERIODS = [
    { key: 'daily', label: 'Today' },
    { key: 'weekly', label: 'This Week' },
    { key: 'monthly', label: 'This Month' },
];

// Monthly targets — adjust these to match real KPIs
const MONTHLY_VISIT_TARGET = 100;
const MONTHLY_AMOUNT_TARGET = 100000; // ₹1,00,000

// ─── Radial ring (View-based, no native SVG module required) ─────────────────
const RadialRing = ({ size, strokeWidth, progress, max, color, trackColor = '#F3F4F6' }) => {
    const pct = max > 0 ? Math.min(Math.max(progress / max, 0), 1) : 0;
    const half = size / 2;
    const deg1 = pct <= 0.5 ? pct * 360 - 90 : 90;
    const deg2 = pct > 0.5 ? (pct - 0.5) * 360 - 90 : -90;

    return (
        <View style={{ width: size, height: size, position: 'absolute' }}>
            {/* Track */}
            <View style={{ position: 'absolute', width: size, height: size, borderRadius: half, borderWidth: strokeWidth, borderColor: trackColor }} />
            {/* Right half clip (0–50%) */}
            <View style={{ position: 'absolute', width: half, height: size, left: half, overflow: 'hidden' }}>
                <View style={{
                    position: 'absolute', left: -half, width: size, height: size,
                    borderRadius: half, borderWidth: strokeWidth,
                    borderColor: pct > 0 ? color : 'transparent',
                    transform: [{ rotate: `${deg1}deg` }],
                }} />
            </View>
            {/* Left half clip (50–100%) */}
            {pct > 0.5 && (
                <View style={{ position: 'absolute', width: half, height: size, left: 0, overflow: 'hidden' }}>
                    <View style={{
                        position: 'absolute', left: 0, width: size, height: size,
                        borderRadius: half, borderWidth: strokeWidth,
                        borderColor: color,
                        transform: [{ rotate: `${deg2}deg` }],
                    }} />
                </View>
            )}
        </View>
    );
};

// ─── Single radial progress card ─────────────────────────────────────────────
const RadialCard = ({
    title, icon, iconColor, iconBg,
    ringColor, trackColor,
    progress, max,
    centerValue, centerSub,
    badge,
}) => {
    const SIZE = 128;
    const STROKE = 13;
    const pct = max > 0 ? Math.round(Math.min(progress / max, 1) * 100) : 0;

    return (
        <View style={rStyles.card}>
            {pct >= 100 && (
                <View style={rStyles.milestoneBadge}>
                    <Icon name="award" size={11} color="#fff" />
                </View>
            )}
            {/* Title */}
            <View style={rStyles.titleRow}>
                <View style={[rStyles.iconBox, { backgroundColor: iconBg }]}>
                    <Icon name={icon} size={14} color={iconColor} />
                </View>
                <Text style={rStyles.title} numberOfLines={1}>{title}</Text>
            </View>

            {/* Ring + center text */}
            <View style={[rStyles.ringWrap, { width: SIZE, height: SIZE }]}>
                <RadialRing
                    size={SIZE}
                    strokeWidth={STROKE}
                    progress={progress}
                    max={max}
                    color={ringColor}
                    trackColor={trackColor}
                />
                <View style={rStyles.centerOverlay}>
                    <Text style={[rStyles.centerValue, { color: ringColor }]}>{centerValue}</Text>
                    <Text style={rStyles.centerSub}>{centerSub}</Text>
                </View>
            </View>

            {/* Progress % badge */}
            <View style={[rStyles.badge, { backgroundColor: ringColor + '18' }]}>
                <Text style={[rStyles.badgePct, { color: ringColor }]}>{pct}%</Text>
                {badge ? <Text style={rStyles.badgeLabel}> {badge}</Text> : null}
            </View>
        </View>
    );
};

// ─── Motivational banner (built from real numbers only — no fabricated streaks) ─
const getMotivation = (period, data) => {
    if (!data) return null;

    const visits = Number(data.total_visits) || 0;
    const amount = Number(data.total_collection_amount) || 0;

    // Scale the monthly targets down to an implied daily/weekly pace so the
    // same "% of goal" logic works for every tab.
    const WORK_DAYS_PER_MONTH = 26;
    const WORK_DAYS_PER_WEEK = 6;
    const divisor = period === 'daily' ? WORK_DAYS_PER_MONTH
        : period === 'weekly' ? (WORK_DAYS_PER_MONTH / WORK_DAYS_PER_WEEK)
        : 1;

    const visitTarget = MONTHLY_VISIT_TARGET / divisor;
    const amountTarget = MONTHLY_AMOUNT_TARGET / divisor;
    const pct = Math.max(
        visitTarget > 0 ? visits / visitTarget : 0,
        amountTarget > 0 ? amount / amountTarget : 0,
    );

    const periodWord = period === 'daily' ? 'today' : period === 'weekly' ? 'this week' : 'this month';

    if (visits === 0 && amount === 0) {
        return {
            emoji: '🌅',
            title: period === 'daily' ? "Let's make today count!" : `No activity recorded ${periodWord} yet`,
            subtitle: 'Punch in and log your first visit to get started.',
            color: colors.info,
            bg: colors.infoLight,
        };
    }
    if (pct >= 1) {
        return {
            emoji: '🏆',
            title: `Outstanding work ${periodWord}!`,
            subtitle: `${fmtNum(visits)} visits and ₹${fmtNum(amount)} collected — goal reached.`,
            color: colors.success,
            bg: colors.successLight,
        };
    }
    if (pct >= 0.75) {
        return {
            emoji: '🔥',
            title: 'Almost there — keep the momentum!',
            subtitle: `${fmtNum(visits)} visits, ₹${fmtNum(amount)} collected ${periodWord}.`,
            color: colors.warning,
            bg: colors.warningLight,
        };
    }
    if (pct >= 0.4) {
        return {
            emoji: '💪',
            title: 'Good progress — stay consistent!',
            subtitle: `${fmtNum(visits)} visits, ₹${fmtNum(amount)} collected ${periodWord}.`,
            color: colors.primary,
            bg: colors.primaryLight,
        };
    }
    return {
        emoji: '🚀',
        title: 'Great start — keep going!',
        subtitle: `${fmtNum(visits)} visits, ₹${fmtNum(amount)} collected ${periodWord}.`,
        color: colors.primary,
        bg: colors.primaryLight,
    };
};

const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');

const MotivationBanner = ({ period, data }) => {
    const m = getMotivation(period, data);
    if (!m) return null;
    return (
        <View style={[mStyles.card, { backgroundColor: m.bg }]}>
            <Text style={mStyles.emoji}>{m.emoji}</Text>
            <View style={{ flex: 1 }}>
                <Text style={[mStyles.title, { color: m.color }]}>{m.title}</Text>
                <Text style={mStyles.subtitle}>{m.subtitle}</Text>
            </View>
        </View>
    );
};

const mStyles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 18,
        padding: spacing.md,
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    emoji: { fontSize: 32 },
    title: { fontSize: 15, fontWeight: '800' },
    subtitle: { fontSize: 12, color: colors.textMedium, marginTop: 2 },
});

// ─── Existing small metric card ───────────────────────────────────────────────
const MetricCard = ({ icon, iconColor, iconBg, label, value, sub }) => (
    <View style={styles.metricCard}>
        <View style={[styles.metricIcon, { backgroundColor: iconBg }]}>
            <Icon name={icon} size={20} color={iconColor} />
        </View>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
        {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
);

// ─── Screen ──────────────────────────────────────────────────────────────────
const MyPerformanceScreen = ({ navigation }) => {
    const [period, setPeriod] = useState('daily');

    // Cache-then-network is now react-query's job (persisted to AsyncStorage
    // via the app-level persister in src/queryClient.js) instead of this
    // screen hand-rolling its own @performance_cache_{period} snapshot —
    // isStale/staleAsOf below are derived from the query result the same
    // way, just without a second, screen-local copy of the same data.
    const {
        data,
        isLoading: loading,
        isFetching,
        error: queryError,
        dataUpdatedAt,
        refetch,
    } = useApiQuery(['performance', period], () => api.getPerformance(period));

    const refreshing = isFetching && !loading;
    // A global interceptor already handles 401 (logout/redirect) — this
    // screen just avoids flashing its own error banner right before that
    // happens, matching the original fetchData's early-return on 401.
    const is401 = queryError?.response?.status === 401;
    const error = (queryError && !is401 && !data) ? parseApiError(queryError).message : null;
    const isStale = !!(data && queryError && !is401);
    const staleAsOf = isStale ? dataUpdatedAt : null;

    const fmt = (num) => {
        if (num === undefined || num === null) return '—';
        return Number(num).toLocaleString('en-IN');
    };
    const fmtKm = (num) => {
        if (num === undefined || num === null) return '—';
        return `${Number(num).toFixed(2)} km`;
    };
    const fmtCurrency = (num) => {
        if (num === undefined || num === null) return '—';
        return `₹${Number(num).toLocaleString('en-IN')}`;
    };

    // Compact currency for ring center (₹45K instead of ₹45,000)
    const fmtCompact = (num) => {
        if (num === undefined || num === null) return '—';
        const n = Number(num);
        if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
        if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
        return `₹${n}`;
    };

    // ── Radial hero section (monthly only) ────────────────────────────────────
    const renderMonthlyRadials = () => {
        if (!data) return null;
        const visits = Number(data.total_visits) || 0;
        const amount = Number(data.total_collection_amount) || 0;

        return (
            <View style={styles.radialSection}>
                <Text style={styles.radialHeading}>Monthly Progress</Text>
                <View style={styles.radialRow}>
                    {/* Visits ring */}
                    <RadialCard
                        title="Total Visits"
                        icon="users"
                        iconColor={colors.success}
                        iconBg={colors.successLight}
                        ringColor={colors.success}
                        trackColor={colors.successLight}
                        progress={visits}
                        max={MONTHLY_VISIT_TARGET}
                        centerValue={fmt(visits)}
                        centerSub="visits"
                        badge={`of ${MONTHLY_VISIT_TARGET}`}
                    />
                    {/* Collection amount ring */}
                    <RadialCard
                        title="Collection Amt"
                        icon="trending-up"
                        iconColor={colors.primary}
                        iconBg={colors.primaryLight}
                        ringColor={colors.primary}
                        trackColor={colors.primaryLight}
                        progress={amount}
                        max={MONTHLY_AMOUNT_TARGET}
                        centerValue={fmtCompact(amount)}
                        centerSub="collected"
                        badge="of ₹1L target"
                    />
                </View>
                {/* Sub-stats below rings */}
                <View style={styles.radialSubRow}>
                    <View style={styles.radialStat}>
                        <Icon name="map-pin" size={13} color={colors.textMuted} />
                        <Text style={styles.radialStatLabel}> Avg visits/day</Text>
                        <Text style={styles.radialStatVal}>{data.avg_daily_visits ?? '—'}</Text>
                    </View>
                    <View style={styles.radialStatDivider} />
                    <View style={styles.radialStat}>
                        <Icon name="calendar" size={13} color={colors.textMuted} />
                        <Text style={styles.radialStatLabel}> Working days</Text>
                        <Text style={styles.radialStatVal}>{fmt(data.working_days)}</Text>
                    </View>
                    <View style={styles.radialStatDivider} />
                    <View style={styles.radialStat}>
                        <Icon name="check-circle" size={13} color={colors.textMuted} />
                        <Text style={styles.radialStatLabel}> Collections</Text>
                        <Text style={styles.radialStatVal}>{fmt(data.total_collections)}</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderMetrics = () => {
        if (!data) return null;

        if (period === 'daily') {
            return (
                <>
                    <View style={styles.row}>
                        <MetricCard icon="map" iconColor={colors.primary} iconBg={colors.primaryLight} label="Distance" value={fmtKm(data.total_distance)} />
                        <MetricCard icon="clock" iconColor={colors.info} iconBg={colors.infoLight} label="Working Hours" value={data.working_hours || '—'} />
                    </View>
                    <View style={styles.row}>
                        <MetricCard icon="users" iconColor={colors.success} iconBg={colors.successLight} label="Visits" value={fmt(data.total_visits)} />
                        <MetricCard icon="activity" iconColor={colors.warning} iconBg={colors.warningLight} label="Total Punches" value={fmt(data.total_punches)} />
                    </View>
                    <View style={styles.row}>
                        <MetricCard icon="dollar-sign" iconColor={colors.success} iconBg={colors.successLight} label="Collections" value={fmt(data.total_collections)} />
                        <MetricCard icon="trending-up" iconColor={colors.primary} iconBg={colors.primaryLight} label="Collection Amt" value={fmtCurrency(data.total_collection_amount)} />
                    </View>
                </>
            );
        }

        if (period === 'weekly') {
            return (
                <>
                    <View style={styles.row}>
                        <MetricCard icon="map" iconColor={colors.primary} iconBg={colors.primaryLight} label="Distance" value={fmtKm(data.total_distance)} />
                        <MetricCard icon="calendar" iconColor={colors.info} iconBg={colors.infoLight} label="Working Days" value={fmt(data.working_days)} />
                    </View>
                    <View style={styles.row}>
                        <MetricCard icon="users" iconColor={colors.success} iconBg={colors.successLight} label="Visits" value={fmt(data.total_visits)} />
                        <MetricCard icon="activity" iconColor={colors.warning} iconBg={colors.warningLight} label="Total Punches" value={fmt(data.total_punches)} />
                    </View>
                    <View style={styles.row}>
                        <MetricCard icon="dollar-sign" iconColor={colors.success} iconBg={colors.successLight} label="Collections" value={fmt(data.total_collections)} />
                        <MetricCard icon="trending-up" iconColor={colors.primary} iconBg={colors.primaryLight} label="Collection Amt" value={fmtCurrency(data.total_collection_amount)} />
                    </View>
                </>
            );
        }

        // monthly — radials above, remaining cards below
        return (
            <>
                {renderMonthlyRadials()}
                <Text style={styles.sectionLabel}>Other Stats</Text>
                <View style={styles.row}>
                    <MetricCard icon="map" iconColor={colors.primary} iconBg={colors.primaryLight} label="Distance" value={fmtKm(data.total_distance)} sub={data.avg_daily_distance != null ? `Avg ${fmtKm(data.avg_daily_distance)}/day` : null} />
                    <MetricCard icon="activity" iconColor={colors.warning} iconBg={colors.warningLight} label="Total Punches" value={fmt(data.total_punches)} />
                </View>
            </>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={22} color={colors.textDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Performance</Text>
                <View style={{ width: 38 }} />
            </View>

            {/* Period Tabs */}
            <View style={styles.tabBar}>
                {PERIODS.map((p) => (
                    <TouchableOpacity
                        key={p.key}
                        style={[styles.tab, period === p.key && styles.tabActive]}
                        onPress={() => setPeriod(p.key)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.tabText, period === p.key && styles.tabTextActive]}>
                            {p.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={{ padding: spacing.md }}>
                    <SkeletonStatsGrid style={{ marginBottom: spacing.md }} />
                    <SkeletonCard />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => refetch()}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                >
                    {error ? (
                        <View style={styles.centered}>
                            <Icon name="alert-circle" size={48} color={colors.danger} />
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
                                <Icon name="refresh-cw" size={16} color="#fff" />
                                <Text style={styles.retryBtnText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    ) : data ? (
                        <>
                            {isStale && (
                                <View style={styles.staleBanner}>
                                    <Icon name="wifi-off" size={13} color={colors.warning} />
                                    <Text style={styles.staleBannerText}>
                                        Showing last synced data{staleAsOf ? ` · ${new Date(staleAsOf).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                                    </Text>
                                </View>
                            )}
                            <MotivationBanner period={period} data={data} />
                            <View style={styles.dateRange}>
                                <Icon name="calendar" size={13} color={colors.textMuted} />
                                <Text style={styles.dateRangeText}>
                                    {data.date_from === data.date_to
                                        ? data.date_from
                                        : `${data.date_from}  →  ${data.date_to}`}
                                </Text>
                            </View>
                            {renderMetrics()}
                        </>
                    ) : (
                        <View style={styles.centered}>
                            <Icon name="bar-chart-2" size={48} color={colors.border} />
                            <Text style={styles.emptyText}>No data for this period</Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

// ─── Radial card styles ───────────────────────────────────────────────────────
const rStyles = StyleSheet.create({
    card: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: spacing.md,
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        position: 'relative',
    },
    milestoneBadge: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.warning,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.surface,
        elevation: 4,
        zIndex: 10,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: spacing.sm,
        alignSelf: 'flex-start',
    },
    iconBox: {
        width: 26,
        height: 26,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textMedium,
        flexShrink: 1,
    },
    ringWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    centerOverlay: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerValue: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    centerSub: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 1,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginTop: spacing.sm,
    },
    badgePct: {
        fontSize: 13,
        fontWeight: '700',
    },
    badgeLabel: {
        fontSize: 11,
        color: colors.textMuted,
    },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
        gap: spacing.xs,
    },
    tab: {
        flex: 1,
        paddingVertical: spacing.xs,
        borderRadius: 20,
        alignItems: 'center',
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted },
    tabTextActive: { color: '#fff' },
    scrollContent: { padding: spacing.md, paddingBottom: 100 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
    emptyText: { marginTop: spacing.md, fontSize: typography.sizes.sm, color: colors.textMuted },
    errorText: { marginTop: spacing.md, fontSize: typography.sizes.sm, color: colors.danger, textAlign: 'center' },
    retryBtn: {
        flexDirection: 'row', alignItems: 'center', marginTop: spacing.md,
        backgroundColor: colors.primary, paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm, borderRadius: 24, gap: 6,
    },
    retryBtnText: { color: '#fff', fontSize: typography.sizes.sm, fontWeight: '600' },
    dateRange: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.md },
    dateRangeText: { fontSize: typography.sizes.xs, color: colors.textMuted },
    staleBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: colors.warningLight, borderRadius: 10,
        paddingVertical: 6, paddingHorizontal: spacing.sm, marginBottom: spacing.sm,
    },
    staleBannerText: { fontSize: 11, color: colors.warning, fontWeight: '600' },
    row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textMuted,
        marginBottom: spacing.sm,
        marginTop: spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Radial section
    radialSection: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: spacing.md,
        marginBottom: spacing.sm,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
    },
    radialHeading: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.textDark,
        marginBottom: spacing.sm,
    },
    radialRow: { flexDirection: 'row', gap: spacing.sm },
    radialSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    radialStat: { alignItems: 'center', flexDirection: 'row', gap: 3 },
    radialStatLabel: { fontSize: 11, color: colors.textMuted },
    radialStatVal: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginLeft: 4 },
    radialStatDivider: { width: 1, height: 20, backgroundColor: colors.border },

    // Metric card
    metricCard: {
        flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md,
        alignItems: 'center', elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
    },
    metricIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
    metricValue: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.textDark, textAlign: 'center' },
    metricLabel: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
    metricSub: { fontSize: 11, color: colors.textLight, marginTop: 2, textAlign: 'center' },
});

export default MyPerformanceScreen;
