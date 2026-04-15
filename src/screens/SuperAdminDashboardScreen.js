import React, { useState, useCallback, useContext, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
    ActivityIndicator,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { AuthContext } from '../context/AuthContext';
import api from '../api/api';
import GlassCard from '../components/GlassCard';
import OfflineService, { CacheKeys } from '../services/OfflineService';

const SuperAdminDashboardScreen = ({ navigation }) => {
    const { user, logout } = useContext(AuthContext) || {};
    const currentUser = user || { first_name: 'Super Admin', last_name: '', employee_id: 'N/A' };
    
    const [stats, setStats] = useState(null);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [isOffline, setIsOffline] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchDashboardData = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError(null);

        try {
            const online = await api.isOnline();
            setIsOffline(!online);

            // Load cached data first
            const cachedStats = await OfflineService.get('superadmin_stats');
            const cachedDevices = await OfflineService.get('superadmin_devices');

            if (cachedStats.isCached && cachedStats.data) {
                setStats(cachedStats.data);
            }
            if (cachedDevices.isCached && cachedDevices.data) {
                setDevices(Array.isArray(cachedDevices.data) ? cachedDevices.data : []);
            }

            // Try to fetch fresh data
            if (online) {
                const [statsRes, devicesRes] = await Promise.all([
                    api.getOrganizationStats().catch(() => ({ data: null })),
                    api.getDevices().catch(() => ({ data: [] }))
                ]);
                
                const statsData = statsRes.data || {
                    total_users: 0,
                    total_employees: 0,
                    total_admins: 0,
                    total_devices: 0
                };
                
                const devicesData = Array.isArray(devicesRes.data) ? devicesRes.data : 
                                  (devicesRes.data?.results || []);

                setStats(statsData);
                setDevices(devicesData);
                setLastUpdated(new Date());

                // Cache the data
                await OfflineService.set('superadmin_stats', statsData);
                await OfflineService.set('superadmin_devices', devicesData);
            }

        } catch (err) {
            console.log('Error fetching super admin data:', err);
            setError('Failed to load dashboard data');
            
            const cachedStats = await OfflineService.get('superadmin_stats');
            const cachedDevices = await OfflineService.get('superadmin_devices');
            
            if (cachedStats.isCached) setStats(cachedStats.data);
            if (cachedDevices.isCached) setDevices(Array.isArray(cachedDevices.data) ? cachedDevices.data : []);
            
            setIsOffline(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData(false);
    }, [fetchDashboardData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboardData(true);
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: logout, style: 'destructive' }
        ]);
    };

    const getTimeAgo = (date) => {
        if (!date) return '';
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
        return `${Math.floor(seconds / 3600)} hours ago`;
    };

    const getDeviceStatusColor = (status) => {
        switch (status) {
            case 'APPROVED': return '#4CC9F0';
            case 'PENDING': return '#F8961E';
            case 'BLOCKED': return '#F94144';
            default: return '#8D99AE';
        }
    };

    const getDeviceStatusBg = (status) => {
        switch (status) {
            case 'APPROVED': return '#4CC9F020';
            case 'PENDING': return '#F8961E20';
            case 'BLOCKED': return '#F9414420';
            default: return '#8D99AE20';
        }
    };

    const renderDeviceItem = ({ item, index }) => {
        const userName = item.username || item.user?.username || item.user?.first_name || 'Unknown User';
        const deviceName = item.device_name || item.device_id || item.name || 'Unknown Device';
        const lastActive = item.last_active || item.created_at;
        
        return (
            <View key={item.id || index} style={styles.deviceCard}>
                <View style={styles.deviceHeader}>
                    <View style={styles.deviceIcon}>
                        <Icon name="smartphone" size={20} color="#DC2626" />
                    </View>
                    <View style={styles.deviceMain}>
                        <Text style={styles.deviceUser}>{userName}</Text>
                        <Text style={styles.deviceName}>{deviceName}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getDeviceStatusBg(item.status) }]}>
                        <Text style={[styles.statusText, { color: getDeviceStatusColor(item.status) }]}>
                            {item.status || 'UNKNOWN'}
                        </Text>
                    </View>
                </View>

                <View style={styles.deviceDetails}>
                    <View style={styles.detailRow}>
                        <Icon name={Platform.OS === 'ios' ? 'smartphone' : 'android'} size={14} color="#8D99AE" />
                        <Text style={styles.detailText}>{item.platform || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Icon name="calendar" size={14} color="#8D99AE" />
                        <Text style={styles.detailText}>
                            Added: {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
                        </Text>
                    </View>
                    {lastActive && (
                        <View style={styles.detailRow}>
                            <Icon name="clock" size={14} color="#8D99AE" />
                            <Text style={styles.detailText}>
                                Last Active: {new Date(lastActive).toLocaleDateString()}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Desktop Only Actions Notice */}
                <View style={styles.desktopOnlyNotice}>
                    <Icon name="monitor" size={14} color="#F8961E" />
                    <Text style={styles.desktopNoticeText}>
                        Actions available on Desktop only
                    </Text>
                </View>
            </View>
        );
    };

    if (loading && !stats) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#DC2626" />
                    <Text style={styles.loadingText}>Loading dashboard...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const pendingDevices = devices.filter(d => d.status === 'PENDING');
    const approvedDevices = devices.filter(d => d.status === 'APPROVED');
    const blockedDevices = devices.filter(d => d.status === 'BLOCKED');

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* OFFLINE BANNER */}
                {isOffline && (
                    <View style={styles.offlineBanner}>
                        <Icon name="wifi-off" size={16} color="#FFF" />
                        <Text style={styles.offlineBannerText}>
                            Offline - Showing cached data
                        </Text>
                    </View>
                )}

                {/* HEADER */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <View style={styles.headerTop}>
                            <View style={styles.backBtnPlaceholder} />
                            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                                <Icon name="log-out" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.title}>Super Admin</Text>
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
                        <Icon name="alert-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* STATS GRID */}
                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, styles.statCardPrimary]}>
                        <Icon name="users" size={28} color="#FFFFFF" />
                        <Text style={styles.statValue}>{stats?.total_users ?? 0}</Text>
                        <Text style={styles.statLabel}>Total Users</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Icon name="user-check" size={28} color="#DC2626" />
                        <Text style={styles.statValueDark}>{stats?.total_employees ?? 0}</Text>
                        <Text style={styles.statLabelDark}>Employees</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Icon name="shield" size={28} color="#DC2626" />
                        <Text style={styles.statValueDark}>{stats?.total_admins ?? 0}</Text>
                        <Text style={styles.statLabelDark}>Admins</Text>
                    </View>
                    <View style={[styles.statCard, styles.statCardDevice]}>
                        <Icon name="smartphone" size={28} color="#FFFFFF" />
                        <Text style={styles.statValue}>{stats?.total_devices ?? 0}</Text>
                        <Text style={styles.statLabel}>Devices</Text>
                    </View>
                </View>

                {/* DEVICE SUMMARY */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Device Summary</Text>
                        {lastUpdated && (
                            <Text style={styles.lastUpdated}>
                                Updated {getTimeAgo(lastUpdated)}
                            </Text>
                        )}
                    </View>
                    <View style={styles.deviceSummaryRow}>
                        <View style={[styles.summaryItem, { borderLeftColor: '#F8961E' }]}>
                            <Text style={styles.summaryValue}>{pendingDevices.length}</Text>
                            <Text style={styles.summaryLabel}>Pending</Text>
                        </View>
                        <View style={[styles.summaryItem, { borderLeftColor: '#4CC9F0' }]}>
                            <Text style={styles.summaryValue}>{approvedDevices.length}</Text>
                            <Text style={styles.summaryLabel}>Approved</Text>
                        </View>
                        <View style={[styles.summaryItem, { borderLeftColor: '#F94144' }]}>
                            <Text style={styles.summaryValue}>{blockedDevices.length}</Text>
                            <Text style={styles.summaryLabel}>Blocked</Text>
                        </View>
                    </View>
                </View>

                {/* ALL DEVICES LIST */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>All Devices</Text>
                        <Text style={styles.deviceCount}>{devices.length} total</Text>
                    </View>

                    {devices.length > 0 ? (
                        devices.map((item, index) => renderDeviceItem({ item, index }))
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Icon name="smartphone" size={48} color="#8D99AE" />
                            <Text style={styles.emptyText}>
                                {isOffline ? 'No cached device data available' : 'No devices registered'}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.bottomPadding} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    scrollView: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    loadingText: {
        marginTop: 12,
        color: '#8D99AE',
        fontSize: 14,
    },
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8961E',
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    offlineBannerText: {
        color: '#FFFFFF',
        fontSize: 13,
        marginLeft: 8,
        fontWeight: '500',
    },
    header: {
        backgroundColor: '#DC2626',
        paddingTop: Platform.OS === 'android' ? 16 : 8,
        paddingBottom: 24,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerContent: {
        marginTop: 8,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    backBtn: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12,
    },
    backBtnPlaceholder: {
        width: 40,
        height: 40,
    },
    logoutBtn: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    subtitle: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 4,
    },
    userId: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.65)',
        marginTop: 2,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F94144',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    errorText: {
        color: '#FFFFFF',
        marginLeft: 10,
        fontSize: 14,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        marginTop: -20,
        justifyContent: 'space-between',
    },
    statCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        width: '48%',
        marginBottom: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    statCardPrimary: {
        backgroundColor: '#DC2626',
    },
    statCardDevice: {
        backgroundColor: '#991B1B',
    },
    statValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginTop: 8,
    },
    statValueDark: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2B2D42',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
    },
    statLabelDark: {
        fontSize: 12,
        color: '#8D99AE',
        marginTop: 4,
    },
    section: {
        paddingHorizontal: 16,
        marginTop: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2B2D42',
    },
    lastUpdated: {
        fontSize: 11,
        color: '#8D99AE',
    },
    deviceCount: {
        fontSize: 13,
        color: '#8D99AE',
    },
    deviceSummaryRow: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
        borderLeftWidth: 3,
        paddingLeft: 12,
    },
    summaryValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2B2D42',
    },
    summaryLabel: {
        fontSize: 11,
        color: '#8D99AE',
        marginTop: 2,
    },
    deviceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    deviceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    deviceIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#EDF2F4',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    deviceMain: {
        flex: 1,
    },
    deviceUser: {
        fontSize: 15,
        fontWeight: '600',
        color: '#2B2D42',
    },
    deviceName: {
        fontSize: 12,
        color: '#8D99AE',
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
    },
    deviceDetails: {
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        padding: 12,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    detailText: {
        fontSize: 12,
        color: '#8D99AE',
        marginLeft: 8,
    },
    desktopOnlyNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8961E15',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginTop: 12,
    },
    desktopNoticeText: {
        fontSize: 12,
        color: '#F8961E',
        marginLeft: 6,
        fontWeight: '500',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
    },
    emptyText: {
        color: '#8D99AE',
        fontSize: 14,
        marginTop: 12,
        textAlign: 'center',
    },
    bottomPadding: {
        height: 40,
    },
});

export default SuperAdminDashboardScreen;
