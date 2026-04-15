import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import api from '../api/api';
import GlassCard from '../components/GlassCard';
import { colors, typography, spacing } from '../theme/tokens';
import OfflineService, { CacheKeys } from '../services/OfflineService';
import SkeletonLoader from '../components/SkeletonLoader';

const AllowanceHistoryScreen = ({ navigation }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchHistory = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);

        try {
            // Load cached data first
            const cached = await OfflineService.get(CacheKeys.ALLOWANCE_HISTORY);
            if (cached.isCached && cached.data) {
                setRequests(Array.isArray(cached.data) ? cached.data : []);
                setLastUpdated(new Date(cached.timestamp));
            }

            // Try to fetch fresh data
            if (await api.isOnline()) {
                const res = await api.getAllowanceHistory();
                const data = res.data?.results || res.data || [];
                
                setRequests(Array.isArray(data) ? data : []);
                setLastUpdated(new Date());
                setIsOffline(false);

                // Cache the data
                await OfflineService.set(CacheKeys.ALLOWANCE_HISTORY, data);
            } else {
                setIsOffline(true);
            }
        } catch (err) {
            console.log("Allowance History Error:", err);
            
            // Fallback to cached data
            const cached = await OfflineService.get(CacheKeys.ALLOWANCE_HISTORY);
            if (cached.isCached && cached.data) {
                setRequests(Array.isArray(cached.data) ? cached.data : []);
                setLastUpdated(new Date(cached.timestamp));
            }
            setIsOffline(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchHistory(false);
        }, [fetchHistory])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory(true);
    };

    const getTimeAgo = (date) => {
        if (!date) return '';
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return date.toLocaleDateString();
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'APPROVED': return colors.success;
            case 'REJECTED': return colors.danger;
            case 'PENDING': return colors.warning;
            default: return colors.textMuted;
        }
    };

    const renderItem = ({ item }) => (
        <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.dateText}>{item.travel_date || item.submitted_date || 'N/A'}</Text>

                <View
                    style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.status) + '20' }
                    ]}
                >
                    <Text
                        style={[
                            styles.statusText,
                            { color: getStatusColor(item.status) }
                        ]}
                    >
                        {item.status || 'PENDING'}
                    </Text>
                </View>
            </View>

            <View style={styles.routeBox}>
                <View style={styles.node}>
                    <Icon name="circle" size={12} color={colors.primary} />
                    <Text style={styles.nodeText} numberOfLines={1}>
                        {item.from_location || 'N/A'}
                    </Text>
                </View>

                <View style={styles.line} />

                <View style={styles.node}>
                    <Icon name="map-pin" size={12} color={colors.danger} />
                    <Text style={styles.nodeText} numberOfLines={1}>
                        {item.to_location || 'N/A'}
                    </Text>
                </View>
            </View>

            <View style={styles.footer}>
                <View>
                    <Text style={styles.label}>Distance</Text>
                    <Text style={styles.value}>
                        {item.total_distance || item.total_distance_km || 0} km
                    </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.label}>Claim Amount</Text>
                    <Text style={[styles.value, { color: colors.success }]}>
                        ₹{item.total_amount || item.distance_allowance_amount || 0}
                    </Text>
                </View>
            </View>

            {item.reason && (
                <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>Reason:</Text>
                    <Text style={styles.reasonText} numberOfLines={2}>
                        {item.reason}
                    </Text>
                </View>
            )}
        </GlassCard>
    );

    const ListHeader = () => (
        <>
            {isOffline && (
                <View style={styles.offlineBanner}>
                    <Icon name="wifi-off" size={16} color="#FFF" />
                    <Text style={styles.offlineText}>
                        Offline - Showing cached data from {getTimeAgo(lastUpdated)}
                    </Text>
                </View>
            )}
            
            {lastUpdated && (
                <View style={styles.lastUpdatedContainer}>
                    <Icon name="clock" size={12} color={colors.textMuted} />
                    <Text style={styles.lastUpdatedText}>
                        Last updated: {getTimeAgo(lastUpdated)}
                    </Text>
                </View>
            )}

            {/* Summary Card */}
            <GlassCard style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{requests.length}</Text>
                        <Text style={styles.summaryLabel}>Total Claims</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: colors.success }]}>
                            {requests.filter(r => r.status === 'APPROVED').length}
                        </Text>
                        <Text style={styles.summaryLabel}>Approved</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: colors.warning }]}>
                            {requests.filter(r => r.status === 'PENDING').length}
                        </Text>
                        <Text style={styles.summaryLabel}>Pending</Text>
                    </View>
                </View>
            </GlassCard>
        </>
    );

    const handleGoBack = () => {
        const state = navigation.getState();
        if (state && state.routes.length <= 1) {
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
            });
        } else {
            navigation.goBack();
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={handleGoBack}
                    style={styles.backBtn}
                >
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>
                    Allowance History
                </Text>

                <TouchableOpacity
                    onPress={onRefresh}
                    style={styles.refreshBtn}
                    disabled={refreshing}
                >
                    <Icon 
                        name="refresh-cw" 
                        size={20} 
                        color={refreshing ? colors.textMuted : colors.primary}
                    />
                </TouchableOpacity>
            </View>

            {loading && requests.length === 0 ? (
                <View style={styles.skeletonList}>
                    <View style={styles.skeletonHeader}>
                        <SkeletonLoader width={100} height={16} borderRadius={4} />
                        <SkeletonLoader width={60} height={14} borderRadius={4} />
                    </View>
                    {[1, 2, 3, 4, 5, 6].map((item) => (
                        <SkeletonLoader key={item} height={110} borderRadius={16} style={styles.skeletonItem} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={requests}
                    keyExtractor={(item, index) =>
                        item.id ? item.id.toString() : index.toString()
                    }
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={ListHeader}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Icon name="inbox" size={48} color={colors.textMuted} />
                            <Text style={styles.emptyText}>
                                {isOffline 
                                    ? 'No cached data available. Connect to internet.'
                                    : 'No allowance claims found.'}
                            </Text>
                        </View>
                    }
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[colors.primary]}
                        />
                    }
                />
            )}
        </SafeAreaView>
    );
};

export default AllowanceHistoryScreen;

// ================= STYLES =================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        marginRight: spacing.md,
    },
    refreshBtn: {
        marginLeft: 'auto',
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.textMuted,
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: typography.sizes.md,
        marginTop: spacing.md,
        textAlign: 'center',
        paddingHorizontal: spacing.lg,
    },
    listContent: {
        padding: spacing.lg,
        paddingBottom: spacing.xxl
    },
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warning,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
        marginBottom: spacing.md,
    },
    offlineText: {
        color: '#FFF',
        fontSize: typography.sizes.sm,
        marginLeft: spacing.sm,
    },
    lastUpdatedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    lastUpdatedText: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginLeft: spacing.xs,
    },
    summaryCard: {
        marginBottom: spacing.md,
        padding: spacing.md,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    summaryItem: {
        alignItems: 'center',
        flex: 1,
    },
    summaryDivider: {
        width: 1,
        height: 30,
        backgroundColor: colors.border,
    },
    summaryValue: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    summaryLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    card: {
        marginBottom: spacing.md,
        padding: spacing.lg
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md
    },
    dateText: {
        fontSize: typography.sizes.md,
        fontWeight: 'bold',
        color: colors.textDark
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold'
    },
    routeBox: {
        marginBottom: spacing.md
    },
    node: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    nodeText: {
        marginLeft: 8,
        fontSize: typography.sizes.sm,
        color: colors.textDark,
        flex: 1
    },
    line: {
        width: 2,
        height: 16,
        backgroundColor: colors.border,
        marginLeft: 5,
        marginVertical: 2
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.md
    },
    label: {
        fontSize: 10,
        color: colors.textMuted,
        textTransform: 'uppercase'
    },
    value: {
        fontSize: typography.sizes.md,
        fontWeight: 'bold',
        color: colors.textDark,
        marginTop: 2
    },
    reasonBox: {
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    reasonLabel: {
        fontSize: 10,
        color: colors.textMuted,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    reasonText: {
        fontSize: typography.sizes.sm,
        color: colors.textDark,
    },
    skeletonList: {
        flex: 1,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
    },
    skeletonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    skeletonItem: {
        marginBottom: spacing.sm,
    }
});
