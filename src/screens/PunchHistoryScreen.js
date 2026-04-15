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

const PunchHistoryScreen = ({ navigation }) => {
    const [punches, setPunches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchHistory = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);

        try {
            // Load cached data first
            const cached = await OfflineService.get(CacheKeys.PUNCH_HISTORY);
            if (cached.isCached && cached.data) {
                setPunches(Array.isArray(cached.data) ? cached.data : []);
                setLastUpdated(new Date(cached.timestamp));
            }

            // Try to fetch fresh data
            if (await api.isOnline()) {
                const res = await api.getPunchHistory();
                const data = res.data?.results || res.data || [];
                
                setPunches(Array.isArray(data) ? data : []);
                setLastUpdated(new Date());
                setIsOffline(false);

                // Cache the data
                await OfflineService.set(CacheKeys.PUNCH_HISTORY, data);
            } else {
                setIsOffline(true);
            }
        } catch (err) {
            console.log("Punch History Error:", err);
            
            // Fallback to cached data
            const cached = await OfflineService.get(CacheKeys.PUNCH_HISTORY);
            if (cached.isCached && cached.data) {
                setPunches(Array.isArray(cached.data) ? cached.data : []);
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

    const renderItem = ({ item }) => (
        <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.typeBadge}>
                    <Icon
                        name={item.visit_type === 'COLLECTION' ? 'dollar-sign' : 'map-pin'}
                        size={14}
                        color="#FFF"
                    />
                    <Text style={styles.typeText}>
                        {item.visit_type || 'NORMAL'}
                    </Text>
                </View>

                <Text style={styles.timeText}>
                    {item.punched_at ? new Date(item.punched_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : 'N/A'}
                </Text>
            </View>

            <View style={styles.detailRow}>
                <Icon name="calendar" size={16} color={colors.textMuted} />
                <Text style={styles.detailText}>
                    {item.punch_date ? new Date(item.punch_date).toDateString() : 'N/A'}
                </Text>
            </View>

            <View style={styles.detailRow}>
                <Icon name="navigation" size={16} color={colors.textMuted} />
                <Text style={styles.detailText}>
                    {item.latitude ? `${item.latitude}, ${item.longitude}` : 'Location not available'}
                </Text>
            </View>

            <View style={styles.distanceBox}>
                <Text style={styles.distanceLabel}>Distance from last:</Text>
                <Text style={styles.distanceValue}>
                    {item.distance_from_last || 0} km
                </Text>
            </View>
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

                <Text style={styles.headerTitle}>Punch History</Text>

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

            {loading && punches.length === 0 ? (
                <View style={styles.skeletonList}>
                    <View style={styles.skeletonHeader}>
                        <SkeletonLoader width={100} height={16} borderRadius={4} />
                        <SkeletonLoader width={60} height={14} borderRadius={4} />
                    </View>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                        <SkeletonLoader key={item} height={80} borderRadius={14} style={styles.skeletonItem} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={punches}
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
                                    : 'No punches found.'}
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

export default PunchHistoryScreen;

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
    card: {
        marginBottom: spacing.md,
        padding: spacing.md
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12
    },
    typeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4
    },
    timeText: {
        fontSize: typography.sizes.sm,
        fontWeight: 'bold',
        color: colors.textDark
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6
    },
    detailText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginLeft: 8,
        flex: 1,
    },
    distanceBox: {
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    distanceLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted
    },
    distanceValue: {
        fontSize: typography.sizes.sm,
        fontWeight: 'bold',
        color: colors.textDark
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
