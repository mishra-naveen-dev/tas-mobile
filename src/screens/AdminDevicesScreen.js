import React, { useState, useCallback, useContext, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
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
import OfflineService from '../services/OfflineService';

const AdminDevicesScreen = ({ navigation }) => {
    const { user, logout } = useContext(AuthContext) || {};
    const currentUser = user || { first_name: 'Admin', last_name: '', employee_id: 'N/A' };
    
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [error, setError] = useState(null);
    const [isOffline, setIsOffline] = useState(false);

    const fetchDevices = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError(null);

        try {
            const online = await api.isOnline();
            setIsOffline(!online);

            const cached = await OfflineService.get('admin_devices');
            if (cached.isCached && cached.data) {
                setDevices(Array.isArray(cached.data) ? cached.data : []);
            }

            if (online) {
                const res = await api.getDevices();
                const deviceList = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                setDevices(deviceList);
                await OfflineService.set('admin_devices', deviceList);
            }
        } catch (err) {
            console.log('Error fetching devices:', err);
            setError('Failed to load devices');
            
            const cached = await OfflineService.get('admin_devices');
            if (cached.isCached) setDevices(Array.isArray(cached.data) ? cached.data : []);
            
            setIsOffline(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDevices(false);
    }, [fetchDevices]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchDevices(true);
    };

    const handleApprove = async (device) => {
        Alert.alert(
            'Approve Device',
            `Approve device for ${device.username || 'this user'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: async () => {
                        try {
                            await api.approveDevice(device.id, 'APPROVED');
                            Alert.alert('Success', 'Device approved successfully');
                            fetchDevices(true);
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.error || 'Failed to approve device');
                        }
                    }
                }
            ]
        );
    };

    const handleReject = async (device) => {
        Alert.alert(
            'Reject Device',
            `Reject device for ${device.username || 'this user'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.approveDevice(device.id, 'REJECTED');
                            Alert.alert('Success', 'Device rejected');
                            fetchDevices(true);
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.error || 'Failed to reject device');
                        }
                    }
                }
            ]
        );
    };

    const handleBlock = async (device) => {
        Alert.alert(
            'Block Device',
            `Block this device? User will not be able to login from this device.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.blockDevice(device.id);
                            Alert.alert('Success', 'Device blocked successfully');
                            fetchDevices(true);
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.error || 'Failed to block device');
                        }
                    }
                }
            ]
        );
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: logout, style: 'destructive' }
        ]);
    };

    const pendingDevices = devices.filter(d => d.status === 'PENDING');
    const approvedDevices = devices.filter(d => d.status === 'APPROVED');
    const blockedDevices = devices.filter(d => d.status === 'BLOCKED');

    const tabs = [
        { title: 'Pending', key: 'pending', data: pendingDevices, color: '#F8961E' },
        { title: 'Approved', key: 'approved', data: approvedDevices, color: '#4CC9F0' },
        { title: 'Blocked', key: 'blocked', data: blockedDevices, color: '#F94144' },
    ];

    const getStatusColor = (status) => {
        switch (status) {
            case 'APPROVED': return '#4CC9F0';
            case 'PENDING': return '#F8961E';
            case 'BLOCKED': return '#F94144';
            default: return '#8D99AE';
        }
    };

    const getStatusBg = (status) => {
        switch (status) {
            case 'APPROVED': return '#4CC9F015';
            case 'PENDING': return '#F8961E15';
            case 'BLOCKED': return '#F9414415';
            default: return '#8D99AE15';
        }
    };

    const renderDeviceItem = ({ item, index }) => {
        const userName = item.username || item.user?.username || item.user?.first_name || 'Unknown User';
        const deviceName = item.device_name || item.device_id || item.name || 'Unknown Device';
        
        return (
            <View key={item.id || index} style={styles.deviceCard}>
                <View style={styles.deviceHeader}>
                    <View style={[styles.deviceIcon, { backgroundColor: getStatusBg(item.status) }]}>
                        <Icon name="smartphone" size={22} color={getStatusColor(item.status)} />
                    </View>
                    <View style={styles.deviceMain}>
                        <Text style={styles.deviceUser}>{userName}</Text>
                        <Text style={styles.deviceName}>{deviceName}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                            {item.status || 'UNKNOWN'}
                        </Text>
                    </View>
                </View>

                <View style={styles.deviceDetails}>
                    <View style={styles.detailRow}>
                        <Icon name={Platform.OS === 'ios' ? 'smartphone' : 'android'} size={14} color="#8D99AE" />
                        <Text style={styles.detailLabel}>Platform:</Text>
                        <Text style={styles.detailValue}>{item.platform || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Icon name="calendar" size={14} color="#8D99AE" />
                        <Text style={styles.detailLabel}>Added:</Text>
                        <Text style={styles.detailValue}>
                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
                        </Text>
                    </View>
                    {item.last_active && (
                        <View style={styles.detailRow}>
                            <Icon name="clock" size={14} color="#8D99AE" />
                            <Text style={styles.detailLabel}>Last Active:</Text>
                            <Text style={styles.detailValue}>
                                {new Date(item.last_active).toLocaleDateString()}
                            </Text>
                        </View>
                    )}
                </View>

                {/* ACTION BUTTONS */}
                <View style={styles.actionRow}>
                    {item.status === 'PENDING' && (
                        <>
                            <TouchableOpacity 
                                style={[styles.actionBtn, styles.approveBtn]}
                                onPress={() => handleApprove(item)}
                            >
                                <Icon name="check" size={16} color="#FFFFFF" />
                                <Text style={styles.actionBtnText}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.actionBtn, styles.rejectBtn]}
                                onPress={() => handleReject(item)}
                            >
                                <Icon name="x" size={16} color="#FFFFFF" />
                                <Text style={styles.actionBtnText}>Reject</Text>
                            </TouchableOpacity>
                        </>
                    )}
                    {item.status === 'APPROVED' && (
                        <TouchableOpacity 
                            style={[styles.actionBtn, styles.blockBtn]}
                            onPress={() => handleBlock(item)}
                        >
                            <Icon name="slash" size={16} color="#FFFFFF" />
                            <Text style={styles.actionBtnText}>Block Device</Text>
                        </TouchableOpacity>
                    )}
                    {item.status === 'BLOCKED' && (
                        <TouchableOpacity 
                            style={[styles.actionBtn, styles.unblockBtn]}
                            onPress={() => handleApprove(item)}
                        >
                            <Icon name="unlock" size={16} color="#FFFFFF" />
                            <Text style={styles.actionBtnText}>Unblock</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    if (loading && devices.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#DC2626" />
                    <Text style={styles.loadingText}>Loading devices...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
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
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Icon name="arrow-left" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                            <Icon name="log-out" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.title}>Device Management</Text>
                    <Text style={styles.subtitle}>
                        {currentUser.first_name} {currentUser.last_name}
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

            {/* TABS */}
            <View style={styles.tabContainer}>
                {tabs.map((tab, index) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[
                            styles.tab, 
                            activeTab === index && { backgroundColor: tab.color }
                        ]}
                        onPress={() => setActiveTab(index)}
                    >
                        <Text style={[
                            styles.tabText, 
                            activeTab === index && styles.activeTabText
                        ]}>
                            {tab.title} ({tab.data.length})
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* DEVICE LIST */}
            <FlatList
                data={tabs[activeTab].data}
                keyExtractor={(item, index) => `device_${item.id || index}`}
                renderItem={renderDeviceItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="smartphone" size={48} color="#8D99AE" />
                        <Text style={styles.emptyText}>
                            No {tabs[activeTab].key} devices
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
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
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerContent: {
        marginTop: 8,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    backBtn: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12,
    },
    logoutBtn: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 4,
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
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EDF2F4',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
        marginHorizontal: 4,
    },
    tabText: {
        fontSize: 13,
        color: '#8D99AE',
        fontWeight: '600',
    },
    activeTabText: {
        color: '#FFFFFF',
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
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
        marginBottom: 14,
    },
    deviceIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    deviceMain: {
        flex: 1,
    },
    deviceUser: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2B2D42',
    },
    deviceName: {
        fontSize: 12,
        color: '#8D99AE',
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 14,
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
        marginBottom: 14,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    detailLabel: {
        fontSize: 12,
        color: '#8D99AE',
        marginLeft: 8,
        width: 80,
    },
    detailValue: {
        fontSize: 12,
        color: '#2B2D42',
        fontWeight: '500',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        marginLeft: 8,
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
    approveBtn: {
        backgroundColor: '#DC2626',
    },
    rejectBtn: {
        backgroundColor: '#F94144',
    },
    blockBtn: {
        backgroundColor: '#F8961E',
    },
    unblockBtn: {
        backgroundColor: '#DC2626',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: '#8D99AE',
        fontSize: 14,
        marginTop: 12,
    },
});

export default AdminDevicesScreen;
