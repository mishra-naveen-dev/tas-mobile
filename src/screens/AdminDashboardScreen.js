import React, { useState, useCallback, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
    ActivityIndicator,
    FlatList
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { AuthContext } from '../context/AuthContext';
import api from '../api/api';

const AdminDashboardScreen = ({ navigation }) => {
    const { user, logout } = useContext(AuthContext) || {};
    const currentUser = user || { first_name: 'Admin', last_name: '', employee_id: 'N/A' };
    
    const [stats, setStats] = useState({ totalEmployees: 0, activeEmployees: 0, totalDistance: 0 });
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const fetchDashboardData = useCallback(async () => {
        try {
            setError(null);
            const [trackingRes, employeesRes] = await Promise.all([
                api.getEmployeeTracking(),
                api.getAllEmployees()
            ]);
            
            const trackingData = trackingRes.data || [];
            const employeesData = employeesRes.data || [];
            
            setEmployees(trackingData);
            setStats({
                totalEmployees: employeesData.length,
                activeEmployees: trackingData.filter(e => e.today_punches > 0).length,
                totalDistance: trackingData.reduce((sum, e) => sum + (parseFloat(e.distance) || 0), 0).toFixed(2)
            });
        } catch (err) {
            console.log('Error fetching admin data:', err);
            setError('Failed to load dashboard data');
            setStats({ totalEmployees: 0, activeEmployees: 0, totalDistance: 0 });
            setEmployees([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    React.useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: logout, style: 'destructive' }
        ]);
    };

    const actionButtons = [
        { title: 'Approvals', icon: 'check-circle', screen: 'AdminApprovals' },
        { title: 'Devices', icon: 'smartphone', screen: 'AdminDevices' },
    ];

    const renderEmployeeItem = ({ item }) => (
        <View style={styles.employeeCard}>
            <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>{item.name || 'Unknown'}</Text>
                <Text style={styles.employeeId}>ID: {item.employee_id || 'N/A'}</Text>
            </View>
            <View style={styles.employeeStats}>
                <Text style={styles.statItem}>{item.today_punches || 0} punches</Text>
                <Text style={styles.statItem}>{(parseFloat(item.distance) || 0).toFixed(2)} km</Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4361EE" />
                <Text style={styles.loadingText}>Loading dashboard...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Icon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                        <Icon name="log-out" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.title}>Admin Dashboard</Text>
                <Text style={styles.subtitle}>{currentUser.first_name} {currentUser.last_name}</Text>
                <Text style={styles.userId}>ID: {currentUser.employee_id || currentUser.id || 'N/A'}</Text>
            </View>

            {error && (
                <View style={styles.errorBanner}>
                    <Icon name="alert-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.totalEmployees}</Text>
                    <Text style={styles.statLabel}>Total Employees</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.activeEmployees}</Text>
                    <Text style={styles.statLabel}>Active Today</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.totalDistance}</Text>
                    <Text style={styles.statLabel}>Total km</Text>
                </View>
            </View>

            <View style={styles.actionsContainer}>
                {actionButtons.map((btn, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.actionButton}
                        onPress={() => navigation.navigate(btn.screen)}
                    >
                        <Icon name={btn.icon} size={24} color="#4361EE" />
                        <Text style={styles.actionText}>{btn.title}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.listContainer}>
                <Text style={styles.sectionTitle}>Employee Activity</Text>
                {employees.length > 0 ? (
                    employees.slice(0, 10).map((emp, index) => (
                        <View key={index} style={styles.employeeCard}>
                            <View style={styles.employeeInfo}>
                                <Text style={styles.employeeName}>{emp.name || 'Unknown'}</Text>
                                <Text style={styles.employeeId}>{emp.employee_id || 'N/A'}</Text>
                            </View>
                            <View style={styles.employeeStats}>
                                <Text style={styles.statItem}>{emp.today_punches || 0} punches</Text>
                                <Text style={styles.statItem}>{(parseFloat(emp.distance) || 0).toFixed(2)} km</Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyList}>
                        <Text style={styles.emptyText}>No employee activity</Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
    loadingText: { marginTop: 10, color: '#8D99AE', fontSize: 14 },
    header: { padding: 20, paddingTop: 10, backgroundColor: '#4361EE' },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    backBtn: { padding: 5 },
    logoutBtn: { padding: 5 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
    subtitle: { fontSize: 14, color: '#FFFFFF', opacity: 0.8, marginTop: 4 },
    userId: { fontSize: 12, color: '#FFFFFF', opacity: 0.6, marginTop: 2 },
    errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F94144', padding: 12 },
    errorText: { color: '#FFFFFF', marginLeft: 8, fontSize: 14 },
    statsContainer: { flexDirection: 'row', padding: 15, justifyContent: 'space-between' },
    statCard: { backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, alignItems: 'center', flex: 1, marginHorizontal: 4, elevation: 2 },
    statValue: { fontSize: 24, fontWeight: 'bold', color: '#2B2D42' },
    statLabel: { fontSize: 12, color: '#8D99AE', marginTop: 4 },
    actionsContainer: { flexDirection: 'row', paddingHorizontal: 15, paddingBottom: 15, justifyContent: 'space-between' },
    actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, marginHorizontal: 4, elevation: 1 },
    actionText: { fontSize: 14, color: '#2B2D42', marginLeft: 8, fontWeight: '500' },
    listContainer: { padding: 15 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: '#2B2D42', marginBottom: 12 },
    employeeCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8, marginBottom: 8, elevation: 1 },
    employeeInfo: { flex: 1 },
    employeeName: { fontSize: 14, fontWeight: '600', color: '#2B2D42' },
    employeeId: { fontSize: 12, color: '#8D99AE', marginTop: 2 },
    employeeStats: { alignItems: 'flex-end' },
    statItem: { fontSize: 12, color: '#8D99AE' },
    emptyList: { padding: 20, alignItems: 'center' },
    emptyText: { color: '#8D99AE', fontSize: 14 },
});

export default AdminDashboardScreen;