import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';

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
    const [allPunches, setAllPunches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const isTodayActive = toDateStr(activeDate) === toDateStr(new Date());

    const fetchPunches = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const dateStr = toDateStr(activeDate);
            const params = { date_from: dateStr, date_to: dateStr };
            if (employeeId) params.employee_id = employeeId;

            const res = await api.get('/attendance/punches/', { params });
            const raw = Array.isArray(res.data)
                ? res.data
                : Array.isArray(res.data?.results)
                ? res.data.results
                : [];

            // Oldest first for chronological path
            const sorted = [...raw].sort(
                (a, b) => new Date(a.punched_at) - new Date(b.punched_at)
            );
            setAllPunches(sorted);
        } catch (err) {
            setError('Failed to load punch data. Pull down to retry.');
        } finally {
            setLoading(false);
        }
    }, [activeDate, employeeId]);

    useEffect(() => {
        fetchPunches();
    }, [fetchPunches]);

    const mappablePunches = allPunches.filter(
        (p) =>
            p.latitude != null &&
            p.longitude != null &&
            parseFloat(p.latitude) !== 0 &&
            parseFloat(p.longitude) !== 0
    );

    const coordinates = mappablePunches.map((p) => ({
        latitude: parseFloat(p.latitude),
        longitude: parseFloat(p.longitude),
    }));

    const getMapRegion = () => {
        if (coordinates.length === 0) {
            return { latitude: 23.0225, longitude: 72.5714, latitudeDelta: 0.1, longitudeDelta: 0.1 };
        }
        if (coordinates.length === 1) {
            return { ...coordinates[0], latitudeDelta: 0.01, longitudeDelta: 0.01 };
        }
        const lats = coordinates.map((c) => c.latitude);
        const lngs = coordinates.map((c) => c.longitude);
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

    // Latest punch = last item (sorted oldest→newest)
    const latestMappable = mappablePunches.length > 0
        ? mappablePunches[mappablePunches.length - 1]
        : null;

    const goToLatest = () => {
        if (!latestMappable) return;
        mapRef.current?.animateToRegion(
            {
                latitude: parseFloat(latestMappable.latitude),
                longitude: parseFloat(latestMappable.longitude),
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            },
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
                <TouchableOpacity onPress={fetchPunches} style={styles.refreshBtn}>
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
                        if (coordinates.length > 1) {
                            mapRef.current?.fitToCoordinates(coordinates, {
                                edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                                animated: true,
                            });
                        }
                    }}
                >
                    {/* Polyline connecting all punch locations */}
                    {coordinates.length > 1 && (
                        <Polyline
                            coordinates={coordinates}
                            strokeColor={colors.primary}
                            strokeWidth={3}
                        />
                    )}

                    {/* Numbered punch markers */}
                    {mappablePunches.map((punch, idx) => (
                        <Marker
                            key={String(punch.id)}
                            coordinate={{
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

                {coordinates.length > 1 && !loading && (
                    <TouchableOpacity
                        style={styles.fitBtn}
                        onPress={() =>
                            mapRef.current?.fitToCoordinates(coordinates, {
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
                {latestMappable && !loading && (
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
                        <Text style={[styles.statVal, { color: PUNCH_COLORS.COLLECTION }]}>
                            {allPunches.filter(
                                (p) => p.punch_type === 'COLLECTION' || p.punch_type === 'DISBURSEMENT'
                            ).length}
                        </Text>
                        <Text style={styles.statLbl}>Collection</Text>
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
