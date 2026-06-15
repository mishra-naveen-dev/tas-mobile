import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Alert,
    SafeAreaView
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';
import ScreenHeader from '../../components/ScreenHeader';

const UserManagementScreen = ({ navigation }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/organization/users/');
            setUsers(res.data?.results || res.data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
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

    const admins = users.filter(u => u.role === 'ADMIN' || u.role?.name === 'ADMIN');
    const employees = users.filter(u => u.role === 'EMPLOYEE' || u.role?.name === 'EMPLOYEE');
    const guests = users.filter(u => u.role === 'GUEST' || u.role?.name === 'GUEST');

    const currentUsers = activeTab === 0 ? users : activeTab === 1 ? admins : activeTab === 2 ? employees : guests;

    const getRoleBadgeColor = (role) => {
        switch (role) {
            case 'ADMIN': return colors.primary;
            case 'EMPLOYEE': return colors.success;
            case 'GUEST': return colors.warning;
            default: return colors.textMuted;
        }
    };

    const renderUser = ({ item }) => (
        <View style={styles.userCard}>
            <View style={styles.userAvatar}>
                <Text style={styles.avatarText}>
                    {(item.first_name || item.username || 'U').charAt(0).toUpperCase()}
                </Text>
            </View>
            <View style={styles.userInfo}>
                <Text style={styles.userName}>
                    {item.first_name} {item.last_name || ''}
                </Text>
                <Text style={styles.userDetail}>@{item.username}</Text>
                <Text style={styles.userDetail}>{item.email}</Text>
            </View>
            <View style={styles.userActions}>
                <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(item.role) + '20' }]}>
                    <Text style={[styles.roleText, { color: getRoleBadgeColor(item.role) }]}>
                        {item.role || 'USER'}
                    </Text>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader
                title="User Management"
                subtitle={`${users.length} users`}
                navigation={navigation}
            />

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 0 && styles.activeTab]}
                    onPress={() => setActiveTab(0)}
                >
                    <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>
                        All ({users.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 1 && styles.activeTab]}
                    onPress={() => setActiveTab(1)}
                >
                    <Text style={[styles.tabText, activeTab === 1 && styles.activeTabText]}>
                        Admins ({admins.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 2 && styles.activeTab]}
                    onPress={() => setActiveTab(2)}
                >
                    <Text style={[styles.tabText, activeTab === 2 && styles.activeTabText]}>
                        Employees ({employees.length})
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={currentUsers}
                keyExtractor={(item, index) => item.id ? `user_${item.id}` : `user-${index}`}
                renderItem={renderUser}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="users" size={48} color={colors.textLight} />
                        <Text style={styles.emptyText}>No users found</Text>
                    </View>
                }
            />

            <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
                <Icon name="plus" size={24} color="#FFFFFF" />
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        paddingVertical: spacing.sm,
    },
    tab: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 3,
        borderBottomColor: colors.primary,
    },
    tabText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        fontWeight: typography.weights.medium,
    },
    activeTabText: {
        color: colors.primary,
        fontWeight: typography.weights.bold,
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.sm,
        elevation: 2,
    },
    userAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    userInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    userName: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    userDetail: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    userActions: {
        alignItems: 'flex-end',
    },
    roleBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 12,
    },
    roleText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
    },
    emptyContainer: {
        padding: spacing.xxl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        marginTop: spacing.md,
    },
    fab: {
        position: 'absolute',
        right: spacing.lg,
        bottom: spacing.xl,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
});

export default UserManagementScreen;
