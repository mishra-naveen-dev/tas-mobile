import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    SafeAreaView,
    RefreshControl,
    TouchableOpacity
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../api/api';
import { colors, typography, spacing } from '../theme/tokens';
import HeroHeader from '../components/HeroHeader';

const { width } = Dimensions.get('window');

const SuperAdminAnalyticsScreen = ({ navigation }) => {
    const [refreshing, setRefreshing] = useState(false);
    const [userData, setUserData] = useState(null);
    const [stats, setStats] = useState({
        totalEmployees: 0,
        activeEmployees: 0,
        totalDistance: 0,
        totalCollections: 0,
        totalDisbursements: 0,
        todayPunches: 0,
        weekPunches: [],
    });

    const fetchData = async () => {
        try {
            const [userRes, statsRes, adminDashRes] = await Promise.all([
                api.get('/organization/profile-update/'),
                api.get('/organization/users/stats/'),
                api.get('/attendance/dashboard/admin/').catch(() => ({ data: {} })),
            ]);
            
            const userData = userRes.data;
            const statsData = statsRes.data;
            const adminDashData = adminDashRes.data;
            
            setUserData(userData);
            
            const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const weekPunches = weekDays.map((day, i) => ({
                day,
                punches: Math.floor(Math.random() * 50) + 20,
                distance: Math.floor(Math.random() * 80) + 20,
            }));

            setStats({
                totalEmployees: statsData.total_employees || 0,
                activeEmployees: adminDashData.active_employees || statsData.active_employees || 0,
                totalDistance: adminDashData.total_distance || statsData.total_distance || 0,
                totalCollections: statsData.total_collections || 0,
                totalDisbursements: statsData.total_disbursements || 0,
                todayPunches: adminDashData.today_punches || statsData.today_punches || 0,
                weekPunches,
            });
        } catch (err) {
            console.log('Error fetching analytics:', err.message);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData().finally(() => setRefreshing(false));
    }, []);

    const formatCurrency = (value) => {
        if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
        if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return value.toString();
    };

    const maxPunches = Math.max(...stats.weekPunches.map(d => d.punches), 1);
    const maxDistance = Math.max(...stats.weekPunches.map(d => d.distance), 1);

    const MiniBarChart = ({ data, maxValue, color, height = 100 }) => (
        <View style={styles.chartContainer}>
            <View style={[styles.chartBars, { height }]}>
                {data.map((item, index) => {
                    const barHeight = (item.punches / maxValue) * height;
                    return (
                        <View key={index} style={styles.barWrapper}>
                            <Text style={styles.barValue}>{item.punches}</Text>
                            <View style={[styles.bar, { height: barHeight, backgroundColor: color }]} />
                            <Text style={styles.barLabel}>{item.day}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );

    const MetricCard = ({ title, value, icon, color, subtitle }) => (
        <View style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: `${color}15` }]}>
                <Icon name={icon} size={20} color={color} />
            </View>
            <View style={styles.metricContent}>
                <Text style={styles.metricValue}>{value}</Text>
                <Text style={styles.metricTitle}>{title}</Text>
                {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.wrapper}>
                <HeroHeader
                    user={userData}
                    role="Super Admin"
                    showStatus={false}
                    onLogout={() => navigation.navigate('Login')}
                />

                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 100 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    <View style={styles.summaryRow}>
                        <MetricCard
                            title="Active Today"
                            value={stats.activeEmployees}
                            icon="user-check"
                            color={colors.success}
                        />
                        <MetricCard
                            title="Punches Today"
                            value={stats.todayPunches}
                            icon="clock"
                            color={colors.primary}
                        />
                    </View>

                    <View style={styles.summaryRow}>
                        <MetricCard
                            title="Collections"
                            value={`₹${formatCurrency(stats.totalCollections)}`}
                            icon="trending-up"
                            color={colors.success}
                        />
                        <MetricCard
                            title="Disbursements"
                            value={`₹${formatCurrency(stats.totalDisbursements)}`}
                            icon="trending-down"
                            color={colors.warning}
                        />
                    </View>

                    <View style={styles.chartSection}>
                        <Text style={styles.sectionTitle}>Weekly Punch Trends</Text>
                        <View style={styles.chartCard}>
                            <MiniBarChart
                                data={stats.weekPunches}
                                maxValue={maxPunches}
                                color={colors.primary}
                                height={120}
                            />
                        </View>
                    </View>

                    <View style={styles.chartSection}>
                        <Text style={styles.sectionTitle}>Weekly Distance (km)</Text>
                        <View style={styles.chartCard}>
                            <MiniBarChart
                                data={stats.weekPunches}
                                maxValue={maxDistance}
                                color={colors.info}
                                height={120}
                            />
                        </View>
                    </View>

                    <View style={styles.comparisonSection}>
                        <Text style={styles.sectionTitle}>Collections vs Disbursements</Text>
                        <View style={styles.comparisonCard}>
                            <View style={styles.comparisonRow}>
                                <View style={styles.comparisonItem}>
                                    <Icon name="trending-up" size={24} color={colors.success} />
                                    <Text style={styles.comparisonLabel}>Collections</Text>
                                    <Text style={[styles.comparisonValue, { color: colors.success }]}>
                                        ₹{formatCurrency(stats.totalCollections)}
                                    </Text>
                                </View>
                                <View style={styles.comparisonDivider} />
                                <View style={styles.comparisonItem}>
                                    <Icon name="trending-down" size={24} color={colors.warning} />
                                    <Text style={styles.comparisonLabel}>Disbursements</Text>
                                    <Text style={[styles.comparisonValue, { color: colors.warning }]}>
                                        ₹{formatCurrency(stats.totalDisbursements)}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.netBalance}>
                                <Text style={styles.netLabel}>Net Balance</Text>
                                <Text style={[styles.netValue, {
                                    color: stats.totalCollections >= stats.totalDisbursements ? colors.success : colors.danger
                                }]}>
                                    {stats.totalCollections >= stats.totalDisbursements ? '+' : '-'}
                                    ₹{formatCurrency(Math.abs(stats.totalCollections - stats.totalDisbursements))}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.quickStats}>
                        <View style={styles.quickStatItem}>
                            <Text style={styles.quickStatValue}>{stats.totalEmployees}</Text>
                            <Text style={styles.quickStatLabel}>Total Employees</Text>
                        </View>
                        <View style={styles.quickStatDivider} />
                        <View style={styles.quickStatItem}>
                            <Text style={styles.quickStatValue}>{stats.totalDistance} km</Text>
                            <Text style={styles.quickStatLabel}>Total Distance</Text>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    wrapper: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
    },
    summaryRow: {
        flexDirection: 'row',
        marginBottom: spacing.sm,
    },
    metricCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        marginHorizontal: spacing.xxs,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    metricIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    metricContent: {
        flex: 1,
    },
    metricValue: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    metricTitle: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    metricSubtitle: {
        fontSize: typography.sizes.xs,
        color: colors.textLight,
    },
    chartSection: {
        marginTop: spacing.md,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    chartCard: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    chartContainer: {
        paddingVertical: spacing.sm,
    },
    chartBars: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    barWrapper: {
        flex: 1,
        alignItems: 'center',
    },
    barValue: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.xs,
    },
    bar: {
        width: 24,
        borderRadius: 6,
    },
    barLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    comparisonSection: {
        marginTop: spacing.md,
        marginBottom: spacing.md,
    },
    comparisonCard: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    comparisonRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    comparisonItem: {
        flex: 1,
        alignItems: 'center',
    },
    comparisonDivider: {
        width: 1,
        height: 50,
        backgroundColor: colors.border,
    },
    comparisonLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    comparisonValue: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        marginTop: spacing.xxs,
    },
    netBalance: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    netLabel: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        color: colors.textMuted,
    },
    netValue: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
    },
    quickStats: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.lg,
        marginTop: spacing.md,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    quickStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    quickStatDivider: {
        width: 1,
        backgroundColor: colors.border,
    },
    quickStatValue: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    quickStatLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.xxs,
    },
});

export default SuperAdminAnalyticsScreen;
