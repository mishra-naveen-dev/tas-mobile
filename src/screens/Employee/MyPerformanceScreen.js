import React, { useState, useEffect, useCallback } from 'react';
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
import { colors, typography, spacing } from '../../theme/tokens';

const PERIODS = [
    { key: 'daily', label: 'Today' },
    { key: 'weekly', label: 'This Week' },
    { key: 'monthly', label: 'This Month' },
];

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

const MyPerformanceScreen = ({ navigation }) => {
    const [period, setPeriod] = useState('daily');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async (selectedPeriod, isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await api.getPerformance(selectedPeriod);
            setData(res.data);
            setError(null);
        } catch (err) {
            setData(null);
            setError('Failed to load performance data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData(period);
    }, [period, fetchData]);

    const handlePeriodChange = (key) => {
        setPeriod(key);
    };

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

    const renderMetrics = () => {
        if (!data) return null;

        if (period === 'daily') {
            return (
                <>
                    <View style={styles.row}>
                        <MetricCard
                            icon="map"
                            iconColor={colors.primary}
                            iconBg={colors.primaryLight}
                            label="Distance"
                            value={fmtKm(data.total_distance)}
                        />
                        <MetricCard
                            icon="clock"
                            iconColor={colors.info}
                            iconBg={colors.infoLight}
                            label="Working Hours"
                            value={data.working_hours || '—'}
                        />
                    </View>
                    <View style={styles.row}>
                        <MetricCard
                            icon="users"
                            iconColor={colors.success}
                            iconBg={colors.successLight}
                            label="Visits"
                            value={fmt(data.total_visits)}
                        />
                        <MetricCard
                            icon="activity"
                            iconColor={colors.warning}
                            iconBg={colors.warningLight}
                            label="Total Punches"
                            value={fmt(data.total_punches)}
                        />
                    </View>
                    <View style={styles.row}>
                        <MetricCard
                            icon="dollar-sign"
                            iconColor={colors.success}
                            iconBg={colors.successLight}
                            label="Collections"
                            value={fmt(data.total_collections)}
                        />
                        <MetricCard
                            icon="trending-up"
                            iconColor={colors.primary}
                            iconBg={colors.primaryLight}
                            label="Collection Amt"
                            value={fmtCurrency(data.total_collection_amount)}
                        />
                    </View>
                </>
            );
        }

        if (period === 'weekly') {
            return (
                <>
                    <View style={styles.row}>
                        <MetricCard
                            icon="map"
                            iconColor={colors.primary}
                            iconBg={colors.primaryLight}
                            label="Distance"
                            value={fmtKm(data.total_distance)}
                        />
                        <MetricCard
                            icon="calendar"
                            iconColor={colors.info}
                            iconBg={colors.infoLight}
                            label="Working Days"
                            value={fmt(data.working_days)}
                        />
                    </View>
                    <View style={styles.row}>
                        <MetricCard
                            icon="users"
                            iconColor={colors.success}
                            iconBg={colors.successLight}
                            label="Visits"
                            value={fmt(data.total_visits)}
                        />
                        <MetricCard
                            icon="activity"
                            iconColor={colors.warning}
                            iconBg={colors.warningLight}
                            label="Total Punches"
                            value={fmt(data.total_punches)}
                        />
                    </View>
                    <View style={styles.row}>
                        <MetricCard
                            icon="dollar-sign"
                            iconColor={colors.success}
                            iconBg={colors.successLight}
                            label="Collections"
                            value={fmt(data.total_collections)}
                        />
                        <MetricCard
                            icon="trending-up"
                            iconColor={colors.primary}
                            iconBg={colors.primaryLight}
                            label="Collection Amt"
                            value={fmtCurrency(data.total_collection_amount)}
                        />
                    </View>
                </>
            );
        }

        // monthly
        return (
            <>
                <View style={styles.row}>
                    <MetricCard
                        icon="map"
                        iconColor={colors.primary}
                        iconBg={colors.primaryLight}
                        label="Distance"
                        value={fmtKm(data.total_distance)}
                        sub={data.avg_daily_distance != null ? `Avg ${fmtKm(data.avg_daily_distance)}/day` : null}
                    />
                    <MetricCard
                        icon="calendar"
                        iconColor={colors.info}
                        iconBg={colors.infoLight}
                        label="Working Days"
                        value={fmt(data.working_days)}
                    />
                </View>
                <View style={styles.row}>
                    <MetricCard
                        icon="users"
                        iconColor={colors.success}
                        iconBg={colors.successLight}
                        label="Visits"
                        value={fmt(data.total_visits)}
                        sub={data.avg_daily_visits != null ? `Avg ${data.avg_daily_visits}/day` : null}
                    />
                    <MetricCard
                        icon="activity"
                        iconColor={colors.warning}
                        iconBg={colors.warningLight}
                        label="Total Punches"
                        value={fmt(data.total_punches)}
                    />
                </View>
                <View style={styles.row}>
                    <MetricCard
                        icon="dollar-sign"
                        iconColor={colors.success}
                        iconBg={colors.successLight}
                        label="Collections"
                        value={fmt(data.total_collections)}
                    />
                    <MetricCard
                        icon="trending-up"
                        iconColor={colors.primary}
                        iconBg={colors.primaryLight}
                        label="Collection Amt"
                        value={fmtCurrency(data.total_collection_amount)}
                    />
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
                        onPress={() => handlePeriodChange(p.key)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.tabText, period === p.key && styles.tabTextActive]}>
                            {p.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchData(period, true)}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                >
                    {error ? (
                        <View style={styles.centered}>
                            <Icon name="alert-circle" size={48} color={colors.danger} />
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity
                                style={styles.retryBtn}
                                onPress={() => fetchData(period, true)}
                            >
                                <Icon name="refresh-cw" size={16} color="#fff" />
                                <Text style={styles.retryBtnText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    ) : data ? (
                        <>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
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
    backBtn: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
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
    tabActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    tabText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
    },
    tabTextActive: {
        color: '#fff',
    },
    scrollContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxxl,
    },
    emptyText: {
        marginTop: spacing.md,
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    errorText: {
        marginTop: spacing.md,
        fontSize: typography.sizes.sm,
        color: colors.danger,
        textAlign: 'center',
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        borderRadius: 24,
        gap: 6,
    },
    retryBtnText: {
        color: '#fff',
        fontSize: typography.sizes.sm,
        fontWeight: '600',
    },
    dateRange: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: spacing.md,
    },
    dateRangeText: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    },
    row: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    metricCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
    },
    metricIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    metricValue: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        textAlign: 'center',
    },
    metricLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
        textAlign: 'center',
    },
    metricSub: {
        fontSize: 11,
        color: colors.textLight,
        marginTop: 2,
        textAlign: 'center',
    },
});

export default MyPerformanceScreen;
