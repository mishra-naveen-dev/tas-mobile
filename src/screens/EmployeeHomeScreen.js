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
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { usePunch } from '../context/PunchContext';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/tokens';
import HeroHeader from '../components/HeroHeader';
import ActivityCard from '../components/ActivityCard';
import ActivityFilterBar from '../components/ActivityFilterBar';
import SectionHeader from '../components/SectionHeader';
import ActivityPresenter from '../presenters/ActivityPresenter';
import { mapApiResponseToActivities } from '../models/ActivityModel';

const MapPreview = React.memo(({ points, mapRef, navigation }) => {
    const latestPoint = points[0];
    
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
                        <Polyline coordinates={[...points].reverse()} strokeWidth={4} strokeColor={colors.primary} />
                    </>
                )}
            </MapView>
            
            <View style={styles.mapControls}>
                <TouchableOpacity style={styles.controlBtn} onPress={fitAll} activeOpacity={0.8}>
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

const StatCard = ({ icon, value, label, iconColor, bgColor, prefix, suffix }) => (
    <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: bgColor }]}>
            <Icon name={icon} size={20} color={iconColor} />
        </View>
        <Text style={styles.statValue}>
            {prefix || ''}{typeof value === 'number' ? value.toLocaleString() : value}{suffix || ''}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const EmployeeHomeScreen = ({ navigation }) => {
    const auth = useAuth();
    const { 
        isActive, 
        isIdle, 
        isCompleted,
        punchStartTime, 
        getTotalDistance, 
        getTrackingDuration,
        refreshPunches 
    } = usePunch();
    
    const { token, logout } = auth;
    const user = auth?.user;
    const mapRef = useRef(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [summary, setSummary] = useState({});
    const [punches, setPunches] = useState([]);
    const [isOnline, setIsOnline] = useState(true);
    const [selectedFilter, setSelectedFilter] = useState('ALL');

    useEffect(() => {
        if (isActive) {
            Animated.loop(
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
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isActive, pulseAnim]);

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

            const [summaryRes, punchRes] = await Promise.all([
                api.get('/attendance/punches/daily_summary/'),
                api.get('/attendance/punches/today_punches/'),
            ]);

            const liveSummary = summaryRes?.data || {};
            const livePunches = punchRes?.data?.results || punchRes?.data || [];
            setSummary(liveSummary);
            setPunches(livePunches);
        } catch {
            setHasError(true);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [token, checkNetwork]);

    useFocusEffect(useCallback(() => {
        fetchData(false);
        refreshPunches();
        const interval = setInterval(checkNetwork, 30000);
        return () => clearInterval(interval);
    }, [fetchData, checkNetwork, refreshPunches]));

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
                        await auth.logout();
                        if (auth.navigationRef?.current) {
                            auth.navigationRef.current.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        }
                    },
                },
            ]
        );
    }, [auth]);

    const statsData = useMemo(() => [
        { icon: 'navigation', value: summary?.total_distance_today || 0, label: 'Distance', iconColor: colors.info, bgColor: colors.infoLight, suffix: ' km' },
        { icon: 'check-circle', value: summary?.punch_count || 0, label: 'Punches', iconColor: colors.success, bgColor: colors.successLight },
        { icon: 'dollar-sign', value: summary?.total_collection || 0, label: 'Collected', iconColor: colors.warning, bgColor: colors.warningLight, prefix: '₹' },
        { icon: 'trending-up', value: summary?.total_disbursement || 0, label: 'Disbursement', iconColor: colors.danger, bgColor: colors.dangerLight, prefix: '₹' },
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

    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    };

    const formatDuration = (minutes) => {
        if (!minutes) return '0 min';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins} min`;
    };

    const duration = getTrackingDuration();
    const distance = getTotalDistance();

    const getTrackingStatus = () => {
        if (isActive) return { color: colors.success, text: 'Tracking Active', dot: true };
        if (isCompleted) return { color: colors.textMuted, text: 'Day Completed', dot: false };
        return { color: colors.info, text: 'Not Tracking', dot: false };
    };

    const trackingStatus = getTrackingStatus();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
            
            <HeroHeader
                user={user}
                role="Employee"
                showStatus={true}
                status={isActive ? 'active' : 'online'}
                onLogout={handleLogout}
            />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                }
            >
                {isActive && (
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
                )}

                {isActive && (
                    <View style={styles.trackingStatsRow}>
                        <View style={styles.miniStat}>
                            <Icon name="navigation" size={16} color={colors.primary} />
                            <Text style={styles.miniStatValue}>{distance.toFixed(2)} km</Text>
                        </View>
                        <View style={styles.miniStatDivider} />
                        <View style={styles.miniStat}>
                            <Icon name="clock" size={16} color={colors.warning} />
                            <Text style={styles.miniStatValue}>{formatDuration(duration)}</Text>
                        </View>
                    </View>
                )}

                <View style={styles.statsSection}>
                    <View style={styles.statsRow}>
                        {statsData.slice(0, 2).map((stat, index) => (
                            <StatCard key={index} {...stat} />
                        ))}
                    </View>
                    <View style={styles.statsRow}>
                        {statsData.slice(2, 4).map((stat, index) => (
                            <StatCard key={index} {...stat} />
                        ))}
                    </View>
                </View>

                {routePoints.length > 0 && (
                    <MapPreview points={routePoints} mapRef={mapRef} navigation={navigation} />
                )}

                <View style={styles.activitySection}>
                    <View style={styles.activityHeader}>
                        <Text style={styles.sectionTitle}>Today's Activity</Text>
                        <Text style={styles.sectionCount}>
                            {activities.reduce((acc, s) => acc + s.data.length, 0)} items
                        </Text>
                    </View>

                    <ActivityFilterBar 
                        selectedFilter={selectedFilter} 
                        onFilterChange={setSelectedFilter} 
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
                        activities.map((section) => (
                            <View key={section.title}>
                                <SectionHeader title={section.title} count={section.data.length} />
                                {section.data.map((activity) => (
                                    <ActivityCard key={activity.id} activity={activity} />
                                ))}
                            </View>
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
        backgroundColor: `${colors.success}15`,
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
