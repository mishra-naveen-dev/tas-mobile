import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    ScrollView,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';
import { filterGpsOutliers } from '../../utils/gpsUtils';

const { height } = Dimensions.get('window');

// ─── Activity type config ─────────────────────────────────────────────────────
const ACTIVITY_TYPES = {
    PUNCH_IN:        { icon: 'log-in',       color: '#22C55E', label: 'Punch In',          bgColor: '#D1FAE5' },
    PUNCH_OUT:       { icon: 'log-out',      color: '#EF4444', label: 'Punch Out',         bgColor: '#FEE2E2' },
    COLLECTION_VISIT:{ icon: 'dollar-sign',  color: '#3B82F6', label: 'Collection Visit',  bgColor: '#DBEAFE' },
    DISBURSEMENT:    { icon: 'trending-up',  color: '#8B5CF6', label: 'Disbursement',      bgColor: '#EDE9FE' },
};

const getStatusConfig = (status) => {
    switch (status) {
        case 'COLLECTED':          return { color: '#059669', bg: '#D1FAE5', label: 'Collected' };
        case 'PARTIALLY_COLLECTED':return { color: '#D97706', bg: '#FEF3C7', label: 'Partial' };
        case 'VISITED':            return { color: '#2563EB', bg: '#DBEAFE', label: 'Visited' };
        case 'NOT_PAID':           return { color: '#DC2626', bg: '#FEE2E2', label: 'Not Paid' };
        case 'PENDING':            return { color: '#6B7280', bg: '#F3F4F6', label: 'Pending' };
        default:                   return { color: '#6B7280', bg: '#F3F4F6', label: status || '—' };
    }
};

const ACTIVITY_CONFIG = (type) => ACTIVITY_TYPES[type] || { icon: 'map-pin', color: '#9CA3AF', label: type || 'Activity', bgColor: '#F3F4F6' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const formatTime = (ts) =>
    ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

const formatDateFull = (ts) =>
    ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const formatDateTime = (ts) =>
    ts ? `${formatDateFull(ts)} ${formatTime(ts)}` : '—';

const formatCoord = (val) =>
    val != null ? parseFloat(val).toFixed(6) : '—';

const formatDistMeters = (val) => {
    if (val == null) return '—';
    const m = parseFloat(val);
    if (isNaN(m)) return '—';
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
};

// ─── Activity Detail Modal ────────────────────────────────────────────────────
const ActivityDetailModal = ({ visible, activity, onClose }) => {
    if (!activity) return null;
    const cfg = ACTIVITY_CONFIG(activity._activityType);
    const isCollection = activity._activityType === 'COLLECTION_VISIT';
    const statusCfg = isCollection ? getStatusConfig(activity.collectionStatus) : null;

    const Field = ({ label, value, icon }) => {
        if (value == null || value === '' || value === false) return null;
        return (
            <View style={dm.fieldRow}>
                {icon ? <Icon name={icon} size={14} color={colors.textMuted} style={dm.fieldIcon} /> : null}
                <Text style={dm.fieldLabel}>{label}</Text>
                <Text style={dm.fieldValue}>{String(value)}</Text>
            </View>
        );
    };

    const Section = ({ title, children }) => (
        <View style={dm.section}>
            <Text style={dm.sectionTitle}>{title}</Text>
            {children}
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={dm.container}>
                <View style={dm.header}>
                    <View style={[dm.typeBadge, { backgroundColor: cfg.bgColor }]}>
                        <Icon name={cfg.icon} size={16} color={cfg.color} />
                        <Text style={[dm.typeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={dm.closeBtn}>
                        <Icon name="x" size={22} color={colors.textDark} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={dm.scroll} contentContainerStyle={dm.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Status badge for collection visits */}
                    {isCollection && statusCfg && (
                        <View style={[dm.statusBadge, { backgroundColor: statusCfg.bg }]}>
                            <Text style={[dm.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                            {activity.collectedAmount ? (
                                <Text style={[dm.amountText, { color: statusCfg.color }]}>
                                    ₹{parseFloat(activity.collectedAmount).toLocaleString('en-IN')}
                                </Text>
                            ) : null}
                        </View>
                    )}

                    {/* Activity info */}
                    <Section title="Activity">
                        <Field label="Type" value={cfg.label} icon="tag" />
                        <Field label="Date & Time" value={formatDateTime(activity._timestamp)} icon="clock" />
                        {activity.loanId ? <Field label="Loan ID" value={activity.loanId} icon="hash" /> : null}
                        {activity.visitReason ? <Field label="Visit Reason" value={activity.visitReason} icon="compass" /> : null}
                        {activity.activityReason ? <Field label="Activity Type" value={activity.activityReason} icon="layers" /> : null}
                        {isCollection && activity.remarks ? <Field label="Remarks" value={activity.remarks} icon="message-square" /> : null}
                        {isCollection && activity.promiseDate ? <Field label="Promise Date" value={activity.promiseDate} icon="calendar" /> : null}
                    </Section>

                    {/* Customer info */}
                    {(activity.customerName || activity.customerPhone || activity.customerAddress) && (
                        <Section title="Customer">
                            <Field label="Name" value={activity.customerName} icon="user" />
                            <Field label="Phone" value={activity.customerPhone} icon="phone" />
                            <Field label="Address" value={activity.customerAddress} icon="map-pin" />
                        </Section>
                    )}

                    {/* GPS / Location */}
                    <Section title="Location">
                        <Field
                            label="Captured GPS"
                            value={activity.latitude != null && activity.longitude != null
                                ? `${formatCoord(activity.latitude)}, ${formatCoord(activity.longitude)}`
                                : null}
                            icon="crosshair"
                        />
                        {activity.currentAddress ? <Field label="Location" value={activity.currentAddress} icon="navigation" /> : null}
                        {activity.customerLatitude != null && activity.customerLongitude != null && (
                            <Field
                                label="Customer GPS"
                                value={`${formatCoord(activity.customerLatitude)}, ${formatCoord(activity.customerLongitude)}`}
                                icon="user"
                            />
                        )}
                        {activity.distanceFromCustomer != null && (
                            <Field label="Distance from Customer" value={formatDistMeters(activity.distanceFromCustomer)} icon="ruler" />
                        )}
                    </Section>

                    {/* GPS Capture detail */}
                    {activity.gpsCaptureDetails && (
                        <Section title="GPS Capture">
                            <Field label="Accuracy" value={activity.gpsCaptureDetails.accuracy != null ? `${Math.round(activity.gpsCaptureDetails.accuracy)} m` : null} icon="crosshair" />
                            <Field label="Altitude" value={activity.gpsCaptureDetails.altitude != null ? `${Math.round(activity.gpsCaptureDetails.altitude)} m` : null} icon="arrow-up" />
                            <Field label="Speed" value={activity.gpsCaptureDetails.speed != null ? `${(activity.gpsCaptureDetails.speed * 3.6).toFixed(1)} km/h` : null} icon="activity" />
                            <Field label="Provider" value={activity.gpsCaptureDetails.gps_provider || activity.gpsCaptureDetails.location_source} icon="radio" />
                            <Field label="Mock Location" value={activity.gpsCaptureDetails.is_mock_location ? 'Yes' : null} icon="alert-triangle" />
                            {activity.gpsStatus ? <Field label="GPS Status" value={activity.gpsStatus} icon="check-circle" /> : null}
                        </Section>
                    )}

                    {/* Validation */}
                    <Section title="Validation">
                        {activity.geoStatus ? <Field label="Geo Status" value={activity.geoStatus} icon="shield" /> : null}
                        {activity.isOutOfRange != null && activity.isOutOfRange ? (
                            <Field label="Out of Range" value="Yes" icon="alert-circle" />
                        ) : null}
                        {activity.outOfRangeReason ? <Field label="Out of Range Reason" value={activity.outOfRangeReason} icon="alert-circle" /> : null}
                        {activity.isDuplicateLocation != null && activity.isDuplicateLocation ? (
                            <Field label="Duplicate Location" value="Yes" icon="copy" />
                        ) : null}
                        {activity.distanceFromBranch != null && (
                            <Field label="Distance from Branch" value={formatDistMeters(activity.distanceFromBranch)} icon="building" />
                        )}
                    </Section>

                    {/* Sync info */}
                    <Section title="Sync">
                        {activity.clientTransactionId ? <Field label="Transaction ID" value={activity.clientTransactionId} icon="key" /> : null}
                        {activity.createdAt ? <Field label="Synced At" value={formatDateTime(activity.createdAt)} icon="upload-cloud" /> : null}
                        {activity._timestamp && activity.createdAt ? (
                            <Field
                                label="Sync Delay"
                                value={`${Math.round((new Date(activity.createdAt) - new Date(activity._timestamp)) / 1000)}s`}
                                icon="clock"
                            />
                        ) : null}
                    </Section>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
};

const dm = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    typeText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },
    closeBtn: { padding: spacing.xs },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginBottom: spacing.md,
    },
    statusText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },
    amountText: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
    section: { marginBottom: spacing.lg },
    sectionTitle: {
        fontSize: typography.sizes.xs, fontWeight: typography.weights.bold,
        color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
        marginBottom: spacing.xs,
    },
    fieldRow: {
        flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    fieldIcon: { width: 18, marginTop: 2, marginRight: 6 },
    fieldLabel: { width: 120, fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 1 },
    fieldValue: { flex: 1, fontSize: typography.sizes.xs, color: colors.textDark, fontWeight: typography.weights.medium },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
const RouteMapScreen = ({ navigation, route }) => {
    const mapRef = useRef(null);
    const employeeId = route?.params?.employeeId ?? null;
    const employeeName = route?.params?.employeeName ?? null;

    const initialDate = route?.params?.date ? new Date(route.params.date) : new Date();
    const [activeDate, setActiveDate] = useState(initialDate);
    const [allPunches, setAllPunches] = useState([]);
    const [allCollectionUpdates, setAllCollectionUpdates] = useState([]);
    const [gpsRoute, setGpsRoute] = useState([]);
    const [dailySummary, setDailySummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [detailVisible, setDetailVisible] = useState(false);

    const isTodayActive = toDateStr(activeDate) === toDateStr(new Date());

    // ── Fetch all data sources in parallel ────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const dateStr = toDateStr(activeDate);
            const punchParams = { date_from: dateStr, date_to: dateStr };
            if (employeeId) punchParams.employee_id = employeeId;

            const liveParams = { date: dateStr };
            if (employeeId) liveParams.employee_id = employeeId;

            const collParams = { date_from: dateStr, date_to: dateStr };
            if (employeeId) collParams.updated_by = employeeId;

            const summaryParams = { date: dateStr };

            const [punchRes, liveRes, collRes, summaryRes] = await Promise.allSettled([
                api.get('/attendance/punches/', { params: punchParams }),
                api.getLiveDailyRoute(liveParams),
                api.getCollectionUpdates(collParams),
                api.get('/attendance/punches/daily_summary/', { params: summaryParams }),
            ]);

            // Punch records
            if (punchRes.status === 'fulfilled') {
                const raw = Array.isArray(punchRes.value.data)
                    ? punchRes.value.data
                    : Array.isArray(punchRes.value.data?.results)
                    ? punchRes.value.data.results
                    : [];
                setAllPunches(
                    [...raw].sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at))
                );
            }

            // GPS track
            if (liveRes.status === 'fulfilled') {
                const rawPoints = liveRes.value.data?.route || [];
                const clean = filterGpsOutliers(rawPoints);
                setGpsRoute(clean);
            }

            // Collection updates
            if (collRes.status === 'fulfilled') {
                const raw = Array.isArray(collRes.value.data)
                    ? collRes.value.data
                    : Array.isArray(collRes.value.data?.results)
                    ? collRes.value.data.results
                    : [];
                setAllCollectionUpdates(raw);
            }

            // Daily summary (authoritative distance)
            if (summaryRes.status === 'fulfilled') {
                setDailySummary(summaryRes.value.data);
            }
        } catch {
            setError('Failed to load route data. Pull down to retry.');
        } finally {
            setLoading(false);
        }
    }, [activeDate, employeeId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Merge punches + collection updates into unified activity list ──────────
    const mergedActivities = useMemo(() => {
        // Build map: punchId → CollectionUpdate (for linked records)
        const punchToColl = {};
        for (const cu of allCollectionUpdates) {
            if (cu.punch != null) {
                punchToColl[cu.punch] = cu;
            }
        }

        const activities = [];

        // Process each punch
        for (const punch of allPunches) {
            const collUpdate = punchToColl[punch.id];

            if (collUpdate) {
                // Linked: complete_visit created both — merge into one activity
                activities.push({
                    _id: `punch-${punch.id}`,
                    _activityType: 'COLLECTION_VISIT',
                    _source: 'punch+collection',
                    _timestamp: punch.punched_at,
                    _sortKey: new Date(punch.punched_at).getTime(),
                    // Punch data (GPS, timing)
                    id: punch.id,
                    latitude: punch.latitude,
                    longitude: punch.longitude,
                    currentAddress: punch.current_address,
                    gpsCaptureDetails: punch.gps_capture_details,
                    gpsStatus: punch.gps_status,
                    accuracy: punch.accuracy,
                    // Customer data
                    customerName: collUpdate.customer_name || punch.customer_name,
                    customerPhone: collUpdate.customer_phone || punch.customer_phone,
                    customerAddress: collUpdate.customer_address || punch.customer_address,
                    customerLatitude: collUpdate.customer_latitude,
                    customerLongitude: collUpdate.customer_longitude,
                    // Collection data
                    loanId: collUpdate.loan_id || punch.loan_id,
                    collectionStatus: collUpdate.status,
                    collectedAmount: collUpdate.collected_amount,
                    remarks: collUpdate.remarks,
                    promiseDate: collUpdate.promise_date,
                    visitReason: collUpdate.visit_reason || punch.visit_reason,
                    activityReason: collUpdate.activity_reason,
                    // Geo validation (from collection update — more complete)
                    distanceFromCustomer: collUpdate.distance_from_customer,
                    distanceFromBranch: collUpdate.distance_from_branch,
                    geoStatus: collUpdate.geo_status,
                    isOutOfRange: punch.is_out_of_range,
                    outOfRangeReason: punch.out_of_range_reason,
                    isDuplicateLocation: punch.is_duplicate_location,
                    // Sync
                    clientTransactionId: punch.client_transaction_id || collUpdate.client_transaction_id,
                    createdAt: collUpdate.created_at || punch.created_at,
                });
            } else {
                // Standalone punch — no linked collection update
                const punchType = punch.punch_type || 'PUNCH_IN';
                activities.push({
                    _id: `punch-${punch.id}`,
                    _activityType: punch.visit_type === 'DISBURSEMENT' ? 'DISBURSEMENT' : punchType,
                    _source: 'punch',
                    _timestamp: punch.punched_at,
                    _sortKey: new Date(punch.punched_at).getTime(),
                    id: punch.id,
                    latitude: punch.latitude,
                    longitude: punch.longitude,
                    currentAddress: punch.current_address,
                    gpsCaptureDetails: punch.gps_capture_details,
                    gpsStatus: punch.gps_status,
                    accuracy: punch.accuracy,
                    customerName: punch.customer_name,
                    customerPhone: punch.customer_phone,
                    customerAddress: punch.customer_address,
                    customerLatitude: null,
                    customerLongitude: null,
                    loanId: punch.loan_id,
                    collectionStatus: null,
                    collectedAmount: punch.amount,
                    remarks: punch.notes,
                    promiseDate: null,
                    visitReason: punch.visit_reason,
                    activityReason: null,
                    distanceFromCustomer: punch.distance_from_customer,
                    distanceFromBranch: punch.distance_from_branch,
                    geoStatus: punch.geo_status,
                    isOutOfRange: punch.is_out_of_range,
                    outOfRangeReason: punch.out_of_range_reason,
                    isDuplicateLocation: punch.is_duplicate_location,
                    clientTransactionId: punch.client_transaction_id,
                    createdAt: punch.created_at,
                });
            }
        }

        // Standalone collection updates (no linked punch)
        for (const cu of allCollectionUpdates) {
            if (cu.punch != null) continue; // already merged above
            activities.push({
                _id: `coll-${cu.id}`,
                _activityType: 'COLLECTION_VISIT',
                _source: 'collection',
                _timestamp: cu.event_at || cu.created_at,
                _sortKey: new Date(cu.event_at || cu.created_at).getTime(),
                id: cu.id,
                latitude: cu.latitude,
                longitude: cu.longitude,
                currentAddress: cu.location_address,
                gpsCaptureDetails: null,
                gpsStatus: cu.gps_status,
                accuracy: null,
                customerName: cu.customer_name,
                customerPhone: cu.customer_phone,
                customerAddress: cu.customer_address,
                customerLatitude: cu.customer_latitude,
                customerLongitude: cu.customer_longitude,
                loanId: cu.loan_id,
                collectionStatus: cu.status,
                collectedAmount: cu.collected_amount,
                remarks: cu.remarks,
                promiseDate: cu.promise_date,
                visitReason: cu.visit_reason,
                activityReason: cu.activity_reason,
                distanceFromCustomer: cu.distance_from_customer,
                distanceFromBranch: cu.distance_from_branch,
                geoStatus: cu.geo_status,
                isOutOfRange: null,
                outOfRangeReason: null,
                isDuplicateLocation: null,
                clientTransactionId: cu.client_transaction_id,
                createdAt: cu.created_at,
            });
        }

        // Sort chronologically by event timestamp
        activities.sort((a, b) => a._sortKey - b._sortKey);
        return activities;
    }, [allPunches, allCollectionUpdates]);

    // ── Mappable activities (valid GPS) ───────────────────────────────────────
    const mappableActivities = useMemo(() =>
        mergedActivities.filter(
            (a) =>
                a.latitude != null &&
                a.longitude != null &&
                parseFloat(a.latitude) !== 0 &&
                parseFloat(a.longitude) !== 0
        ),
        [mergedActivities]
    );

    // ── GPS polyline coordinates ──────────────────────────────────────────────
    const gpsCoordinates = useMemo(() =>
        gpsRoute.map((p) => ({ latitude: Number(p.lat ?? p.latitude), longitude: Number(p.lon ?? p.lng ?? p.longitude) })),
        [gpsRoute]
    );

    // ── Authoritative distance (from daily_summary, same source as Home) ──────
    const totalDistance = useMemo(() => {
        if (dailySummary?.total_distance_today != null) {
            return parseFloat(dailySummary.total_distance_today);
        }
        return null;
    }, [dailySummary]);

    // ── Stats from merged activities ──────────────────────────────────────────
    const stats = useMemo(() => {
        const total = mergedActivities.length;
        const visits = mergedActivities.filter((a) => a._activityType === 'COLLECTION_VISIT').length;
        const punchIns = mergedActivities.filter((a) => a._activityType === 'PUNCH_IN').length;
        const punchOuts = mergedActivities.filter((a) => a._activityType === 'PUNCH_OUT').length;
        return { total, visits, punchIns, punchOuts };
    }, [mergedActivities]);

    // ── Coordinates for map fitting ───────────────────────────────────────────
    const punchCoordinates = mappableActivities.map((a) => ({
        latitude: parseFloat(a.latitude),
        longitude: parseFloat(a.longitude),
    }));
    const allCoordinates = gpsCoordinates.length > 0 ? gpsCoordinates : punchCoordinates;

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

    // Latest known location
    const latestGpsPt = gpsCoordinates.length > 0 ? gpsCoordinates[gpsCoordinates.length - 1] : null;
    const latestMappable = mappableActivities.length > 0
        ? mappableActivities[mappableActivities.length - 1]
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

    const openDetail = (activity) => {
        setSelectedActivity(activity);
        setDetailVisible(true);
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
                <TouchableOpacity onPress={fetchData} style={styles.refreshBtn}>
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
                    {/* GPS track polyline */}
                    {gpsCoordinates.length > 1 && (
                        <Polyline
                            coordinates={gpsCoordinates}
                            strokeColor={colors.primary}
                            strokeWidth={3}
                            lineDashPattern={undefined}
                        />
                    )}

                    {/* Fallback: connect activity markers when GPS track unavailable */}
                    {gpsCoordinates.length < 2 && punchCoordinates.length > 1 && (
                        <Polyline
                            coordinates={punchCoordinates}
                            strokeColor={colors.primary}
                            strokeWidth={2}
                            lineDashPattern={[6, 4]}
                        />
                    )}

                    {/* Activity markers */}
                    {mappableActivities.map((activity, idx) => {
                        const cfg = ACTIVITY_CONFIG(activity._activityType);
                        return (
                            <Marker
                                key={activity._id}
                                coordinate={{
                                    latitude: parseFloat(activity.latitude),
                                    longitude: parseFloat(activity.longitude),
                                }}
                            >
                                <View style={[styles.pin, { borderColor: cfg.color }]}>
                                    <View style={[styles.pinCore, { backgroundColor: cfg.color }]}>
                                        <Text style={styles.pinText}>{idx + 1}</Text>
                                    </View>
                                </View>
                                <Callout tooltip onPress={() => openDetail(activity)}>
                                    <View style={styles.callout}>
                                        <Text style={[styles.calloutType, { color: cfg.color }]}>
                                            {cfg.label}
                                        </Text>
                                        <Text style={styles.calloutTime}>{formatTime(activity._timestamp)}</Text>
                                        {activity.customerName ? (
                                            <Text style={styles.calloutDetail}>{activity.customerName}</Text>
                                        ) : null}
                                        {activity.currentAddress ? (
                                            <Text style={styles.calloutAddr} numberOfLines={2}>
                                                {activity.currentAddress}
                                            </Text>
                                        ) : null}
                                        <Text style={styles.calloutTap}>Tap for details</Text>
                                    </View>
                                </Callout>
                            </Marker>
                        );
                    })}
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

            {/* Stats + Activity List */}
            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Stats row */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statVal}>{stats.total}</Text>
                        <Text style={styles.statLbl}>Activities</Text>
                    </View>
                    <View style={[styles.statItem, styles.statDivider]}>
                        <Text style={[styles.statVal, { color: ACTIVITY_TYPES.COLLECTION_VISIT.color }]}>
                            {stats.visits}
                        </Text>
                        <Text style={styles.statLbl}>Visits</Text>
                    </View>
                    <View style={[styles.statItem, styles.statDivider]}>
                        <Text style={[styles.statVal, { color: ACTIVITY_TYPES.PUNCH_IN.color }]}>
                            {stats.punchIns}
                        </Text>
                        <Text style={styles.statLbl}>Punch In</Text>
                    </View>
                    <View style={[styles.statItem, styles.statDivider]}>
                        <Text style={[styles.statVal, { color: ACTIVITY_TYPES.PUNCH_OUT.color }]}>
                            {stats.punchOuts}
                        </Text>
                        <Text style={styles.statLbl}>Punch Out</Text>
                    </View>
                    <View style={[styles.statItem, styles.statDivider]}>
                        <Text style={[styles.statVal, { color: '#7b1fa2', fontSize: 14 }]}>
                            {totalDistance != null ? `${totalDistance}` : '—'}
                        </Text>
                        <Text style={styles.statLbl}>km</Text>
                    </View>
                </View>

                {error ? (
                    <View style={styles.errorRow}>
                        <Icon name="alert-circle" size={15} color={colors.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : !loading && mergedActivities.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Icon name="map-pin" size={36} color={colors.border} />
                        <Text style={styles.emptyText}>No activities recorded on this date</Text>
                    </View>
                ) : (
                    mergedActivities.map((activity, idx) => {
                        const cfg = ACTIVITY_CONFIG(activity._activityType);
                        const isCollection = activity._activityType === 'COLLECTION_VISIT';
                        const statusCfg = isCollection ? getStatusConfig(activity.collectionStatus) : null;
                        const hasGps = activity.latitude != null && activity.longitude != null &&
                            parseFloat(activity.latitude) !== 0 && parseFloat(activity.longitude) !== 0;

                        return (
                            <TouchableOpacity
                                key={activity._id}
                                style={styles.activityRow}
                                onPress={() => openDetail(activity)}
                                activeOpacity={0.7}
                            >
                                {/* Number badge */}
                                <View style={[styles.activityBadge, { backgroundColor: cfg.color }]}>
                                    <Text style={styles.activityBadgeText}>{idx + 1}</Text>
                                </View>

                                {/* Activity details */}
                                <View style={styles.activityInfo}>
                                    <View style={styles.activityTopRow}>
                                        <View style={[styles.typeTag, { backgroundColor: cfg.bgColor }]}>
                                            <Icon name={cfg.icon} size={12} color={cfg.color} />
                                            <Text style={[styles.typeTagText, { color: cfg.color }]}>
                                                {cfg.label}
                                            </Text>
                                        </View>
                                        <Text style={styles.activityTime}>
                                            {formatTime(activity._timestamp)}
                                        </Text>
                                    </View>

                                    {/* Status + amount for collection visits */}
                                    {isCollection && statusCfg && (
                                        <View style={styles.activityStatusRow}>
                                            <View style={[styles.statusTag, { backgroundColor: statusCfg.bg }]}>
                                                <Text style={[styles.statusTagText, { color: statusCfg.color }]}>
                                                    {statusCfg.label}
                                                </Text>
                                            </View>
                                            {activity.collectedAmount ? (
                                                <Text style={[styles.amountText, { color: statusCfg.color }]}>
                                                    ₹{parseFloat(activity.collectedAmount).toLocaleString('en-IN')}
                                                </Text>
                                            ) : null}
                                        </View>
                                    )}

                                    {activity.customerName ? (
                                        <Text style={styles.activityCustomer}>{activity.customerName}</Text>
                                    ) : null}
                                    {activity.currentAddress ? (
                                        <Text style={styles.activityAddr} numberOfLines={1}>
                                            {activity.currentAddress}
                                        </Text>
                                    ) : null}

                                    {/* Footer badges */}
                                    <View style={styles.activityFooter}>
                                        {hasGps ? (
                                            <View style={styles.gpsBadge}>
                                                <Icon name="crosshair" size={10} color={colors.success} />
                                                <Text style={styles.gpsBadgeText}>GPS</Text>
                                            </View>
                                        ) : (
                                            <View style={[styles.gpsBadge, { backgroundColor: '#FEF3C7' }]}>
                                                <Icon name="alert-triangle" size={10} color={colors.warning} />
                                                <Text style={[styles.gpsBadgeText, { color: colors.warning }]}>No GPS</Text>
                                            </View>
                                        )}
                                        {activity.loanId ? (
                                            <View style={styles.loanBadge}>
                                                <Text style={styles.loanBadgeText}>{activity.loanId}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>

                                {/* Connector */}
                                {idx < mergedActivities.length - 1 && (
                                    <View style={styles.connector} />
                                )}
                            </TouchableOpacity>
                        );
                    })
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Activity Detail Modal */}
            <ActivityDetailModal
                visible={detailVisible}
                activity={selectedActivity}
                onClose={() => { setDetailVisible(false); setSelectedActivity(null); }}
            />
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
    navArrow: { padding: spacing.sm },
    disabledArrow: { opacity: 0.3 },
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
    map: { flex: 1 },
    mapLoadOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fitBtn: {
        position: 'absolute', top: spacing.md, right: spacing.md,
        backgroundColor: '#fff', width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15, shadowRadius: 4,
    },
    latestBtn: {
        position: 'absolute', bottom: spacing.md, right: spacing.md, alignItems: 'center',
    },
    latestBtnInner: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
        elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25, shadowRadius: 6,
    },
    latestBtnLabel: { fontSize: 10, color: colors.primary, fontWeight: '600', marginTop: 3 },

    // Custom map pin
    pin: {
        width: 32, height: 32, borderRadius: 16, borderWidth: 2,
        backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    },
    pinCore: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    pinText: { color: '#fff', fontSize: 11, fontWeight: '700' },

    // Callout
    callout: {
        backgroundColor: '#fff', borderRadius: 10, padding: 10, minWidth: 140, maxWidth: 220,
        elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15, shadowRadius: 4,
    },
    calloutType: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
    calloutTime: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
    calloutDetail: { fontSize: 11, color: colors.textDark, marginBottom: 2 },
    calloutAddr: { fontSize: 11, color: colors.textMuted },
    calloutTap: { fontSize: 10, color: colors.primary, marginTop: 4, fontStyle: 'italic' },

    // Activity list
    list: { flex: 1 },
    listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md },

    // Stats row
    statsRow: {
        flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14,
        marginBottom: spacing.md, overflow: 'hidden', elevation: 1,
    },
    statItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
    statDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
    statVal: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark },
    statLbl: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },

    // Error / empty
    errorRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff0f0',
        borderRadius: 10, padding: spacing.md, gap: 8,
    },
    errorText: { fontSize: typography.sizes.sm, color: colors.danger, flex: 1 },
    emptyBox: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
    emptyText: { fontSize: typography.sizes.md, color: colors.textMuted },

    // Activity row
    activityRow: {
        flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface,
        borderRadius: 12, padding: spacing.md, marginBottom: spacing.xs, elevation: 1,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2,
    },
    activityBadge: {
        width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
        marginRight: spacing.md, marginTop: 1,
    },
    activityBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    activityInfo: { flex: 1 },
    activityTopRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
    },
    typeTag: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    },
    typeTagText: { fontSize: 11, fontWeight: typography.weights.bold },
    activityTime: { fontSize: typography.sizes.sm, color: colors.textMuted },
    activityStatusRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
    },
    statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    statusTagText: { fontSize: 11, fontWeight: typography.weights.semibold },
    amountText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },
    activityCustomer: { fontSize: typography.sizes.sm, color: colors.textDark, marginTop: 2 },
    activityAddr: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
    activityFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
    gpsBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: colors.successLight, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    },
    gpsBadgeText: { fontSize: 10, color: colors.success, fontWeight: '600' },
    loanBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    loanBadgeText: { fontSize: 10, color: colors.success, fontWeight: '600' },
    connector: {
        position: 'absolute', left: spacing.md + 15, bottom: -spacing.xs,
        width: 1, height: spacing.xs, backgroundColor: colors.border,
    },
});

export default RouteMapScreen;
