import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    StatusBar,
    ScrollView,
    Animated,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { usePunch } from '../../context/PunchContext';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';
import HeroHeader from '../../components/HeroHeader';
import ActivityCard from '../../components/ActivityCard';
import ActivityFilterBar from '../../components/ActivityFilterBar';
import SectionHeader from '../../components/SectionHeader';
import ActivityPresenter from '../../presenters/ActivityPresenter';
import { mapApiResponseToActivities } from '../../models/ActivityModel';

const IS_DEV = __DEV__;

const MapPreview = React.memo(({ points, mapRef }) => {
    const navigation = useNavigation();
    
    if (!points || points.length === 0) {
        return null;
    }
    
    const latestPoint = points[0];
    const startPoint = points[points.length - 1];
    
    const fitAll = useCallback(() => {
        if (points.length > 1 && mapRef.current) {
            mapRef.current.fitToCoordinates(points, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true
            });
        }
    }, [points, mapRef]);

    const handleViewRoute = useCallback(() => {
        if (navigation?.navigate) {
            navigation.navigate('RouteMap');
        }
    }, [navigation]);

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
                {latestPoint && (
                    <Marker coordinate={latestPoint} pinColor="red" />
                )}
                {points.length > 1 && startPoint && (
                    <>
                        <Marker coordinate={startPoint} pinColor="green" />
                        <Polyline 
                            coordinates={[...points].reverse()} 
                            strokeWidth={4} 
                            strokeColor={colors.primary} 
                        />
                    </>
                )}
            </MapView>
            
            <View style={styles.mapControls}>
                <TouchableOpacity style={styles.controlBtn} onPress={fitAll} activeOpacity={0.8}>
                    <Icon name="maximize-2" size={18} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <TouchableOpacity 
                style={styles.mapCta} 
                onPress={handleViewRoute}
                activeOpacity={0.8}
            >
                <Icon name="maximize-2" size={14} color="#FFFFFF" />
                <Text style={styles.mapCtaText}>View Full Route</Text>
            </TouchableOpacity>
        </View>
    );
});

const StatCard = React.memo(({ icon, value, label, iconColor, bgColor, prefix = '', suffix = '' }) => (
    <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: bgColor }]}>
            <Icon name={icon} size={20} color={iconColor} />
        </View>
        <Text style={styles.statValue}>
            {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
));

const ActivitySection = React.memo(({ section, sectionIndex }) => (
    <View key={`section-${section.title}-${sectionIndex}`}>
        <SectionHeader title={section.title} count={section.data?.length || 0} />
        {(section.data || []).map((activity, idx) => (
            <ActivityCard 
                key={`activity-${section.title}-${activity.id || activity.punched_at || idx}`}
                activity={activity} 
            />
        ))}
    </View>
));

const EmployeeHomeScreen = ({ navigation }) => {
    const auth = useAuth() || {};
    const punchCtx = usePunch() || {};
    
    const { 
        isActive = false, 
        isTracking = false,
        currentPunch = null,
        todayPunches = [],
        success = false,
    } = punchCtx;
    
    const getTotalDistance = punchCtx.getTotalDistance || (() => 0);
    const getTrackingDuration = punchCtx.getTrackingDuration || (() => 0);
    const refreshPunches = punchCtx.fetchTodayPunches || (() => {});
    
    const { logout = () => {}, user = null } = auth;
    const mapRef = useRef(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const isMountedRef = useRef(true);
    const lastFetchRef = useRef(0);

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [summary, setSummary] = useState({});
    const [punches, setPunches] = useState([]);
    const [selectedFilter, setSelectedFilter] = useState('ALL');

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        let animation;
        if (isActive || isTracking) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.3,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            animation.start();
        } else {
            pulseAnim.setValue(1);
        }
        return () => animation?.stop();
    }, [isActive, isTracking, pulseAnim]);

    const fetchData = useCallback(async (isRefresh = false) => {
        const now = Date.now();
        if (!isRefresh && now - lastFetchRef.current < 1000) {
            return;
        }
        lastFetchRef.current = now;

        try {
            if (!isRefresh) setIsLoading(true);

            const [summaryRes, punchRes] = await Promise.all([
                api.get('/attendance/punches/daily_summary/'),
                api.get('/attendance/punches/today_punches/'),
            ]).catch(() => [null, null]);

            if (!isMountedRef.current) return;

            const liveSummary = summaryRes?.data || {};
            const livePunches = punchRes?.data?.results || punchRes?.data || [];
            
            setSummary(liveSummary);
            setPunches(livePunches);
        } catch (err) {
            if (IS_DEV) console.error('[Home] Fetch error:', err);
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        }
    }, []);

    useFocusEffect(useCallback(() => {
        fetchData(false);
        refreshPunches();
    }, [fetchData, refreshPunches]));

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchData(true);
        refreshPunches();
    }, [fetchData, refreshPunches]);

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
                        try {
                            await logout();
                        } catch (err) {
                            if (IS_DEV) console.error('[Home] Logout error:', err);
                        }
                    },
                },
            ]
        );
    }, [auth, logout, navigation]);

    const statsData = useMemo(() => [
        { id: 'distance', icon: 'navigation', value: summary?.total_distance_today || 0, label: 'Distance', iconColor: colors.info, bgColor: colors.infoLight, suffix: ' km' },
        { id: 'punches', icon: 'check-circle', value: summary?.punch_count || 0, label: 'Punches', iconColor: colors.success, bgColor: colors.successLight },
        { id: 'collected', icon: 'dollar-sign', value: summary?.total_collection || 0, label: 'Collected', iconColor: colors.warning, bgColor: colors.warningLight, prefix: '₹' },
        { id: 'disbursement', icon: 'trending-up', value: summary?.total_disbursement || 0, label: 'Disbursement', iconColor: colors.danger, bgColor: colors.dangerLight, prefix: '₹' },
    ], [summary]);

    const allPunches = useMemo(() => {
        const combined = [...(punches || []), ...(todayPunches || [])];
        const map = new Map();
        combined.forEach(p => {
            if (p?.id && !map.has(p.id)) {
                map.set(p.id, p);
            }
        });
        return Array.from(map.values());
    }, [punches, todayPunches]);

    const routePoints = useMemo(() => {
        return allPunches
            .filter(p => p.latitude && p.longitude)
            .sort((a, b) => new Date(b.punched_at) - new Date(a.punched_at))
            .map(p => ({ 
                latitude: Number(p.latitude), 
                longitude: Number(p.longitude) 
            }));
    }, [allPunches]);

    const activities = useMemo(() => {
        try {
            const mappedActivities = mapApiResponseToActivities(allPunches, []);
            const filtered = ActivityPresenter.filterActivities(mappedActivities, selectedFilter);
            return ActivityPresenter.groupActivitiesByTime(filtered);
        } catch (err) {
            if (IS_DEV) console.error('[Home] Activities error:', err);
            return [];
        }
    }, [allPunches, selectedFilter]);

    const totalItems = useMemo(() => {
        return activities.reduce((acc, s) => acc + (s.data?.length || 0), 0);
    }, [activities]);

    const formatTime = useCallback((dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            });
        } catch {
            return '';
        }
    }, []);

    const formatDuration = useCallback((minutes) => {
        if (!minutes || minutes < 0) return '0 min';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins} min`;
    }, []);

    const formatDistance = useCallback((km) => {
        if (!km || km < 0) return '0 km';
        return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(2)} km`;
    }, []);

    const duration = getTrackingDuration();
    const distance = getTotalDistance();

    const trackingStatus = useMemo(() => {
        if (isActive || isTracking) {
            return { color: colors.success, text: 'Tracking Active', dot: true };
        }
        if (success) {
            return { color: colors.info, text: 'Punch Success', dot: false };
        }
        return { color: colors.textMuted, text: 'Ready', dot: false };
    }, [isActive, isTracking, success]);

    const punchStartTime = currentPunch?.punched_at || null;

    const handleFilterChange = useCallback((filter) => {
        setSelectedFilter(filter);
    }, []);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
            
            <HeroHeader
                user={user}
                role="Employee"
                showStatus={true}
                status={(isActive || isTracking) ? 'active' : 'online'}
                onLogout={handleLogout}
            />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl 
                        refreshing={isRefreshing} 
                        onRefresh={onRefresh} 
                        colors={[colors.primary]} 
                    />
                }
            >
                {(isActive || isTracking) && (
                    <>
                        <View style={styles.trackingBanner}>
                            <Animated.View style={[styles.trackingDot, { 
                                backgroundColor: trackingStatus.color,
                                transform: [{ scale: pulseAnim }]
                            }]} />
                            <Text style={[styles.trackingText, { color: trackingStatus.color }]}>
                                {trackingStatus.text}
                            </Text>
                            {punchStartTime && (
                                <Text style={styles.punchInTime}>
                                    Since {formatTime(punchStartTime)}
                                </Text>
                            )}
                        </View>

                        <View style={styles.trackingStatsRow}>
                            <View style={styles.miniStat}>
                                <Icon name="navigation" size={16} color={colors.primary} />
                                <Text style={styles.miniStatValue}>{formatDistance(distance)}</Text>
                            </View>
                            <View style={styles.miniStatDivider} />
                            <View style={styles.miniStat}>
                                <Icon name="clock" size={16} color={colors.warning} />
                                <Text style={styles.miniStatValue}>{formatDuration(duration)}</Text>
                            </View>
                        </View>
                    </>
                )}

                <View style={styles.statsSection}>
                    <View style={styles.statsRow}>
                        {statsData.slice(0, 2).map((stat) => (
                            <StatCard key={stat.id} {...stat} />
                        ))}
                    </View>
                    <View style={styles.statsRow}>
                        {statsData.slice(2, 4).map((stat) => (
                            <StatCard key={stat.id} {...stat} />
                        ))}
                    </View>
                </View>

                {routePoints.length > 0 && (
                    <MapPreview points={routePoints} mapRef={mapRef} />
                )}

                <View style={styles.activitySection}>
                    <View style={styles.activityHeader}>
                        <Text style={styles.sectionTitle}>Today's Activity</Text>
                        <Text style={styles.sectionCount}>
                            {totalItems} items
                        </Text>
                    </View>

                    <ActivityFilterBar 
                        selectedFilter={selectedFilter} 
                        onFilterChange={handleFilterChange} 
                    />

                    {activities.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Icon name="inbox" size={48} color={colors.textLight} />
                            <Text style={styles.emptyText}>
                                {selectedFilter === 'ALL' 
                                    ? 'No activity recorded yet today' 
                                    : 'No activities match the selected filter'}
                            </Text>
                        </View>
                    ) : (
                        activities.map((section, sectionIndex) => (
                            <ActivitySection 
                                key={`section-${section.title}-${sectionIndex}`}
                                section={section}
                                sectionIndex={sectionIndex}
                            />
                        ))
                    )}
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 160,
    },
    trackingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5',
        padding: spacing.sm,
        borderRadius: 12,
        marginTop: spacing.md,
    },
    trackingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: spacing.sm,
    },
    trackingText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        flex: 1,
    },
    punchInTime: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    },
    trackingStatsRow: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.sm,
        marginTop: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    miniStat: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    miniStatValue: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginLeft: spacing.xs,
    },
    miniStatDivider: {
        width: 1,
        height: 20,
        backgroundColor: colors.border,
    },
    statsSection: {
        marginTop: spacing.md,
    },
    statsRow: {
        flexDirection: 'row',
        marginBottom: spacing.sm,
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        marginHorizontal: spacing.xxs,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    statIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    statValue: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    statLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
        textAlign: 'center',
    },
    mapContainer: {
        height: 180,
        marginTop: spacing.md,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        ...shadows.sm,
    },
    mapControls: {
        position: 'absolute',
        top: spacing.xs,
        right: spacing.xs,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.sm,
        ...shadows.sm,
    },
    controlBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapCta: {
        position: 'absolute',
        bottom: spacing.xs,
        right: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: borderRadius.sm,
    },
    mapCtaText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: typography.weights.semibold,
        marginLeft: 4,
    },
    activitySection: {
        marginTop: spacing.lg,
    },
    activityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    sectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    sectionCount: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        backgroundColor: colors.surface,
        borderRadius: 14,
        marginTop: spacing.sm,
    },
    emptyText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.sm,
        textAlign: 'center',
    },
});

export default EmployeeHomeScreen;
