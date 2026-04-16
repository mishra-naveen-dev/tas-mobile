import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { colors } from '../theme/tokens';

const SuperAdminDashboardScreen = ({ navigation }) => {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await api.getOrganizationStats();
            setStats(res.data);
        } catch (err) {
            console.log('Error fetching stats:', err);
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

    const menuItems = [
        { title: 'User Management', icon: 'users', screen: 'UserManagement' },
        { title: 'Device Management', icon: 'smartphone', screen: 'AdminDevices' },
        { title: 'Approval Routes', icon: 'git-branch', screen: 'ApprovalRoutes' },
        { title: 'Organization Settings', icon: 'settings', screen: 'OrgSettings' },
        { title: 'All Employees Tracking', icon: 'map-pin', screen: 'EmployeeTracking' },
        { title: 'Reports', icon: 'file-text', screen: 'Reports' },
    ];

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            <View style={styles.header}>
                <Text style={styles.companyName}>Arman Financial Services Ltd</Text>
                <Text style={styles.title}>Super Admin Dashboard</Text>
                <Text style={styles.subtitle}>{user?.first_name} {user?.last_name}</Text>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats?.total_users || 0}</Text>
                    <Text style={styles.statLabel}>Total Users</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats?.total_employees || 0}</Text>
                    <Text style={styles.statLabel}>Employees</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats?.total_admins || 0}</Text>
                    <Text style={styles.statLabel}>Admins</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats?.total_devices || 0}</Text>
                    <Text style={styles.statLabel}>Devices</Text>
                </View>
            </View>

            <View style={styles.menuContainer}>
                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.menuItem}
                        onPress={() => navigation.navigate(item.screen)}
                    >
                        <Text style={styles.menuText}>{item.title}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.quickActions}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('CreateUser')}
                >
                    <Text style={styles.actionText}>+ Create New User</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('AdminApprovals')}
                >
                    <Text style={styles.actionText}>View All Approvals</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        padding: 20,
        backgroundColor: colors.primary,
        paddingTop: 50,
    },
    companyName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
        opacity: 0.9,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.white,
    },
    subtitle: {
        fontSize: 14,
        color: colors.white,
        opacity: 0.8,
    },
    statsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 10,
        justifyContent: 'space-between',
    },
    statCard: {
        backgroundColor: colors.white,
        padding: 15,
        borderRadius: 10,
        width: '48%',
        alignItems: 'center',
        marginBottom: 10,
        elevation: 2,
    },
    statValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.primary,
    },
    statLabel: {
        fontSize: 12,
        color: colors.textMuted,
    },
    menuContainer: {
        padding: 15,
    },
    menuItem: {
        backgroundColor: colors.white,
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        elevation: 2,
    },
    menuText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    quickActions: {
        padding: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    actionButton: {
        backgroundColor: colors.primary,
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
    },
    actionText: {
        color: colors.white,
        fontWeight: 'bold',
        textAlign: 'center',
    },
});

export default SuperAdminDashboardScreen;