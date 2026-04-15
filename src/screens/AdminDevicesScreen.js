import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Alert
} from 'react-native';
import api from '../api/api';
import { colors } from '../theme/tokens';

const AdminDevicesScreen = ({ navigation }) => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const fetchData = useCallback(async () => {
        try {
            const res = await api.getDevices();
            setDevices(res.data?.results || res.data || []);
        } catch (err) {
            console.log('Error fetching devices:', err);
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
            Alert.alert('Error', 'Failed to approve device');
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
                            Alert.alert('Error', 'Failed to reject');
                        }
                    }
                }
            ]
        );
    };

    const handleBlock = async (id) => {
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
                            await api.blockDevice(id);
                            Alert.alert('Success', 'Device blocked');
                            fetchData();
                        } catch (err) {
                            Alert.alert('Error', 'Failed to block device');
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

    const renderDevice = ({ item }) => (
        <View style={styles.deviceCard}>
            <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{item.username}</Text>
                <Text style={styles.deviceDetail}>{item.device_name || item.device_id}</Text>
                <View style={styles.deviceMeta}>
                    <Text style={styles.metaText}>{item.platform} | {item.browser} on {item.os}</Text>
                    <Text style={styles.metaText}>Last active: {item.last_active ? new Date(item.last_active).toLocaleDateString() : 'N/A'}</Text>
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
                        onPress={() => handleBlock(item.id)}
                    >
                        <Text style={styles.actionBtnText}>Block</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
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
        backgroundColor: colors.background,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: colors.white,
    },
    tab: {
        flex: 1,
        padding: 15,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 3,
        borderBottomColor: colors.primary,
    },
    tabText: {
        fontSize: 14,
        color: colors.textMuted,
    },
    activeTabText: {
        color: colors.primary,
        fontWeight: 'bold',
    },
    deviceCard: {
        backgroundColor: colors.white,
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
        color: colors.text,
        marginTop: 5,
    },
    deviceMeta: {
        marginTop: 5,
    },
    metaText: {
        fontSize: 12,
        color: colors.textMuted,
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
        backgroundColor: colors.success,
    },
    rejectBtn: {
        backgroundColor: colors.error,
    },
    blockBtn: {
        backgroundColor: colors.warning,
    },
    actionBtnText: {
        color: colors.white,
        fontWeight: 'bold',
        fontSize: 12,
    },
    emptyContainer: {
        padding: 50,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: colors.textMuted,
    },
});

export default AdminDevicesScreen;