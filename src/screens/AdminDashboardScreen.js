import React, { useState, useCallback, useContext, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Alert,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { AuthContext } from '../context/AuthContext';
import api from '../api/api';
import OfflineService from '../services/OfflineService';
import { colors, typography, spacing } from '../theme/tokens';
import SkeletonLoader from '../components/SkeletonLoader';

const AdminDashboardScreen = ({ navigation }) => {
    const { user, logout } = useContext(AuthContext) || {};
    const currentUser = user || { first_name: 'Admin', last_name: '', employee_id: 'N/A' };
    
    const [stats, setStats] = useState({ 
        totalEmployees: 0, 
        activeEmployees: 0, 
        totalDistance: 0 
    });
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [isOffline, setIsOffline] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Menu items configuration
    const menuItems = useMemo(() => [
        {
            id: 'approvals',
            title: 'Approvals',
            subtitle: 'Review pending requests',
            icon: 'check-circle',
            screen: 'AdminApprovals',
            color: colors.primary,
            bgColor: colors.primaryLight,
        },
        {
            id: 'devices',
            title: 'Devices',
            subtitle: 'Manage registered devices',
            icon: 'smartphone',
            screen: 'AdminDevices',
            color: colors.info,
            bgColor: colors.infoLight,
        },
        {
            id: 'profile',
            title: 'Profile',
            subtitle: 'Account settings',
            icon: 'user',
            screen: 'Profile',
            color: colors.warning,
            bgColor: colors.warningLight,
        },
    ], []);

    // Stats configuration
    const statsConfig = useMemo(() => [
        {
            id: 'total',
            label: 'Total Employees',
            value: stats.totalEmployees,
            icon: 'users',
            variant: 'primary',
        },
        {
            id: 'active',
            label: 'Active Today',
            value: stats.activeEmployees,
            icon: 'user-check',
            variant: 'info',
        },
        {
            id: 'distance',
            label: 'Total km Today',
            value: stats.totalDistance,
            icon: 'navigation',
            variant: 'secondary',
        },
    ], [stats]);

    const fetchDashboardData = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError(null);

        try {
            const online = await api.isOnline();
            setIsOffline(!online);

            // Load cached data first
            const cachedStats = await OfflineService.get('admin_stats');
            const cachedEmployees = await OfflineService.get('admin_employees');

            if (cachedStats.isCached && cachedStats.data) {
                setStats(cachedStats.data);
            }
            if (cachedEmployees.isCached && cachedEmployees.data) {
                setEmployees(Array.isArray(cachedEmployees.data) ? cachedEmployees.data : []);
            }

            // Fetch fresh data if online
            if (online) {
                const [trackingRes, employeesRes] = await Promise.all([
                    api.getEmployeeTracking().catch(() => ({ data: [] })),
                    api.getAllEmployees().catch(() => ({ data: [] }))
                ]);
                
                const trackingData = trackingRes.data?.results || trackingRes.data || [];
                const employeesData = employeesRes.data?.results || employeesRes.data || [];
                
                const newStats = {
                    totalEmployees: employeesData.length,
                    activeEmployees: trackingData.filter(e => e.today_punches > 0).length,
                    totalDistance: trackingData.reduce((sum, e) => sum + (parseFloat(e.distance) || 0), 0).toFixed(2)
                };

                setStats(newStats);
                setEmployees(trackingData);
                setLastUpdated(new Date());

                await OfflineService.set('admin_stats', newStats);
                await OfflineService.set('admin_employees', trackingData);
            }

        } catch (err) {
            console.log('Error fetching admin data:', err);
            setError('Failed to load dashboard data');
            
            const cachedStats = await OfflineService.get('admin_stats');
            const cachedEmployees = await OfflineService.get('admin_employees');
            
            if (cachedStats.isCached) setStats(cachedStats.data);
            if (cachedEmployees.isCached) {
                setEmployees(Array.isArray(cachedEmployees.data) ? cachedEmployees.data : []);
            }
            
            setIsOffline(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData(false);
    }, [fetchDashboardData]);

    // Event handlers - using useCallback to avoid inline functions
    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchDashboardData(true);
    }, [fetchDashboardData]);

    const handleLogout = useCallback(() => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: logout, style: 'destructive' }
        ]);
    }, [logout]);

    const handleMenuPress = useCallback((screen) => {
        navigation.navigate(screen);
    }, [navigation]);

    const getTimeAgo = useCallback((date) => {
        if (!date) return '';
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
        return `${Math.floor(seconds / 3600)} hours ago`;
    }, []);

    // Render functions
    const renderMenuItem = useCallback(({ item }) => (
        <TouchableOpacity
            style={styles.menuCard}
            onPress={() => handleMenuPress(item.screen)}
            activeOpacity={0.8}
        >
            <View style={[styles.menuIconContainer, { backgroundColor: item.bgColor }]}>
                <Icon name={item.icon} size={24} color={item.color} />
            </View>
            <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>
    ), [handleMenuPress]);

    const renderStatCard = useCallback(({ item }) => {
        const isPrimary = item.variant === 'primary';
        return (
            <View style={[styles.statCard, isPrimary && styles.statCardPrimary]}>
                <Icon 
                    name={item.icon} 
                    size={24} 
                    color={isPrimary ? colors.white : item.variant === 'info' ? colors.info : colors.textMuted} 
                />
                <Text style={[styles.statValue, isPrimary && styles.statValueLight]}>
                    {item.value}
                </Text>
                <Text style={[styles.statLabel, isPrimary && styles.statLabelLight]}>
                    {item.label}
                </Text>
            </View>
        );
    }, []);

    const renderEmployeeItem = useCallback(({ item, index }) => (
        <View style={styles.employeeCard}>
            <View style={styles.employeeAvatar}>
                <Text style={styles.avatarText}>
                    {(item.name || 'U').charAt(0).toUpperCase()}
                </Text>
            </View>
            <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>{item.name || 'Unknown'}</Text>
                <Text style={styles.employeeId}>ID: {item.employee_id || 'N/A'}</Text>
            </View>
            <View style={styles.employeeStats}>
                <View style={styles.statBadge}>
                    <Icon name="map-pin" size={12} color={colors.primary} />
                    <Text style={styles.statBadgeText}>{item.today_punches || 0}</Text>
                </View>
                <View style={styles.statBadge}>
                    <Icon name="navigation" size={12} color={colors.info} />
                    <Text style={styles.statBadgeText}>{(parseFloat(item.distance) || 0).toFixed(1)} km</Text>
                </View>
            </View>
        </View>
    ), []);

    const renderHeader = useCallback(() => (
        <>
            {/* OFFLINE BANNER */}
            {isOffline && (
                <View style={styles.offlineBanner}>
                    <Icon name="wifi-off" size={16} color={colors.white} />
                    <Text style={styles.offlineBannerText}>
                        Offline - Showing cached data
                    </Text>
                </View>
            )}

            {/* HEADER */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.headerTop}>
                        <View style={styles.headerPlaceholder} />
                        <TouchableOpacity 
                            onPress={handleLogout} 
                            style={styles.logoutBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Icon name="log-out" size={22} color={colors.white} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.title}>Admin Dashboard</Text>
                    <Text style={styles.subtitle}>
                        {currentUser.first_name} {currentUser.last_name}
                    </Text>
                    <Text style={styles.userId}>
                        ID: {currentUser.employee_id || currentUser.id || 'N/A'}
                    </Text>
                </View>
            </View>

            {/* ERROR BANNER */}
            {error && (
                <View style={styles.errorBanner}>
                    <Icon name="alert-circle" size={20} color={colors.white} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* STATS GRID */}
            <View style={styles.statsContainer}>
                <FlatList
                    data={statsConfig}
                    renderItem={renderStatCard}
                    keyExtractor={item => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.statsContent}
                />
            </View>

            {/* MENU SECTION */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
            </View>
        </>
    ), [isOffline, error, handleLogout, currentUser, statsConfig, renderStatCard]);

    const renderEmptyList = useCallback(() => (
        <View style={styles.emptyContainer}>
            <Icon name="users" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>
                {isOffline ? 'No cached employee data available' : 'No employee activity today'}
            </Text>
        </View>
    ), [isOffline]);

    const renderFooter = useCallback(() => (
        <View style={styles.footer} />
    ), []);

    if (loading && employees.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.skeletonContainer}>
                    {/* Header Skeleton */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <View style={styles.headerTop}>
                                <View style={styles.headerPlaceholder} />
                                <SkeletonLoader width={40} height={40} borderRadius={12} />
                            </View>
                            <SkeletonLoader width={180} height={28} borderRadius={6} />
                            <SkeletonLoader width={140} height={16} borderRadius={4} style={{ marginTop: 8 }} />
                            <SkeletonLoader width={80} height={12} borderRadius={4} style={{ marginTop: 6 }} />
                        </View>
                    </View>

                    {/* Stats Skeleton */}
                    <View style={styles.statsContainer}>
                        <View style={styles.statsRow}>
                            <SkeletonLoader width="31%" height={100} borderRadius={16} />
                            <SkeletonLoader width="31%" height={100} borderRadius={16} />
                            <SkeletonLoader width="31%" height={100} borderRadius={16} />
                        </View>
                    </View>

                    {/* Menu Section */}
                    <View style={styles.section}>
                        <SkeletonLoader width={100} height={18} borderRadius={4} style={{ marginBottom: 12 }} />
                        {[1, 2, 3].map((item) => (
                            <SkeletonLoader key={item} height={72} borderRadius={16} style={{ marginBottom: 10 }} />
                        ))}
                    </View>

                    {/* Employee Section */}
                    <View style={styles.section}>
                        <SkeletonLoader width={140} height={18} borderRadius={4} style={{ marginBottom: 12 }} />
                        {[1, 2, 3, 4, 5].map((item) => (
                            <SkeletonLoader key={item} height={70} borderRadius={14} style={{ marginBottom: 10 }} />
                        ))}
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <FlatList
                data={menuItems}
                renderItem={renderMenuItem}
                keyExtractor={item => item.id}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmptyList}
                ListFooterComponent={renderFooter}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={handleRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.textMuted,
        fontSize: typography.sizes.sm,
    },
    listContent: {
        paddingBottom: spacing.xxl,
    },
    
    // Skeleton Loading
    skeletonContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
    },
    
    // Offline Banner
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.warning,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    offlineBannerText: {
        color: colors.white,
        fontSize: typography.sizes.sm,
        marginLeft: spacing.sm,
        fontWeight: '500',
    },
    
    // Header
    header: {
        backgroundColor: colors.primary,
        paddingTop: Platform.OS === 'android' ? spacing.md : spacing.sm,
        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerContent: {
        marginTop: spacing.sm,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    headerPlaceholder: {
        width: 40,
        height: 40,
    },
    logoutBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.white,
    },
    subtitle: {
        fontSize: typography.sizes.md,
        color: 'rgba(255,255,255,0.85)',
        marginTop: spacing.xs,
    },
    userId: {
        fontSize: typography.sizes.sm,
        color: 'rgba(255,255,255,0.65)',
        marginTop: 2,
    },
    
    // Error Banner
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.danger,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
    },
    errorText: {
        color: colors.white,
        marginLeft: spacing.sm,
        fontSize: typography.sizes.sm,
    },
    
    // Stats
    statsContainer: {
        marginTop: -spacing.lg,
        marginBottom: spacing.md,
    },
    statsContent: {
        paddingHorizontal: spacing.md,
    },
    statCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        alignItems: 'center',
        marginRight: spacing.sm,
        minWidth: 120,
        ...Platform.select({
            ios: {
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    statCardPrimary: {
        backgroundColor: colors.primary,
    },
    statValue: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginTop: spacing.sm,
    },
    statValueLight: {
        color: colors.white,
    },
    statLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
        textAlign: 'center',
    },
    statLabelLight: {
        color: 'rgba(255,255,255,0.8)',
    },
    
    // Section
    section: {
        paddingHorizontal: spacing.md,
        marginTop: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginBottom: spacing.sm,
    },
    
    // Menu Card
    menuCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        padding: spacing.md,
        borderRadius: 16,
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
    menuIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
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
    
    // Employee Card
    employeeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        padding: spacing.md,
        borderRadius: 14,
        ...Platform.select({
            ios: {
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
            },
            android: {
                elevation: 1,
            },
        }),
    },
    employeeAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    avatarText: {
        color: colors.white,
        fontSize: 18,
        fontWeight: typography.weights.bold,
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
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 8,
        marginBottom: 4,
    },
    statBadgeText: {
        fontSize: typography.sizes.xs,
        color: colors.textDark,
        fontWeight: typography.weights.medium,
        marginLeft: 4,
    },
    
    // Empty State
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: typography.sizes.sm,
        marginTop: spacing.md,
        textAlign: 'center',
    },
    
    // Footer
    footer: {
        paddingVertical: spacing.xl,
    },
});

export default AdminDashboardScreen;
