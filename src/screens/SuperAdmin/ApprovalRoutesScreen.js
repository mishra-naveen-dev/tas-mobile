import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    SafeAreaView
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';
import ScreenHeader from '../../components/ScreenHeader';
import { SkeletonListItem } from '../../components/SkeletonComponents';

const ApprovalRoutesScreen = ({ navigation }) => {
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/organization/approval-routes/');
            setRoutes(res.data?.results || res.data || []);
        } catch (err) {
            console.error('Error fetching routes:', err);
            setRoutes([]);
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

    const renderRoute = ({ item }) => (
        <View style={styles.routeCard}>
            <View style={styles.routeHeader}>
                <View style={styles.routeIcon}>
                    <Icon name="git-branch" size={20} color={colors.primary} />
                </View>
                <View style={styles.routeInfo}>
                    <Text style={styles.routeName}>{item.name || 'Approval Route'}</Text>
                    <Text style={styles.routeType}>{item.route_type || 'Standard'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: item.is_active ? colors.success + '20' : colors.textMuted + '20' }]}>
                    <Text style={[styles.statusText, { color: item.is_active ? colors.success : colors.textMuted }]}>
                        {item.is_active ? 'Active' : 'Inactive'}
                    </Text>
                </View>
            </View>

            {item.levels && item.levels.length > 0 && (
                <View style={styles.levelsContainer}>
                    <Text style={styles.levelsTitle}>Approval Levels:</Text>
                    <View style={styles.levelsList}>
                        {item.levels.map((level, index) => (
                            <View key={index} style={styles.levelItem}>
                                <View style={styles.levelNumber}>
                                    <Text style={styles.levelNumberText}>{index + 1}</Text>
                                </View>
                                <Text style={styles.levelName}>{level.name || `Level ${index + 1}`}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            <View style={styles.routeActions}>
                <TouchableOpacity style={styles.actionBtn}>
                    <Icon name="edit" size={16} color={colors.primary} />
                    <Text style={styles.actionBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                    <Icon name="trash-2" size={16} color={colors.danger} />
                    <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader
                title="Approval Routes"
                subtitle="Manage approval workflows"
                navigation={navigation}
            />

            {loading && routes.length === 0 ? (
                <View style={{ padding: spacing.md }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={routes}
                    keyExtractor={(item, index) => item.id ? `route_${item.id}` : `route-${index}`}
                    renderItem={renderRoute}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="git-branch" size={48} color={colors.textLight} />
                            <Text style={styles.emptyText}>No approval routes</Text>
                            <Text style={styles.emptySubtext}>Create routes to manage approval workflows</Text>
                        </View>
                    }
                />
            )}

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
    listContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    routeCard: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.md,
        elevation: 2,
    },
    routeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    routeIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    routeInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    routeName: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    routeType: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 12,
    },
    statusText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
    },
    levelsContainer: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    levelsTitle: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        color: colors.textMuted,
        marginBottom: spacing.sm,
    },
    levelsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    levelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 8,
        marginRight: spacing.xs,
        marginBottom: spacing.xs,
    },
    levelNumber: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.xs,
    },
    levelNumberText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    levelName: {
        fontSize: typography.sizes.sm,
        color: colors.textDark,
    },
    routeActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    actionBtnText: {
        fontSize: typography.sizes.sm,
        color: colors.primary,
        marginLeft: spacing.xs,
        fontWeight: typography.weights.medium,
    },
    emptyContainer: {
        padding: spacing.xxl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginTop: spacing.md,
    },
    emptySubtext: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.xs,
        textAlign: 'center',
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
    },
});

export default ApprovalRoutesScreen;
