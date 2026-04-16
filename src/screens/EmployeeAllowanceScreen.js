import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import HeroHeader from '../components/HeroHeader';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

const EmployeeAllowanceScreen = ({ navigation }) => {
    const auth = useAuth();
    const user = auth?.user;
    const [allowances, setAllowances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState('ALL');

    const fetchAllowances = useCallback(async () => {
        try {
            const res = await api.getAllowanceRequests();
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data || []);
            setAllowances(data);
        } catch (err) {
            console.log('Error fetching allowances:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        fetchAllowances();
    }, [fetchAllowances]));

    const onRefresh = () => {
        setRefreshing(true);
        fetchAllowances();
    };

    const handleLogout = () => {
        auth.logout();
        if (auth.navigationRef?.current) {
            auth.navigationRef.current.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toUpperCase()) {
            case 'APPROVED': return colors.success;
            case 'REJECTED': return colors.danger;
            case 'PENDING': return colors.warning;
            default: return colors.textMuted;
        }
    };

    const filteredAllowances = allowances.filter(item => {
        if (selectedFilter === 'ALL') return true;
        return item.status?.toUpperCase() === selectedFilter;
    });

    const filters = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

    const formatCurrency = (amount) => {
        if (!amount && amount !== 0) return '₹0';
        return `₹${Number(amount).toLocaleString('en-IN')}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const renderAllowance = ({ item }) => (
        <TouchableOpacity style={styles.allowanceCard} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
                <View style={styles.typeContainer}>
                    <View style={[styles.typeIcon, { backgroundColor: `${colors.primary}15` }]}>
                        <Icon name="dollar-sign" size={20} color={colors.primary} />
                    </View>
                    <View>
                        <Text style={styles.allowanceType}>{item.allowance_type || 'Allowance'}</Text>
                        <Text style={styles.allowanceDate}>{formatDate(item.created_at)}</Text>
                    </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status || 'PENDING'}
                    </Text>
                </View>
            </View>
            
            <View style={styles.cardBody}>
                <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Amount</Text>
                    <Text style={styles.amountValue}>{formatCurrency(item.amount)}</Text>
                </View>
                
                {item.description && (
                    <View style={styles.descriptionRow}>
                        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
                    </View>
                )}

                {item.admin_comment && (
                    <View style={styles.commentRow}>
                        <Icon name="check-circle" size={14} color={colors.textMuted} />
                        <Text style={styles.comment}>{item.admin_comment}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    const totalPending = allowances
        .filter(a => a.status?.toUpperCase() === 'PENDING')
        .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

    const totalApproved = allowances
        .filter(a => a.status?.toUpperCase() === 'APPROVED')
        .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <HeroHeader
                user={user}
                role="Employee"
                showStatus={false}
                onLogout={handleLogout}
            />

            <TouchableOpacity 
                style={styles.createBtn}
                onPress={() => navigation.navigate('ApplyAllowance')}
                activeOpacity={0.8}
            >
                <Icon name="plus" size={20} color="#FFFFFF" />
                <Text style={styles.createBtnText}>New Allowance</Text>
            </TouchableOpacity>

            <View style={styles.summaryContainer}>
                <View style={styles.summaryCard}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Pending</Text>
                        <Text style={[styles.summaryValue, { color: colors.warning }]}>
                            {formatCurrency(totalPending)}
                        </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Approved</Text>
                        <Text style={[styles.summaryValue, { color: colors.success }]}>
                            {formatCurrency(totalApproved)}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {filters.map((filter) => (
                        <TouchableOpacity
                            key={filter}
                            style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
                            onPress={() => setSelectedFilter(filter)}
                        >
                            <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>
                                {filter}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={filteredAllowances}
                renderItem={renderAllowance}
                keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="dollar-sign" size={48} color={colors.textLight} />
                        <Text style={styles.emptyText}>
                            {loading ? 'Loading...' : 'No allowances found'}
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    summaryContainer: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
    },
    summaryCard: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        backgroundColor: colors.border,
        marginHorizontal: spacing.md,
    },
    summaryLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
    },
    filterContainer: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    filterChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: 20,
        marginRight: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        fontWeight: '500',
    },
    filterTextActive: {
        color: colors.surface,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 140,
    },
    allowanceCard: {
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
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    typeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    typeIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    allowanceType: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    allowanceDate: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
    },
    cardBody: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.sm,
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    amountLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    amountValue: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    descriptionRow: {
        marginTop: spacing.xs,
    },
    description: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    commentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
        backgroundColor: colors.background,
        padding: spacing.sm,
        borderRadius: 8,
    },
    comment: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginLeft: spacing.xs,
        flex: 1,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.md,
    },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: 12,
        elevation: 4,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    createBtnText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
        marginLeft: spacing.sm,
    },
});

export default EmployeeAllowanceScreen;
