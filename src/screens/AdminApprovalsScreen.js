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

const AdminApprovalsScreen = ({ navigation }) => {
    const { user, logout } = useContext(AuthContext) || {};
    const currentUser = user || { first_name: 'Admin', last_name: '', employee_id: 'N/A' };
    
    const [allowances, setAllowances] = useState([]);
    const [corrections, setCorrections] = useState([]);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState(0);

    const tabs = [
        { title: 'Allowances', key: 'allowance', count: allowances.length },
        { title: 'Corrections', key: 'correction', count: corrections.length },
        { title: 'Devices', key: 'device', count: devices.length },
    ];

    const fetchApprovalsData = useCallback(async () => {
        try {
            setError(null);
            const [allowanceRes, correctionRes, deviceRes] = await Promise.all([
                api.getAllAllowanceRequests(),
                api.getCorrectionRequests(),
                api.getDevices()
            ]);
            
            const allowanceData = allowanceRes.data?.results || allowanceRes.data || [];
            const correctionData = correctionRes.data?.results || correctionRes.data || [];
            const deviceData = deviceRes.data?.results || deviceRes.data || [];
            
            setAllowances(allowanceData.filter(item => item.status === 'PENDING'));
            setCorrections(correctionData.filter(item => item.status === 'PENDING'));
            setDevices(deviceData.filter(item => item.status === 'PENDING'));
        } catch (err) {
            console.log('Error fetching approvals:', err);
            setError('Failed to load approvals');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchApprovalsData();
    };

    React.useEffect(() => {
        fetchApprovalsData();
    }, [fetchApprovalsData]);

    const handleApprove = async (item, type) => {
        const id = item.id;
        const status = 'APPROVED';
        
        try {
            if (type === 'allowance') {
                await api.approveAllowance(id, status);
            } else if (type === 'correction') {
                await api.approveCorrection(id, status);
            } else if (type === 'device') {
                await api.approveDevice(id, status);
            }
            
            Alert.alert('Success', `${type} approved successfully`);
            fetchApprovalsData();
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || `Failed to approve ${type}`);
        }
    };

    const handleReject = async (item, type) => {
        const id = item.id;
        const status = 'REJECTED';
        
        try {
            if (type === 'allowance') {
                await api.approveAllowance(id, status);
            } else if (type === 'correction') {
                await api.approveCorrection(id, status);
            } else if (type === 'device') {
                await api.approveDevice(id, status);
            }
            
            Alert.alert('Success', `${type} rejected`);
            fetchApprovalsData();
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || `Failed to reject ${type}`);
        }
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: logout, style: 'destructive' }
        ]);
    };

    const renderItem = ({ item, type }) => {
        const title = type === 'device' 
            ? `${item.username || 'Unknown'} - ${item.device_name || item.device_id || 'Unknown Device'}`
            : item.employee_name || item.user?.first_name || 'Unknown';
        const subtitle = type === 'allowance' 
            ? `₹${item.amount} - ${item.visit_type}`
            : type === 'correction'
            ? `${item.punch_time} - ${item.location_address}`
            : item.status;

        return (
            <View style={styles.itemCard}>
                <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{title}</Text>
                    <Text style={styles.itemSubtitle}>{subtitle}</Text>
                </View>
                <View style={styles.itemActions}>
                    <TouchableOpacity 
                        style={[styles.actionBtn, styles.approveBtn]}
                        onPress={() => handleApprove(item, type)}
                    >
                        <Icon name="check" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.actionBtn, styles.rejectBtn]}
                        onPress={() => handleReject(item, type)}
                    >
                        <Icon name="x" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const currentData = activeTab === 0 ? allowances : activeTab === 1 ? corrections : devices;
    const currentType = tabs[activeTab].key;

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4361EE" />
                <Text style={styles.loadingText}>Loading approvals...</Text>
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
                        <Text style={styles.headerTitle}>Pending Approvals</Text>
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
                            {tab.title} ({tab.count})
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={currentData}
                keyExtractor={(item, index) => `${currentType}_${item.id || index}`}
                renderItem={({ item }) => renderItem({ item, type: currentType })}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyList}>
                        <Icon name="inbox" size={48} color="#8D99AE" />
                        <Text style={styles.emptyText}>No pending {currentType}s</Text>
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
    itemCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 15, marginHorizontal: 15, marginTop: 10, borderRadius: 10, elevation: 1 },
    itemInfo: { flex: 1 },
    itemTitle: { fontSize: 14, fontWeight: '600', color: '#2B2D42' },
    itemSubtitle: { fontSize: 12, color: '#8D99AE', marginTop: 4 },
    itemActions: { flexDirection: 'row' },
    actionBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    approveBtn: { backgroundColor: '#4CC9F0' },
    rejectBtn: { backgroundColor: '#F94144' },
    emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyText: { color: '#8D99AE', marginTop: 10, fontSize: 14 },
});

export default AdminApprovalsScreen;