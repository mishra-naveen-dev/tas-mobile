import React, { useState, useContext, useCallback, lazy, Suspense, memo } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Platform,
    Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/api';
import { AuthContext } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import PrimaryButton from '../components/PrimaryButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, spacing, shadows } from '../theme/tokens';
import OfflineService, { CacheKeys } from '../services/OfflineService';
import SkeletonLoader, { 
    SkeletonCard, 
    SkeletonListItem, 
    SkeletonStatCard,
    SkeletonHeader 
} from '../components/SkeletonLoader';

const DashboardScreen = ({ navigation }) => {
    const { token, user, logout } = useContext(AuthContext);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [summary, setSummary] = useState({});
    const [correctionsCount, setCorrectionsCount] = useState(0);
    const [punches, setPunches] = useState([]);
    const [filterType, setFilterType] = useState('ALL');
    const [showFilter, setShowFilter] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!token) return;

        try {
            if (!isRefresh) setLoading(true);

            // Check network status
            const online = await api.isOnline();
            setIsOffline(!online);

            // 1. Load cached data first for instant display
            const cachedSummary = await OfflineService.get(CacheKeys.DASHBOARD_SUMMARY);
            const cachedPunches = await OfflineService.get(CacheKeys.TODAY_PUNCHES);
            const cachedCorrections = await OfflineService.get('corrections_count');

            if (cachedSummary.isCached && cachedSummary.data) {
                setSummary(cachedSummary.data);
                setLastUpdated(new Date(cachedSummary.timestamp));
            }
            if (cachedPunches.isCached && cachedPunches.data) {
                setPunches(Array.isArray(cachedPunches.data) ? cachedPunches.data : []);
            }
            if (cachedCorrections.isCached) {
                setCorrectionsCount(cachedCorrections.data);
            }

            // 2. Try to fetch fresh data from server
            if (online) {
                const [summaryRes, punchRes, correctionsRes] = await Promise.all([
                    api.getDailySummary(),
                    api.getTodayPunches(),
                    api.getCorrectionRequests().catch(() => ({ data: [] }))
                ]);

                const liveSummary = summaryRes?.data || {};
                const livePunches = punchRes?.data?.results || punchRes?.data || [];
                const correctionsData = correctionsRes?.data?.results || correctionsRes?.data || [];
                const pendingCorrections = correctionsData.filter(c => c.status === 'PENDING').length;

                // Update state with fresh data
                setSummary(liveSummary);
                setPunches(Array.isArray(livePunches) ? livePunches : []);
                setCorrectionsCount(pendingCorrections);
                setLastUpdated(new Date());

                // Cache the data
                await OfflineService.set(CacheKeys.DASHBOARD_SUMMARY, liveSummary);
                await OfflineService.set(CacheKeys.TODAY_PUNCHES, livePunches);
                await OfflineService.set('corrections_count', pendingCorrections);
            }

        } catch (err) {
            console.log("-> Dashboard network fault:", err?.message);
            
            // On error, use cached data if available
            const cachedSummary = await OfflineService.get(CacheKeys.DASHBOARD_SUMMARY);
            const cachedPunches = await OfflineService.get(CacheKeys.TODAY_PUNCHES);
            const cachedCorrections = await OfflineService.get('corrections_count');

            if (cachedSummary.isCached) {
                setSummary(cachedSummary.data);
            }
            if (cachedPunches.isCached) {
                setPunches(Array.isArray(cachedPunches.data) ? cachedPunches.data : []);
            }
            if (cachedCorrections.isCached) {
                setCorrectionsCount(cachedCorrections.data);
            }
            
            setIsOffline(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useFocusEffect(
        useCallback(() => {
            fetchData(false);
        }, [fetchData])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData(true);
    };

    const renderActivityItem = ({ item }) => (
        <View style={styles.activityItem}>
            <View style={styles.activityIconWrapper}>
                <Icon
                    name={item?.visit_type?.includes('COLLECT') ? 'dollar-sign' : 'map-pin'}
                    size={20}
                    color={colors.primary}
                />
            </View>
            <View style={styles.activityDetails}>
                <Text style={styles.activityTitle}>{item?.visit_type || 'Location Ping'}</Text>
                <Text style={styles.activityTime}>
                    {item?.punched_at ? new Date(item.punched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </Text>
            </View>
        </View>
    );

    const validRoutePoints = (punches || [])
        .filter(p => p.latitude && p.longitude)
        .sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at))
        .map(p => ({
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
        }));

    const filteredPunches = punches.filter(p => {
        if (filterType === 'ALL') return true;
        return p.visit_type === filterType;
    });

    const getTimeAgo = (date) => {
        if (!date) return '';
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return date.toLocaleDateString();
    };

    if (loading && !refreshing && Object.keys(summary).length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.skeletonContainer}>
                    {/* Header Skeleton */}
                    <View style={styles.skeletonHeader}>
                        <View>
                            <SkeletonLoader width={140} height={20} borderRadius={6} />
                            <SkeletonLoader width={100} height={14} borderRadius={4} style={{ marginTop: 8 }} />
                        </View>
                        <SkeletonLoader width={44} height={44} borderRadius={12} />
                    </View>

                    {/* Hero Card Skeleton */}
                    <SkeletonLoader height={150} borderRadius={16} style={styles.heroSkeleton}>
                        <View style={styles.heroCardSkeleton}>
                            {/* Row 1 */}
                            <View style={styles.heroRowSkeleton}>
                                <View style={styles.heroMetricSkeleton}>
                                    <SkeletonLoader width={36} height={36} borderRadius={10} />
                                    <SkeletonLoader width={50} height={18} borderRadius={4} style={{ marginTop: 6 }} />
                                    <SkeletonLoader width={40} height={12} borderRadius={4} style={{ marginTop: 4 }} />
                                </View>
                                <View style={styles.heroDividerSkeleton} />
                                <View style={styles.heroMetricSkeleton}>
                                    <SkeletonLoader width={36} height={36} borderRadius={10} />
                                    <SkeletonLoader width={30} height={18} borderRadius={4} style={{ marginTop: 6 }} />
                                    <SkeletonLoader width={40} height={12} borderRadius={4} style={{ marginTop: 4 }} />
                                </View>
                            </View>
                            {/* Row 2 */}
                            <View style={styles.heroRowSkeleton}>
                                <View style={styles.heroMetricSkeleton}>
                                    <SkeletonLoader width={36} height={36} borderRadius={10} />
                                    <SkeletonLoader width={50} height={18} borderRadius={4} style={{ marginTop: 6 }} />
                                    <SkeletonLoader width={50} height={12} borderRadius={4} style={{ marginTop: 4 }} />
                                </View>
                                <View style={styles.heroDividerSkeleton} />
                                <View style={styles.heroMetricSkeleton}>
                                    <SkeletonLoader width={36} height={36} borderRadius={10} />
                                    <SkeletonLoader width={50} height={18} borderRadius={4} style={{ marginTop: 6 }} />
                                    <SkeletonLoader width={60} height={12} borderRadius={4} style={{ marginTop: 4 }} />
                                </View>
                            </View>
                        </View>
                    </SkeletonLoader>

                    {/* Map Skeleton */}
                    <SkeletonLoader height={180} borderRadius={16} style={styles.mapSkeleton}>
                        <View style={styles.mapSkeletonInner}>
                            <Icon name="map" size={40} color={colors.textLight} />
                            <Text style={styles.mapSkeletonText}>Loading map...</Text>
                        </View>
                    </SkeletonLoader>

                    {/* Action Buttons Skeleton */}
                    <View style={styles.skeletonActions}>
                        <SkeletonLoader width="48%" height={56} borderRadius={14} />
                        <SkeletonLoader width="48%" height={56} borderRadius={14} />
                    </View>

                    {/* List Header */}
                    <SkeletonLoader width={120} height={18} borderRadius={4} style={styles.listHeaderSkeleton} />

                    {/* List Items Skeleton */}
                    {[1, 2, 3, 4].map((item) => (
                        <SkeletonListItem key={item} style={styles.listItemSkeleton} />
                    ))}
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                data={filteredPunches}
                keyExtractor={(item, index) => index.toString()}
                renderItem={renderActivityItem}
                showsVerticalScrollIndicator={false}

                ListHeaderComponent={
                    <>
                        {/* OFFLINE BANNER */}
                        {isOffline && (
                            <View style={styles.offlineBanner}>
                                <Icon name="wifi-off" size={16} color="#FFF" />
                                <Text style={styles.offlineText}>
                                    Offline Mode - Showing cached data from {getTimeAgo(lastUpdated)}
                                </Text>
                            </View>
                        )}

                        {/* HEADER */}
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.greeting}>
                                    Hello, {user?.username || 'Officer'}
                                </Text>
                                <Text style={styles.dateText}>
                                    {new Date().toDateString()}
                                </Text>
                            </View>

                            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                                <Icon name="log-out" size={24} color={colors.danger} />
                            </TouchableOpacity>
                        </View>

                        {/* HERO */}
                        <GlassCard style={styles.heroCard}>
                            <View style={styles.heroRow}>
                                <View style={styles.heroMetric}>
                                    <View style={[styles.heroIconWrapper, { backgroundColor: colors.primaryLight }]}>
                                        <Icon name="map" size={20} color={colors.primary} />
                                    </View>
                                    <Text style={styles.heroValue}>
                                        {summary?.total_distance_today || 0}
                                    </Text>
                                    <Text style={styles.heroUnit}>km</Text>
                                    <Text style={styles.heroLabel}>Distance</Text>
                                </View>

                                <View style={styles.heroDivider} />

                                <View style={styles.heroMetric}>
                                    <View style={[styles.heroIconWrapper, { backgroundColor: colors.successLight }]}>
                                        <Icon name="check-circle" size={20} color={colors.success} />
                                    </View>
                                    <Text style={styles.heroValue}>
                                        {summary?.punch_count || 0}
                                    </Text>
                                    <Text style={styles.heroLabel}>Punches</Text>
                                </View>
                            </View>

                            <View style={styles.heroRow}>
                                <View style={styles.heroMetric}>
                                    <View style={[styles.heroIconWrapper, { backgroundColor: colors.warningLight }]}>
                                        <Icon name="trending-up" size={20} color={colors.warning} />
                                    </View>
                                    <Text style={styles.heroValue}>
                                        ₹{summary?.total_collection || 0}
                                    </Text>
                                    <Text style={styles.heroLabel}>Collected</Text>
                                </View>

                                <View style={styles.heroDivider} />

                                <View style={styles.heroMetric}>
                                    <View style={[styles.heroIconWrapper, { backgroundColor: colors.infoLight }]}>
                                        <Icon name="trending-down" size={20} color={colors.info} />
                                    </View>
                                    <Text style={styles.heroValue}>
                                        ₹{summary?.total_disbursement || 0}
                                    </Text>
                                    <Text style={styles.heroLabel}>Disbursement</Text>
                                </View>
                            </View>
                        </GlassCard>

                        {/* Corrections Alert Card */}
                        {correctionsCount > 0 && (
                            <TouchableOpacity 
                                style={styles.correctionsCard}
                                onPress={() => navigation.navigate('CorrectionTab', { screen: 'CorrectionHome' })}
                                activeOpacity={0.8}
                            >
                                <View style={styles.correctionsContent}>
                                    <View style={styles.correctionsIcon}>
                                        <Icon name="edit-3" size={20} color={colors.warning} />
                                    </View>
                                    <View style={styles.correctionsText}>
                                        <Text style={styles.correctionsTitle}>Punch Corrections Pending</Text>
                                        <Text style={styles.correctionsSubtitle}>
                                            You have {correctionsCount} correction {correctionsCount === 1 ? 'request' : 'requests'} raised
                                        </Text>
                                    </View>
                                </View>
                                <Icon name="chevron-right" size={20} color={colors.warning} />
                            </TouchableOpacity>
                        )}

                        {/* MAP */}
                        {validRoutePoints.length > 0 && (
                            <TouchableOpacity 
                                style={styles.mapWrap}
                                onPress={() => navigation.navigate('RouteMap')}
                            >
                                <MapView
                                    style={styles.mapEmbed}
                                    initialRegion={{
                                        latitude: validRoutePoints[0]?.latitude || 23.0225,
                                        longitude: validRoutePoints[0]?.longitude || 72.5714,
                                        latitudeDelta: 0.05,
                                        longitudeDelta: 0.05,
                                    }}
                                >
                                    <Marker coordinate={validRoutePoints[0]} pinColor="green" />

                                    {validRoutePoints.length > 1 && (
                                        <>
                                            <Marker
                                                coordinate={validRoutePoints.at(-1)}
                                                pinColor="red"
                                            />
                                            <Polyline
                                                coordinates={validRoutePoints}
                                                strokeWidth={4}
                                                strokeColor="blue"
                                            />
                                        </>
                                    )}
                                </MapView>
                                <View style={styles.mapOverlayButton}>
                                    <Icon name="maximize-2" size={14} color="#fff" />
                                    <Text style={styles.mapOverlayButtonText}>View Full Route</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* SECTION TITLE */}
                        <View style={styles.listHeaderRow}>
                            <Text style={styles.sectionTitle}>
                                Today's Activity
                            </Text>

                            <TouchableOpacity
                                style={styles.filterBtn}
                                onPress={() => setShowFilter(!showFilter)}
                            >
                                <Icon name="filter" size={18} color={colors.primary} />
                                <Text style={styles.filterText}>{filterType}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* FILTER OPTIONS */}
                        {showFilter && (
                            <View style={styles.filterDropdown}>
                                {['ALL', 'COLLECTION', 'DISBURSEMENT'].map(type => (
                                    <TouchableOpacity
                                        key={type}
                                        style={styles.filterItem}
                                        onPress={() => {
                                            setFilterType(type);
                                            setShowFilter(false);
                                        }}
                                    >
                                        <Text style={styles.filterItemText}>{type}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </>
                }

                ListEmptyComponent={
                    <Text style={styles.emptyText}>
                        {isOffline ? 'No cached data available. Connect to internet to load data.' : 'No activity recorded yet today.'}
                    </Text>
                }

                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                    />
                }

                contentContainerStyle={{
                    paddingHorizontal: spacing.md,
                    paddingBottom: 140,
                }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.textMuted,
    },
    skeletonContainer: {
        flex: 1,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
    },
    skeletonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    heroSkeleton: {
        marginBottom: spacing.md,
    },
    heroCardSkeleton: {
        flexDirection: 'column',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
    },
    heroRowSkeleton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    heroMetricSkeleton: {
        alignItems: 'center',
    },
    heroDividerSkeleton: {
        width: 1,
        height: 60,
        backgroundColor: colors.border,
    },
    mapSkeleton: {
        marginBottom: spacing.md,
    },
    mapSkeletonInner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapSkeletonText: {
        marginTop: spacing.sm,
        color: colors.textLight,
        fontSize: typography.sizes.sm,
    },
    skeletonActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    listHeaderSkeleton: {
        marginBottom: spacing.md,
    },
    listItemSkeleton: {
        marginBottom: spacing.sm,
    },
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warning,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        borderRadius: 8,
    },
    offlineText: {
        color: '#FFF',
        fontSize: typography.sizes.sm,
        marginLeft: spacing.sm,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        padding: spacing.lg,
        paddingTop: spacing.md
    },
    greeting: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    dateText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    logoutBtn: {
        padding: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: 12,
        ...shadows.soft,
    },
    heroCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: 16,
        ...Platform.select({
            ios: {
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    heroRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    heroMetric: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    heroIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    heroValue: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    heroUnit: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginLeft: 2,
    },
    heroLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    heroDivider: {
        width: 1,
        backgroundColor: colors.border,
        height: 50,
    },
    correctionsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        padding: spacing.md,
        backgroundColor: colors.warningLight,
        borderRadius: 14,
        borderLeftWidth: 4,
        borderLeftColor: colors.warning,
        ...Platform.select({
            ios: {
                shadowColor: colors.warning,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    correctionsContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    correctionsIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    correctionsText: {
        flex: 1,
    },
    correctionsTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    correctionsSubtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.md,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    activityIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F7FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    activityDetails: {
        flex: 1,
    },
    activityTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    activityTime: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    emptyText: {
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.lg,
    },
    fab: {
        position: 'absolute',
        bottom: spacing.xl,
        alignSelf: 'center',
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapWrap: {
        height: 180,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        borderRadius: 12,
        overflow: 'hidden',
    },
    mapEmbed: {
        flex: 1,
        width: '100%',
    },
    mapOverlayButton: {
        position: 'absolute',
        bottom: spacing.sm,
        right: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 4,
    },
    mapOverlayButtonText: {
        color: '#fff',
        fontSize: typography.sizes.xs,
        marginLeft: spacing.xs,
    },
    listHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        marginTop: spacing.xl,
    },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterText: {
        marginLeft: 6,
        fontSize: 12,
        color: colors.textDark,
        fontWeight: '600',
    },
    filterDropdown: {
        marginHorizontal: spacing.md,
        marginTop: 6,
        backgroundColor: colors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    filterItemText: {
        fontSize: 14,
        color: colors.textDark,
    }
});

export default DashboardScreen;
