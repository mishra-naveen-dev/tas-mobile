import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
    SafeAreaView
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/api';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, typography, spacing } from '../../theme/tokens';

const SuperAdminDashboardScreen = ({ navigation }) => {
    const auth = useAuth();
    const user = auth?.user;
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const handleLogout = useCallback(() => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await auth.logout();
                    },
                },
            ]
        );
    }, [auth]);

    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/organization/users/stats/');
            setStats(res.data);
        } catch (err) {
            console.error('Error fetching stats:', err?.response?.data || err?.message || err);
            setStats({
                total_employees: 0,
                active_employees: 0,
                total_punches: 0,
                total_distance: 0,
                total_collections: 0,
                total_disbursements: 0,
            });
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
        { title: 'Employee List', icon: 'user-check', screen: 'EmployeeList' },
        { title: 'Device Management', icon: 'smartphone', screen: 'AdminDevices' },
        { title: 'Approval Routes', icon: 'git-branch', screen: 'ApprovalRoutes' },
        { title: 'Organization Settings', icon: 'settings', screen: 'OrgSettings' },
        { title: 'Employee Tracking', icon: 'map-pin', screen: 'EmployeeTracking' },
        { title: 'Reports', icon: 'file-text', screen: 'Reports' },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader
                title="Super Admin"
                subtitle={user?.username || 'Super Admin'}
                navigation={navigation}
                showBack={false}
                showLogout={true}
                onLogout={handleLogout}
            />

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats?.total_employees || 0}</Text>
                        <Text style={styles.statLabel}>Total Employees</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats?.active_employees || 0}</Text>
                        <Text style={styles.statLabel}>Active Today</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{(stats?.total_distance || 0).toFixed(0)}</Text>
                        <Text style={styles.statLabel}>Total km</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats?.total_punches || 0}</Text>
                        <Text style={styles.statLabel}>Punches</Text>
                    </View>
                </View>

                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>Management</Text>
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.menuItem}
                            onPress={() => navigation.navigate(item.screen)}
                        >
                            <View style={styles.menuIcon}>
                                <Icon name={item.icon} size={20} color={colors.primary} />
                            </View>
                            <Text style={styles.menuText}>{item.title}</Text>
                            <Icon name="chevron-right" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.quickActions}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('CreateUser')}
                    >
                        <Icon name="user-plus" size={20} color={colors.primary} />
                        <Text style={styles.actionText}>Create New User</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('AdminApprovals')}
                    >
                        <Icon name="check-circle" size={20} color={colors.primary} />
                        <Text style={styles.actionText}>View All Approvals</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
    },
    statsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: spacing.md,
        justifyContent: 'space-between',
    },
    statCard: {
        width: '48%',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: spacing.sm,
        elevation: 2,
    },
    statValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.primary,
    },
    statLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    menuSection: {
        padding: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.md,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.sm,
        elevation: 1,
    },
    menuIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    menuText: {
        flex: 1,
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.medium,
        color: colors.textDark,
    },
    quickActions: {
        padding: spacing.md,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.sm,
        elevation: 1,
    },
    actionText: {
        flex: 1,
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.medium,
        color: colors.textDark,
        marginLeft: spacing.md,
    },
});

export default SuperAdminDashboardScreen;
