import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    ScrollView,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';
import { filterGpsOutliers, calcTotalDistanceKm } from '../../utils/gpsUtils';

const { height } = Dimensions.get('window');

const PUNCH_COLORS = {
    PUNCH_IN: '#22C55E',
    PUNCH_OUT: '#EF4444',
    COLLECTION: '#3B82F6',
    DISBURSEMENT: '#8B5CF6',
};

const PUNCH_LABELS = {
    PUNCH_IN: 'Punch In',
    PUNCH_OUT: 'Punch Out',
    COLLECTION: 'Collection',
    DISBURSEMENT: 'Disbursement',
};

const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const punchColor = (type) => PUNCH_COLORS[type] ?? '#9CA3AF';
const punchLabel = (type) => PUNCH_LABELS[type] ?? type;

const RouteMapScreen = ({ navigation, route }) => {
    const mapRef = useRef(null);
    const employeeId = route?.params?.employeeId ?? null;
    const employeeName = route?.params?.employeeName ?? null;

    const initialDate = route?.params?.date ? new Date(route.params.date) : new Date();
    const [activeDate, setActiveDate] = useState(initialDate);
    const [allPunches,  setAllPunches]  = useState([]);
    const [gpsRoute,    setGpsRoute]    = useState([]);   // actual 10-s GPS track
    const [routeDist,   setRouteDist]   = useState(null); // km, outlier-filtered
    const [loading,     setLoading]     = useState(true);
    const [refreshing,  setRefreshing]  = useState(false);
    const [error,       setError]       = useState(null);

    const isTodayActive = toDateStr(activeDate) === toDateStr(new Date());

    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        setError(null);
        try {
            const dateStr = toDateStr(activeDate);
            const punchParams = { date_from: dateStr, date_to: dateStr };
            if (employeeId) punchParams.employee_id = employeeId;

            const liveParams = { date: dateStr };
            if (employeeId) liveParams.employee_id = employeeId;

            const collectionParams = { date_from: dateStr, date_to: dateStr };
            if (employeeId) collectionParams.updated_by = employeeId;

            // Run all requests in parallel
            const [punchRes, liveRes, collectionRes] = await Promise.allSettled([
                api.get('/attendance/punches/', { params: punchParams }),
                api.getLiveDailyRoute(liveParams),
                api.getCollectionUpdates(collectionParams),
            ]);

            // ── Punch records (markers) ───────────────────────────────────────
            if (punchRes.status === 'fulfilled') {
                const raw = Array.isArray(punchRes.value.data)
                    ? punchRes.value.data
                    : Array.isArray(punchRes.value.data?.results)
                    ? punchRes.value.data.results
                    : [];

                // Field activity (e.g. a collection outcome update) doesn't
                // always happen inside an explicit punch-tracked GPS session
                // — shape each update to look like a punch (this screen's own
                // punch_type-based coloring/labeling, see PUNCH_COLORS above,
                // already has a COLLECTION entry) so it's never silently
                // dropped from the route/list just because no punch exists.
                const rawCollections = collectionRes.status === 'fulfilled'
                    ? (collectionRes.value.data?.results || collectionRes.value.data || [])
                    : [];
                const collectionActivities = rawCollections.map(c => ({
                    id: `coll-${c.id}`,
                    punch_type: 'COLLECTION',
                    punched_at: c.created_at,
                    current_address: c.location_address,
                    latitude: c.latitude,
                    longitude: c.longitude,
                    amount: c.collected_amount,
                    customer_name: c.customer_name,
                    reason: c.remarks || c.status_display,
                }));

                setAllPunches(
                    [...raw, ...collectionActivities].sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at))
                );
            }

            // ── Actual GPS track (polyline) ───────────────────────────────────
            if (liveRes.status === 'fulfilled') {
                const rawPoints = liveRes.value.data?.route || [];
                // Speed-based outlier filter (>120 km/h → drop the point)
                const clean = filterGpsOutliers(rawPoints);
                setGpsRoute(clean);
                setRouteDist(calcTotalDistanceKm(clean));
            }
        } catch {
            setError('Failed to load route data. Pull down to retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeDate, employeeId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const onRefresh = useCallback(() => fetchData(true), [fetchData]);

    // Punch markers — only those with valid GPS
    const mappablePunches = allPunches.filter(
        (p) =>
            p.latitude != null &&
            p.longitude != null &&
            parseFloat(p.latitude) !== 0 &&
            parseFloat(p.longitude) !== 0
    );

    // The true GPS track converted to react-native-maps coordinate format
    const gpsCoordinates = useMemo(() =>
        gpsRoute.map((p) => ({ latitude: Number(p.lat ?? p.latitude), longitude: Number(p.lon ?? p.lng ?? p.longitude) })),
        [gpsRoute]
    );

    // Fallback: if live track unavailable, connect punch markers
    const punchCoordinates = mappablePunches.map((p) => ({
        latitude: parseFloat(p.latitude),
        longitude: parseFloat(p.longitude),
    }));

    // Coordinates used to fit the map view
    const allCoordinates = gpsCoordinates.length > 0 ? gpsCoordinates : punchCoordinates;

    // Several punches often share (near-)identical GPS — e.g. a few quick
    // back-to-back check-ins without moving — which would otherwise stack
    // exactly on top of each other with only the last one visible. Spread
    // same-spot markers into a small ring purely for on-map visibility; the
    // callout still shows each punch's real captured address/time, and every
    // other calculation (distance, polyline, fit-bounds) keeps using the
    // true, un-offset coordinates above.
    const markerPositions = useMemo(() => {
        const groups = new Map();
        punchCoordinates.forEach((c, idx) => {
            const key = `${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(idx);
        });

        const positions = new Array(punchCoordinates.length);
        groups.forEach((indices) => {
            const n = indices.length;
            if (n === 1) {
                positions[indices[0]] = punchCoordinates[indices[0]];
                return;
            }
            const { latitude: baseLat, longitude: baseLng } = punchCoordinates[indices[0]];
            const radiusMeters = 10 + Math.min(n, 8) * 2;
            const latOffset = radiusMeters / 111320;
            const lngOffset = radiusMeters / (111320 * Math.cos(baseLat * Math.PI / 180) || 1);
            indices.forEach((idx, i) => {
                const angle = (2 * Math.PI * i) / n;
                positions[idx] = {
                    latitude: baseLat + latOffset * Math.sin(angle),
                    longitude: baseLng + lngOffset * Math.cos(angle),
                };
            });
        });
        return positions;
    }, [punchCoordinates]);

    const getMapRegion = () => {
        if (allCoordinates.length === 0) {
            return { latitude: 23.0225, longitude: 72.5714, latitudeDelta: 0.1, longitudeDelta: 0.1 };
        }
        if (allCoordinates.length === 1) {
            return { ...allCoordinates[0], latitudeDelta: 0.01, longitudeDelta: 0.01 };
        }
        const lats = allCoordinates.map((c) => c.latitude);
        const lngs = allCoordinates.map((c) => c.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.6),
            longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.6),
        };
    };

    const shiftDate = (delta) => {
        setActiveDate((d) => {
            const next = new Date(d);
            next.setDate(next.getDate() + delta);
            return next;
        });
    };

    const formatDate = (d) =>
        d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const formatTime = (ts) =>
        ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

    // Latest known location: prefer last GPS track point, fall back to last punch
    const latestGpsPt  = gpsCoordinates.length > 0 ? gpsCoordinates[gpsCoordinates.length - 1] : null;
    const latestMappable = mappablePunches.length > 0
        ? mappablePunches[mappablePunches.length - 1]
        : null;

    const goToLatest = () => {
        const target = latestGpsPt ?? (latestMappable
            ? { latitude: parseFloat(latestMappable.latitude), longitude: parseFloat(latestMappable.longitude) }
            : null);
        if (!target) return;
        mapRef.current?.animateToRegion(
            { ...target, latitudeDelta: 0.005, longitudeDelta: 0.005 },
            600
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {employeeName ? employeeName : 'Route Map'}
                </Text>
                <TouchableOpacity onPress={() => fetchData()} style={styles.refreshBtn}>
                    <Icon name="refresh-cw" size={20} color={loading ? colors.border : colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Date Navigator */}
            <View style={styles.dateNav}>
                <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.navArrow}>
                    <Icon name="chevron-left" size={22} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveDate(new Date())}
                    style={styles.datePill}
                    activeOpacity={0.7}
                >
                    <Icon name="calendar" size={13} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.datePillText}>
                        {isTodayActive ? 'Today' : formatDate(activeDate)}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => { if (!isTodayActive) shiftDate(1); }}
                    style={[styles.navArrow, isTodayActive && styles.disabledArrow]}
                    disabled={isTodayActive}
                >
                    <Icon
                        name="chevron-right"
                        size={22}
                        color={isTodayActive ? colors.border : colors.primary}
                    />
                </TouchableOpacity>
            </View>

            {/* Map */}
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={getMapRegion()}
                    onMapReady={() => {
                        if (allCoordinates.length > 1) {
                            mapRef.current?.fitToCoordinates(allCoordinates, {
                                edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                                animated: true,
                            });
                        }
                    }}
                >
                    {/* Actual GPS track — drawn from live tracking points (10 s intervals) */}
                    {gpsCoordinates.length > 1 && (
                        <Polyline
                            coordinates={gpsCoordinates}
                            strokeColor={colors.primary}
                            strokeWidth={3}
                            lineDashPattern={undefined}
                        />
                    )}

                    {/* Fallback: connect punch markers when GPS track unavailable */}
                    {gpsCoordinates.length < 2 && punchCoordinates.length > 1 && (
                        <Polyline
                            coordinates={punchCoordinates}
                            strokeColor={colors.primary}
                            strokeWidth={2}
                            lineDashPattern={[6, 4]}
                        />
                    )}

                    {/* Numbered punch markers */}
                    {mappablePunches.map((punch, idx) => (
                        <Marker
                            key={String(punch.id)}
                            coordinate={markerPositions[idx] || {
                                latitude: parseFloat(punch.latitude),
                                longitude: parseFloat(punch.longitude),
                            }}
                        >
                            <View style={[styles.pin, { borderColor: punchColor(punch.punch_type) }]}>
                                <View
                                    style={[
                                        styles.pinCore,
                                        { backgroundColor: punchColor(punch.punch_type) },
                                    ]}
                                >
                                    <Text style={styles.pinText}>{idx + 1}</Text>
                                </View>
                            </View>
                            <Callout tooltip>
                                <View style={styles.callout}>
                                    <Text style={[styles.calloutType, { color: punchColor(punch.punch_type) }]}>
                                        {punchLabel(punch.punch_type)}
                                    </Text>
                                    <Text style={styles.calloutTime}>{formatTime(punch.punched_at)}</Text>
                                    {punch.customer_name ? (
                                        <Text style={styles.calloutDetail}>{punch.customer_name}</Text>
                                    ) : null}
                                    {punch.current_address ? (
                                        <Text style={styles.calloutAddr} numberOfLines={2}>
                                            {punch.current_address}
                                        </Text>
                                    ) : null}
                                </View>
                            </Callout>
                        </Marker>
                    ))}
                </MapView>

                {loading && (
                    <View style={styles.mapLoadOverlay}>
                        <ActivityIndicator color={colors.primary} size="small" />
                    </View>
                )}

                {allCoordinates.length > 1 && !loading && (
                    <TouchableOpacity
                        style={styles.fitBtn}
                        onPress={() =>
                            mapRef.current?.fitToCoordinates(allCoordinates, {
                                edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                                animated: true,
                            })
                        }
                        activeOpacity={0.8}
                    >
                        <Icon name="maximize-2" size={18} color={colors.primary} />
                    </TouchableOpacity>
                )}

                {/* Go-to-latest button — like Google Maps location button */}
                {(latestGpsPt || latestMappable) && !loading && (
                    <TouchableOpacity
                        style={styles.latestBtn}
                        onPress={goToLatest}
                        activeOpacity={0.8}
                    >
                        <View style={styles.latestBtnInner}>
                            <Icon name="navigation" size={20} color="#fff" />
                        </View>
                        <Text style={styles.latestBtnLabel}>Latest</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Summary + Punch List */}
            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                }
            >
                {/* Stats row */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statVal}>{allPunches.length}</Text>
                        <Text style={styles.statLbl}>Total</Text>
                    </View>
                    <View style={[styles.statItem, styles.statDivider]}>
                        <Text style={[styles.statVal, { color: PUNCH_COLORS.PUNCH_IN }]}>
                            {allPunches.filter((p) => p.punch_type === 'PUNCH_IN').length}
                        </Text>
                        <Text style={styles.statLbl}>Punch In</Text>
                    </View>
                    <View style={[styles.statItem, styles.statDivider]}>
                        <Text style={[styles.statVal, { color: PUNCH_COLORS.PUNCH_OUT }]}>
                            {allPunches.filter((p) => p.punch_type === 'PUNCH_OUT').length}
                        </Text>
                        <Text style={styles.statLbl}>Punch Out</Text>
                    </View>
                    <View style={[styles.statItem, styles.statDivider]}>
                        <Text style={[styles.statVal, { color: '#7b1fa2', fontSize: 14 }]}>
                            {routeDist != null ? `${routeDist}` : '—'}
                        </Text>
                        <Text style={styles.statLbl}>km</Text>
                    </View>
                </View>

                {error ? (
                    <View style={styles.errorRow}>
                        <Icon name="alert-circle" size={15} color={colors.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : !loading && allPunches.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Icon name="map-pin" size={36} color={colors.border} />
                        <Text style={styles.emptyText}>No punches recorded on this date</Text>
                    </View>
                ) : (
                    allPunches.map((punch, idx) => (
                        <View key={String(punch.id)} style={styles.punchRow}>
                            {/* Number badge with colour coding */}
                            <View
                                style={[
                                    styles.punchBadge,
                                    { backgroundColor: punchColor(punch.punch_type) },
                                ]}
                            >
                                <Text style={styles.punchBadgeText}>{idx + 1}</Text>
                            </View>

                            {/* Punch details */}
                            <View style={styles.punchInfo}>
                                <View style={styles.punchTopRow}>
                                    <Text
                                        style={[
                                            styles.punchType,
                                            { color: punchColor(punch.punch_type) },
                                        ]}
                                    >
                                        {punchLabel(punch.punch_type)}
                                    </Text>
                                    <Text style={styles.punchTime}>
                                        {formatTime(punch.punched_at)}
                                    </Text>
                                </View>
                                {punch.customer_name ? (
                                    <Text style={styles.punchCustomer}>{punch.customer_name}</Text>
                                ) : null}
                                {punch.current_address ? (
                                    <Text style={styles.punchAddr} numberOfLines={1}>
                                        {punch.current_address}
                                    </Text>
                                ) : null}
                                {(!punch.latitude || !punch.longitude ||
                                    parseFloat(punch.latitude) === 0) ? (
                                    <Text style={styles.noGps}>No GPS recorded</Text>
                                ) : null}
                            </View>

                            {/* Connector line between rows */}
                            {idx < allPunches.length - 1 && (
                                <View style={styles.connector} />
                            )}
                        </View>
                    ))
                )}
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: { padding: spacing.xs },
    refreshBtn: { padding: spacing.xs },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },

    // Date navigator
    dateNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    navArrow: {
        padding: spacing.sm,
    },
    disabledArrow: {
        opacity: 0.3,
    },
    datePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 20,
        backgroundColor: `${colors.primary}12`,
        gap: 4,
    },
    datePillText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.primary,
    },

    // Map
    mapContainer: {
        height: height * 0.38,
        width: '100%',
        backgroundColor: '#e8e8e8',
    },
    map: {
        flex: 1,
    },
    mapLoadOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fitBtn: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        backgroundColor: '#fff',
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    latestBtn: {
        position: 'absolute',
        bottom: spacing.md,
        right: spacing.md,
        alignItems: 'center',
    },
    latestBtnInner: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    latestBtnLabel: {
        fontSize: 10,
        color: colors.primary,
        fontWeight: '600',
        marginTop: 3,
    },

    // Custom map pin
    pin: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinCore: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },

    // Callout tooltip
    callout: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 10,
        minWidth: 140,
        maxWidth: 220,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    calloutType: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 2,
    },
    calloutTime: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: 2,
    },
    calloutDetail: {
        fontSize: 11,
        color: colors.textDark,
        marginBottom: 2,
    },
    calloutAddr: {
        fontSize: 11,
        color: colors.textMuted,
    },

    // Punch list
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
    },

    // Stats row
    statsRow: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 14,
        marginBottom: spacing.md,
        overflow: 'hidden',
        elevation: 1,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    statDivider: {
        borderLeftWidth: 1,
        borderLeftColor: colors.border,
    },
    statVal: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    statLbl: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },

    // Error / empty
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff0f0',
        borderRadius: 10,
        padding: spacing.md,
        gap: 8,
    },
    errorText: {
        fontSize: typography.sizes.sm,
        color: colors.danger,
        flex: 1,
    },
    emptyBox: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
        gap: spacing.sm,
    },
    emptyText: {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
    },

    // Punch row
    punchRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.xs,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
    },
    punchBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
        marginTop: 1,
    },
    punchBadgeText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    punchInfo: {
        flex: 1,
    },
    punchTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    punchType: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
    },
    punchTime: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    punchCustomer: {
        fontSize: typography.sizes.sm,
        color: colors.textDark,
        marginTop: 2,
    },
    punchAddr: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    noGps: {
        fontSize: typography.sizes.xs,
        color: colors.border,
        marginTop: 2,
        fontStyle: 'italic',
    },
    connector: {
        position: 'absolute',
        left: spacing.md + 15,
        bottom: -spacing.xs,
        width: 1,
        height: spacing.xs,
        backgroundColor: colors.border,
    },
});

export default RouteMapScreen;
