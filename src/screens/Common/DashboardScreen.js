import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

    return (
        <View style={styles.mapContainer}>
            <MapView
                ref={mapRef}
                style={{ flex: 1, width: '100%', height: '100%' }}
                initialRegion={{
                    latitude: latestPoint?.latitude || 23.0225,
                    longitude: latestPoint?.longitude || 72.5714,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
            >
                {latestPoint && <Marker coordinate={latestPoint} pinColor="red" />}
                {points.length > 1 && (
                    <>
                        <Marker coordinate={points[points.length - 1]} pinColor="green" />
                        <Polyline coordinates={[...points].reverse()} strokeWidth={4} strokeColor={colors.info} />
                    </>
                )}
            </MapView>
            
            <View style={styles.mapControls}>
                <TouchableOpacity style={styles.controlBtn} onPress={centerOnLatest} activeOpacity={0.8}>
                    <Icon name="crosshair" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.controlBtn, styles.controlBtnLast]} onPress={fitAll} activeOpacity={0.8}>
                    <Icon name="maximize-2" size={18} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.mapCta} onPress={() => navigation.navigate('RouteMap')} activeOpacity={0.8}>
                <Icon name="maximize-2" size={14} color="#FFFFFF" />
                <Text style={styles.mapCtaText}>View Full Route</Text>
            </TouchableOpacity>
        </View>
    );
});

const DashboardScreen = ({ navigation }) => {
    const auth = useAuth();
    const { token, logout } = auth;
    const user = auth?.user;
    const mapRef = useRef(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [summary, setSummary] = useState({});
    const [punches, setPunches] = useState([]);
    const [isOnline, setIsOnline] = useState(true);
    const [isGpsActive, setIsGpsActive] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState('ALL');

    const checkNetwork = useCallback(async () => {
        try {
            const controller = new AbortController();
            await fetch('https://www.google.com/favicon.ico', { method: 'HEAD', signal: controller.signal });
            setIsOnline(true);
        } catch { setIsOnline(false); }
    }, []);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!token) return;
        try {
            setHasError(false);
            if (!isRefresh) setIsLoading(true);
            await checkNetwork();

            const cachedSummary = await AsyncStorage.getItem('@dashboard_summary');
            const cachedPunches = await AsyncStorage.getItem('@dashboard_punches');
            if (cachedSummary) setSummary(JSON.parse(cachedSummary));
            if (cachedPunches) setPunches(JSON.parse(cachedPunches));

            const [summaryRes, punchRes] = await Promise.all([
                api.get(`/attendance/punches/daily_summary/?t=${Date.now()}`),
                api.get(`/attendance/punches/today_punches/?t=${Date.now()}`),
            ]);

            const liveSummary = summaryRes?.data || {};
            const livePunches = punchRes?.data?.results || punchRes?.data || [];
            setSummary(liveSummary);
            setPunches(livePunches);
            setIsGpsActive(livePunches.length > 0);

            AsyncStorage.setItem('@dashboard_summary', JSON.stringify(liveSummary));
            AsyncStorage.setItem('@dashboard_punches', JSON.stringify(livePunches));
        } catch {
            setHasError(true);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [token, checkNetwork]);

    useFocusEffect(useCallback(() => {
        fetchData(false);
        const interval = setInterval(checkNetwork, 30000);
        return () => clearInterval(interval);
    }, [fetchData, checkNetwork]));

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchData(true);
    }, [fetchData]);

    const statsData = useMemo(() => [
        { icon: 'navigation', value: summary?.total_distance_today || 0, label: 'Distance', iconColor: colors.danger, bgColor: colors.dangerLight, suffix: ' km' },
        { icon: 'check-circle', value: summary?.punch_count || 0, label: 'Punches', iconColor: colors.success, bgColor: colors.successLight },
        { icon: 'dollar-sign', value: summary?.total_collection || 0, label: 'Collected', iconColor: colors.warning, bgColor: colors.warningLight, prefix: '₹' },
        { icon: 'trending-up', value: summary?.total_disbursement || 0, label: 'Disbursement', iconColor: colors.info, bgColor: colors.infoLight, prefix: '₹' },
    ], [summary]);

    const routePoints = useMemo(() =>
        punches.filter(p => p.latitude && p.longitude)
            .sort((a, b) => new Date(b.punched_at) - new Date(a.punched_at))
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
                                        <View style={[styles.statusDot, { backgroundColor: !isOnline ? colors.textMuted : isGpsActive ? colors.info : colors.success }]} />
                                        <Text style={[styles.statusText, { color: !isOnline ? colors.textMuted : isGpsActive ? colors.info : colors.success }]}>
                                            {!isOnline ? 'Offline' : isGpsActive ? 'Tracking' : 'Online'}
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
                    <ErrorView onRetry={fetchData} style={{ marginTop: spacing.lg }} />
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
    ), [user, logout, isOnline, isGpsActive, hasError, isLoading, statsData, routePoints, navigation, fetchData, activities, selectedFilter]);

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
    mapControls: { position: 'absolute', top: spacing.xs, right: spacing.xs, backgroundColor: colors.surface, borderRadius: borderRadius.sm, ...shadows.sm },
    controlBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.divider },
    controlBtnLast: { borderBottomWidth: 0 },
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
