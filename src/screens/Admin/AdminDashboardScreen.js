import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
    SafeAreaView
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/api';
import HeroHeader from '../../components/HeroHeader';
import { colors, typography, spacing } from '../../theme/tokens';
import { SkeletonStatsGrid } from '../../components/SkeletonComponents';

const AdminDashboardScreen = ({ navigation }) => {
    const auth = useAuth();
    const user = auth?.user;
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState({
        totalEmployees: 0,
        activeEmployees: 0,
        totalDistance: 0,
        totalCollections: 0,
        totalDisbursements: 0,
    });
    const [employees, setEmployees] = useState([]);
    const [collStats, setCollStats] = useState(null);

    const handleLogout = useCallback(() => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await auth.logout();
                    },
                },
            ]
        );
    }, [auth]);

    const fetchData = useCallback(async () => {
        try {
            const [statsRes, trackingRes, collRes] = await Promise.allSettled([
                api.get('/organization/users/stats/'),
                api.get('/tracking/employees/'),
                api.getCollectionDashboardStats(),
            ]);

            const bothFailed =
                statsRes.status === 'rejected' && trackingRes.status === 'rejected';
            if (bothFailed) {
                setError('Could not load dashboard data. Pull down to retry.');
            } else {
                setError(null);
            }

            if (statsRes.status === 'fulfilled') {
                const statsData = statsRes.value.data;
                setStats({
                    totalEmployees: statsData.total_employees || 0,
                    activeEmployees: statsData.active_employees || 0,
                    totalDistance: statsData.total_distance || 0,
                    totalCollections: statsData.total_collections || 0,
                    totalDisbursements: statsData.total_disbursements || 0,
                });
            }

            if (trackingRes.status === 'fulfilled') {
                const trackingData = trackingRes.value.data?.results || trackingRes.value.data || [];
                setEmployees(trackingData);
            }
            if (collRes.status === 'fulfilled') {
                setCollStats(collRes.value.data);
            }
        } catch (err) {
            setError('Could not load dashboard data. Pull down to retry.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData().finally(() => setRefreshing(false));
    };

    const formatCurrency = (value) => {
        if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
        if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return value.toString();
    };

    const StatCard = ({ title, value, icon, color }) => (
        <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
                <Icon name={icon} size={22} color={color} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{title}</Text>
        </View>
    );

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

    return (
        <SafeAreaView edges={['top']} style={styles.safeArea}>
            <View style={styles.container}>
                <HeroHeader
                    user={user}
                    role={user?.role || 'Admin'}
                    showStatus={true}
                    status={stats.activeEmployees > 0 ? 'online' : 'offline'}
                    onLogout={handleLogout}
                />

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {error ? (
                        <View style={styles.errorBanner}>
                            <Icon name="alert-circle" size={15} color={colors.danger} />
                            <Text style={styles.errorBannerText}>{error}</Text>
                            <TouchableOpacity onPress={fetchData}>
                                <Text style={styles.retryLink}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {isLoading ? (
                        <SkeletonStatsGrid style={{ marginBottom: spacing.md }} />
                    ) : (
                        <View style={styles.kpiSection}>
                            <View style={styles.kpiRow}>
                                <StatCard title="Total Employees" value={stats.totalEmployees} icon="users" color={colors.primary} />
                                <StatCard title="Active Today" value={stats.activeEmployees} icon="user-check" color={colors.success} />
                            </View>
                            <View style={styles.kpiRow}>
                                <StatCard title="Distance" value={`${stats.totalDistance.toFixed(0)} km`} icon="navigation" color={colors.info} />
                                <StatCard title="Collections" value={`₹${formatCurrency(stats.totalCollections)}`} icon="trending-up" color={colors.success} />
                            </View>
                        </View>
                    )}

                    <View style={styles.menuSection}>
                        <Text style={styles.sectionTitle}>Quick Actions</Text>
                        <MenuItem
                            title="My Profile"
                            subtitle="View personal & work details"
                            icon="user"
                            color={colors.primary}
                            onPress={() => navigation.navigate('Profile')}
                        />
                        <MenuItem
                            title="Pending Approvals"
                            subtitle="Review approval requests"
                            icon="check-circle"
                            color={colors.warning}
                            onPress={() => navigation.navigate('AdminApprovals')}
                        />
                        <MenuItem
                            title="Device Management"
                            subtitle="Manage employee devices"
                            icon="smartphone"
                            color={colors.info}
                            onPress={() => navigation.navigate('AdminDevices')}
                        />
                        <MenuItem
                            title="Employee Tracking"
                            subtitle="Monitor live locations"
                            icon="map-pin"
                            color={colors.primary}
                            onPress={() => navigation.navigate('EmployeeTracking')}
                        />
                        <MenuItem
                            title="Daily Activity"
                            subtitle="Distance, punches, collection by date"
                            icon="activity"
                            color={colors.info}
                            onPress={() => navigation.navigate('DailySummary')}
                        />
                        <MenuItem
                            title="Help & Support"
                            subtitle="Company info, FAQs and IT Technical Support"
                            icon="help-circle"
                            color={colors.info}
                            onPress={() => navigation.navigate('HelpSupport')}
                        />
                    </View>

                    {/* ── Collection Overview ── */}
                    {collStats && (
                        <View style={styles.collSection}>
                            <View style={styles.collHeader}>
                                <Icon name="dollar-sign" size={15} color="#d32f2f" />
                                <Text style={styles.sectionTitle}>Collection Overview</Text>
                            </View>

                            {/* Status pills */}
                            <View style={styles.collPillRow}>
                                {[
                                    { label: 'Assigned', value: collStats.total_assigned,      color: '#1d4ed8', bg: '#dbeafe' },
                                    { label: 'Pending',  value: collStats.pending,              color: '#d97706', bg: '#fef3c7' },
                                    { label: 'Collected',value: collStats.collected,            color: '#16a34a', bg: '#dcfce7' },
                                    { label: 'Partial',  value: collStats.partially_collected,  color: '#0891b2', bg: '#e0f2fe' },
                                    { label: 'Not Paid', value: collStats.not_paid,             color: '#dc2626', bg: '#fee2e2' },
                                ].map(p => (
                                    <View key={p.label} style={[styles.collPill, { backgroundColor: p.bg }]}>
                                        <Text style={[styles.collPillVal, { color: p.color }]}>{p.value}</Text>
                                        <Text style={[styles.collPillLbl, { color: p.color + 'bb' }]}>{p.label}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Amount row */}
                            <View style={styles.collAmtRow}>
                                <View style={styles.collAmtBox}>
                                    <Text style={styles.collAmtLabel}>Today Updates</Text>
                                    <Text style={styles.collAmtVal}>{collStats.today?.updates || 0}</Text>
                                </View>
                                <View style={styles.collAmtDivider} />
                                <View style={styles.collAmtBox}>
                                    <Text style={styles.collAmtLabel}>Today Amount</Text>
                                    <Text style={[styles.collAmtVal, { color: '#16a34a' }]}>
                                        {formatCurrency(collStats.today?.amount || 0)}
                                    </Text>
                                </View>
                                <View style={styles.collAmtDivider} />
                                <View style={styles.collAmtBox}>
                                    <Text style={styles.collAmtLabel}>MTD Amount</Text>
                                    <Text style={[styles.collAmtVal, { color: '#d32f2f', fontWeight: '800' }]}>
                                        ₹{formatCurrency(collStats.mtd?.amount || 0)}
                                    </Text>
                                </View>
                            </View>

                            {/* Top collectors today */}
                            {(collStats.top_collectors || []).length > 0 && (
                                <View style={styles.topSection}>
                                    <Text style={styles.topTitle}>Top Collectors Today</Text>
                                    {collStats.top_collectors.map((tc, i) => (
                                        <View key={i} style={styles.topRow}>
                                            <View style={[styles.topRank, { backgroundColor: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#cd7f32' }]}>
                                                <Text style={styles.topRankText}>{i + 1}</Text>
                                            </View>
                                            <View style={styles.topInfo}>
                                                <Text style={styles.topName}>{tc.name}</Text>
                                                <Text style={styles.topCode}>{tc.employee_code}{tc.branch ? ` · ${tc.branch}` : ''}</Text>
                                            </View>
                                            <View style={styles.topAmtBox}>
                                                <Text style={styles.topAmt}>₹{formatCurrency(tc.amount)}</Text>
                                                <Text style={styles.topCount}>{tc.count} done</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    <View style={styles.menuSection}>
                        <Text style={styles.sectionTitle}>Employee Activity</Text>
                        {employees.length === 0 ? (
                            <Text style={styles.emptyText}>No employee activity today</Text>
                        ) : (
                            employees.slice(0, 10).map((emp, index) => (
                                <TouchableOpacity
                                    key={emp.id || index}
                                    style={styles.employeeCard}
                                    onPress={() => navigation.navigate('EmployeeTracking', { employee: emp })}
                                >
                                    <View style={styles.employeeAvatar}>
                                        <Text style={styles.employeeInitial}>
                                            {(emp.name || 'U').charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={styles.employeeInfo}>
                                        <Text style={styles.employeeName}>{emp.name || 'Unknown'}</Text>
                                        <Text style={styles.employeeId}>{emp.employee_id || emp.id}</Text>
                                    </View>
                                    <View style={styles.employeeStats}>
                                        <Text style={styles.statItem}>{emp.today_punches || 0} punches</Text>
                                        <Text style={styles.statItem}>{(parseFloat(emp.distance) || 0).toFixed(1)} km</Text>
                                    </View>
                                    <Icon name="chevron-right" size={18} color={colors.textMuted} />
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 100,
    },
    kpiSection: {
        marginTop: spacing.md,
        marginBottom: spacing.lg,
    },
    kpiRow: {
        flexDirection: 'row',
        marginBottom: spacing.sm,
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        marginHorizontal: spacing.xxs,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    statIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    statValue: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    statLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
        textAlign: 'center',
    },
    menuSection: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        marginBottom: spacing.sm,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
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
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    menuSubtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    employeeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        marginBottom: spacing.sm,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
    },
    employeeAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    employeeInitial: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.primary,
    },
    employeeInfo: {
        flex: 1,
    },
    employeeName: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    employeeId: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    employeeStats: {
        alignItems: 'flex-end',
        marginRight: spacing.sm,
    },
    statItem: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    emptyText: {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        textAlign: 'center',
        padding: spacing.xl,
        backgroundColor: colors.surface,
        borderRadius: 14,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0F0',
        borderRadius: 10,
        padding: spacing.sm,
        marginTop: spacing.md,
        marginBottom: spacing.xs,
        gap: 8,
    },
    errorBannerText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: colors.danger,
    },
    retryLink: {
        fontSize: typography.sizes.sm,
        color: colors.primary,
        fontWeight: '600',
    },

    // ── Collection section ──
    collSection: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: '#fee2e2',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        overflow: 'hidden',
    },
    collHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: '#fef2f2',
    },
    collPillRow: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingVertical: 10,
        gap: 5,
    },
    collPill: {
        flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 10,
    },
    collPillVal: { fontSize: 15, fontWeight: '800' },
    collPillLbl: { fontSize: 8, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
    collAmtRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingVertical: 10,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    collAmtBox: { flex: 1, alignItems: 'center' },
    collAmtLabel: { fontSize: 10, color: '#94a3b8' },
    collAmtVal: { fontSize: 15, fontWeight: '800', color: '#1e293b', marginTop: 2 },
    collAmtDivider: { width: 1, height: 28, backgroundColor: '#e2e8f0' },
    topSection: {
        borderTopWidth: 1, borderTopColor: '#f1f5f9',
        paddingHorizontal: spacing.sm, paddingBottom: spacing.sm,
    },
    topTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: 8, marginBottom: 6 },
    topRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fafafa', borderRadius: 10,
        paddingVertical: 7, paddingHorizontal: 10, marginBottom: 5,
    },
    topRank: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    topRankText: { fontSize: 11, fontWeight: '800', color: '#fff' },
    topInfo: { flex: 1 },
    topName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
    topCode: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
    topAmtBox: { alignItems: 'flex-end' },
    topAmt: { fontSize: 13, fontWeight: '800', color: '#16a34a' },
    topCount: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
});

export default AdminDashboardScreen;
