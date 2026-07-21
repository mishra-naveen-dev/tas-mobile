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
import { SkeletonListItem } from '../../components/SkeletonComponents';

const SuperAdminHomeScreen = ({ navigation }) => {
    const auth = useAuth();
    const user = auth?.user;
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalEmployees: 0,
        activeEmployees: 0,
        totalDistance: 0,
        totalCollections: 0,
        totalDisbursements: 0,
        pendingApprovals: 0,
        newDevices: 0,
        deviceUnlocks: 0,
        todayPunches: 0,
        yesterdayPunches: 0,
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
            setLoading(true);
            
            const [
                usersRes,
                devicesRes,
                approvalsRes,
                dashboardRes,
                todayPunchesRes,
                pendingDevicesRes,
                collRes,
            ] = await Promise.allSettled([
                api.get('/organization/users/'),
                api.get('/organization/users/stats/'),
                api.get('/organization/approval-routes/pending/'),
                api.get('/attendance/dashboard/admin/'),
                api.get('/attendance/punches/today_punches/'),
                api.get('/organization/devices/pending_devices/'),
                api.getCollectionDashboardStats(),
            ]);

            let totalEmployees = 0;
            let activeEmployees = 0;
            let totalDistance = 0;
            let totalCollections = 0;
            let totalDisbursements = 0;

            if (usersRes.status === 'fulfilled') {
                const users = usersRes.value.data?.results || usersRes.value.data || [];
                totalEmployees = users.length;
                activeEmployees = users.filter(u => u.is_active).length;
                setEmployees(users.slice(0, 10)); // Show first 10 employees
            }

            if (devicesRes.status === 'fulfilled') {
                const statsData = devicesRes.value.data;
                totalDistance = statsData?.total_distance || 0;
                totalCollections = statsData?.total_collections || 0;
                totalDisbursements = statsData?.total_disbursements || 0;
            }

            let pendingApprovals = 0;
            if (approvalsRes.status === 'fulfilled') {
                const approvals = approvalsRes.value.data?.results || approvalsRes.value.data || [];
                pendingApprovals = approvals.length;
            }

            let todayPunches = 0;
            if (todayPunchesRes.status === 'fulfilled') {
                const punches = todayPunchesRes.value.data?.results || todayPunchesRes.value.data || [];
                todayPunches = punches.length;
            }

            let newDevices = 0;
            if (pendingDevicesRes.status === 'fulfilled') {
                const devices = pendingDevicesRes.value.data?.results || pendingDevicesRes.value.data || [];
                newDevices = devices.length;
            }

            if (dashboardRes.status === 'fulfilled') {
                const dashData = dashboardRes.value.data;
                totalDistance = dashData?.total_distance || totalDistance;
                totalCollections = dashData?.total_collection || totalCollections;
                totalDisbursements = dashData?.total_disbursement || totalDisbursements;
                todayPunches = dashData?.punch_count || todayPunches;
            }

            setStats({
                totalEmployees,
                activeEmployees,
                totalDistance,
                totalCollections,
                totalDisbursements,
                pendingApprovals,
                newDevices,
                deviceUnlocks: 0,
                todayPunches,
                yesterdayPunches: 0,
            });

            if (collRes.status === 'fulfilled') {
                setCollStats(collRes.value.data);
            }
        } catch (err) {
            if (__DEV__) console.log('Error fetching stats:', err);
        } finally {
            setLoading(false);
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

    const ActionCard = ({ title, subtitle, icon, color, badge, onPress }) => (
        <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.actionIconContainer, { backgroundColor: `${color}15` }]}>
                <Icon name={icon} size={24} color={color} />
            </View>
            <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{title}</Text>
                <Text style={styles.actionSubtitle}>{subtitle}</Text>
            </View>
            {badge > 0 && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                </View>
            )}
            <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>
    );

    const MenuSection = ({ title, items }) => (
        <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>{title}</Text>
            {items.map((item, index) => (
                <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
                    <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                        <Icon name={item.icon} size={20} color={item.color} />
                    </View>
                    <Text style={styles.menuText}>{item.title}</Text>
                    <Icon name="chevron-right" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            ))}
        </View>
    );

    const EmployeeCard = ({ item }) => {
        const getRoleColor = (role) => {
            const safeRole = typeof role === 'string' ? role.toUpperCase() : '';
            switch (safeRole) {
                case 'ADMIN': return colors.warning;
                case 'SUPER_ADMIN': return colors.danger;
                case 'MANAGER': return colors.primary;
                default: return colors.info;
            }
        };

        const getStatusColor = (isActive) => isActive ? colors.success : colors.textMuted;

        const safeItem = {
            ...item,
            first_name: typeof item.first_name === 'string' ? item.first_name : '',
            last_name: typeof item.last_name === 'string' ? item.last_name : '',
            username: typeof item.username === 'string' ? item.username : 'Unknown',
            email: typeof item.email === 'string' ? item.email : '',
            role: typeof item.role === 'string' ? item.role : 'employee',
        };

        const employeeName = safeItem.first_name && safeItem.last_name
            ? `${safeItem.first_name} ${safeItem.last_name}`
            : safeItem.username || 'Unknown';

        const roleDisplay = String(safeItem.role || 'employee').replace(/_/g, ' ').toUpperCase();

        return (
            <TouchableOpacity
                style={styles.employeeCard}
                onPress={() => navigation.navigate('EmployeeTracking', { employeeId: item.id, employee: item })}
                activeOpacity={0.7}
            >
                <View style={styles.employeeAvatar}>
                    <Text style={styles.employeeAvatarText}>
                        {employeeName.charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName}>{employeeName}</Text>
                    <Text style={styles.employeeDetail}>{safeItem.email || 'No email'}</Text>
                    <View style={styles.employeeMeta}>
                        <View style={[styles.roleBadge, { backgroundColor: `${getRoleColor(safeItem.role)}15` }]}>
                            <Text style={[styles.roleBadgeText, { color: getRoleColor(safeItem.role) }]}>
                                {roleDisplay}
                            </Text>
                        </View>
                        <View style={styles.statusContainer}>
                            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.is_active) }]} />
                            <Text style={[styles.statusText, { color: getStatusColor(item.is_active) }]}>
                                {item.is_active ? 'Active' : 'Inactive'}
                            </Text>
                        </View>
                    </View>
                </View>
                <Icon name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView edges={['top']} style={styles.safeArea}>
            <View style={styles.container}>
                <HeroHeader
                    user={user}
                    role={user?.role || 'Super Admin'}
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
                    <View style={styles.kpiSection}>
                        <View style={styles.kpiRow}>
                            <StatCard title="Total Employees" value={stats.totalEmployees} icon="users" color={colors.primary} />
                            <StatCard title="Active Today" value={stats.activeEmployees} icon="user-check" color={colors.success} />
                        </View>
                        <View style={styles.kpiRow}>
                            <StatCard title="Distance" value={`${stats.totalDistance} km`} icon="navigation" color={colors.info} />
                            <StatCard title="Collections" value={`₹${formatCurrency(stats.totalCollections)}`} icon="trending-up" color={colors.success} />
                        </View>
                        <View style={styles.kpiRow}>
                            <StatCard title="Disbursements" value={`₹${formatCurrency(stats.totalDisbursements)}`} icon="trending-down" color={colors.warning} />
                            <StatCard title="Today's Punches" value={stats.todayPunches} icon="clock" color={colors.danger} />
                        </View>
                    </View>

                    {/* ── Collection Overview ── */}
                    {collStats && (
                        <View style={styles.collSection}>
                            <View style={styles.collHeaderRow}>
                                <Icon name="dollar-sign" size={15} color="#d32f2f" />
                                <Text style={styles.collSectionTitle}>Collection Overview</Text>
                            </View>

                            {/* Status pills */}
                            <View style={styles.collPillRow}>
                                {[
                                    { label: 'Assigned',  value: collStats.total_assigned,      color: '#1d4ed8', bg: '#dbeafe' },
                                    { label: 'Pending',   value: collStats.pending,              color: '#d97706', bg: '#fef3c7' },
                                    { label: 'Collected', value: collStats.collected,            color: '#16a34a', bg: '#dcfce7' },
                                    { label: 'Partial',   value: collStats.partially_collected,  color: '#0891b2', bg: '#e0f2fe' },
                                    { label: 'Not Paid',  value: collStats.not_paid,             color: '#dc2626', bg: '#fee2e2' },
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
                                        ₹{formatCurrency(collStats.today?.amount || 0)}
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
                                            <View style={[styles.topRank, {
                                                backgroundColor: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#cd7f32',
                                            }]}>
                                                <Text style={styles.topRankText}>{i + 1}</Text>
                                            </View>
                                            <View style={styles.topInfo}>
                                                <Text style={styles.topName}>{tc.name}</Text>
                                                <Text style={styles.topCode}>
                                                    {tc.employee_code}{tc.branch ? ` · ${tc.branch}` : ''}
                                                </Text>
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

                    <View style={styles.employeesSection}>
                        <View style={styles.employeesSectionHeader}>
                            <Text style={styles.sectionTitle}>Employees</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('EmployeeList')}>
                                <Text style={styles.viewAllText}>View All</Text>
                            </TouchableOpacity>
                        </View>
                        {loading ? (
                            <View>
                                {[1, 2, 3].map(i => (
                                    <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
                                ))}
                            </View>
                        ) : employees.length > 0 ? (
                            employees.map((employee) => (
                                <EmployeeCard key={employee.id} item={employee} />
                            ))
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Icon name="users" size={48} color={colors.textLight} />
                                <Text style={styles.emptyText}>No employees found</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.quickActionsSection}>
                        <Text style={styles.sectionTitle}>Quick Actions</Text>
                        <ActionCard
                            title="Pending Approvals"
                            subtitle="Review and approve requests"
                            icon="check-circle"
                            color={colors.warning}
                            badge={stats.pendingApprovals}
                            onPress={() => navigation.navigate('AdminApprovals')}
                        />
                        <ActionCard
                            title="Employee Tracking"
                            subtitle="Monitor live locations"
                            icon="map-pin"
                            color={colors.info}
                            onPress={() => navigation.navigate('EmployeeTracking')}
                        />
                        <ActionCard
                            title="Device Management"
                            subtitle={`${stats.newDevices} pending devices`}
                            icon="smartphone"
                            color={colors.primary}
                            onPress={() => navigation.navigate('AdminDevices')}
                        />
                    </View>

                    <MenuSection
                        title="Management"
                        items={[
                            { title: 'User Management', icon: 'users', color: colors.primary, onPress: () => navigation.navigate('UserManagement') },
                            { title: 'Employee List', icon: 'user-check', color: colors.success, onPress: () => navigation.navigate('EmployeeList') },
                            { title: 'Create New User', icon: 'user-plus', color: colors.info, onPress: () => navigation.navigate('CreateUser') },
                        ]}
                    />

                    <MenuSection
                        title="Settings & Reports"
                        items={[
                            { title: 'Organization Settings', icon: 'settings', color: colors.textMedium, onPress: () => navigation.navigate('OrgSettings') },
                            { title: 'Reports', icon: 'file-text', color: colors.warning, onPress: () => navigation.navigate('Reports') },
                            { title: 'Approval Routes', icon: 'git-branch', color: colors.success, onPress: () => navigation.navigate('ApprovalRoutes') },
                        ]}
                    />
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
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.sm,
    },
    quickActionsSection: {
        marginBottom: spacing.lg,
    },
    actionCard: {
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
    actionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    actionContent: {
        flex: 1,
    },
    actionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    actionSubtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    badge: {
        backgroundColor: colors.danger,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: spacing.sm,
    },
    badgeText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
        color: colors.surface,
    },
    menuSection: {
        marginBottom: spacing.lg,
    },
    menuSectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
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
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    menuText: {
        flex: 1,
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.medium,
        color: colors.textDark,
    },
    employeesSection: {
        marginBottom: spacing.lg,
    },
    employeesSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    viewAllText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.primary,
    },
    employeeCard: {
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
    employeeAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    employeeAvatarText: {
        fontSize: typography.sizes.xl,
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
    employeeDetail: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    employeeMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    roleBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 10,
        marginRight: spacing.sm,
    },
    roleBadgeText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 4,
    },
    statusText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
    },
    loadingContainer: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    emptyContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 14,
    },
    emptyText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.sm,
    },

    // ── Collection overview ──────────────────────────────────────
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
    collHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: '#fef2f2',
    },
    collSectionTitle: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
        color: colors.text,
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
    topTitle: {
        fontSize: 11, fontWeight: '700', color: '#64748b',
        textTransform: 'uppercase', marginTop: 8, marginBottom: 6,
    },
    topRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fafafa', borderRadius: 10,
        paddingVertical: 7, paddingHorizontal: 10, marginBottom: 5,
    },
    topRank: {
        width: 22, height: 22, borderRadius: 11,
        alignItems: 'center', justifyContent: 'center', marginRight: 8,
    },
    topRankText: { fontSize: 11, fontWeight: '800', color: '#fff' },
    topInfo: { flex: 1 },
    topName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
    topCode: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
    topAmtBox: { alignItems: 'flex-end' },
    topAmt: { fontSize: 13, fontWeight: '800', color: '#16a34a' },
    topCount: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
});

export default SuperAdminHomeScreen;
