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

const AdminApprovalsScreen = ({ navigation }) => {
    const { user, logout } = useContext(AuthContext) || {};
    const currentUser = user || { first_name: 'Admin', last_name: '', employee_id: 'N/A' };
    
    const [allowances, setAllowances] = useState([]);
    const [corrections, setCorrections] = useState([]);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [error, setError] = useState(null);
    const [isOffline, setIsOffline] = useState(false);

    const     tabs = [
        { title: 'Allowances', key: 'allowance', icon: 'dollar-sign', color: '#DC2626' },
        { title: 'Corrections', key: 'correction', icon: 'edit', color: '#DC2626' },
        { title: 'Devices', key: 'device', icon: 'smartphone', color: '#DC2626' },
    ];

    const fetchApprovalsData = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError(null);

        try {
            const online = await api.isOnline();
            setIsOffline(!online);

            // Load cached data first
            const cachedAllowances = await OfflineService.get('admin_allowances');
            const cachedCorrections = await OfflineService.get('admin_corrections');
            const cachedDevices = await OfflineService.get('admin_approval_devices');

            if (cachedAllowances.isCached) setAllowances(Array.isArray(cachedAllowances.data) ? cachedAllowances.data : []);
            if (cachedCorrections.isCached) setCorrections(Array.isArray(cachedCorrections.data) ? cachedCorrections.data : []);
            if (cachedDevices.isCached) setDevices(Array.isArray(cachedDevices.data) ? cachedDevices.data : []);

            if (online) {
                const [allowanceRes, correctionRes, deviceRes] = await Promise.all([
                    api.getAllAllowanceRequests().catch(() => ({ data: [] })),
                    api.getCorrectionRequests().catch(() => ({ data: [] })),
                    api.getDevices().catch(() => ({ data: [] }))
                ]);
                
                const allowanceData = (allowanceRes.data?.results || allowanceRes.data || []).filter(item => item.status === 'PENDING');
                const correctionData = (correctionRes.data?.results || correctionRes.data || []).filter(item => item.status === 'PENDING');
                const deviceData = (deviceRes.data?.results || deviceRes.data || []).filter(item => item.status === 'PENDING');
                
                setAllowances(allowanceData);
                setCorrections(correctionData);
                setDevices(deviceData);

                await OfflineService.set('admin_allowances', allowanceData);
                await OfflineService.set('admin_corrections', correctionData);
                await OfflineService.set('admin_approval_devices', deviceData);
            }
        } catch (err) {
            console.log('Error fetching approvals:', err);
            setError('Failed to load approvals');
            
            setIsOffline(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchApprovalsData(false);
    }, [fetchApprovalsData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchApprovalsData(true);
    };

    const handleApprove = async (item, type) => {
        const action = type === 'allowance' ? 'allowance request' : 
                      type === 'correction' ? 'correction request' : 'device';
        
        Alert.alert(
            'Confirm Approval',
            `Approve this ${action}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: async () => {
                        try {
                            if (type === 'allowance') {
                                await api.approveAllowance(item.id, 'APPROVED');
                            } else if (type === 'correction') {
                                await api.approveCorrection(item.id, 'APPROVED');
                            } else if (type === 'device') {
                                await api.approveDevice(item.id, 'APPROVED');
                            }
                            
                            Alert.alert('Success', `${type} approved successfully`);
                            fetchApprovalsData(true);
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.error || `Failed to approve ${type}`);
                        }
                    }
                }
            ]
        );
    };

    const handleReject = async (item, type) => {
        const action = type === 'allowance' ? 'allowance request' : 
                      type === 'correction' ? 'correction request' : 'device';
        
        Alert.alert(
            'Confirm Rejection',
            `Reject this ${action}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (type === 'allowance') {
                                await api.approveAllowance(item.id, 'REJECTED');
                            } else if (type === 'correction') {
                                await api.approveCorrection(item.id, 'REJECTED');
                            } else if (type === 'device') {
                                await api.approveDevice(item.id, 'REJECTED');
                            }
                            
                            Alert.alert('Success', `${type} rejected`);
                            fetchApprovalsData(true);
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.error || `Failed to reject ${type}`);
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

    const getCurrentData = () => {
        switch (activeTab) {
            case 0: return allowances;
            case 1: return corrections;
            case 2: return devices;
            default: return [];
        }
    };

    const renderItem = ({ item, index }) => {
        const currentTab = tabs[activeTab];
        
        let title = '';
        let subtitle = '';
        let icon = currentTab.icon;

        if (activeTab === 0) { // Allowances
            title = item.employee_name || item.user?.first_name || 'Unknown Employee';
            subtitle = `${item.total_distance || 0} km - ₹${item.total_amount || 0}`;
        } else if (activeTab === 1) { // Corrections
            title = item.employee_name || item.user?.first_name || 'Unknown';
            subtitle = item.punch_time ? `${item.punch_time} - ${item.location_address || 'No location'}` : 'Correction Request';
        } else { // Devices
            title = item.username || item.user?.username || item.user?.first_name || 'Unknown User';
            subtitle = item.device_name || item.device_id || 'Unknown Device';
        }

        return (
            <View key={item.id || index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                    <View style={[styles.itemIcon, { backgroundColor: currentTab.color + '15' }]}>
                        <Icon name={icon} size={22} color={currentTab.color} />
                    </View>
                    <View style={styles.itemMain}>
                        <Text style={styles.itemTitle}>{title}</Text>
                        <Text style={styles.itemSubtitle}>{subtitle}</Text>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity 
                        style={[styles.actionBtn, styles.approveBtn]}
                        onPress={() => handleApprove(item, currentTab.key)}
                    >
                        <Icon name="check" size={16} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.actionBtn, styles.rejectBtn]}
                        onPress={() => handleReject(item, currentTab.key)}
                    >
                        <Icon name="x" size={16} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (loading && getCurrentData().length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#DC2626" />
                    <Text style={styles.loadingText}>Loading approvals...</Text>
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
                    <Text style={styles.title}>Pending Approvals</Text>
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
                {tabs.map((tab, index) => {
                    const count = index === 0 ? allowances.length : index === 1 ? corrections.length : devices.length;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[
                                styles.tab, 
                                activeTab === index && { backgroundColor: tab.color }
                            ]}
                            onPress={() => setActiveTab(index)}
                        >
                            <Icon 
                                name={tab.icon} 
                                size={16} 
                                color={activeTab === index ? '#FFFFFF' : '#8D99AE'} 
                            />
                            <Text style={[
                                styles.tabText, 
                                activeTab === index && styles.activeTabText
                            ]}>
                                {tab.title} ({count})
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* APPROVAL LIST */}
            <FlatList
                data={getCurrentData()}
                keyExtractor={(item, index) => `${tabs[activeTab].key}_${item.id || index}`}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="inbox" size={48} color="#8D99AE" />
                        <Text style={styles.emptyText}>
                            No pending {tabs[activeTab].title.toLowerCase()}
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        marginHorizontal: 4,
    },
    tabText: {
        fontSize: 12,
        color: '#8D99AE',
        fontWeight: '600',
        marginLeft: 6,
    },
    activeTabText: {
        color: '#FFFFFF',
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    itemCard: {
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
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    itemIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    itemMain: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#2B2D42',
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#8D99AE',
        marginTop: 3,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 10,
        marginLeft: 10,
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 6,
    },
    approveBtn: {
        backgroundColor: '#DC2626',
    },
    rejectBtn: {
        backgroundColor: '#F94144',
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

export default AdminApprovalsScreen;
