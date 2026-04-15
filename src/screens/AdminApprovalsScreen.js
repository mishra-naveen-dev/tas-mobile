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

const AdminApprovalsScreen = ({ navigation }) => {
    const { logout, user } = useContext(AuthContext) || {};
    const [allowances, setAllowances] = useState([]);
    const [corrections, setCorrections] = useState([]);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const fetchData = useCallback(async () => {
        try {
            const [allowanceRes, correctionRes, deviceRes] = await Promise.all([
                api.getAllAllowanceRequests({ status: 'PENDING' }),
                api.getCorrectionRequests({ status: 'PENDING' }),
                api.getDevices({ status: 'PENDING' })
            ]);
            
            setAllowances(allowanceRes.data?.results || allowanceRes.data || []);
            setCorrections(correctionRes.data?.results || correctionRes.data || []);
            setDevices(deviceRes.data?.results || deviceRes.data || []);
        } catch (err) {
            console.log('Error fetching approvals:', err);
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

    const handleApprove = async (type, id) => {
        try {
            if (type === 'allowance') {
                await api.approveAllowance(id, 'APPROVED');
            } else if (type === 'correction') {
                await api.approveCorrection(id, 'APPROVED');
            } else if (type === 'device') {
                await api.approveDevice(id, 'APPROVED');
            }
            Alert.alert('Success', 'Approved successfully');
            fetchData();
        } catch (err) {
            Alert.alert('Error', 'Failed to approve');
        }
    };

    const handleReject = async (type, id) => {
        Alert.alert(
            'Confirm Reject',
            'Are you sure you want to reject?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (type === 'allowance') {
                                await api.approveAllowance(id, 'REJECTED');
                            } else if (type === 'correction') {
                                await api.approveCorrection(id, 'REJECTED');
                            } else if (type === 'device') {
                                await api.approveDevice(id, 'REJECTED');
                            }
                            Alert.alert('Success', 'Rejected successfully');
                            fetchData();
                        } catch (err) {
                            Alert.alert('Error', 'Failed to reject');
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item, type }) => (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>
                    {type === 'allowance' ? `${item.employee_name} - ₹${item.total_amount}` :
                     type === 'correction' ? `${item.employee_name} - ${item.punch_type}` :
                     `${item.username} - ${item.device_name}`}
                </Text>
                <Text style={styles.cardSubtitle}>
                    {type === 'allowance' ? `${item.total_distance} km | ${item.travel_date}` :
                     type === 'correction' ? `${item.punched_at} | ${item.current_address}` :
                     `${item.platform} | ${item.browser} on ${item.os}`}
                </Text>
            </View>
            <View style={styles.cardActions}>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleApprove(type, item.id)}
                >
                    <Text style={styles.actionBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleReject(type, item.id)}
                >
                    <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const tabs = [
        { title: 'Allowances', count: allowances.length },
        { title: 'Corrections', count: corrections.length },
        { title: 'Devices', count: devices.length }
    ];

    const currentData = activeTab === 0 ? allowances : activeTab === 1 ? corrections : devices;
    const currentType = activeTab === 0 ? 'allowance' : activeTab === 1 ? 'correction' : 'device';

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
                    <Text style={styles.headerTitle}>Pending Approvals</Text>
                    <Text style={styles.headerSubtitle}>{user?.first_name} {user?.last_name} (ID: {user?.employee_id || user?.id || 'N/A'})</Text>
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                    <Icon name="log-out" size={24} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
            <View style={styles.tabContainer}>
                {tabs.map((tab, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.tab, activeTab === index && styles.activeTab]}
                        onPress={() => setActiveTab(index)}
                    >
                        <Text style={[styles.tabText, activeTab === index && styles.activeTabText]}>
                            {tab.title} ({tab.count})
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={currentData}
                keyExtractor={(item) => `${currentType}_${item.id}`}
                renderItem={({ item }) => renderItem({ item, type: currentType })}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No pending items</Text>
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
        padding: 10,
    },
    tab: {
        flex: 1,
        padding: 10,
        alignItems: 'center',
        borderRadius: 5,
    },
    activeTab: {
        backgroundColor: '#4361EE',
    },
    tabText: {
        fontSize: 14,
        color: '#8D99AE',
    },
    activeTabText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    card: {
        backgroundColor: '#FFFFFF',
        margin: 10,
        padding: 15,
        borderRadius: 10,
        elevation: 2,
    },
    cardContent: {
        marginBottom: 10,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    cardSubtitle: {
        fontSize: 12,
        color: '#8D99AE',
        marginTop: 5,
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionBtn: {
        flex: 1,
        padding: 10,
        borderRadius: 5,
        marginHorizontal: 5,
        alignItems: 'center',
    },
    approveBtn: {
        backgroundColor: '#4CC9F0',
    },
    rejectBtn: {
        backgroundColor: '#F94144',
    },
    actionBtnText: {
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

export default AdminApprovalsScreen;