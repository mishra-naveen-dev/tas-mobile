import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    SafeAreaView,
    RefreshControl
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import HeroHeader from '../../components/HeroHeader';
import { colors, typography, spacing } from '../../theme/tokens';
import { SkeletonListItem } from '../../components/SkeletonComponents';

const SuperAdminEmployeesScreen = ({ navigation }) => {
    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [userData, setUserData] = useState(null);

    const fetchUserData = async () => {
        try {
            const res = await api.get('/organization/profile-update/');
            setUserData(res.data);
        } catch (err) {
            console.log('Error fetching user:', err.message);
        }
    };

    const fetchEmployees = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            const res = await api.get('/organization/users/');
            if (res.data && Array.isArray(res.data)) {
                setEmployees(res.data);
                setFilteredEmployees(res.data);
            }
        } catch (err) {
            console.log('Error fetching employees:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        fetchUserData();
        fetchEmployees(true);
    };

    useEffect(() => {
        fetchUserData();
        fetchEmployees();
    }, []);

    useEffect(() => {
        let filtered = employees;

        if (searchQuery) {
            filtered = filtered.filter(emp => 
                emp.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                emp.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                emp.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (filter !== 'all') {
            if (filter === 'active') {
                filtered = filtered.filter(emp => emp.is_active);
            } else if (filter === 'inactive') {
                filtered = filtered.filter(emp => !emp.is_active);
            }
        }

        setFilteredEmployees(filtered);
    }, [searchQuery, filter, employees]);

    const getStatusColor = (isActive) => isActive ? colors.success : colors.textMuted;
    const getRoleColor = (role) => {
        const safeRole = typeof role === 'string' ? role.toUpperCase() : '';
        switch (safeRole) {
            case 'ADMIN': return colors.warning;
            case 'SUPER_ADMIN': return colors.primary;
            default: return colors.info;
        }
    };

    const EmployeeCard = ({ item }) => {
        const safeItem = {
            ...item,
            first_name: typeof item.first_name === 'string' ? item.first_name : '',
            last_name: typeof item.last_name === 'string' ? item.last_name : '',
            username: typeof item.username === 'string' ? item.username : 'Unknown',
            email: typeof item.email === 'string' ? item.email : '',
            role: typeof item.role === 'string' ? item.role : 'employee',
        };

        const employeeName = safeItem.first_name && safeItem.last_name
            ? `${safeItem.first_name} ${safeItem.last_name}`
            : safeItem.username || 'Unknown';

        const roleDisplay = String(safeItem.role || 'employee').replace(/_/g, ' ').toUpperCase();
        const avatarInitial = employeeName.length > 0 ? employeeName.charAt(0).toUpperCase() : 'U';

        return (
            <TouchableOpacity
                style={styles.employeeCard}
                onPress={() => navigation.navigate('EmployeeTracking', { employeeId: item.id, employee: item })}
                activeOpacity={0.7}
            >
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{avatarInitial}</Text>
                </View>
                <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName}>{employeeName}</Text>
                    <Text style={styles.employeeEmail}>{safeItem.email || 'No email'}</Text>
                    <View style={styles.employeeMeta}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.is_active) }]} />
                        <Text style={[styles.statusText, { color: getStatusColor(item.is_active) }]}>
                            {item.is_active ? 'Active' : 'Inactive'}
                        </Text>
                        <View style={[styles.roleBadge, { backgroundColor: `${getRoleColor(safeItem.role)}15` }]}>
                            <Text style={[styles.roleText, { color: getRoleColor(safeItem.role) }]}>
                                {roleDisplay}
                            </Text>
                        </View>
                    </View>
                </View>
                <Icon name="chevron-right" size={22} color={colors.textMuted} />
            </TouchableOpacity>
        );
    };

    const filters = [
        { key: 'all', label: 'All', count: employees.length },
        { key: 'active', label: 'Active', count: employees.filter(e => e.is_active).length },
        { key: 'inactive', label: 'Inactive', count: employees.filter(e => !e.is_active).length },
    ];

    return (
        <SafeAreaView edges={['top']} style={styles.safeArea}>
            <View style={styles.container}>
                <HeroHeader
                    user={userData}
                    role="Super Admin"
                    showStatus={false}
                    onLogout={() => navigation.navigate('Login')}
                />

                <View style={styles.searchContainer}>
                    <View style={styles.searchBox}>
                        <Icon name="search" size={18} color={colors.textMuted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name, email..."
                            placeholderTextColor={colors.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery ? (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Icon name="x" size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                <View style={styles.filterContainer}>
                    {filters.map((f) => (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
                            onPress={() => setFilter(f.key)}
                        >
                            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                                {f.label}
                            </Text>
                            <View style={[styles.filterCount, filter === f.key && styles.filterCountActive]}>
                                <Text style={[styles.filterCountText, filter === f.key && styles.filterCountTextActive]}>
                                    {f.count}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {loading && filteredEmployees.length === 0 ? (
                    <View style={{ padding: spacing.md }}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
                        ))}
                    </View>
                ) : (
                    <FlatList
                        data={filteredEmployees}
                        renderItem={({ item }) => <EmployeeCard item={item} />}
                        keyExtractor={(item, index) => item.id ? item.id.toString() : `emp-${index}`}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Icon name="users" size={64} color={colors.textLight} />
                                <Text style={styles.emptyText}>No employees found</Text>
                            </View>
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    searchContainer: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    searchInput: {
        flex: 1,
        fontSize: typography.sizes.base,
        color: colors.textDark,
        marginLeft: spacing.sm,
        paddingVertical: spacing.xs,
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        marginRight: spacing.sm,
        backgroundColor: colors.surface,
    },
    filterBtnActive: {
        backgroundColor: colors.primary,
    },
    filterText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        color: colors.textMuted,
    },
    filterTextActive: {
        color: colors.surface,
    },
    filterCount: {
        backgroundColor: colors.background,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: spacing.xs,
    },
    filterCountActive: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    filterCountText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
        color: colors.textMuted,
    },
    filterCountTextActive: {
        color: colors.surface,
    },
    listContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 100,
    },
    employeeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        marginBottom: spacing.sm,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    avatarText: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.primary,
    },
    employeeInfo: {
        flex: 1,
    },
    employeeName: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    employeeEmail: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    employeeMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: spacing.xs,
    },
    statusText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
    },
    roleBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: spacing.sm,
    },
    roleText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxl * 2,
    },
    emptyText: {
        fontSize: typography.sizes.base,
        color: colors.textMuted,
        marginTop: spacing.md,
    },
});

export default SuperAdminEmployeesScreen;
