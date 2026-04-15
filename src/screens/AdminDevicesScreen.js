import React, { useState, useCallback, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Alert,
    ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { AuthContext } from '../context/AuthContext';
import api from '../api/api';

const AdminDevicesScreen = ({ navigation }) => {
    const { user, logout } = useContext(AuthContext) || {};
    const currentUser = user || { first_name: 'Admin', last_name: '', employee_id: 'N/A' };
    
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [error, setError] = useState(null);

    const fetchDevices = useCallback(async () => {
        try {
            setError(null);
            const res = await api.getDevices();
            const deviceList = res.data?.results || res.data || [];
            setDevices(deviceList);
        } catch (err) {
            console.log('Error fetching devices:', err);
            setError('Failed to load devices');
            setDevices([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchDevices();
    };

    React.useEffect(() => {
        fetchDevices();
    }, [fetchDevices]);

    const handleApprove = async (device) => {
        const deviceId = device.id;
        try {
            await api.approveDevice(deviceId, 'APPROVED');
            Alert.alert('Success', 'Device approved successfully');
            fetchDevices();
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to approve device');
        }
    };

    const handleReject = async (device) => {
        const deviceId = device.id;
        try {
            await api.approveDevice(deviceId, 'REJECTED');
            Alert.alert('Success', 'Device rejected');
            fetchDevices();
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to reject device');
        }
    };

    const handleBlock = async (device) => {
        const deviceId = device.device_id || device.id;
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
                            await api.blockDevice(deviceId);
                            Alert.alert('Success', 'Device blocked successfully');
                            fetchDevices();
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
        { title: 'Pending', key: 'pending', data: pendingDevices },
        { title: 'Approved', key: 'approved', data: approvedDevices },
        { title: 'Blocked', key: 'blocked', data: blockedDevices },
    ];

    const renderDeviceItem = ({ item }) => {
        const userName = item.username || item.user?.username || 'Unknown User';
        const deviceName = item.device_name || item.device_id || item.name || 'Unknown Device';
        
        return (
            <View style={styles.deviceCard}>
                <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{userName}</Text>
                    <Text style={styles.deviceDetail}>{deviceName}</Text>
                    <View style={styles.deviceMeta}>
                        <Text style={styles.metaText}>{item.status}</Text>
                        <Text style={styles.metaText}>{item.platform || 'N/A'}</Text>
                    </View>
                </View>
                <View style={styles.deviceActions}>
                    {item.status === 'PENDING' && (
                        <>
                            <TouchableOpacity 
                                style={[styles.actionBtn, styles.approveBtn]}
                                onPress={() => handleApprove(item)}
                            >
                                <Icon name="check" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.actionBtn, styles.rejectBtn]}
                                onPress={() => handleReject(item)}
                            >
                                <Icon name="x" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </>
                    )}
                    {item.status === 'APPROVED' && (
                        <TouchableOpacity 
                            style={[styles.actionBtn, styles.blockBtn]}
                            onPress={() => handleBlock(item)}
                        >
                            <Icon name="slash" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4361EE" />
                <Text style={styles.loadingText}>Loading devices...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Icon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>Device Management</Text>
                        <Text style={styles.headerSubtitle}>{currentUser.first_name} {currentUser.last_name}</Text>
                    </View>
                    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                        <Icon name="log-out" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>

            {error && (
                <View style={styles.errorBanner}>
                    <Icon name="alert-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <View style={styles.tabContainer}>
                {tabs.map((tab, index) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, activeTab === index && styles.activeTab]}
                        onPress={() => setActiveTab(index)}
                    >
                        <Text style={[styles.tabText, activeTab === index && styles.activeTabText]}>
                            {tab.title} ({tab.data.length})
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={tabs[activeTab].data}
                keyExtractor={(item, index) => `device_${item.id || index}`}
                renderItem={renderDeviceItem}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyList}>
                        <Icon name="smartphone" size={48} color="#8D99AE" />
                        <Text style={styles.emptyText}>No {tabs[activeTab].key} devices</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
    loadingText: { marginTop: 10, color: '#8D99AE', fontSize: 14 },
    header: { backgroundColor: '#4361EE', paddingBottom: 15 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    headerCenter: { alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
    headerSubtitle: { fontSize: 12, color: '#FFFFFF', opacity: 0.8, marginTop: 2 },
    backBtn: { padding: 5 },
    logoutBtn: { padding: 5 },
    errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F94144', padding: 12 },
    errorText: { color: '#FFFFFF', marginLeft: 8, fontSize: 14 },
    tabContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 10, borderBottomWidth: 1, borderBottomColor: '#EDF2F4' },
    tab: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 8 },
    activeTab: { backgroundColor: '#4361EE' },
    tabText: { fontSize: 14, color: '#8D99AE', fontWeight: '500' },
    activeTabText: { color: '#FFFFFF' },
    deviceCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 15, marginHorizontal: 15, marginTop: 10, borderRadius: 10, elevation: 1 },
    deviceInfo: { flex: 1 },
    deviceName: { fontSize: 14, fontWeight: '600', color: '#2B2D42' },
    deviceDetail: { fontSize: 12, color: '#8D99AE', marginTop: 4 },
    deviceMeta: { flexDirection: 'row', marginTop: 8 },
    metaText: { fontSize: 11, color: '#8D99AE', backgroundColor: '#EDF2F4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 6 },
    deviceActions: { flexDirection: 'row', alignItems: 'center' },
    actionBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    approveBtn: { backgroundColor: '#4CC9F0' },
    rejectBtn: { backgroundColor: '#F94144' },
    blockBtn: { backgroundColor: '#F8961E' },
    emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyText: { color: '#8D99AE', marginTop: 10, fontSize: 14 },
});

export default AdminDevicesScreen;