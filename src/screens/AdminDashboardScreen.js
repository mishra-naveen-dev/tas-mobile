import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
    ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { AuthContext } from '../context/AuthContext';
import api from '../api/api';

const AdminDashboardScreen = ({ navigation }) => {
    const authContext = useContext(AuthContext);
    const user = authContext?.user || { first_name: 'Admin', last_name: '' };
    const { logout } = authContext || {};
    
    const [stats, setStats] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [trackingRes, employeesRes] = await Promise.all([
                api.getEmployeeTracking(),
                api.getAllEmployees()
            ]);
            
            setEmployees(trackingRes.data || []);
            setStats({
                totalEmployees: employeesRes.data?.length || 0,
                activeEmployees: (trackingRes.data || []).filter(e => e.today_punches > 0).length,
                totalDistance: (trackingRes.data || []).reduce((sum, e) => sum + (parseFloat(e.distance) || 0), 0)
            });
        } catch (err) {
            console.log('Error fetching admin data:', err);
            Alert.alert('Error', 'Failed to load dashboard data');
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

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: logout, style: 'destructive' }
        ]);
    };

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
                <Text style={styles.subtitle}>{user?.first_name} {user?.last_name}</Text>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats?.totalEmployees || 0}</Text>
                    <Text style={styles.statLabel}>Total Employees</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats?.activeEmployees || 0}</Text>
                    <Text style={styles.statLabel}>Active Today</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{(stats?.totalDistance || 0).toFixed(1)}</Text>
                    <Text style={styles.statLabel}>Total km</Text>
                </View>
            </View>

            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('AdminApprovals')}
                >
                    <Text style={styles.actionText}>Pending Approvals</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('AdminDevices')}
                >
                    <Text style={styles.actionText}>Device Management</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('EmployeeTracking')}
                >
                    <Text style={styles.actionText}>Employee Tracking</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.listContainer}>
                <Text style={styles.sectionTitle}>Today's Activity</Text>
                {employees.slice(0, 10).map((emp, index) => (
                    <View key={index} style={styles.employeeCard}>
                        <View style={styles.employeeInfo}>
                            <Text style={styles.employeeName}>{emp.name}</Text>
                            <Text style={styles.employeeId}>{emp.employee_id}</Text>
                        </View>
                        <View style={styles.employeeStats}>
                            <Text style={styles.statItem}>{emp.today_punches || 0} punches</Text>
                            <Text style={styles.statItem}>{(parseFloat(emp.distance) || 0).toFixed(2)} km</Text>
                        </View>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        padding: 20,
        paddingTop: 10,
        backgroundColor: '#4361EE',
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    backBtn: {
        padding: 5,
    },
    logoutBtn: {
        padding: 5,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    subtitle: {
        fontSize: 14,
        color: '#FFFFFF',
        opacity: 0.8,
    },
    statsContainer: {
        flexDirection: 'row',
        padding: 15,
        justifyContent: 'space-between',
    },
    statCard: {
        backgroundColor: '#FFFFFF',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        flex: 1,
        marginHorizontal: 5,
        elevation: 2,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#4361EE',
    },
    statLabel: {
        fontSize: 12,
        color: '#8D99AE',
    },
    actionsContainer: {
        padding: 15,
    },
    actionButton: {
        backgroundColor: '#FFFFFF',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        elevation: 2,
    },
    actionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2B2D42',
    },
    listContainer: {
        padding: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    employeeCard: {
        backgroundColor: '#FFFFFF',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        elevation: 1,
    },
    employeeInfo: {
        flex: 1,
    },
    employeeName: {
        fontSize: 16,
        fontWeight: '600',
    },
    employeeId: {
        fontSize: 12,
        color: '#8D99AE',
    },
    employeeStats: {
        alignItems: 'flex-end',
    },
    statItem: {
        fontSize: 14,
        color: '#8D99AE',
    },
});

export default AdminDashboardScreen;