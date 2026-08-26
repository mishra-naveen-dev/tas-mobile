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
    Alert,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import api from '../../api/api';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useAuth } from '../../context/AuthContext';
import { usePunch, STATES } from '../../context/PunchContext';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';
import HeroHeader from '../../components/HeroHeader';
import DailyPunchPrompt from '../../components/DailyPunchPrompt';
import ActivityCard from '../../components/ActivityCard';
import ActivityDetailModal from '../../components/ActivityDetailModal';
import ActivityFilterBar from '../../components/ActivityFilterBar';
import SectionHeader from '../../components/SectionHeader';
import ActivityPresenter from '../../presenters/ActivityPresenter';
import { mapApiResponseToActivities, activityFromQueueItem } from '../../models/ActivityModel';
import { SkeletonStatsGrid, SkeletonListItem } from '../../components/SkeletonComponents';
import { subscribe as subscribeOfflineQueue, retryItem as retryOfflineQueueItem } from '../../services/OfflineQueue';

const ZOHO_CHART_URL = 'https://analytics.zoho.in/open-view/334082000154073362';

const MONTH_KEY = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const isSameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

// ─── Radial ring (View-based, no native SVG module required) ─────────────────
const RadialRing = ({ size, strokeWidth, progress, max, color, trackColor }) => {
    const pct = max > 0 ? Math.min(Math.max(progress / max, 0), 1) : 0;
    const half = size / 2;
    const deg1 = pct <= 0.5 ? pct * 360 - 90 : 90;
    const deg2 = pct > 0.5 ? (pct - 0.5) * 360 - 90 : -90;

    return (
        <View style={{ width: size, height: size, position: 'absolute' }}>
            {/* Track */}
            <View style={{ position: 'absolute', width: size, height: size, borderRadius: half, borderWidth: strokeWidth, borderColor: trackColor }} />
            {/* Right half clip (0–50%) */}
            <View style={{ position: 'absolute', width: half, height: size, left: half, overflow: 'hidden' }}>
                <View style={{
                    position: 'absolute', left: -half, width: size, height: size,
                    borderRadius: half, borderWidth: strokeWidth,
                    borderColor: pct > 0 ? color : 'transparent',
                    transform: [{ rotate: `${deg1}deg` }],
                }} />
            </View>
            {/* Left half clip (50–100%) */}
            {pct > 0.5 && (
                <View style={{ position: 'absolute', width: half, height: size, left: 0, overflow: 'hidden' }}>
                    <View style={{
                        position: 'absolute', left: 0, width: size, height: size,
                        borderRadius: half, borderWidth: strokeWidth,
                        borderColor: color,
                        transform: [{ rotate: `${deg2}deg` }],
                    }} />
                </View>
            )}
        </View>
    );
};

// ─── Monthly collection ring card ─────────────────────────────────────────────
// `target`/`collected`/`achievementPct`/`remainingAmt`/`excessAmt` come
// straight from the backend's monthly_target response (apps/loans/views.py::
// CollectionRecordViewSet.monthly_target) — never recomputed independently
// on-device, per "backend is the source of truth." The ring's fill
// proportion still derives from collected/target locally since that's pure
// rendering geometry, not an alternate calculation.
const MonthlyCollectionCard = ({
    collected, target, achievementPct, remainingAmt, excessAmt,
    monthLabel, onPrevMonth, onNextMonth, canGoNext, loading,
}) => {
    const RING = 112;
    const STROKE = 11;
    const pct = target > 0 ? Math.min(collected / target, 1) : 0;
    const pctLabel = Math.round(achievementPct ?? 0);

    const fmtCompact = (n) => {
        if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
        if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
        return `₹${n}`;
    };
    const fmtFull = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

    const ringColor = pct >= 1 ? colors.success : pct >= 0.5 ? colors.warning : colors.primary;
    const trackColor = pct >= 1 ? colors.successLight : pct >= 0.5 ? colors.warningLight : colors.primaryLight;

    return (
        <View style={homeStyles.mcCard}>
            {/* Card header */}
            <View style={homeStyles.mcHeader}>
                <View style={homeStyles.mcHeaderLeft}>
                    <View style={[homeStyles.mcIconBox, { backgroundColor: ringColor + '18' }]}>
                        <Icon name="target" size={14} color={ringColor} />
                    </View>
                    <View>
                        <Text style={homeStyles.mcTitle}>Monthly Collection</Text>
                        <View style={homeStyles.mcMonthSelector}>
                            <TouchableOpacity onPress={onPrevMonth} disabled={loading} hitSlop={{ top: 6, bottom: 6, left: 6, right: 10 }}>
                                <Icon name="chevron-left" size={15} color={colors.textMuted} />
                            </TouchableOpacity>
                            <Text style={homeStyles.mcMonth}>{monthLabel}</Text>
                            <TouchableOpacity onPress={onNextMonth} disabled={loading || !canGoNext} hitSlop={{ top: 6, bottom: 6, left: 10, right: 6 }}>
                                <Icon name="chevron-right" size={15} color={canGoNext ? colors.textMuted : colors.textLight} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                <View style={[homeStyles.mcBadge, { backgroundColor: ringColor + '18' }]}>
                    <Text style={[homeStyles.mcBadgeText, { color: ringColor }]}>{pctLabel}%</Text>
                </View>
            </View>

            {/* Body: ring + stats side by side */}
            <View style={homeStyles.mcBody}>
                {/* Ring */}
                <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
                    <RadialRing
                        size={RING} strokeWidth={STROKE}
                        progress={collected} max={target}
                        color={ringColor} trackColor={trackColor}
                    />
                    {/* Center label */}
                    <View style={homeStyles.mcRingCenter}>
                        <Text style={[homeStyles.mcRingValue, { color: ringColor }]}>
                            {fmtCompact(collected)}
                        </Text>
                        <Text style={homeStyles.mcRingSub}>collected</Text>
                    </View>
                </View>

                {/* Stats column */}
                <View style={homeStyles.mcStats}>
                    <View style={homeStyles.mcStatRow}>
                        <View style={[homeStyles.mcDot, { backgroundColor: trackColor, borderColor: ringColor }]} />
                        <View>
                            <Text style={homeStyles.mcStatLabel}>Total Due Amount Schedule</Text>
                            <Text style={homeStyles.mcStatVal}>{fmtFull(target)}</Text>
                        </View>
                    </View>
                    <View style={homeStyles.mcDivider} />
                    <View style={homeStyles.mcStatRow}>
                        <View style={[homeStyles.mcDot, { backgroundColor: ringColor }]} />
                        <View>
                            <Text style={homeStyles.mcStatLabel}>MTD Collected</Text>
                            <Text style={[homeStyles.mcStatVal, { color: ringColor }]}>{fmtFull(collected)}</Text>
                        </View>
                    </View>
                    <View style={homeStyles.mcDivider} />
                    <View style={homeStyles.mcStatRow}>
                        <View style={[homeStyles.mcDot, { backgroundColor: colors.textLight }]} />
                        <View>
                            <Text style={homeStyles.mcStatLabel}>{excessAmt > 0 ? 'Excess' : 'Remaining Amount'}</Text>
                            <Text style={homeStyles.mcStatVal}>{fmtFull(excessAmt > 0 ? excessAmt : remainingAmt)}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Progress bar strip */}
            <View style={homeStyles.mcStrip}>
                <View style={[homeStyles.mcStripFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: ringColor }]} />
            </View>
            <View style={homeStyles.mcStripLabels}>
                <Text style={homeStyles.mcStripLabel}>₹0</Text>
                <Text style={homeStyles.mcStripLabel}>{fmtCompact(target)}</Text>
            </View>
        </View>
    );
};

// ─── Collection Stats Widget ──────────────────────────────────────────────────
const CollectionWidget = ({ stats, onPress }) => {
    if (!stats) return null;

    const fmtAmt = (n) => {
        if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
        if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
        return `₹${Number(n).toLocaleString('en-IN')}`;
    };

    const done       = (stats.today?.collected || 0) + (stats.today?.partial || 0);
    const todayAmt   = stats.today?.amount || 0;
    const mtdAmt     = stats.mtd?.amount || 0;
    const total      = stats.total_assigned || 0;
    const pending    = stats.pending || 0;
    const notPaid    = stats.not_paid || 0;

    return (
        <TouchableOpacity style={cwStyles.card} onPress={onPress} activeOpacity={0.92}>
            {/* Header */}
            <View style={cwStyles.header}>
                <View style={cwStyles.headerLeft}>
                    <View style={cwStyles.iconBox}>
                        <Icon name="dollar-sign" size={14} color="#d32f2f" />
                    </View>
                    <View>
                        <Text style={cwStyles.title}>My Collections</Text>
                        <Text style={cwStyles.sub}>Today's activity</Text>
                    </View>
                </View>
                <View style={cwStyles.todayBadge}>
                    <Text style={cwStyles.todayBadgeText}>{done} done today</Text>
                </View>
            </View>

            {/* Stat pills row */}
            <View style={cwStyles.pillRow}>
                {[
                    { label: 'Assigned', value: total,   color: '#1d4ed8', bg: '#dbeafe' },
                    { label: 'Pending',  value: pending, color: '#d97706', bg: '#fef3c7' },
                    { label: 'Done',     value: done,    color: '#16a34a', bg: '#dcfce7' },
                    { label: 'Not Paid', value: notPaid, color: '#dc2626', bg: '#fee2e2' },
                ].map(p => (
                    <View key={p.label} style={[cwStyles.pill, { backgroundColor: p.bg }]}>
                        <Text style={[cwStyles.pillValue, { color: p.color }]}>{p.value}</Text>
                        <Text style={[cwStyles.pillLabel, { color: p.color + 'bb' }]}>{p.label}</Text>
                    </View>
                ))}
            </View>

            {/* Amount row */}
            <View style={cwStyles.amtRow}>
                <View style={cwStyles.amtBox}>
                    <Text style={cwStyles.amtLabel}>Today Collected</Text>
                    <Text style={cwStyles.amtValue}>{fmtAmt(todayAmt)}</Text>
                </View>
                <View style={cwStyles.amtDivider} />
                <View style={cwStyles.amtBox}>
                    <Text style={cwStyles.amtLabel}>MTD Collected</Text>
                    <Text style={[cwStyles.amtValue, { color: '#16a34a' }]}>{fmtAmt(mtdAmt)}</Text>
                </View>
                <View style={cwStyles.amtDivider} />
                <View style={cwStyles.amtBox}>
                    <Icon name="chevron-right" size={16} color="#d32f2f" />
                    <Text style={[cwStyles.amtLabel, { color: '#d32f2f', fontWeight: '700' }]}>View All</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const cwStyles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginTop: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#fef2f2',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBox: {
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
    sub:   { fontSize: 10, color: '#94a3b8', marginTop: 1 },
    todayBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    todayBadgeText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
    pillRow: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        paddingVertical: 10,
        gap: 6,
    },
    pill: {
        flex: 1, alignItems: 'center', paddingVertical: 8,
        borderRadius: 10,
    },
    pillValue: { fontSize: 16, fontWeight: '800', lineHeight: 18 },
    pillLabel: { fontSize: 9, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
    amtRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingVertical: 10,
        paddingHorizontal: 10,
        alignItems: 'center',
    },
    amtBox: { flex: 1, alignItems: 'center' },
    amtLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
    amtValue: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginTop: 2 },
    amtDivider: { width: 1, height: 28, backgroundColor: '#e2e8f0' },
});

const IS_DEV = __DEV__;

const MapPreview = React.memo(({ points, mapRef }) => {
    const navigation = useNavigation();

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

    if (!points || points.length === 0) {
        return null;
    }

    const latestPoint = points[0];
    const startPoint = points[points.length - 1];

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

const StatCard = React.memo(({ icon, value, label, iconColor, bgColor, prefix = '', suffix = '', onPress }) => {
    const Container = onPress ? TouchableOpacity : View;
    return (
        <Container style={styles.statCard} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
            <View style={[styles.statIconContainer, { backgroundColor: bgColor }]}>
                <Icon name={icon} size={20} color={iconColor} />
            </View>
            <Text style={styles.statValue}>
                {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
            </Text>
            <Text style={styles.statLabel}>{label}</Text>
        </Container>
    );
});

const ActivitySection = React.memo(({ section, sectionIndex, onActivityPress, onRetry }) => (
    <View key={`section-${section.title}-${sectionIndex}`}>
        <SectionHeader title={section.title} count={section.data?.length || 0} />
        {(section.data || []).map((activity, idx) => (
            <ActivityCard
                key={`activity-${section.title}-${activity.id || activity.punched_at || idx}`}
                activity={activity}
                onPress={() => onActivityPress(activity)}
                onRetry={onRetry}
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
        punchState = STATES.IDLE,
    } = punchCtx;

    const getTotalDistance = punchCtx.getTotalDistance || (() => 0);
    const getTrackingDuration = punchCtx.getTrackingDuration || (() => 0);
    const refreshPunches = punchCtx.fetchTodayPunches || (() => {});
    const punchOut = punchCtx.punchOut || (async () => ({ success: false, error: 'Not available' }));
    const isPunchingOut = punchState === STATES.PUNCHING_OUT;
    
    const { logout = () => {}, user = null } = auth;
    const mapRef = useRef(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const [selectedFilter, setSelectedFilter] = useState('ALL');
    const [selectedMonth, setSelectedMonth] = useState(() => new Date());
    const [selectedActivity, setSelectedActivity] = useState(null);

    const [queuedItems, setQueuedItems] = useState([]);
    const prevQueueLengthRef = useRef(0);

    const todayStr = new Date().toISOString().slice(0, 10);

    // Six independent queries — react-query fires them in parallel the same
    // way the old Promise.all did, but each caches/revalidates on its own,
    // and the screen shows the last-known page instantly instead of blank
    // while useFocusEffect's refetch (below) is in flight.
    const summaryQuery = useApiQuery(['homeDailySummary'], () => api.get('/attendance/punches/daily_summary/'));
    const todayPunchesApiQuery = useApiQuery(
        ['homeTodayPunchesApi', todayStr],
        () => api.get('/attendance/punches/today_punches/'),
        { retry: 2 },
    );
    // getCorrectionCounts() already returns the counts object directly, not
    // an axios response — wrap it so useApiQuery's res.data unwrap still works.
    const correctionQuery = useApiQuery(['homeCorrectionCounts'], () => api.getCorrectionCounts().then((counts) => ({ data: counts })));
    const monthlyPerfQuery = useApiQuery(['homeMonthlyPerformance'], () => api.getPerformance('monthly'));
    const collectionStatsQuery = useApiQuery(['homeCollectionDashboardStats'], () => api.getCollectionDashboardStats());
    const collectionUpdatesQuery = useApiQuery(
        ['homeCollectionUpdatesToday', user?.id, todayStr],
        () => api.getCollectionUpdates({ updated_by: user?.id, date_from: todayStr, date_to: todayStr }),
        { enabled: !!user?.id, retry: 2 },
    );

    // Live mirror of the offline outbox — this IS the "Pending Sync" section
    // below, straight from the same queue OfflineBanner already reads, so a
    // queued visit/punch appears here the instant it's saved locally, not
    // once it happens to sync and a server refetch happens to pick it up.
    useEffect(() => subscribeOfflineQueue((items) => {
        // An item just left the queue (synced) — refetch the server-backed
        // activity sources immediately instead of waiting for the next
        // screen focus, so the just-synced record shows up in Previous
        // Activity right away rather than sitting invisible in the gap.
        if (items.length < prevQueueLengthRef.current) {
            todayPunchesApiQuery.refetch();
            collectionUpdatesQuery.refetch();
        }
        prevQueueLengthRef.current = items.length;
        setQueuedItems(items);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);

    const pendingSyncActivities = useMemo(
        () => queuedItems.map(activityFromQueueItem),
        [queuedItems],
    );

    const handleRetryQueueItem = useCallback((queueId) => {
        if (queueId) retryOfflineQueueItem(queueId);
    }, []);

    // Total Visits — see CollectionUpdateViewSet.visit_summary(). Scoped to
    // "today" by default, same as the rest of this screen; role-scoping to
    // this employee's own activity happens server-side, never trusting a
    // client-supplied employee id.
    const visitSummaryQuery = useApiQuery(
        ['homeVisitSummary', todayStr],
        () => api.getVisitSummary({ date_from: todayStr, date_to: todayStr }),
    );
    const {
        data: monthlyTarget,
        isLoading: monthlyTargetLoading,
        refetch: refetchMonthlyTarget,
    } = useApiQuery(['monthlyTarget', MONTH_KEY(selectedMonth)], () => api.getMonthlyTarget(MONTH_KEY(selectedMonth)));

    const isLoading = summaryQuery.isLoading || todayPunchesApiQuery.isLoading || correctionQuery.isLoading;
    const isRefreshing = summaryQuery.isFetching && !summaryQuery.isLoading;

    // react-query keeps showing the last good cached result on a failed
    // background refetch (retry exhausted) rather than clearing it — which
    // is the right call for a field agent's flaky signal, but it means a
    // punch/visit made after the last successful fetch can go missing from
    // this list with nothing telling the employee it might be incomplete.
    // Surface that instead of rendering a confidently-stale snapshot.
    const activityMayBeStale = todayPunchesApiQuery.isError || collectionUpdatesQuery.isError;
    const retryActivityFetch = useCallback(() => {
        todayPunchesApiQuery.refetch();
        collectionUpdatesQuery.refetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const summary = useMemo(() => summaryQuery.data || {}, [summaryQuery.data]);
    const correctionSummary = useMemo(() => correctionQuery.data || {}, [correctionQuery.data]);
    const monthlyCollection = Number(monthlyPerfQuery.data?.total_collection_amount) || 0;
    const collectionStats = collectionStatsQuery.data || null;
    const visitSummary = visitSummaryQuery.data || null;

    // Field activity (e.g. a collection outcome update) doesn't always
    // happen inside an explicit punch-tracked GPS session — shape each
    // update to look like a punch so mapApiResponseToActivities' own
    // visit_type dispatch (see models/ActivityModel.js) picks it up as a
    // COLLECTION activity without needing any changes there.
    const punches = useMemo(() => {
        const livePunches = todayPunchesApiQuery.data?.results || todayPunchesApiQuery.data || [];
        const todayCollectionActivities = (collectionUpdatesQuery.data?.results || collectionUpdatesQuery.data || [])
            .map(c => ({
                id: `coll-${c.id}`,
                visit_type: 'COLLECTION',
                punched_at: c.created_at,
                current_address: c.location_address,
                latitude: c.latitude,
                longitude: c.longitude,
                total_amount: c.collected_amount,
                client_name: c.customer_name,
                reason: c.remarks || c.status_display,
                // The unified Collection Visit flow (complete_visit) creates
                // both this CollectionUpdate AND a PUNCH_IN AttendancePunch
                // for the same real-world visit — c.punch links back to it
                // so allPunches (below) can drop that raw punch instead of
                // showing the same visit as two separate activity rows.
                linked_punch_id: c.punch,
            }));
        return [...livePunches, ...todayCollectionActivities];
    }, [todayPunchesApiQuery.data, collectionUpdatesQuery.data]);

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

    // Re-fetch everything whenever the Home tab regains focus — matches the
    // original fetchData/fetchMonthlyTarget behavior exactly, just via
    // react-query's refetch() instead of a hand-rolled Promise.all. Data
    // fetched here already had the 1s debounce lastFetchRef used to guard
    // against — react-query's own in-flight-request dedup makes that guard
    // unnecessary (a second refetch while one is already pending is a no-op).
    useFocusEffect(useCallback(() => {
        summaryQuery.refetch();
        todayPunchesApiQuery.refetch();
        correctionQuery.refetch();
        monthlyPerfQuery.refetch();
        collectionStatsQuery.refetch();
        collectionUpdatesQuery.refetch();
        visitSummaryQuery.refetch();
        refetchMonthlyTarget();
        refreshPunches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshPunches]));

    const changeMonth = useCallback((delta) => {
        setSelectedMonth((prev) => {
            const next = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
            // Never navigate past the current month — the backend would
            // correctly return zero data for a genuine future month, but
            // there is nothing useful to show ahead of "now" here.
            if (delta > 0 && next > new Date()) return prev;
            return next;
        });
    }, []);

    const onRefresh = useCallback(() => {
        summaryQuery.refetch();
        todayPunchesApiQuery.refetch();
        correctionQuery.refetch();
        monthlyPerfQuery.refetch();
        collectionStatsQuery.refetch();
        collectionUpdatesQuery.refetch();
        visitSummaryQuery.refetch();
        refetchMonthlyTarget();
        refreshPunches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshPunches]);

    // Mirrors EmployeePunchScreen.handlePunchOutPress — punchOut() needs no
    // form/location pre-fetch of its own (it captures GPS internally and
    // degrades gracefully to the last known fix), so a single confirm-then-call
    // is all that's needed here too.
    const handlePunchOutPress = useCallback(() => {
        Alert.alert(
            'Punch Out',
            'Are you sure you want to punch out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Punch Out',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await punchOut();
                        if (!result.success) {
                            Alert.alert('Error', result.error || 'Failed to punch out.');
                        }
                    },
                },
            ]
        );
    }, [punchOut]);

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

    // Live distance — polls LocationService every 3 s while tracking is active
    const [liveDistance, setLiveDistance] = useState(() => getTotalDistance());
    useEffect(() => {
        const d = getTotalDistance();
        setLiveDistance(d);
        if (!isActive && !isTracking) return;
        const t = setInterval(() => setLiveDistance(getTotalDistance()), 3000);
        return () => clearInterval(t);
    }, [isActive, isTracking, getTotalDistance]);

    const statsData = useMemo(() => {
        // When tracking is active, GPS live distance is more accurate than the
        // backend punch-to-punch value (which only counts straight lines between punches).
        const distanceValue = (isActive || isTracking)
            ? parseFloat((liveDistance || 0).toFixed(2))
            : parseFloat((summary?.total_distance_today || 0).toFixed(2));

        return [
            { id: 'distance', icon: 'navigation', value: distanceValue, label: 'Distance', iconColor: colors.info, bgColor: colors.infoLight, suffix: ' km' },
            { id: 'punches', icon: 'check-circle', value: summary?.punch_count || 0, label: 'Punches', iconColor: colors.success, bgColor: colors.successLight, onPress: () => navigation.navigate('PunchHistory') },
            {
                id: 'collected', icon: 'dollar-sign', label: 'Collected',
                iconColor: colors.warning, bgColor: colors.warningLight, prefix: '₹',
                // Combined: collection-record updates + direct punch collections.
                // Fall back to the attendance daily_summary when dashboard_stats not yet loaded.
                value: collectionStats
                    ? (collectionStats.today?.amount ?? 0)
                    : (summary?.total_collection ?? 0),
                onPress: () => navigation.navigate('CollectionDone'),
            },
            {
                id: 'total_visits', icon: 'map-pin', label: 'Total Visits',
                iconColor: colors.danger, bgColor: colors.dangerLight,
                value: visitSummary?.total_visits || 0,
                onPress: () => navigation.navigate('VisitActivitySummary'),
            },
        ];
    }, [summary, isActive, isTracking, liveDistance, collectionStats, visitSummary, navigation]);

    const correctionCounts = useMemo(() => ({
        pending: correctionSummary?.pending || 0,
        approved: correctionSummary?.approved || 0,
        rejected: correctionSummary?.rejected || 0,
    }), [correctionSummary]);

    const allPunches = useMemo(() => {
        // Drop any raw punch already represented by its own CollectionUpdate-
        // derived activity entry (see linked_punch_id above) — without this,
        // a single Collection Visit shows up as two rows: the punch itself
        // (from today_punches / PunchContext) and its collection outcome.
        const linkedPunchIds = new Set(
            (punches || []).filter(p => p?.linked_punch_id).map(p => p.linked_punch_id)
        );
        const combined = [...(punches || []), ...(todayPunches || [])]
            .filter(p => !linkedPunchIds.has(p?.id));
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

            <DailyPunchPrompt />

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

                        <TouchableOpacity
                            style={[styles.homePunchOutBtn, isPunchingOut && styles.homePunchOutBtnDisabled]}
                            onPress={handlePunchOutPress}
                            disabled={isPunchingOut}
                            activeOpacity={0.85}
                        >
                            {isPunchingOut ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Icon name="log-out" size={18} color="#fff" />
                                    <Text style={styles.homePunchOutBtnText}>Punch Out</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={styles.trackingStatsRow}>
                            <View style={styles.miniStat}>
                                <Icon name="navigation" size={16} color={colors.primary} />
                                <Text style={styles.miniStatValue}>{formatDistance(liveDistance)}</Text>
                            </View>
                            <View style={styles.miniStatDivider} />
                            <View style={styles.miniStat}>
                                <Icon name="clock" size={16} color={colors.warning} />
                                <Text style={styles.miniStatValue}>{formatDuration(duration)}</Text>
                            </View>
                        </View>
                    </>
                )}

                {correctionCounts.total > 0 && (
                    <View style={styles.correctionWidget}>
                        <View style={styles.correctionHeader}>
                            <Icon name="edit-3" size={16} color={colors.text} />
                            <Text style={styles.correctionTitle}>My Requests</Text>
                        </View>
                        <View style={styles.correctionStats}>
                            <View style={styles.correctionStat}>
                                <Text style={styles.correctionCount}>{correctionCounts.pending}</Text>
                                <Text style={[styles.correctionLabel, { color: colors.warning }]}>Pending</Text>
                            </View>
                            <View style={styles.correctionStat}>
                                <Text style={styles.correctionCount}>{correctionCounts.approved}</Text>
                                <Text style={[styles.correctionLabel, { color: colors.success }]}>Approved</Text>
                            </View>
                            <View style={styles.correctionStat}>
                                <Text style={styles.correctionCount}>{correctionCounts.rejected}</Text>
                                <Text style={[styles.correctionLabel, { color: colors.danger }]}>Rejected</Text>
                            </View>
                        </View>
                    </View>
                )}

                {isLoading ? (
                    <SkeletonStatsGrid style={{ marginBottom: spacing.md }} />
                ) : (
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
                )}

                {/* ── Collection Stats Widget ── */}
                <CollectionWidget
                    stats={collectionStats}
                    onPress={() => navigation.navigate('EmployeeCollections')}
                />

                {/* ── Analytics Chart (Zoho) — commented out, not deleted, per request ──
                <TouchableOpacity
                    style={styles.chartCard}
                    activeOpacity={0.85}
                    onPress={() => Linking.openURL(ZOHO_CHART_URL)}
                >
                    <View style={styles.chartHeader}>
                        <Icon name="bar-chart-2" size={16} color={colors.primary} />
                        <Text style={styles.chartTitle}>Analytics Overview</Text>
                        <View style={{ flex: 1 }} />
                        <Icon name="external-link" size={14} color={colors.textMuted} />
                    </View>
                    <View style={styles.chartPreview}>
                        <View style={styles.chartPreviewIcon}>
                            <Icon name="trending-up" size={36} color={colors.primary} />
                        </View>
                        <Text style={styles.chartPreviewText}>Tap to open Zoho Analytics Dashboard</Text>
                        <View style={styles.chartPreviewBtn}>
                            <Icon name="bar-chart-2" size={13} color="#fff" />
                            <Text style={styles.chartPreviewBtnText}>View Full Report</Text>
                        </View>
                    </View>
                </TouchableOpacity>
                */}

                <MonthlyCollectionCard
                    collected={monthlyTarget?.monthly_collected ?? (collectionStats?.mtd?.amount ?? monthlyCollection)}
                    target={monthlyTarget?.monthly_target ?? 0}
                    achievementPct={monthlyTarget?.achievement_percentage ?? 0}
                    remainingAmt={monthlyTarget?.remaining_amount ?? 0}
                    excessAmt={monthlyTarget?.excess_amount ?? 0}
                    monthLabel={selectedMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                    onPrevMonth={() => changeMonth(-1)}
                    onNextMonth={() => changeMonth(1)}
                    canGoNext={!isSameMonth(selectedMonth, new Date())}
                    loading={monthlyTargetLoading}
                />

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

                    {activityMayBeStale && (
                        <View style={styles.staleBanner}>
                            <Text style={styles.staleBannerText}>
                                Couldn't refresh — showing last known activity
                            </Text>
                            <TouchableOpacity onPress={retryActivityFetch} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Text style={styles.staleBannerRetry}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <ActivityFilterBar
                        selectedFilter={selectedFilter}
                        onFilterChange={handleFilterChange}
                    />

                    {pendingSyncActivities.length > 0 && (
                        <ActivitySection
                            section={{ title: 'Pending Sync', data: pendingSyncActivities }}
                            sectionIndex={-1}
                            onActivityPress={setSelectedActivity}
                            onRetry={handleRetryQueueItem}
                        />
                    )}

                    {isLoading ? (
                        <View>
                            {[1, 2, 3].map(i => (
                                <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
                            ))}
                        </View>
                    ) : activities.length === 0 ? (
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
                                onActivityPress={setSelectedActivity}
                            />
                        ))
                    )}
                </View>
            </ScrollView>

            <ActivityDetailModal
                activity={selectedActivity}
                visible={!!selectedActivity}
                onClose={() => setSelectedActivity(null)}
            />
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
    homePunchOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E53935',
        paddingVertical: spacing.sm,
        borderRadius: 12,
        marginTop: spacing.sm,
        gap: spacing.xs,
        ...shadows.sm,
    },
    homePunchOutBtnDisabled: {
        opacity: 0.6,
    },
    homePunchOutBtnText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.bold,
        color: '#fff',
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
    chartCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    chartHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.xs,
    },
    chartTitle: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    chartPreview: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    chartPreviewIcon: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    chartPreviewText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        textAlign: 'center',
    },
    chartPreviewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        marginTop: spacing.xs,
        gap: spacing.xs,
    },
    chartPreviewBtnText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: '#fff',
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
    staleBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.warningLight,
        borderRadius: 10,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
    },
    staleBannerText: {
        flex: 1,
        fontSize: typography.sizes.xs,
        color: colors.textDark,
        marginRight: spacing.sm,
    },
    staleBannerRetry: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.semibold,
        color: colors.warning,
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
    correctionWidget: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        marginTop: spacing.sm,
    },
    correctionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    correctionTitle: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
        color: colors.text,
        marginLeft: spacing.sm,
    },
    correctionStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    correctionStat: {
        alignItems: 'center',
    },
    correctionCount: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.text,
    },
    correctionLabel: {
        fontSize: typography.sizes.xs,
        marginTop: 2,
    },
});

// ─── Monthly collection card styles ──────────────────────────────────────────
const homeStyles = StyleSheet.create({
    mcCard: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: spacing.md,
        marginTop: spacing.md,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    mcHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    mcHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    mcIconBox: {
        width: 30,
        height: 30,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mcTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.textDark,
    },
    mcMonth: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 1,
    },
    mcMonthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 1,
    },
    mcBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    mcBadgeText: {
        fontSize: 13,
        fontWeight: '800',
    },
    mcBody: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    mcRingCenter: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mcRingValue: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    mcRingSub: {
        fontSize: 10,
        color: colors.textMuted,
        marginTop: 1,
    },
    mcStats: {
        flex: 1,
        gap: 6,
    },
    mcStatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    mcDot: {
        width: 9,
        height: 9,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    mcStatLabel: {
        fontSize: 11,
        color: colors.textMuted,
    },
    mcStatVal: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.textDark,
        marginTop: 1,
    },
    mcDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginLeft: spacing.md + 2,
    },
    mcStrip: {
        height: 5,
        backgroundColor: colors.border,
        borderRadius: 4,
        marginTop: spacing.md,
        overflow: 'hidden',
    },
    mcStripFill: {
        height: '100%',
        borderRadius: 4,
        minWidth: 4,
    },
    mcStripLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    mcStripLabel: {
        fontSize: 10,
        color: colors.textMuted,
    },
});

export default EmployeeHomeScreen;
