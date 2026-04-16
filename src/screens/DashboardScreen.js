import React, { useState, useContext, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    RefreshControl,
    Animated,
    Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/api';
import { AuthContext } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors, typography, spacing } from '../theme/tokens';

const COMPANY_NAME = 'ARMAN FINANCIAL SERVICES LTD';

const SkeletonCard = () => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const shimmer = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
            ])
        );
        shimmer.start();
        return () => shimmer.stop();
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <View style={styles.statsCard}>
            <View style={styles.statsRow}>
                {[1, 2].map((i) => (
                    <View key={i} style={styles.statItem}>
                        <Animated.View style={[styles.skeletonIcon, { opacity }]} />
                        <Animated.View style={[styles.skeletonText, { opacity }]} />
                        <Animated.View style={[styles.skeletonLabel, { opacity }]} />
                    </View>
                ))}
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsRow}>
                {[1, 2].map((i) => (
                    <View key={i} style={styles.statItem}>
                        <Animated.View style={[styles.skeletonIcon, { opacity }]} />
                        <Animated.View style={[styles.skeletonText, { opacity }]} />
                        <Animated.View style={[styles.skeletonLabel, { opacity }]} />
                    </View>
                ))}
            </View>
        </View>
    );
};

const AnimatedValue = ({ value, suffix = '', prefix = '', duration = 800 }) => {
    const animatedValue = useRef(new Animated.Value(0)).current;
    const [displayValue, setDisplayValue] = useState('0');
    const prevValue = useRef(value);

    useEffect(() => {
        if (prevValue.current !== value) {
            prevValue.current = value;
            animatedValue.setValue(0);
            Animated.timing(animatedValue, {
                toValue: value,
                duration,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }).start();

            const listener = animatedValue.addListener(({ value: val }) => {
                if (Number.isInteger(value)) {
                    setDisplayValue(Math.round(val).toString());
                } else {
                    setDisplayValue(val.toFixed(1));
                }
            });

            return () => animatedValue.removeListener(listener);
        }
    }, [value, duration, animatedValue]);

    return (
        <Text style={styles.statValue}>
            {prefix}{displayValue}{suffix}
        </Text>
    );
};

const StatItem = ({ icon, value, label, iconColor, bgColor, suffix = '', prefix = '', isLoading }) => (
    <View style={styles.statItem}>
        {isLoading ? (
            <>
                <View style={[styles.skeletonIcon, { backgroundColor: '#E5E7EB' }]} />
                <View style={[styles.skeletonText, { backgroundColor: '#E5E7EB' }]} />
                <View style={[styles.skeletonLabel, { backgroundColor: '#E5E7EB' }]} />
            </>
        ) : (
            <>
                <View style={[styles.statIconWrapper, { backgroundColor: bgColor }]}>
                    <Icon name={icon} size={22} color={iconColor} />
                </View>
                <AnimatedValue value={value} suffix={suffix} prefix={prefix} />
                <Text style={styles.statLabel}>{label}</Text>
            </>
        )}
    </View>
);

const StatusBadge = ({ isOnline, isGpsActive }) => {
    const getStatusColor = () => {
        if (!isOnline) return '#EF4444';
        if (isGpsActive) return '#2563EB';
        return '#10B981';
    };

    const getStatusIcon = () => {
        if (!isOnline) return 'wifi-off';
        if (isGpsActive) return 'map-pin';
        return 'wifi';
    };

    const getStatusText = () => {
        if (!isOnline) return 'Offline';
        if (isGpsActive) return 'GPS Active';
        return 'Online';
    };

    return (
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
            <Icon name={getStatusIcon()} size={12} color={getStatusColor()} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusText()}
            </Text>
        </View>
    );
};

const DashboardHeader = ({ username, onLogout, isOnline, isGpsActive }) => (
    <View style={styles.header}>
        <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
                <View style={styles.companyBadge}>
                    <Icon name="briefcase" size={14} color="#FFFFFF" />
                    <Text style={styles.companyName}>{COMPANY_NAME}</Text>
                </View>
                <Text style={styles.greeting}>Hello, {username || 'Officer'}</Text>
                <Text style={styles.dateText}>
                    {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                </Text>
            </View>
            <View style={styles.headerRight}>
                <StatusBadge isOnline={isOnline} isGpsActive={isGpsActive} />
                <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.7}>
                    <Icon name="log-out" size={22} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </View>
    </View>
);

const StatsCard = ({ summary, isLoading }) => (
    <View style={styles.statsCard}>
        <View style={styles.statsRow}>
            <StatItem
                icon="navigation"
                value={summary?.total_distance_today || 0}
                label="Distance"
                iconColor="#DC2626"
                bgColor="#FEE2E2"
                suffix=" km"
                isLoading={isLoading}
            />
            <View style={styles.statDivider} />
            <StatItem
                icon="check-circle"
                value={summary?.punch_count || 0}
                label="Punches"
                iconColor="#059669"
                bgColor="#D1FAE5"
                isLoading={isLoading}
            />
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.statsRow}>
            <StatItem
                icon="dollar-sign"
                value={summary?.total_collection || 0}
                label="Collected"
                iconColor="#D97706"
                bgColor="#FEF3C7"
                prefix="₹"
                isLoading={isLoading}
            />
            <View style={styles.statDivider} />
            <StatItem
                icon="trending-up"
                value={summary?.total_disbursement || 0}
                label="Disbursement"
                iconColor="#2563EB"
                bgColor="#DBEAFE"
                prefix="₹"
                isLoading={isLoading}
            />
        </View>
    </View>
);

const ErrorView = ({ onRetry }) => (
    <View style={styles.errorContainer}>
        <Icon name="alert-circle" size={48} color={colors.danger} />
        <Text style={styles.errorText}>Failed to load data</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Icon name="refresh-cw" size={16} color="#FFFFFF" />
            <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
    </View>
);

const DashboardScreen = ({ navigation }) => {
    const { token, user, logout } = useContext(AuthContext);
    const mapRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [summary, setSummary] = useState({});
    const [punches, setPunches] = useState([]);
    const [filterType, setFilterType] = useState('ALL');
    const [showFilter, setShowFilter] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [isGpsActive, setIsGpsActive] = useState(false);

    const checkNetworkStatus = useCallback(async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            await fetch('https://www.google.com/favicon.ico', {
                method: 'HEAD',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            setIsOnline(true);
        } catch {
            setIsOnline(false);
        }
    }, []);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!token) return;

        try {
            setHasError(false);
            if (!isRefresh) setLoading(true);

            await checkNetworkStatus();

            try {
                const cachedSummary = await AsyncStorage.getItem('@dashboard_summary');
                const cachedPunches = await AsyncStorage.getItem('@dashboard_punches');
                if (cachedSummary) setSummary(JSON.parse(cachedSummary));
                if (cachedPunches) setPunches(JSON.parse(cachedPunches));
            } catch (cacheErr) {
                console.log("Cache read fault:", cacheErr);
            }

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

        } catch (err) {
            console.log("Dashboard network fault:", err?.message);
            setHasError(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token, checkNetworkStatus]);

    useFocusEffect(
        useCallback(() => {
            fetchData(false);
            const interval = setInterval(checkNetworkStatus, 30000);
            return () => clearInterval(interval);
        }, [fetchData, checkNetworkStatus])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData(true);
    }, [fetchData]);

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
        .sort((a, b) => new Date(b.punched_at) - new Date(a.punched_at))
        .map(p => ({
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
            timestamp: p.punched_at,
        }));

    const latestPoint = validRoutePoints.length > 0 ? validRoutePoints[0] : null;

    const centerOnCurrentLocation = () => {
        if (validRoutePoints.length === 0 || !mapRef.current) return;
        mapRef.current.animateToRegion({
            latitude: latestPoint.latitude,
            longitude: latestPoint.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01
        }, 500);
    };

    const fitAllCoordinates = () => {
        if (validRoutePoints.length > 1 && mapRef.current) {
            mapRef.current.fitToCoordinates(validRoutePoints, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true
            });
        }
    };

    const filteredPunches = punches.filter(p => {
        if (filterType === 'ALL') return true;
        return p.visit_type === filterType;
    });

    if (loading && !refreshing && hasError) {
        return (
            <SafeAreaView style={styles.container}>
                <DashboardHeader
                    username={user?.username}
                    onLogout={logout}
                    isOnline={isOnline}
                    isGpsActive={isGpsActive}
                />
                <ErrorView onRetry={fetchData} />
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
                        <DashboardHeader
                            username={user?.username}
                            onLogout={logout}
                            isOnline={isOnline}
                            isGpsActive={isGpsActive}
                        />

                        {hasError ? (
                            <ErrorView onRetry={fetchData} />
                        ) : (
                            <>
                                {loading && !refreshing ? (
                                    <SkeletonCard />
                                ) : (
                                    <StatsCard summary={summary} isLoading={false} />
                                )}
                            </>
                        )}

                        {validRoutePoints.length > 0 && !hasError && (
                            <TouchableOpacity
                                style={styles.mapWrap}
                                onPress={() => navigation.navigate('RouteMap')}
                            >
                                <MapView
                                    ref={mapRef}
                                    style={styles.mapEmbed}
                                    initialRegion={{
                                        latitude: latestPoint?.latitude || 23.0225,
                                        longitude: latestPoint?.longitude || 72.5714,
                                        latitudeDelta: 0.05,
                                        longitudeDelta: 0.05,
                                    }}
                                >
                                    <Marker coordinate={latestPoint} pinColor="red" title="Latest" />
                                    {validRoutePoints.length > 1 && (
                                        <>
                                            <Marker
                                                coordinate={validRoutePoints[validRoutePoints.length - 1]}
                                                pinColor="green"
                                                title="Start"
                                            />
                                            <Polyline
                                                coordinates={[...validRoutePoints].reverse()}
                                                strokeWidth={4}
                                                strokeColor="#2563EB"
                                            />
                                        </>
                                    )}
                                </MapView>

                                <View style={styles.mapControls}>
                                    <TouchableOpacity
                                        style={styles.mapControlBtn}
                                        onPress={centerOnCurrentLocation}
                                        activeOpacity={0.8}
                                    >
                                        <Icon name="crosshair" size={20} color={colors.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.mapControlBtn, styles.mapControlBtnLast]}
                                        onPress={fitAllCoordinates}
                                        activeOpacity={0.8}
                                    >
                                        <Icon name="maximize-2" size={20} color={colors.primary} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.mapOverlayButton}>
                                    <Icon name="maximize-2" size={14} color="#fff" />
                                    <Text style={styles.mapOverlayButtonText}>View Full Route</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Today's Activity</Text>
                            <TouchableOpacity
                                style={styles.filterBtn}
                                onPress={() => setShowFilter(!showFilter)}
                            >
                                <Icon name="filter" size={16} color={colors.primary} />
                                <Text style={styles.filterText}>{filterType}</Text>
                            </TouchableOpacity>
                        </View>

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
                    !loading && !hasError ? (
                        <Text style={styles.emptyText}>
                            No activity recorded yet today.
                        </Text>
                    ) : null
                }
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
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
        backgroundColor: '#F5F5F5',
    },
    header: {
        backgroundColor: colors.primaryDark,
        paddingTop: 50,
        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerLeft: {
        flex: 1,
    },
    headerRight: {
        alignItems: 'flex-end',
    },
    companyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: spacing.md,
    },
    companyName: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 1,
        marginLeft: 6,
    },
    greeting: {
        fontSize: 26,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    dateText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 10,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        marginLeft: 4,
    },
    logoutBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginHorizontal: spacing.md,
        marginTop: spacing.lg,
        padding: spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statsDivider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: spacing.md,
    },
    statDivider: {
        width: 1,
        height: '100%',
        backgroundColor: '#F3F4F6',
        marginHorizontal: spacing.md,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    statIconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textDark,
        textAlign: 'center',
    },
    statLabel: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 4,
        textAlign: 'center',
    },
    skeletonIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        marginBottom: spacing.sm,
    },
    skeletonText: {
        width: 60,
        height: 20,
        borderRadius: 4,
        marginBottom: 4,
    },
    skeletonLabel: {
        width: 50,
        height: 14,
        borderRadius: 4,
    },
    errorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xxl,
        marginHorizontal: spacing.md,
        marginTop: spacing.lg,
    },
    errorText: {
        fontSize: 16,
        color: colors.textMuted,
        marginTop: spacing.md,
        marginBottom: spacing.lg,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    retryText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    mapWrap: {
        height: 180,
        marginHorizontal: spacing.md,
        marginTop: spacing.lg,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    mapEmbed: {
        flex: 1,
        width: '100%',
    },
    mapControls: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    mapControlBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    mapControlBtnLast: {
        borderBottomWidth: 0,
    },
    mapOverlayButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    mapOverlayButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        marginTop: spacing.xl,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textDark,
    },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterText: {
        fontSize: 12,
        color: colors.textDark,
        fontWeight: '600',
        marginLeft: 6,
    },
    filterDropdown: {
        marginHorizontal: spacing.md,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    filterItem: {
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    filterItemText: {
        fontSize: 14,
        color: colors.textDark,
        fontWeight: '500',
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 14,
        borderRadius: 14,
        marginBottom: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    activityIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    activityDetails: {
        flex: 1,
    },
    activityTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textDark,
    },
    activityTime: {
        fontSize: 13,
        color: colors.textMuted,
        marginTop: 2,
    },
    emptyText: {
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.xl,
        fontSize: 14,
    },
});

export default DashboardScreen;
