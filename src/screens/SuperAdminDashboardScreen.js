import React, { useState, useCallback, useContext } from 'react';
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

const SuperAdminDashboardScreen = ({ navigation }) => {
    const { user, logout } = useContext(AuthContext) || {};
    const currentUser = user || { first_name: 'Super Admin', last_name: '', employee_id: 'N/A' };
    
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async () => {
        try {
            setError(null);
            const response = await api.getOrganizationStats();
            const data = response.data;
            setStats(data || {
                total_users: 0,
                total_employees: 0,
                total_admins: 0,
                total_devices: 0
            });
        } catch (err) {
            console.log('Error fetching stats:', err);
            setError('Failed to load statistics');
            setStats({ total_users: 0, total_employees: 0, total_admins: 0, total_devices: 0 });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchStats();
    };

    React.useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: logout, style: 'destructive' }
        ]);
    };

    const menuItems = [
        { title: 'Device Management', icon: 'smartphone', screen: 'AdminDevices' },
    ];

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
                <Text style={styles.title}>Super Admin</Text>
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
                    <Text style={styles.statValue}>{stats?.total_users ?? 0}</Text>
                    <Text style={styles.statLabel}>Total Users</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats?.total_employees ?? 0}</Text>
                    <Text style={styles.statLabel}>Employees</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats?.total_admins ?? 0}</Text>
                    <Text style={styles.statLabel}>Admins</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats?.total_devices ?? 0}</Text>
                    <Text style={styles.statLabel}>Devices</Text>
                </View>
            </View>

            <View style={styles.menuContainer}>
                <Text style={styles.sectionTitle}>Management</Text>
                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.menuItem}
                        onPress={() => navigation.navigate(item.screen)}
                    >
                        <View style={styles.menuIcon}>
                            <Icon name={item.icon} size={24} color="#4361EE" />
                        </View>
                        <Text style={styles.menuText}>{item.title}</Text>
                        <Icon name="chevron-right" size={20} color="#8D99AE" />
                    </TouchableOpacity>
                ))}
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
    statsContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'space-between' },
    statCard: { backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, alignItems: 'center', width: '48%', marginBottom: 10, elevation: 2 },
    statValue: { fontSize: 28, fontWeight: 'bold', color: '#2B2D42' },
    statLabel: { fontSize: 12, color: '#8D99AE', marginTop: 4 },
    menuContainer: { padding: 15 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: '#2B2D42', marginBottom: 12 },
    menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, marginBottom: 10, elevation: 1 },
    menuIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EDF2F4', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    menuText: { flex: 1, fontSize: 16, color: '#2B2D42' },
});

export default SuperAdminDashboardScreen;