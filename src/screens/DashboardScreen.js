import React, { useState, useContext, useCallback, useRef, useMemo } from 'react';
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
import api from '../api/api';
import { AuthContext } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/tokens';
import { SkeletonStatsGrid, SkeletonListItem } from '../components/SkeletonComponents';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import ErrorView from '../components/ErrorView';

const COMPANY_NAME = 'ARMAN FINANCIAL SERVICES LTD';

const ListItem = React.memo(({ item }) => (
    <View style={styles.listItem}>
        <View style={styles.listIconWrapper}>
            <Icon
                name={item?.visit_type?.includes('COLLECT') ? 'dollar-sign' : 'map-pin'}
                size={18}
                color={colors.primary}
            />
        </View>
        <View style={styles.listContent}>
            <Text style={styles.listTitle}>{item?.visit_type || 'Location Ping'}</Text>
            <Text style={styles.listSubtitle}>
                {item?.punched_at ? new Date(item.punched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
            </Text>
        </View>
    </View>
));

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
                style={styles.map}
                initialRegion={{
                    latitude: latestPoint?.latitude || 23.0225,
                    longitude: latestPoint?.longitude || 72.5714,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
            >
                <Marker coordinate={latestPoint} pinColor="red" />
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
    const { token, user, logout } = useContext(AuthContext);
    const mapRef = useRef(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [summary, setSummary] = useState({});
    const [punches, setPunches] = useState([]);
    const [isOnline, setIsOnline] = useState(true);
    const [isGpsActive, setIsGpsActive] = useState(false);

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

    const ListHeader = useMemo(() => (
        <>
            <View style={styles.heroSection}>
                <SafeAreaView edges={['top']}>
                    <View style={styles.heroContent}>
                        <View style={styles.heroLeft}>
                            <View style={styles.companyBadge}>
                                <Icon name="briefcase" size={12} color="#FFFFFF" />
                                <Text style={styles.companyName}>{COMPANY_NAME}</Text>
                            </View>
                            <Text style={styles.greeting}>Hello, {user?.username || 'Officer'}</Text>
                            <Text style={styles.dateText}>
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </Text>
                        </View>
                        <View style={styles.heroRight}>
                            <StatusBadge 
                                status={!isOnline ? 'offline' : isGpsActive ? 'info' : 'online'} 
                                size="sm"
                            />
                            <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
                                <Icon name="log-out" size={20} color="#FFFFFF" />
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
                    <Text style={styles.sectionCount}>{punches.length} punches</Text>
                </View>
            </View>
        </>
    ), [user?.username, logout, isOnline, isGpsActive, hasError, isLoading, statsData, routePoints, navigation, fetchData]);

    const renderItem = useCallback(({ item }) => <ListItem item={item} />, []);
    const keyExtractor = useCallback((_, index) => index.toString(), []);

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
            <FlatList
                data={punches}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ListHeaderComponent={ListHeader}
                ListEmptyComponent={!isLoading && !hasError ? () => (
                    <View style={styles.emptyState}>
                        <Icon name="inbox" size={48} color={colors.textLight} />
                        <Text style={styles.emptyText}>No activity recorded yet today</Text>
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
    heroSection: { backgroundColor: colors.primaryDark, borderBottomLeftRadius: borderRadius.xxl, borderBottomRightRadius: borderRadius.xxl },
    heroContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.lg, paddingTop: spacing.md },
    heroLeft: { flex: 1 },
    heroRight: { alignItems: 'flex-end' },
    companyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: borderRadius.full, marginBottom: spacing.sm },
    companyName: { fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, color: '#FFFFFF', letterSpacing: 0.5, marginLeft: spacing.xxs },
    greeting: { fontSize: typography.sizes.xxxl, fontWeight: typography.weights.bold, color: '#FFFFFF' },
    dateText: { fontSize: typography.sizes.sm, color: 'rgba(255,255,255,0.75)', marginTop: spacing.xxs },
    logoutBtn: { width: 40, height: 40, borderRadius: borderRadius.md, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
    contentSection: { paddingHorizontal: spacing.md },
    mapContainer: { height: 180, marginTop: spacing.lg, borderRadius: borderRadius.lg, overflow: 'hidden', ...shadows.md },
    map: { flex: 1 },
    mapControls: { position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: colors.surface, borderRadius: borderRadius.sm, ...shadows.sm },
    controlBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.divider },
    controlBtnLast: { borderBottomWidth: 0 },
    mapCta: { position: 'absolute', bottom: spacing.sm, right: spacing.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: borderRadius.sm },
    mapCtaText: { color: '#FFFFFF', fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, marginLeft: spacing.xxs },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md },
    sectionTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.textDark },
    sectionCount: { fontSize: typography.sizes.sm, color: colors.textMuted },
    listContent: { paddingHorizontal: spacing.md, paddingBottom: 140 },
    listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm, ...shadows.xs },
    listIconWrapper: { width: 40, height: 40, borderRadius: borderRadius.sm, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
    listContent: { flex: 1 },
    listTitle: { fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.textDark },
    listSubtitle: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 2 },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
    emptyText: { fontSize: typography.sizes.md, color: colors.textMuted, marginTop: spacing.md },
});

export default DashboardScreen;
