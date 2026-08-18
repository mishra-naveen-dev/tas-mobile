import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    StatusBar,
    Linking,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { filterGpsOutliers, calcTotalDistanceKm } from '../../utils/gpsUtils';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';
import HeroHeader from '../../components/HeroHeader';
import { SkeletonStatsGrid } from '../../components/SkeletonComponents';
import StatCard from '../../components/StatCard';
import ErrorView from '../../components/ErrorView';
import ActivityCard from '../../components/ActivityCard';
import ActivityFilterBar from '../../components/ActivityFilterBar';
import SectionHeader from '../../components/SectionHeader';
import ActivityPresenter from '../../presenters/ActivityPresenter';
import { mapApiResponseToActivities } from '../../models/ActivityModel';

const MapPreview = React.memo(({ points, mapRef, navigation }) => {
    const latestPoint = points[0];
    const [isMapReady, setIsMapReady] = useState(false);
    
    const centerOnLatest = () => {
        if (!latestPoint || !mapRef.current) return;
        mapRef.current.animateToRegion({
            latitude: latestPoint.latitude,
            longitude: latestPoint.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01
        }, 500);
    };

    const fitAll = () => {
        if (points.length > 1 && mapRef.current) {
            mapRef.current.fitToCoordinates(points, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true
            });
        }
    };

    const openInGoogleMaps = () => {
        if (!latestPoint) return;
        const { latitude, longitude } = latestPoint;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Could not open maps');
        });
    };

    const formatCoords = (point) => ({
        latitude: Number(point.latitude),
        longitude: Number(point.longitude)
    });

    const routeCoordinates = points.map(formatCoords).reverse();

    // Auto-center on latest point when map is ready
    const onMapReady = () => {
        if (!isMapReady && latestPoint && mapRef.current) {
            setIsMapReady(true);
            setTimeout(() => {
                if (mapRef.current && latestPoint) {
                    mapRef.current.animateToRegion({
                        latitude: latestPoint.latitude,
                        longitude: latestPoint.longitude,
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.02
                    }, 500);
                }
            }, 100);
        }
    };

    return (
        <View style={styles.mapContainer}>
            <MapView
                ref={mapRef}
                style={{ flex: 1, width: '100%', height: '100%' }}
                onMapReady={onMapReady}
                initialRegion={{
                    latitude: latestPoint?.latitude || 23.0225,
                    longitude: latestPoint?.longitude || 72.5714,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
            >
                {routeCoordinates.length > 0 && (
                    <>
                        <Polyline 
                            coordinates={routeCoordinates} 
                            strokeWidth={4} 
                            strokeColor={colors.primary} 
                        />
                        {routeCoordinates.map((coord, index) => (
                            <Marker 
                                key={index}
                                coordinate={coord}
                                pinColor={index === routeCoordinates.length - 1 ? colors.danger : colors.success}
                            />
                        ))}
                    </>
                )}
            </MapView>
            
            <View style={styles.mapControls}>
                <TouchableOpacity style={styles.controlBtn} onPress={centerOnLatest} activeOpacity={0.8}>
                    <Icon name="map-pin" size={18} color={colors.danger} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlBtn} onPress={fitAll} activeOpacity={0.8}>
                    <Icon name="maximize-2" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlBtn} onPress={openInGoogleMaps} activeOpacity={0.8}>
                    <Icon name="navigation" size={18} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.mapCta} onPress={() => navigation.navigate('RouteMap')} activeOpacity={0.8}>
                <Icon name="maximize" size={14} color="#FFFFFF" />
                <Text style={styles.mapCtaText}>View Full Route</Text>
            </TouchableOpacity>
        </View>
    );
});

const DashboardScreen = ({ navigation }) => {
    const auth = useAuth();
    const { logout } = auth;
    const user = auth?.user;
    const mapRef = useRef(null);

    const [selectedFilter, setSelectedFilter] = useState('ALL');
    const todayStr = new Date().toISOString().slice(0, 10);

    // Cache-then-network is now react-query's job (persisted to AsyncStorage
    // via the app-level persister in src/queryClient.js) instead of this
    // screen hand-rolling its own @dashboard_summary/@dashboard_punches/
    // @dashboard_clean_dist snapshot.
    const summaryQuery = useApiQuery(['dashboardDailySummary'], () => api.get('/attendance/punches/daily_summary/'));
    const punchesQuery = useApiQuery(['dashboardTodayPunches'], () => api.get('/attendance/punches/today_punches/'));
    const liveRouteQuery = useApiQuery(['dashboardLiveRoute', todayStr], () => api.getLiveDailyRoute({ date: todayStr }));

    const isLoading = summaryQuery.isLoading || punchesQuery.isLoading;
    const isRefreshing = (summaryQuery.isFetching || punchesQuery.isFetching) && !isLoading;

    // Kept quiet on a session-expired error (matches the original: the
    // global interceptor handles the actual logout/redirect, this screen
    // just avoids flashing its own error banner right before that happens).
    const isSessionExpiredError = (err) => {
        const msg = err?.message || '';
        return msg.includes('Session expired') || msg.includes('login');
    };
    const hasError = !!(
        (summaryQuery.error && !isSessionExpiredError(summaryQuery.error)) ||
        (punchesQuery.error && !isSessionExpiredError(punchesQuery.error))
    );

    const summary = useMemo(() => summaryQuery.data || {}, [summaryQuery.data]);
    const punches = useMemo(() => punchesQuery.data?.results || punchesQuery.data || [], [punchesQuery.data]);
    const isGpsActive = punches.length > 0;

    // Use live tracking distance with GPS outlier filtering. The
    // daily_summary distance can be wildly wrong when any punch record was
    // captured with a bad GPS fix (multipath / NLOS outlier). The live track
    // gives the actual travelled path — filter it for any remaining bad
    // points and use that as the displayed distance; falls back to the
    // summary value (null here) when there's no live route yet.
    const cleanDistanceKm = useMemo(() => {
        const route = liveRouteQuery.data?.route;
        if (route?.length > 0) {
            return calcTotalDistanceKm(filterGpsOutliers(route));
        }
        return null;
    }, [liveRouteQuery.data]);

    useFocusEffect(useCallback(() => {
        summaryQuery.refetch();
        punchesQuery.refetch();
        liveRouteQuery.refetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []));

    const onRefresh = useCallback(() => {
        summaryQuery.refetch();
        punchesQuery.refetch();
        liveRouteQuery.refetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Same combined refetch, exposed as a no-args retry for ErrorView.
    const retryAll = onRefresh;

    const statsData = useMemo(() => {
        // Prefer the outlier-filtered live tracking distance.
        // Fall back to the punch summary value only when live track data is absent.
        const distanceKm = cleanDistanceKm ?? summary?.total_distance_today ?? 0;
        return [
            { icon: 'navigation', value: Number(distanceKm).toFixed(2), label: 'Distance', iconColor: colors.danger, bgColor: colors.dangerLight, suffix: ' km' },
            { icon: 'check-circle', value: summary?.punch_count || 0, label: 'Punches', iconColor: colors.success, bgColor: colors.successLight },
            { icon: 'dollar-sign', value: summary?.total_collection || 0, label: 'Collected', iconColor: colors.warning, bgColor: colors.warningLight, prefix: '₹' },
            { icon: 'trending-up', value: summary?.total_disbursement || 0, label: 'Disbursement', iconColor: colors.info, bgColor: colors.infoLight, prefix: '₹' },
        ];
    }, [summary, cleanDistanceKm]);

    const routePoints = useMemo(() =>
        punches.filter(p => p.latitude && p.longitude)
            .sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at))
            .map(p => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) })),
        [punches]
    );

    const activities = useMemo(() => {
        const mappedActivities = mapApiResponseToActivities(punches, []);
        const filtered = ActivityPresenter.filterActivities(mappedActivities, selectedFilter);
        return ActivityPresenter.groupActivitiesByTime(filtered);
    }, [punches, selectedFilter]);

    const flatListData = useMemo(() => {
        const data = [];
        activities.forEach(section => {
            data.push({ type: 'sectionHeader', title: section.title, count: section.data.length });
            section.data.forEach(activity => {
                data.push({ type: 'activity', ...activity });
            });
        });
        return data;
    }, [activities]);

    const ListHeader = useMemo(() => (
        <>
            <View style={styles.heroSection}>
                <SafeAreaView edges={['top']}>
                    <View style={styles.heroContent}>
                        <View style={styles.heroLeft}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>
                                    {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                                </Text>
                            </View>
                            <View style={styles.heroInfo}>
                                <Text style={styles.greeting}>Hello,</Text>
                                <Text style={styles.name}>
                                    {user?.first_name && user?.last_name 
                                        ? `${user.first_name} ${user.last_name}`
                                        : user?.username || 'Officer'}
                                </Text>
                                <View style={styles.badges}>
                                    <View style={styles.roleBadge}>
                                        <Text style={styles.roleText}>EMPLOYEE</Text>
                                    </View>
                                    <View style={styles.statusBadge}>
                                        <View style={[styles.statusDot, { backgroundColor: isGpsActive ? colors.info : colors.success }]} />
                                        <Text style={[styles.statusText, { color: isGpsActive ? colors.info : colors.success }]}>
                                            {isGpsActive ? 'Active' : 'Ready'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                        <View style={styles.heroRight}>
                            <View style={styles.dateContainer}>
                                <Text style={styles.dateText}>
                                    {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
                                <Icon name="log-out" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaView>
            </View>

            <View style={styles.contentSection}>
                {hasError ? (
                    <ErrorView onRetry={retryAll} style={{ marginTop: spacing.lg }} />
                ) : isLoading ? (
                    <SkeletonStatsGrid style={{ marginTop: spacing.md }} />
                ) : (
                    <StatCard data={statsData} style={{ marginTop: spacing.md }} />
                )}

                {!isLoading && routePoints.length > 0 && (
                    <MapPreview points={routePoints} mapRef={mapRef} navigation={navigation} />
                )}

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Today's Activity</Text>
                    <Text style={styles.sectionCount}>{activities.reduce((acc, s) => acc + s.data.length, 0)} items</Text>
                </View>

                <ActivityFilterBar 
                    selectedFilter={selectedFilter} 
                    onFilterChange={setSelectedFilter} 
                />
            </View>
        </>
    ), [user, logout, isGpsActive, hasError, isLoading, statsData, routePoints, navigation, retryAll, activities, selectedFilter]);

    const renderItem = useCallback(({ item }) => {
        if (item.type === 'sectionHeader') {
            return <SectionHeader title={item.title} count={item.count} />;
        }
        return <ActivityCard activity={item} />;
    }, []);

    const keyExtractor = useCallback((item, index) => 
        item.type === 'sectionHeader' ? `header-${item.title}` : item.id || item.punched_at || `item-${index}`, 
    []);

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
            <FlatList
                data={flatListData}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ListHeaderComponent={ListHeader}
                ListEmptyComponent={!isLoading && !hasError ? () => (
                    <View style={styles.emptyState}>
                        <Icon name="inbox" size={48} color={colors.textLight} />
                        <Text style={styles.emptyText}>
                            {selectedFilter === 'ALL' 
                                ? 'No activity recorded yet today' 
                                : 'No activities match the selected filter'}
                        </Text>
                    </View>
                ) : null}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    heroSection: {
        backgroundColor: colors.surface,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    heroContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
    },
    heroLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    avatarText: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.primary,
    },
    heroInfo: {
        flex: 1,
    },
    greeting: {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
    },
    name: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    badges: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    roleBadge: {
        backgroundColor: `${colors.info}15`,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: spacing.sm,
    },
    roleText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
        color: colors.info,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 4,
    },
    statusText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
    },
    heroRight: {
        alignItems: 'flex-end',
    },
    dateContainer: {
        backgroundColor: colors.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 12,
        marginBottom: spacing.xs,
    },
    dateText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        fontWeight: typography.weights.medium,
    },
    logoutBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentSection: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
    mapContainer: { height: 160, marginTop: spacing.md, marginHorizontal: spacing.md, borderRadius: borderRadius.md, overflow: 'hidden', ...shadows.sm },
    map: { flex: 1 },
    mapControls: { position: 'absolute', top: spacing.xs, right: spacing.xs, backgroundColor: colors.surface, borderRadius: borderRadius.sm, flexDirection: 'column', ...shadows.sm },
    controlBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.divider },
    mapCta: { position: 'absolute', bottom: spacing.xs, right: spacing.xs, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm },
    mapCtaText: { color: '#FFFFFF', fontSize: 10, fontWeight: typography.weights.semibold, marginLeft: 4 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.md },
    sectionTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.textDark },
    sectionCount: { fontSize: typography.sizes.xs, color: colors.textMuted },
    listContent: { paddingHorizontal: spacing.md, paddingBottom: 120 },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
    emptyText: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: spacing.sm },
});

export default DashboardScreen;
