import React, { useState, useEffect, useCallback, useMemo, useRef, Component } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Modal,
    TextInput,
    Linking,
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    Dimensions,
    Animated,
    Platform,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MapView, { Marker, Callout, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';

import api from '../../api/api';
import LocationService from '../../services/LocationService';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

const STATUS_OPTIONS = [
    { value: 'PENDING', label: 'P2P', color: colors.textMuted },
    { value: 'VISITED', label: 'Visited', color: colors.info },
    { value: 'COLLECTED', label: 'Collected', color: colors.success },
    { value: 'PARTIALLY_COLLECTED', label: 'Partial', color: colors.warning },
    { value: 'NOT_PAID', label: 'Not Paid', color: colors.danger },
];

const VISIT_REASON_OPTIONS = [
    { value: 'OD_VISIT', label: 'OD Visit' },
    { value: 'OTHER', label: 'Other' },
];
const VISIT_REASON_META = VISIT_REASON_OPTIONS.reduce((a, o) => { a[o.value] = o.label; return a; }, {});

const STATUS_META = STATUS_OPTIONS.reduce((a, o) => { a[o.value] = o; return a; }, {});

// Pin color for map markers per status
const PIN_COLOR = {
    VISITED: '#2196F3',
    COLLECTED: '#4CAF50',
    PARTIALLY_COLLECTED: '#FF9800',
    NOT_PAID: '#F44336',
    PENDING: '#9E9E9E',
};

const TYPE_OPTIONS = [
    { value: 'ALL', label: 'All Types' },
    { value: 'REGULAR', label: 'Regular', color: colors.info },
    { value: 'OD', label: 'OD', color: colors.danger },
    { value: 'ADVANCE', label: 'Advance', color: '#7b1fa2' },
];
const TYPE_META = {
    REGULAR: { label: 'Regular', color: colors.info },
    OD: { label: 'OD', color: colors.danger },
    ADVANCE: { label: 'Advance', color: '#7b1fa2' },
};

// DPD (days past due) sub-buckets — only relevant when Type filter = OD
const DPD_BUCKET_OPTIONS = [
    { value: '0-30', label: '0-30', min: 0, max: 30 },
    { value: '31-60', label: '31-60', min: 31, max: 60 },
    { value: '61-90', label: '61-90', min: 61, max: 90 },
    { value: '91+', label: '91+', min: 91, max: Infinity },
];
const matchesDpdBucket = (days, bucketValue) => {
    if (days == null) return false;
    const bucket = DPD_BUCKET_OPTIONS.find(b => b.value === bucketValue);
    return bucket ? days >= bucket.min && days <= bucket.max : false;
};

// ── Map error boundary — prevents a MapView crash from killing the whole screen ──
class MapErrorBoundary extends Component {
    state = { crashed: false };
    static getDerivedStateFromError() { return { crashed: true }; }
    componentDidCatch(err) { console.warn('[CollectionsMap] crash caught:', err?.message); }
    render() {
        if (this.state.crashed) {
            return (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <Icon name="alert-triangle" size={32} color="#d97706" />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400e', marginTop: 12, textAlign: 'center' }}>
                        Map unavailable
                    </Text>
                    <Text style={{ fontSize: 12, color: '#b45309', marginTop: 4, textAlign: 'center' }}>
                        Could not load the map. Check your connection or try again.
                    </Text>
                    <TouchableOpacity
                        onPress={() => this.setState({ crashed: false })}
                        style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#fef3c7', borderRadius: 8, borderWidth: 1, borderColor: '#fbbf24' }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400e' }}>Retry</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return this.props.children;
    }
}

const PAGE_SIZE = 20;

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtAmount = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtCompact = (n) => {
    const v = Number(n || 0);
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
    return `₹${v}`;
};

const KpiPill = ({ label, value, accent }) => (
    <View style={styles.kpiPill}>
        <Text style={[styles.kpiValue, accent && { color: accent }]}>{value}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
    </View>
);

// ── Map tab ─────────────────────────────────────────────────────────────────
const CollectionsMap = ({ records, navigateToCustomer, openUpdate }) => {
    const mapRef = useRef(null);
    const currentRegion = useRef(null);

    // All customers with valid GPS — always parse to float to avoid MapView crash
    const pinned = useMemo(
        () => records
            .map(r => ({
                ...r,
                visit_latitude:  parseFloat(r.visit_latitude),
                visit_longitude: parseFloat(r.visit_longitude),
            }))
            .filter(r => !isNaN(r.visit_latitude) && !isNaN(r.visit_longitude)),
        [records]
    );

    // Route line: pending/partial customers sorted by visit time
    const routeCoords = useMemo(() => {
        const sorted = [...pinned]
            .filter(r => r.last_collection_date && r.status !== 'COLLECTED')
            .sort((a, b) => new Date(a.last_collection_date) - new Date(b.last_collection_date));
        return sorted.map(r => ({ latitude: r.visit_latitude, longitude: r.visit_longitude }));
    }, [pinned]);

    const initialRegion = useMemo(() => {
        if (pinned.length > 0) {
            return { latitude: pinned[0].visit_latitude, longitude: pinned[0].visit_longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        }
        return { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 8, longitudeDelta: 8 };
    }, [pinned]);

    const zoomIn = useCallback(() => {
        const r = currentRegion.current || initialRegion;
        const next = { ...r, latitudeDelta: Math.max(r.latitudeDelta / 2, 0.001), longitudeDelta: Math.max(r.longitudeDelta / 2, 0.001) };
        mapRef.current?.animateToRegion(next, 200);
        currentRegion.current = next;
    }, [initialRegion]);

    const zoomOut = useCallback(() => {
        const r = currentRegion.current || initialRegion;
        const next = { ...r, latitudeDelta: Math.min(r.latitudeDelta * 2, 90), longitudeDelta: Math.min(r.longitudeDelta * 2, 90) };
        mapRef.current?.animateToRegion(next, 200);
        currentRegion.current = next;
    }, [initialRegion]);

    const reCenter = useCallback(async () => {
        try {
            const loc = await LocationService.getCurrentLocation();
            if (loc?.latitude && loc?.longitude && !loc?.error) {
                const next = { latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 };
                mapRef.current?.animateToRegion(next, 600);
                currentRegion.current = next;
                return;
            }
        } catch (_) {}
        if (pinned.length > 0) {
            mapRef.current?.fitToCoordinates(
                pinned.map(r => ({ latitude: r.visit_latitude, longitude: r.visit_longitude })),
                { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
            );
        }
    }, [pinned]);

    if (pinned.length === 0) {
        return (
            <View style={styles.mapEmpty}>
                <Icon name="map-pin" size={36} color={colors.textLight} />
                <Text style={styles.mapEmptyTitle}>No location pins yet</Text>
                <Text style={styles.mapEmptySub}>
                    Pins appear after you update a customer status in the field.
                    Use the Navigate buttons in the list below to get directions.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.mapWrapper}>
          <MapErrorBoundary>
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={initialRegion}
                onRegionChangeComplete={r => { currentRegion.current = r; }}
                showsUserLocation
                showsMyLocationButton={false}
            >
                {routeCoords.length > 1 && (
                    <Polyline
                        coordinates={routeCoords}
                        strokeColor={colors.primary}
                        strokeWidth={3}
                        lineDashPattern={[6, 3]}
                    />
                )}
                {pinned.map(r => {
                    const meta = STATUS_META[r.status] || STATUS_META.PENDING;
                    const isDone = r.status === 'COLLECTED';
                    return (
                        <Marker
                            key={r.id}
                            coordinate={{ latitude: r.visit_latitude, longitude: r.visit_longitude }}
                            pinColor={PIN_COLOR[r.status] || PIN_COLOR.PENDING}
                            opacity={isDone ? 0.5 : 1}
                        >
                            <Callout tooltip={false} style={styles.calloutBox}>
                                <Text style={styles.calloutName} numberOfLines={1}>{r.customer_name}</Text>
                                <Text style={styles.calloutSub}>{r.loan_id} · {meta.label}</Text>
                                <Text style={styles.calloutAmt}>{fmtCompact(r.amount_due)}</Text>
                                <View style={styles.calloutActions}>
                                    <TouchableOpacity
                                        style={[styles.calloutBtn, { backgroundColor: colors.primary }]}
                                        onPress={() => navigateToCustomer(r)}
                                    >
                                        <Icon name="navigation" size={12} color="#fff" />
                                        <Text style={styles.calloutBtnText}>Navigate</Text>
                                    </TouchableOpacity>
                                    {!isDone && (
                                        <TouchableOpacity
                                            style={[styles.calloutBtn, { backgroundColor: colors.success }]}
                                            onPress={() => openUpdate(r)}
                                        >
                                            <Icon name="edit-3" size={12} color="#fff" />
                                            <Text style={styles.calloutBtnText}>Update</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </Callout>
                        </Marker>
                    );
                })}
            </MapView>

            {/* Zoom controls — floating right, above map layer */}
            <View style={styles.zoomControls} pointerEvents="box-none">
                <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn} activeOpacity={0.75}>
                    <Icon name="plus" size={18} color="#1e293b" />
                </TouchableOpacity>
                <View style={styles.zoomDivider} />
                <TouchableOpacity style={styles.zoomBtn} onPress={zoomOut} activeOpacity={0.75}>
                    <Icon name="minus" size={18} color="#1e293b" />
                </TouchableOpacity>
            </View>

            {/* Recenter button */}
            <TouchableOpacity style={styles.recenterBtn} onPress={reCenter} activeOpacity={0.75}>
                <Icon name="crosshair" size={20} color={colors.primary} />
            </TouchableOpacity>
          </MapErrorBoundary>
        </View>
    );
};

// ── Animated list card wrapper ───────────────────────────────────────────────
const AnimatedCard = React.memo(({ index, children }) => {
    const shouldAnimate = index < 10;
    const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
    const translateY = useRef(new Animated.Value(shouldAnimate ? 32 : 0)).current;

    useEffect(() => {
        if (!shouldAnimate) return;
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1, duration: 340, delay: index * 55, useNativeDriver: true,
            }),
            Animated.spring(translateY, {
                toValue: 0, tension: 65, friction: 9, delay: index * 55, useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View style={{ opacity, transform: [{ translateY }] }}>
            {children}
        </Animated.View>
    );
});

// ── Main screen ──────────────────────────────────────────────────────────────
const CollectionsScreen = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [pageLoading, setPageLoading] = useState(false);

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('ALL');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [dpdFilter, setDpdFilter] = useState('ALL');
    const [filterModalVisible, setFilterModalVisible] = useState(false);

    const [view, setView] = useState('list'); // 'list' | 'map'
    const [mapSearch, setMapSearch] = useState('');

    const [modal, setModal] = useState({ open: false, record: null });
    const [form, setForm] = useState({ status: 'PENDING', collected_amount: '', remarks: '', promise_date: null, visit_reason: '' });
    const [saving, setSaving] = useState(false);
    const [showPromiseDatePicker, setShowPromiseDatePicker] = useState(false);

    // Fetch a single page; pass reset=true on refresh/filter-change to clear existing records
    const fetchRecords = useCallback(async (pageNum = 1, reset = false) => {
        if (pageNum === 1) reset = true;
        if (pageNum > 1) setPageLoading(true);
        else if (reset) setLoading(true);
        try {
            const res = await api.getCollections({ page: pageNum, page_size: PAGE_SIZE });
            const data   = res.data?.results ?? (Array.isArray(res.data) ? res.data : []);
            const total  = res.data?.count   ?? data.length;
            setRecords(prev => reset ? data : [...prev, ...data]);
            setPage(pageNum);
            setHasMore(records.length + data.length < total || !!res.data?.next);
        } catch {
            if (pageNum === 1) Alert.alert('Error', 'Could not load your collections.');
        } finally {
            setLoading(false);
            setRefreshing(false);
            setPageLoading(false);
        }
    }, [records.length]);

    useEffect(() => { fetchRecords(1, true); }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchRecords(1, true);
    }, [fetchRecords]);

    const onEndReached = useCallback(() => {
        if (!pageLoading && !loading && hasMore) {
            fetchRecords(page + 1, false);
        }
    }, [pageLoading, loading, hasMore, page, fetchRecords]);

    // ── Derived stats & filtering ─────────────────────────────────────────
    const stats = useMemo(() => {
        const countBy = {};
        let totalDue = 0;
        let totalCollected = 0;
        records.forEach(r => {
            countBy[r.status] = (countBy[r.status] || 0) + 1;
            totalDue += Number(r.amount_due || 0);
            totalCollected += Number(r.collected_amount || 0);
        });
        return {
            total: records.length,
            countBy,
            pending: countBy.PENDING || 0,
            collected: (countBy.COLLECTED || 0) + (countBy.PARTIALLY_COLLECTED || 0),
            totalDue,
            totalCollected,
        };
    }, [records]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return records.filter(r => {
            if (activeFilter !== 'ALL' && r.status !== activeFilter) return false;
            if (typeFilter !== 'ALL' && (r.collection_type || 'REGULAR') !== typeFilter) return false;
            if (typeFilter === 'OD' && dpdFilter !== 'ALL' && r.dpd_bucket !== dpdFilter) return false;
            if (!q) return true;
            return (
                (r.loan_id || '').toLowerCase().includes(q) ||
                (r.customer_name || '').toLowerCase().includes(q) ||
                (r.customer_phone || '').toLowerCase().includes(q) ||
                (r.pincode || '').toLowerCase().includes(q)
            );
        });
    }, [records, activeFilter, typeFilter, dpdFilter, search]);

    // Map view search — non-collected only, across name/address/area/loan/date
    const mapPending = useMemo(() => {
        const q = mapSearch.trim().toLowerCase();
        return records.filter(r => {
            if (r.status === 'COLLECTED') return false;
            if (!q) return true;
            const due = r.due_date ? new Date(r.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase() : '';
            return (
                (r.customer_name || '').toLowerCase().includes(q) ||
                (r.loan_id || '').toLowerCase().includes(q) ||
                (r.address || '').toLowerCase().includes(q) ||
                (r.area || '').toLowerCase().includes(q) ||
                (r.pincode || '').toLowerCase().includes(q) ||
                due.includes(q)
            );
        });
    }, [records, mapSearch]);

    const openUpdate = (record) => {
        setForm({
            status: record.status || 'PENDING',
            collected_amount: record.collected_amount != null ? String(record.collected_amount) : '',
            remarks: record.remarks || '',
            promise_date: record.promise_date ? new Date(record.promise_date) : null,
            visit_reason: record.visit_reason || '',
        });
        setModal({ open: true, record });
    };

    const navigateToCustomer = useCallback((r) => {
        // Prefer GPS coords (captured on prior visit); fall back to text address
        if (r.visit_latitude && r.visit_longitude) {
            const lat = r.visit_latitude;
            const lng = r.visit_longitude;
            Linking.openURL(`google.navigation:q=${lat},${lng}&mode=d`).catch(() =>
                Linking.openURL(`https://maps.google.com/maps?daddr=${lat},${lng}`)
            );
            return;
        }
        const addr = [r.address, r.area, r.pincode].filter(Boolean).join(', ');
        if (addr) {
            Linking.openURL(`https://maps.google.com/maps?q=${encodeURIComponent(addr)}&mode=d`);
        } else {
            Alert.alert('No Location', 'No address or GPS data available for this customer.');
        }
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            // Auto-capture GPS at the moment of save
            let gpsPayload = {};
            try {
                const loc = await LocationService.getCurrentLocation();
                if (loc?.latitude && loc?.longitude && !loc?.error) {
                    gpsPayload.latitude = loc.latitude;
                    gpsPayload.longitude = loc.longitude;
                    gpsPayload.location_address = loc.address || '';
                }
            } catch (_) {
                // GPS optional — don't block the save
            }

            const payload = { status: form.status, remarks: form.remarks, ...gpsPayload };
            if (form.collected_amount !== '') payload.collected_amount = parseFloat(form.collected_amount);
            payload.promise_date = form.status === 'PENDING' && form.promise_date
                ? form.promise_date.toISOString().split('T')[0]
                : null;
            payload.visit_reason = form.status === 'VISITED' ? form.visit_reason : '';

            await api.updateCollectionStatus(modal.record.id, payload);
            setModal({ open: false, record: null });
            fetchRecords();
        } catch (e) {
            Alert.alert('Error', 'Failed to update status.');
        } finally {
            setSaving(false);
        }
    };

    const renderItem = ({ item, index }) => {
        const meta = STATUS_META[item.status] || STATUS_META.PENDING;
        const fullAddress = [item.address, item.area, item.pincode && `PIN: ${item.pincode}`]
            .filter(Boolean).join(', ');
        return (
            <AnimatedCard index={index}>
            <View style={styles.card}>
                <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />
                <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.customerName}>{item.customer_name}</Text>
                            <View style={styles.loanRow}>
                                <Text style={styles.loanId}>Loan ID: {item.loan_id}</Text>
                                {(() => {
                                    const t = TYPE_META[item.collection_type] || TYPE_META.REGULAR;
                                    return (
                                        <View style={[styles.typeTag, { backgroundColor: t.color + '1A' }]}>
                                            <Text style={[styles.typeTagText, { color: t.color }]}>{t.label}</Text>
                                        </View>
                                    );
                                })()}
                                {item.dpd_days != null && item.dpd_days > 0 && (() => {
                                    const d = item.dpd_days;
                                    const c = d > 90 ? '#7f1d1d'
                                            : d > 60 ? '#b91c1c'
                                            : d > 30 ? '#d97706'
                                            : '#f59e0b';
                                    return (
                                        <View style={[styles.typeTag, { backgroundColor: c + '22' }]}>
                                            <Text style={[styles.typeTagText, { color: c, fontWeight: '800' }]}>
                                                DPD {d}
                                            </Text>
                                        </View>
                                    );
                                })()}
                            </View>
                        </View>
                        <View style={[styles.statusChip, { backgroundColor: meta.color + '1A' }]}>
                            <Text style={[styles.statusChipText, { color: meta.color }]}>
                                {item.status_display || meta.label}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.row}>
                        <Icon name="map-pin" size={15} color={colors.textMuted} />
                        <Text style={styles.rowText}>{fullAddress || 'No address'}</Text>
                        {/* Green dot if GPS was captured for this record */}
                        {item.visit_latitude != null && (
                            <View style={styles.gpsDot} />
                        )}
                    </View>

                    {!!item.customer_phone && (
                        <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(`tel:${item.customer_phone}`)}>
                            <Icon name="phone" size={15} color={colors.textMuted} />
                            <Text style={[styles.rowText, { color: colors.primary }]}>{item.customer_phone}</Text>
                        </TouchableOpacity>
                    )}

                    <View style={styles.row}>
                        <Icon name="dollar-sign" size={15} color={colors.textMuted} />
                        <Text style={styles.rowText}>
                            To collect: <Text style={styles.bold}>{fmtAmount(item.amount_due)}</Text>
                            {item.collected_amount != null ? `  ·  Collected: ${fmtAmount(item.collected_amount)}` : ''}
                        </Text>
                    </View>

                    {item.dpd_days != null && (
                        <View style={styles.row}>
                            {(() => {
                                const d = item.dpd_days;
                                const c = d === 0 ? colors.success
                                        : d > 90 ? '#7f1d1d'
                                        : d > 60 ? '#b91c1c'
                                        : d > 30 ? '#d97706'
                                        : '#f59e0b';
                                return (
                                    <>
                                        <Icon name="alert-circle" size={15} color={c} />
                                        <Text style={[styles.rowText, { color: c, fontWeight: d > 0 ? '700' : '400' }]}>
                                            DPD: {d} days{item.dpd_bucket ? ` (${item.dpd_bucket})` : ''}
                                        </Text>
                                    </>
                                );
                            })()}
                        </View>
                    )}

                    {!!item.due_date && (
                        <View style={styles.row}>
                            <Icon name="calendar" size={15} color={colors.textMuted} />
                            <Text style={styles.rowText}>Planned: {fmtDate(item.due_date)}</Text>
                        </View>
                    )}

                    {!!item.promise_date && (
                        <View style={styles.row}>
                            <Icon name="clock" size={15} color={colors.warning} />
                            <Text style={[styles.rowText, { color: colors.warning }]}>
                                Promised: {fmtDate(item.promise_date)}
                            </Text>
                        </View>
                    )}

                    {!!item.visit_reason && (
                        <View style={styles.row}>
                            <Icon name="info" size={15} color={colors.info} />
                            <Text style={[styles.rowText, { color: colors.info }]}>
                                Reason: {VISIT_REASON_META[item.visit_reason] || item.visit_reason}
                            </Text>
                        </View>
                    )}

                    <View style={styles.row}>
                        <Icon name="clock" size={15} color={colors.textMuted} />
                        <Text style={styles.rowText}>Last collection: {fmtDate(item.last_collection_date)}</Text>
                    </View>

                    <View style={styles.actionRow}>
                        {!!item.customer_phone && (
                            <TouchableOpacity
                                style={styles.iconBtn}
                                onPress={() => Linking.openURL(`tel:${item.customer_phone}`)}
                            >
                                <Icon name="phone-call" size={16} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={() => navigateToCustomer(item)}
                        >
                            <Icon name="navigation" size={16} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.updateBtn} onPress={() => openUpdate(item)}>
                            <Icon name="edit-3" size={16} color="#FFFFFF" />
                            <Text style={styles.updateBtnText}>Update Status</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
            </AnimatedCard>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

            {/* ── Header ── */}
            <View style={styles.header}>
                <View style={styles.headerTopRow}>
                    <View>
                        <Text style={styles.headerTitle}>My Collections</Text>
                        <Text style={styles.headerSub}>{stats.total} assigned · {stats.pending} pending</Text>
                    </View>
                    <View style={styles.headerActions}>
                        {/* List / Map toggle */}
                        <View style={styles.viewToggle}>
                            <TouchableOpacity
                                style={[styles.toggleBtn, view === 'list' && styles.toggleBtnActive]}
                                onPress={() => setView('list')}
                            >
                                <Icon name="list" size={16} color={view === 'list' ? colors.primary : 'rgba(255,255,255,0.7)'} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleBtn, view === 'map' && styles.toggleBtnActive]}
                                onPress={() => setView('map')}
                            >
                                <Icon name="map" size={16} color={view === 'map' ? colors.primary : 'rgba(255,255,255,0.7)'} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                            <Icon name="refresh-cw" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.kpiRow}>
                    <KpiPill label="To Collect" value={fmtCompact(stats.totalDue)} />
                    <KpiPill label="Collected" value={fmtCompact(stats.totalCollected)} accent={colors.successLight} />
                    <KpiPill label="Pending" value={stats.pending} />
                    <KpiPill label="Done" value={stats.collected} />
                </View>
            </View>

            {/* ── Map view ── */}
            {view === 'map' ? (
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {/* Legend row */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll} contentContainerStyle={styles.legendRow}>
                        {Object.entries(PIN_COLOR).filter(([k]) => k !== 'PENDING').map(([status, color]) => (
                            <View key={status} style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: color }]} />
                                <Text style={styles.legendText}>{STATUS_META[status]?.label || status}</Text>
                            </View>
                        ))}
                        <View style={styles.legendItem}>
                            <View style={styles.legendLine} />
                            <Text style={styles.legendText}>Route</Text>
                        </View>
                    </ScrollView>

                    {/* Map — fixed height so list is visible below */}
                    <View style={{ height: SCREEN_HEIGHT * 0.52 }}>
                        <CollectionsMap
                            records={records}
                            navigateToCustomer={navigateToCustomer}
                            openUpdate={openUpdate}
                        />
                    </View>

                    {/* Pending list below map — FlatList for virtualization */}
                    {(() => {
                        const allPending = records.filter(r => r.status !== 'COLLECTED');
                        const done = records.length - allPending.length;
                        const pending = mapPending;

                        const renderMapItem = ({ item: r }) => {
                            const meta = STATUS_META[r.status] || STATUS_META.PENDING;
                            const addr = [r.address, r.area, r.pincode].filter(Boolean).join(', ');
                            return (
                                <View style={styles.mapListCard}>
                                    <View style={[styles.mapListAccent, { backgroundColor: PIN_COLOR[r.status] || PIN_COLOR.PENDING }]} />
                                    <View style={{ flex: 1, paddingRight: 4 }}>
                                        <View style={styles.mapListTopRow}>
                                            <Text style={styles.mapListName} numberOfLines={1}>{r.customer_name}</Text>
                                            <Text style={styles.mapListAmt}>{fmtCompact(r.amount_due)}</Text>
                                        </View>
                                        <View style={styles.mapListRow}>
                                            <Text style={styles.mapListSub}>{r.loan_id}</Text>
                                            <View style={[styles.mapStatusChip, { backgroundColor: (PIN_COLOR[r.status] || PIN_COLOR.PENDING) + '20' }]}>
                                                <Text style={[styles.mapStatusChipText, { color: PIN_COLOR[r.status] || PIN_COLOR.PENDING }]}>{meta.label}</Text>
                                            </View>
                                        </View>
                                        {!!addr && (
                                            <View style={styles.mapListInfoRow}>
                                                <Icon name="map-pin" size={11} color={colors.textMuted} />
                                                <Text style={styles.mapListInfoText} numberOfLines={1}>{addr}</Text>
                                            </View>
                                        )}
                                        <View style={styles.mapListBottomRow}>
                                            {!!r.customer_phone && (
                                                <TouchableOpacity style={styles.mapListInfoRow} onPress={() => Linking.openURL(`tel:${r.customer_phone}`)}>
                                                    <Icon name="phone" size={11} color={colors.primary} />
                                                    <Text style={[styles.mapListInfoText, { color: colors.primary }]}>{r.customer_phone}</Text>
                                                </TouchableOpacity>
                                            )}
                                            {!!r.due_date && (
                                                <View style={styles.mapListInfoRow}>
                                                    <Icon name="calendar" size={11} color={colors.textMuted} />
                                                    <Text style={styles.mapListInfoText}>EMI: {fmtDate(r.due_date)}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.mapListActions}>
                                            <TouchableOpacity style={styles.mapNavBtn} onPress={() => navigateToCustomer(r)} activeOpacity={0.75}>
                                                <Icon name="navigation" size={13} color={colors.primary} />
                                                <Text style={styles.mapNavBtnText}>Navigate</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.mapUpdateBtn} onPress={() => openUpdate(r)} activeOpacity={0.75}>
                                                <Icon name="edit-3" size={13} color="#fff" />
                                                <Text style={styles.mapUpdateBtnText}>Update</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            );
                        };

                        return (
                            <View style={[styles.mapListSection, { minHeight: 120 }]}>
                                {/* Search bar */}
                                <View style={styles.mapSearchWrap}>
                                    <Icon name="search" size={15} color={colors.textMuted} />
                                    <TextInput
                                        style={styles.mapSearchInput}
                                        placeholder="Search name, loan ID, address, area, date…"
                                        placeholderTextColor={colors.textMuted}
                                        value={mapSearch}
                                        onChangeText={setMapSearch}
                                        returnKeyType="search"
                                    />
                                    {!!mapSearch && (
                                        <TouchableOpacity onPress={() => setMapSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                            <Icon name="x-circle" size={15} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View style={styles.mapListHeaderRow}>
                                    <Text style={styles.mapListHeader}>
                                        {mapSearch ? `${pending.length} results` : `${allPending.length} Remaining`}
                                    </Text>
                                    {done > 0 && !mapSearch && (
                                        <View style={styles.mapDoneBadge}>
                                            <Icon name="check-circle" size={12} color={colors.success} />
                                            <Text style={styles.mapDoneBadgeText}>{done} done</Text>
                                        </View>
                                    )}
                                </View>

                                <FlatList
                                    data={pending}
                                    keyExtractor={r => String(r.id)}
                                    renderItem={renderMapItem}
                                    scrollEnabled={false}
                                    initialNumToRender={8}
                                    maxToRenderPerBatch={8}
                                    windowSize={5}
                                    removeClippedSubviews
                                    ListEmptyComponent={
                                        <View style={styles.mapAllDone}>
                                            {mapSearch
                                                ? <><Icon name="search" size={28} color={colors.textLight} /><Text style={[styles.mapAllDoneText, { color: colors.textMuted }]}>No customers match your search</Text></>
                                                : <><Icon name="check-circle" size={32} color={colors.success} /><Text style={styles.mapAllDoneText}>All collections done!</Text></>
                                            }
                                        </View>
                                    }
                                />
                            </View>
                        );
                    })()}
                </ScrollView>
            ) : (
                <>
                    {/* ── Search ── */}
                    <View style={styles.searchWrap}>
                        <Icon name="search" size={18} color={colors.textMuted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search name, loan id, phone, pincode…"
                            placeholderTextColor={colors.textMuted}
                            value={search}
                            onChangeText={setSearch}
                        />
                        {!!search && (
                            <TouchableOpacity onPress={() => setSearch('')}>
                                <Icon name="x-circle" size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* ── Filter bar ── */}
                    <View style={styles.filterBar}>
                        <TouchableOpacity
                            style={styles.filterBtn}
                            onPress={() => setFilterModalVisible(true)}
                            activeOpacity={0.85}
                        >
                            <Icon name="sliders" size={15} color={colors.primary} />
                            <Text style={styles.filterBtnText}>Filters</Text>
                            {(activeFilter !== 'ALL' || typeFilter !== 'ALL' || dpdFilter !== 'ALL') && (
                                <View style={styles.filterBadge}>
                                    <Text style={styles.filterBadgeText}>
                                        {(activeFilter !== 'ALL' ? 1 : 0) + (typeFilter !== 'ALL' ? 1 : 0) + (dpdFilter !== 'ALL' ? 1 : 0)}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <Text style={styles.filterSummary} numberOfLines={1}>
                            {(activeFilter === 'ALL' ? 'All' : STATUS_META[activeFilter]?.label)}
                            {'  ·  '}
                            {(typeFilter === 'ALL' ? 'All Types' : TYPE_META[typeFilter]?.label)}
                            {typeFilter === 'OD' && dpdFilter !== 'ALL' ? ` (DPD ${dpdFilter})` : ''}
                            {'  ·  '}{filtered.length} results
                        </Text>
                        {(activeFilter !== 'ALL' || typeFilter !== 'ALL' || dpdFilter !== 'ALL') && (
                            <TouchableOpacity
                                style={styles.resetIconBtn}
                                onPress={() => { setActiveFilter('ALL'); setTypeFilter('ALL'); setDpdFilter('ALL'); }}
                                activeOpacity={0.75}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Icon name="rotate-ccw" size={15} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* ── Filter modal: Status (parent) + Type (sub) ── */}
                    <Modal
                        visible={filterModalVisible}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setFilterModalVisible(false)}
                    >
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Filters</Text>
                                    <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                                        <Icon name="x" size={22} color={colors.textDark} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.fieldLabel}>Status</Text>
                                <View style={styles.statusGrid}>
                                    <TouchableOpacity
                                        style={[styles.statusOption, activeFilter === 'ALL' && { backgroundColor: colors.textDark, borderColor: colors.textDark }]}
                                        onPress={() => setActiveFilter('ALL')}
                                    >
                                        <Text style={[styles.statusOptionText, activeFilter === 'ALL' && { color: '#FFFFFF' }]}>
                                            All ({stats.total})
                                        </Text>
                                    </TouchableOpacity>
                                    {STATUS_OPTIONS.map(o => {
                                        const active = activeFilter === o.value;
                                        return (
                                            <TouchableOpacity
                                                key={o.value}
                                                style={[styles.statusOption, active && { backgroundColor: o.color, borderColor: o.color }]}
                                                onPress={() => setActiveFilter(o.value)}
                                            >
                                                <Text style={[styles.statusOptionText, active && { color: '#FFFFFF' }]}>
                                                    {o.label} ({stats.countBy[o.value] || 0})
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <Text style={styles.fieldLabel}>Type</Text>
                                <View style={styles.statusGrid}>
                                    {TYPE_OPTIONS.map(o => {
                                        const active = typeFilter === o.value;
                                        const activeColor = o.color || colors.textDark;
                                        return (
                                            <TouchableOpacity
                                                key={o.value}
                                                style={[styles.statusOption, active && { backgroundColor: activeColor, borderColor: activeColor }]}
                                                onPress={() => {
                                                    setTypeFilter(o.value);
                                                    if (o.value !== 'OD') setDpdFilter('ALL');
                                                }}
                                            >
                                                <Text style={[styles.statusOptionText, active && { color: '#FFFFFF' }]}>{o.label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {typeFilter === 'OD' && (
                                    <>
                                        <Text style={styles.fieldLabel}>DPD Range</Text>
                                        <View style={styles.statusGrid}>
                                            <TouchableOpacity
                                                style={[styles.statusOption, dpdFilter === 'ALL' && { backgroundColor: colors.danger, borderColor: colors.danger }]}
                                                onPress={() => setDpdFilter('ALL')}
                                            >
                                                <Text style={[styles.statusOptionText, dpdFilter === 'ALL' && { color: '#FFFFFF' }]}>All</Text>
                                            </TouchableOpacity>
                                            {DPD_BUCKET_OPTIONS.map(b => {
                                                const active = dpdFilter === b.value;
                                                return (
                                                    <TouchableOpacity
                                                        key={b.value}
                                                        style={[styles.statusOption, active && { backgroundColor: colors.danger, borderColor: colors.danger }]}
                                                        onPress={() => setDpdFilter(b.value)}
                                                    >
                                                        <Text style={[styles.statusOptionText, active && { color: '#FFFFFF' }]}>{b.label}</Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </>
                                )}

                                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                                    <TouchableOpacity
                                        style={[styles.saveBtn, styles.resetBtn, { flex: 1 }]}
                                        onPress={() => { setActiveFilter('ALL'); setTypeFilter('ALL'); setDpdFilter('ALL'); }}
                                    >
                                        <Text style={[styles.saveBtnText, { color: colors.textDark }]}>Reset</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.saveBtn, { flex: 1, marginTop: 0 }]}
                                        onPress={() => setFilterModalVisible(false)}
                                    >
                                        <Text style={styles.saveBtnText}>Apply</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>

                    {loading ? (
                        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
                    ) : (
                        <FlatList
                            data={filtered}
                            keyExtractor={(item) => String(item.id)}
                            renderItem={renderItem}
                            contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                            onEndReached={onEndReached}
                            onEndReachedThreshold={0.3}
                            initialNumToRender={10}
                            maxToRenderPerBatch={10}
                            windowSize={7}
                            removeClippedSubviews
                            ListFooterComponent={
                                pageLoading
                                    ? <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                                          <ActivityIndicator size="small" color={colors.primary} />
                                          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Loading more…</Text>
                                      </View>
                                    : !hasMore && records.length > 0
                                        ? <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                                              <Text style={{ fontSize: 11, color: colors.textMuted }}>All {records.length} records loaded</Text>
                                          </View>
                                        : null
                            }
                            ListEmptyComponent={
                                <View style={styles.center}>
                                    <Icon name="inbox" size={40} color={colors.textLight} />
                                    <Text style={styles.emptyText}>
                                        {records.length === 0 ? 'No customers assigned to you yet.' : 'No records match this filter.'}
                                    </Text>
                                </View>
                            }
                        />
                    )}
                </>
            )}

            {/* ── Update modal ── */}
            <Modal visible={modal.open} transparent animationType="slide" onRequestClose={() => setModal({ open: false, record: null })}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Update Collection</Text>
                            <TouchableOpacity onPress={() => setModal({ open: false, record: null })}>
                                <Icon name="x" size={22} color={colors.textDark} />
                            </TouchableOpacity>
                        </View>
                        {modal.record && (
                            <Text style={styles.modalSub}>
                                {modal.record.customer_name} · Loan {modal.record.loan_id}
                            </Text>
                        )}

                        <Text style={styles.fieldLabel}>Status</Text>
                        <View style={styles.statusGrid}>
                            {STATUS_OPTIONS.map(o => {
                                const active = form.status === o.value;
                                return (
                                    <TouchableOpacity
                                        key={o.value}
                                        style={[styles.statusOption, active && { backgroundColor: o.color, borderColor: o.color }]}
                                        onPress={() => setForm(f => {
                                            const next = { ...f, status: o.value };
                                            // Auto-fill full EMI amount when "Collected" is selected
                                            if (o.value === 'COLLECTED') {
                                                const emi = modal.record?.amount_due;
                                                if (emi != null) next.collected_amount = String(emi);
                                            }
                                            // Clear amount when switching away from collection statuses
                                            if (o.value !== 'COLLECTED' && o.value !== 'PARTIALLY_COLLECTED') {
                                                next.collected_amount = '';
                                            }
                                            // Clear promise date when switching away from P2P
                                            if (o.value !== 'PENDING') {
                                                next.promise_date = null;
                                            }
                                            // Clear visit reason when switching away from Visited
                                            if (o.value !== 'VISITED') {
                                                next.visit_reason = '';
                                            }
                                            return next;
                                        })}
                                    >
                                        <Text style={[styles.statusOptionText, active && { color: '#FFFFFF' }]}>{o.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {form.status === 'PENDING' && (
                            <>
                                <Text style={styles.fieldLabel}>Promise to Pay Date</Text>
                                <TouchableOpacity
                                    style={styles.input}
                                    onPress={() => setShowPromiseDatePicker(true)}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                                        <Icon name="calendar" size={16} color={colors.textMuted} />
                                        <Text style={{ color: form.promise_date ? colors.textDark : colors.textMuted }}>
                                            {form.promise_date ? fmtDate(form.promise_date) : 'Select date customer will pay'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                                {showPromiseDatePicker && (
                                    <DateTimePicker
                                        value={form.promise_date || new Date()}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        minimumDate={new Date()}
                                        onChange={(event, selectedDate) => {
                                            setShowPromiseDatePicker(Platform.OS === 'ios');
                                            if (selectedDate) {
                                                setForm(f => ({ ...f, promise_date: selectedDate }));
                                            }
                                        }}
                                    />
                                )}
                            </>
                        )}

                        {form.status === 'VISITED' && (
                            <>
                                <Text style={styles.fieldLabel}>Visit Reason</Text>
                                <View style={styles.statusGrid}>
                                    {VISIT_REASON_OPTIONS.map(o => {
                                        const active = form.visit_reason === o.value;
                                        return (
                                            <TouchableOpacity
                                                key={o.value}
                                                style={[styles.statusOption, active && { backgroundColor: colors.info, borderColor: colors.info }]}
                                                onPress={() => setForm(f => ({ ...f, visit_reason: o.value }))}
                                            >
                                                <Text style={[styles.statusOptionText, active && { color: '#FFFFFF' }]}>{o.label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </>
                        )}

                        {(form.status === 'COLLECTED' || form.status === 'PARTIALLY_COLLECTED') && (
                            <>
                                <View style={styles.amountLabelRow}>
                                    <Text style={styles.fieldLabel}>Collected Amount (₹)</Text>
                                    {form.status === 'COLLECTED' && modal.record?.amount_due != null && (
                                        <View style={styles.emiHint}>
                                            <Icon name="zap" size={11} color={colors.success} />
                                            <Text style={styles.emiHintText}>Auto-filled from EMI</Text>
                                        </View>
                                    )}
                                </View>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    value={form.collected_amount}
                                    onChangeText={(v) => setForm(f => ({ ...f, collected_amount: v.replace(/[^0-9.]/g, '') }))}
                                    placeholder="0"
                                    placeholderTextColor={colors.textMuted}
                                />
                                {form.status === 'COLLECTED' && modal.record?.amount_due != null && (
                                    <Text style={styles.emiSub}>
                                        EMI due: ₹{Number(modal.record.amount_due).toLocaleString('en-IN')} — edit if different
                                    </Text>
                                )}
                            </>
                        )}

                        <Text style={styles.fieldLabel}>Remarks</Text>
                        <TextInput
                            style={[styles.input, styles.remarksInput]}
                            multiline
                            value={form.remarks}
                            onChangeText={(v) => setForm(f => ({ ...f, remarks: v }))}
                            placeholder="Optional notes"
                            placeholderTextColor={colors.textMuted}
                        />

                        {/* GPS capture notice */}
                        <View style={styles.gpsNotice}>
                            <Icon name="crosshair" size={13} color={colors.textMuted} />
                            <Text style={styles.gpsNoticeText}>Your GPS location will be captured automatically on save</Text>
                        </View>

                        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
                            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
    emptyText: { marginTop: spacing.sm, color: colors.textMuted, fontSize: typography.sizes.sm, textAlign: 'center' },

    // Header
    header: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.lg,
        borderBottomLeftRadius: borderRadius.xl,
        borderBottomRightRadius: borderRadius.xl,
    },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold, color: '#FFFFFF' },
    headerSub: { fontSize: typography.sizes.xs, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    toggleBtn: { padding: spacing.xs + 2, paddingHorizontal: spacing.sm },
    toggleBtnActive: { backgroundColor: '#FFFFFF' },
    refreshBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    },
    kpiRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    kpiPill: {
        flex: 1, backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: borderRadius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, alignItems: 'center',
    },
    kpiValue: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: '#FFFFFF' },
    kpiLabel: { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

    // Map
    mapContainer: { flex: 1 },
    mapWrapper: { flex: 1 },
    map: { flex: 1 },
    mapEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    legendScroll: { maxHeight: 40 },
    legendRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: spacing.md },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLine: { width: 18, height: 3, backgroundColor: colors.primary, borderRadius: 2 },
    legendText: { fontSize: 11, color: colors.textMedium },

    // Zoom controls (floating right side, above map layer)
    zoomControls: {
        position: 'absolute', right: 12, top: 60,
        zIndex: 10, elevation: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 5,
        overflow: 'hidden',
    },
    zoomBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
    zoomDivider: { height: 1, backgroundColor: '#E2E8F0', marginHorizontal: 6 },

    // Recenter button (floating right side below zoom)
    recenterBtn: {
        position: 'absolute', right: 12, top: 168,
        zIndex: 10, elevation: 10,
        width: 42, height: 42, borderRadius: 10,
        backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 5,
    },

    // Map empty state
    mapEmptyTitle: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.textDark, marginTop: spacing.md, textAlign: 'center' },
    mapEmptySub: { fontSize: typography.sizes.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },

    // Map mode customer list below the map
    mapListSection: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 120 },
    mapSearchWrap: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        borderWidth: 1, borderColor: colors.border,
        paddingHorizontal: spacing.sm, paddingVertical: 9,
        marginBottom: spacing.sm,
    },
    mapSearchInput: {
        flex: 1, fontSize: typography.sizes.sm, color: colors.textDark,
        marginLeft: 4, paddingVertical: 0,
    },
    mapListHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    mapListHeader: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.textDark },
    mapDoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successLight || '#d1fae5', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
    mapDoneBadgeText: { fontSize: 11, fontWeight: '600', color: colors.success },
    mapListCard: {
        flexDirection: 'row', alignItems: 'stretch',
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
        overflow: 'hidden',
    },
    mapListAccent: { width: 4, borderRadius: 0 },
    mapListTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2, paddingTop: spacing.sm, paddingHorizontal: spacing.sm },
    mapListRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, marginBottom: 4 },
    mapListInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, marginBottom: 3 },
    mapListInfoText: { fontSize: 11, color: colors.textMuted, flex: 1 },
    mapListBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.sm, flexWrap: 'wrap' },
    mapListActions: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, paddingTop: 6 },
    mapListName: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.textDark, flex: 1 },
    mapListSub: { fontSize: 11, color: colors.textMuted },
    mapListAmt: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginLeft: 8 },
    mapStatusChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
    mapStatusChipText: { fontSize: 10, fontWeight: '600' },
    mapNavBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.primaryLight || '#eff6ff', borderWidth: 1, borderColor: colors.primary + '30' },
    mapNavBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
    mapUpdateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.primary },
    mapUpdateBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
    mapChevronBtn: { padding: 6 },
    mapAllDone: { alignItems: 'center', paddingVertical: 32, gap: 8 },
    mapAllDoneText: { fontSize: typography.sizes.sm, color: colors.success, fontWeight: '600' },

    // Map marker callout
    calloutBox: { width: 200, padding: 10, borderRadius: 10 },
    calloutName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
    calloutSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
    calloutAmt: { fontSize: 13, fontWeight: '600', color: '#1e293b', marginTop: 4 },
    calloutActions: { flexDirection: 'row', gap: 6, marginTop: 8 },
    calloutBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, borderRadius: 6 },
    calloutBtnText: { fontSize: 11, fontWeight: '600', color: '#fff' },

    // GPS indicator dot on card
    gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginLeft: 4 },

    // Search
    searchWrap: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        backgroundColor: colors.surface, marginHorizontal: spacing.md, marginTop: spacing.md,
        paddingHorizontal: spacing.md, borderRadius: borderRadius.md,
        borderWidth: 1, borderColor: colors.border,
    },
    searchInput: { flex: 1, paddingVertical: spacing.sm, fontSize: typography.sizes.sm, color: colors.textDark, marginLeft: spacing.xs },

    // Filters
    filterBar: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    filterBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
        borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.primary,
        backgroundColor: colors.surface,
    },
    filterBtnText: { fontSize: typography.sizes.xs, fontWeight: '700', color: colors.primary },
    filterBadge: {
        backgroundColor: colors.primary, borderRadius: borderRadius.full,
        minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    },
    filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
    filterSummary: { flex: 1, fontSize: typography.sizes.xs, color: colors.textMuted },
    resetIconBtn: {
        width: 30, height: 30, borderRadius: 15,
        borderWidth: 1, borderColor: colors.primary + '50',
        backgroundColor: colors.primary + '12',
        alignItems: 'center', justifyContent: 'center',
    },
    resetBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },

    loanRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
    typeTag: { paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: borderRadius.sm, marginLeft: spacing.xs },
    typeTagText: { fontSize: 10, fontWeight: '700' },

    // Card
    card: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    cardAccent: { width: 4 },
    cardBody: { flex: 1, padding: spacing.md },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
    customerName: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.textDark },
    loanId: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
    statusChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.md },
    statusChipText: { fontSize: 12, fontWeight: '700' },
    divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
    rowText: { flex: 1, fontSize: typography.sizes.sm, color: colors.textMedium, marginLeft: spacing.xs },
    bold: { fontWeight: typography.weights.bold, color: colors.textDark },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
    iconBtn: {
        width: 40, height: 40, borderRadius: borderRadius.md,
        borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    },
    updateBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
        backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.sm,
    },
    updateBtnText: { color: '#FFFFFF', fontWeight: '700', marginLeft: spacing.xs },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
        padding: spacing.lg, paddingBottom: spacing.xxl,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark },
    modalSub: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 4, marginBottom: spacing.sm },
    fieldLabel: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.textMedium, marginTop: spacing.sm, marginBottom: spacing.xs },
    amountLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, marginBottom: spacing.xs },
    emiHint: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successLight || '#d1fae5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    emiHintText: { fontSize: 10, fontWeight: '600', color: colors.success },
    emiSub: { fontSize: 11, color: colors.textMuted, marginTop: 4, marginBottom: 2 },
    statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    statusOption: {
        paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
        borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs, marginBottom: spacing.xs,
    },
    statusOptionText: { fontSize: typography.sizes.xs, color: colors.textMedium, fontWeight: '600' },
    input: {
        borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontSize: typography.sizes.sm, color: colors.textDark,
    },
    remarksInput: { height: 70, textAlignVertical: 'top' },
    gpsNotice: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: spacing.sm, paddingVertical: spacing.xs,
    },
    gpsNoticeText: { fontSize: 11, color: colors.textMuted },
    saveBtn: {
        backgroundColor: colors.primary, borderRadius: borderRadius.md,
        paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm,
    },
    saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: typography.sizes.md },
});

export default CollectionsScreen;
