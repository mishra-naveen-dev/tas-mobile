import React, { useState, useEffect, useCallback, useContext } from 'react';
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
    const { logout, user } = useContext(AuthContext) || {};
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            setError(null);
            const res = await api.getDevices();
            const deviceList = res.data?.results || res.data || [];
            setDevices(deviceList);
        } catch (err) {
            console.log('Error fetching devices:', err);
            setError('Failed to load devices');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleApprove = async (id) => {
        try {
            await api.approveDevice(id, 'APPROVED');
            Alert.alert('Success', 'Device approved');
            fetchData();
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to approve device');
        }
    };

    const handleReject = async (id) => {
        Alert.alert(
            'Confirm Reject',
            'Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.approveDevice(id, 'REJECTED');
                            Alert.alert('Success', 'Device rejected');
                            fetchData();
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.error || 'Failed to reject');
                        }
                    }
                }
            ]
        );
    };

    const handleBlock = async (device) => {
        const deviceId = device.device_id || device.id;
        
        Alert.alert(
            'Confirm Block',
            'Block this device? User will not be able to login from this device.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.blockDevice(deviceId);
                            Alert.alert('Success', 'Device blocked');
                            fetchData();
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.error || 'Failed to block device');
                        }
                    }
                }
            ]
        );
    };

    const pendingDevices = devices.filter(d => d.status === 'PENDING');
    const approvedDevices = devices.filter(d => d.status === 'APPROVED');
    const blockedDevices = devices.filter(d => d.status === 'BLOCKED');

    const currentDevices = activeTab === 0 ? pendingDevices : 
                          activeTab === 1 ? approvedDevices : blockedDevices;

    const renderDevice = ({ item }) => {
        // Handle different property names from API
        const userName = item.user?.username || item.username || item.user_name || 'Unknown User';
        const deviceName = item.device_name || item.device_id || item.name || 'Unknown Device';
        const platform = item.platform || 'Unknown';
        const browser = item.browser || 'Unknown';
        const os = item.os || 'Unknown OS';
        const lastActive = item.last_active ? new Date(item.last_active).toLocaleDateString() : 'N/A';
        
        return (
            <View style={styles.deviceCard}>
                <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{userName}</Text>
                    <Text style={styles.deviceDetail}>{deviceName}</Text>
                    <View style={styles.deviceMeta}>
                        <Text style={styles.metaText}>{platform} | {browser} on {os}</Text>
                        <Text style={styles.metaText}>Last active: {lastActive}</Text>
                    </View>
                </View>
                <View style={styles.deviceActions}>
                    {item.status === 'PENDING' && (
                        <>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.approveBtn]}
                                onPress={() => handleApprove(item.id)}
                            >
                                <Text style={styles.actionBtnText}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.rejectBtn]}
                                onPress={() => handleReject(item.id)}
                            >
                                <Text style={styles.actionBtnText}>Reject</Text>
                            </TouchableOpacity>
                        </>
                    )}
                    {item.status === 'APPROVED' && (
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.blockBtn]}
                            onPress={() => handleBlock(item)}
                        >
                            <Text style={styles.actionBtnText}>Block</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading devices...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: logout, style: 'destructive' }
        ]);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Device Management</Text>
                    <Text style={styles.headerSubtitle}>{user?.first_name} {user?.last_name} (ID: {user?.employee_id || user?.id || 'N/A'})</Text>
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                    <Icon name="log-out" size={24} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 0 && styles.activeTab]}
                    onPress={() => setActiveTab(0)}
                >
                    <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>
                        Pending ({pendingDevices.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 1 && styles.activeTab]}
                    onPress={() => setActiveTab(1)}
                >
                    <Text style={[styles.tabText, activeTab === 1 && styles.activeTabText]}>
                        Approved ({approvedDevices.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 2 && styles.activeTab]}
                    onPress={() => setActiveTab(2)}
                >
                    <Text style={[styles.tabText, activeTab === 2 && styles.activeTabText]}>
                        Blocked ({blockedDevices.length})
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={currentDevices}
                keyExtractor={(item) => `device_${item.id}`}
                renderItem={renderDevice}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No devices</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#4361EE',
    },
    headerCenter: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#FFFFFF',
        opacity: 0.8,
        marginTop: 2,
    },
    backBtn: {
        padding: 5,
    },
    logoutBtn: {
        padding: 5,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
    },
    tab: {
        flex: 1,
        padding: 15,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 3,
        borderBottomColor: '#4361EE',
    },
    tabText: {
        fontSize: 14,
        color: '#8D99AE',
    },
    activeTabText: {
        color: '#4361EE',
        fontWeight: 'bold',
    },
    deviceCard: {
        backgroundColor: '#FFFFFF',
        margin: 10,
        padding: 15,
        borderRadius: 10,
        elevation: 2,
    },
    deviceInfo: {
        marginBottom: 10,
    },
    deviceName: {
        fontSize: 16,
        fontWeight: '600',
    },
    deviceDetail: {
        fontSize: 14,
        color: '#2B2D42',
        marginTop: 5,
    },
    deviceMeta: {
        marginTop: 5,
    },
    metaText: {
        fontSize: 12,
        color: '#8D99AE',
    },
    deviceActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    actionBtn: {
        padding: 8,
        borderRadius: 5,
        marginLeft: 10,
        paddingHorizontal: 15,
    },
    approveBtn: {
        backgroundColor: '#4CC9F0',
    },
    rejectBtn: {
        backgroundColor: '#F94144',
    },
    blockBtn: {
        backgroundColor: '#F8961E',
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#8D99AE',
    },
    errorText: {
        color: '#F94144',
        fontSize: 16,
        marginBottom: 15,
    },
    retryBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#4361EE',
        borderRadius: 5,
    },
    retryText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    emptyContainer: {
        padding: 50,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#8D99AE',
    },
});

export default AdminDevicesScreen;