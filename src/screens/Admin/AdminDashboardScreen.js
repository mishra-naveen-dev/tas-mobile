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

const AdminDashboardScreen = ({ navigation }) => {
    const auth = useAuth();
    const user = auth?.user;
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
            const [statsRes, trackingRes] = await Promise.allSettled([
                api.get('/organization/users/stats/'),
                api.get('/tracking/employees/'),
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
        } catch (err) {
            setError('Could not load dashboard data. Pull down to retry.');
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
                    </View>

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
});

export default AdminDashboardScreen;
