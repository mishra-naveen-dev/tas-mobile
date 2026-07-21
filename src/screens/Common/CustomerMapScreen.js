import React, { useState, useEffect, useCallback, useMemo, useRef, Component } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    TextInput,
    ScrollView,
    Modal,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MapView, { PROVIDER_GOOGLE, Marker, Callout } from 'react-native-maps';
import Supercluster from 'supercluster';

import api from '../../api/api';
import LocationService from '../../services/LocationService';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';

// Marker coloring by collection status — matches CollectionsScreen's
// PIN_COLOR convention. (Risk-category coloring/filtering removed for now.)
const STATUS_FALLBACK_COLOR = {
    VISITED: '#2196F3',
    COLLECTED: '#4CAF50',
    PARTIALLY_COLLECTED: '#FF9800',
    NOT_PAID: '#F44336',
    PENDING: '#9E9E9E',
};
const markerColorFor = (m) => STATUS_FALLBACK_COLOR[m.status] || STATUS_FALLBACK_COLOR.PENDING;

const STATUS_FILTER_OPTIONS = [
    { value: 'ALL', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'VISITED', label: 'Visited' },
    { value: 'COLLECTED', label: 'Collected' },
    { value: 'PARTIALLY_COLLECTED', label: 'Partial' },
    { value: 'NOT_PAID', label: 'Not Paid' },
];

const RADIUS_OPTIONS_KM = [1, 2, 3, 5, 10, 20];

const DEFAULT_REGION = { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 8, longitudeDelta: 8 };
const REGION_FETCH_DEBOUNCE_MS = 500;
const SEARCH_DEBOUNCE_MS = 400;

const regionToBounds = (region) => ({
    min_lat: region.latitude - region.latitudeDelta / 2,
    max_lat: region.latitude + region.latitudeDelta / 2,
    min_lng: region.longitude - region.longitudeDelta / 2,
    max_lng: region.longitude + region.longitudeDelta / 2,
});

// Same purpose as CollectionsScreen's MapErrorBoundary — a MapView crash
// (bad native module state, etc.) shouldn't take down the whole screen.
class MapErrorBoundary extends Component {
    state = { crashed: false };
    static getDerivedStateFromError() { return { crashed: true }; }
    componentDidCatch(err) { console.warn('[CustomerMap] crash caught:', err?.message); }
    render() {
        if (this.state.crashed) {
            return (
                <View style={styles.mapCrash}>
                    <Icon name="alert-triangle" size={32} color="#d97706" />
                    <Text style={styles.mapCrashTitle}>Map unavailable</Text>
                    <Text style={styles.mapCrashSub}>Could not load the map. Check your connection or try again.</Text>
                    <TouchableOpacity style={styles.mapCrashRetry} onPress={() => this.setState({ crashed: false })}>
                        <Text style={styles.mapCrashRetryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return this.props.children;
    }
}

const CustomerMapScreen = ({ navigation }) => {
    const { isManager } = useAuth();
    const employeeLayerAvailable = !!isManager;

    const mapRef = useRef(null);
    const regionFetchTimerRef = useRef(null);
    const fetchSeqRef = useRef(0);
    const clusterIndexRef = useRef(null);

    const [region, setRegion] = useState(DEFAULT_REGION);
    const [markers, setMarkers] = useState([]);
    const [clusters, setClusters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [truncated, setTruncated] = useState(false);
    const [totalMatching, setTotalMatching] = useState(0);

    const [statusFilter, setStatusFilter] = useState('ALL');
    const [filterVisible, setFilterVisible] = useState(false);

    const [radiusEnabled, setRadiusEnabled] = useState(false);
    const [radiusKm, setRadiusKm] = useState(5);

    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const [userLocation, setUserLocation] = useState(null);

    const [selectedId, setSelectedId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [eta, setEta] = useState(null);
    const [etaLoading, setEtaLoading] = useState(false);

    const [employees, setEmployees] = useState([]);
    const [showEmployees, setShowEmployees] = useState(false);
    const [employeesLoading, setEmployeesLoading] = useState(false);

    const buildFilterParams = useCallback(() => {
        const params = {};
        if (statusFilter !== 'ALL') params.status = statusFilter;
        if (radiusEnabled && userLocation) {
            params.user_lat = userLocation.latitude;
            params.user_lng = userLocation.longitude;
            params.radius_km = radiusKm;
        }
        return params;
    }, [statusFilter, radiusEnabled, userLocation, radiusKm]);

    // Bumped per request so a slow, superseded response can never clobber a
    // faster, newer one — same stale-response guard CollectionsScreen uses.
    const fetchMarkers = useCallback((targetRegion) => {
        const seq = ++fetchSeqRef.current;
        setLoading(true);
        api.getMapMarkers(regionToBounds(targetRegion), buildFilterParams())
            .then(res => {
                if (seq !== fetchSeqRef.current) return;
                setMarkers(Array.isArray(res.data?.markers) ? res.data.markers : []);
                setTruncated(!!res.data?.truncated);
                setTotalMatching(res.data?.total_matching || 0);
            })
            .catch(() => {
                if (seq !== fetchSeqRef.current) return;
                setMarkers([]);
            })
            .finally(() => {
                if (seq === fetchSeqRef.current) setLoading(false);
            });
    }, [buildFilterParams]);

    // Cheap, synchronous, local recompute — no native/network work, so it's
    // safe to run on every pan/zoom without debouncing (unlike fetchMarkers,
    // which hits the network and IS debounced below).
    const recomputeClusters = useCallback((targetRegion) => {
        const index = clusterIndexRef.current;
        if (!index) { setClusters([]); return; }
        const bbox = [
            targetRegion.longitude - targetRegion.longitudeDelta / 2,
            targetRegion.latitude - targetRegion.latitudeDelta / 2,
            targetRegion.longitude + targetRegion.longitudeDelta / 2,
            targetRegion.latitude + targetRegion.latitudeDelta / 2,
        ];
        const zoom = Math.min(20, Math.max(0, Math.round(Math.log2(360 / targetRegion.longitudeDelta))));
        setClusters(index.getClusters(bbox, zoom));
    }, []);

    const onRegionChangeComplete = useCallback((newRegion) => {
        setRegion(newRegion);
        recomputeClusters(newRegion);
        if (regionFetchTimerRef.current) clearTimeout(regionFetchTimerRef.current);
        regionFetchTimerRef.current = setTimeout(() => fetchMarkers(newRegion), REGION_FETCH_DEBOUNCE_MS);
    }, [fetchMarkers, recomputeClusters]);

    const onClusterPress = useCallback((clusterId) => {
        const index = clusterIndexRef.current;
        if (!index) return;
        const leaves = index.getLeaves(clusterId, Infinity);
        const coords = leaves.map(l => ({
            latitude: l.geometry.coordinates[1],
            longitude: l.geometry.coordinates[0],
        }));
        if (coords.length) {
            mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                animated: true,
            });
        }
    }, []);

    // Recenter on the employee's current location — same crosshair pattern
    // CollectionsScreen's map uses.
    const recenterToMyLocation = useCallback(async () => {
        try {
            const loc = await LocationService.getCurrentLocation();
            if (loc?.latitude && loc?.longitude && !loc?.error) {
                const here = { latitude: loc.latitude, longitude: loc.longitude };
                setUserLocation(here);
                const next = { ...here, latitudeDelta: 0.05, longitudeDelta: 0.05 };
                setRegion(next);
                mapRef.current?.animateToRegion(next, 500);
                recomputeClusters(next);
                fetchMarkers(next);
                return;
            }
        } catch (_) {}
        Alert.alert('Location unavailable', 'Could not detect your current location.');
    }, [fetchMarkers, recomputeClusters]);

    // Manual refresh — reloads markers for whatever's currently on screen.
    const onRefresh = useCallback(() => {
        fetchMarkers(region);
    }, [fetchMarkers, region]);

    // Filter changes refetch the current viewport immediately (no debounce —
    // these are deliberate taps, not rapid pan/zoom gestures).
    useEffect(() => {
        fetchMarkers(region);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, radiusEnabled, radiusKm]);

    useEffect(() => {
        return () => { if (regionFetchTimerRef.current) clearTimeout(regionFetchTimerRef.current); };
    }, []);

    // Center on the employee's own location on first mount, then load markers
    // for that viewport — falls back to the all-India default region if GPS
    // is unavailable, exactly like CollectionsMap's reCenter behavior.
    useEffect(() => {
        let cancelled = false;
        LocationService.getCurrentLocation().then(loc => {
            if (cancelled) return;
            if (loc?.latitude && loc?.longitude && !loc?.error) {
                const here = { latitude: loc.latitude, longitude: loc.longitude };
                setUserLocation(here);
                const next = { ...here, latitudeDelta: 0.1, longitudeDelta: 0.1 };
                setRegion(next);
                mapRef.current?.animateToRegion(next, 500);
                fetchMarkers(next);
            } else {
                fetchMarkers(DEFAULT_REGION);
            }
        }).catch(() => { if (!cancelled) fetchMarkers(DEFAULT_REGION); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openMarkerDetail = useCallback((markerId) => {
        setSelectedId(markerId);
        setDetail(null);
        setEta(null);
        setDetailLoading(true);
        const params = userLocation ? { user_lat: userLocation.latitude, user_lng: userLocation.longitude } : {};
        api.getMapDetail(markerId, params)
            .then(res => setDetail(res.data))
            .catch(() => Alert.alert('Not Found', 'This customer could not be loaded.'))
            .finally(() => setDetailLoading(false));
    }, [userLocation]);

    const closeDetail = useCallback(() => {
        setSelectedId(null);
        setDetail(null);
        setEta(null);
    }, []);

    const fetchEta = useCallback(async () => {
        if (!detail) return;
        let loc = userLocation;
        if (!loc) {
            const cur = await LocationService.getCurrentLocation();
            if (cur?.latitude && cur?.longitude && !cur?.error) {
                loc = { latitude: cur.latitude, longitude: cur.longitude };
                setUserLocation(loc);
            }
        }
        if (!loc) {
            Alert.alert('Location needed', 'Could not detect your location for ETA.');
            return;
        }
        setEtaLoading(true);
        try {
            const res = await api.getEta(detail.id, loc.latitude, loc.longitude);
            setEta(res.data);
        } catch (e) {
            Alert.alert('ETA unavailable', e?.response?.data?.error || 'Could not calculate distance right now.');
        } finally {
            setEtaLoading(false);
        }
    }, [detail, userLocation]);

    const navigateToDetail = useCallback(() => {
        if (!detail) return;
        if (detail.customer_latitude && detail.customer_longitude) {
            LocationService.openMaps(detail.customer_latitude, detail.customer_longitude);
        } else {
            Alert.alert('No Location', 'No GPS coordinates available for this customer.');
        }
    }, [detail]);

    // Debounced search-as-you-type against map_search — same 400ms debounce
    // convention CollectionsScreen uses for its list search box.
    useEffect(() => {
        const q = search.trim();
        if (!q) { setSearchResults([]); setSearching(false); return; }
        setSearching(true);
        const t = setTimeout(() => {
            api.getMapSearch(q)
                .then(res => setSearchResults(Array.isArray(res.data?.results) ? res.data.results : []))
                .catch(() => setSearchResults([]))
                .finally(() => setSearching(false));
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [search]);

    const panToResult = useCallback((r) => {
        setSearch('');
        setSearchResults([]);
        const lat = parseFloat(r.customer_latitude);
        const lng = parseFloat(r.customer_longitude);
        if (isNaN(lat) || isNaN(lng)) return;
        const next = { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        setRegion(next);
        mapRef.current?.animateToRegion(next, 500);
        fetchMarkers(next);
        openMarkerDetail(r.id);
    }, [fetchMarkers, openMarkerDetail]);

    const toggleEmployeeLayer = useCallback(() => {
        if (showEmployees) { setShowEmployees(false); return; }
        setEmployeesLoading(true);
        api.getNearbyEmployees()
            .then(res => {
                setEmployees(Array.isArray(res.data?.employees) ? res.data.employees : []);
                setShowEmployees(true);
            })
            .catch(() => Alert.alert('Error', 'Could not load employee locations.'))
            .finally(() => setEmployeesLoading(false));
    }, [showEmployees]);

    const parsedMarkers = useMemo(
        () => markers
            .map(m => ({ ...m, customer_latitude: parseFloat(m.customer_latitude), customer_longitude: parseFloat(m.customer_longitude) }))
            .filter(m => !isNaN(m.customer_latitude) && !isNaN(m.customer_longitude)),
        [markers]
    );

    const parsedEmployees = useMemo(
        () => employees
            .map(e => ({ ...e, latitude: parseFloat(e.latitude), longitude: parseFloat(e.longitude) }))
            .filter(e => !isNaN(e.latitude) && !isNaN(e.longitude)),
        [employees]
    );

    // Rebuild the cluster index whenever the marker set changes (new
    // viewport data from the backend, or a filter change) — supercluster's
    // own load() is cheap even for a few thousand points, well within the
    // backend's MAP_MARKERS_HARD_LIMIT.
    useEffect(() => {
        const index = new Supercluster({ radius: 60, maxZoom: 17, minPoints: 2 });
        index.load(parsedMarkers.map(m => ({
            type: 'Feature',
            properties: { cluster: false, marker: m },
            geometry: { type: 'Point', coordinates: [m.customer_longitude, m.customer_latitude] },
        })));
        clusterIndexRef.current = index;
        recomputeClusters(region);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parsedMarkers]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={22} color={colors.textDark} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Customer Map</Text>
                    <Text style={styles.headerSub}>
                        {loading ? 'Loading…' : `${totalMatching} customer${totalMatching === 1 ? '' : 's'} in view`}
                        {truncated ? ' · zoom in for more' : ''}
                    </Text>
                </View>
                <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} disabled={loading}>
                    <Icon name="refresh-cw" size={20} color={loading ? colors.textLight : colors.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                    <Icon name="search" size={16} color={colors.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search name, loan ID, phone, area..."
                        placeholderTextColor={colors.textMuted}
                        value={search}
                        onChangeText={setSearch}
                    />
                    {searching && <ActivityIndicator size="small" color={colors.primary} />}
                </View>
                <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterVisible(true)} activeOpacity={0.75}>
                    <Icon name="sliders" size={18} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {searchResults.length > 0 && (
                <View style={styles.searchResultsBox}>
                    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 220 }}>
                        {searchResults.map(r => (
                            <TouchableOpacity key={r.id} style={styles.searchResultRow} onPress={() => panToResult(r)} activeOpacity={0.7}>
                                <Icon name="map-pin" size={14} color={colors.primary} />
                                <View style={{ flex: 1, marginLeft: spacing.xs }}>
                                    <Text style={styles.searchResultName} numberOfLines={1}>{r.customer_name}</Text>
                                    <Text style={styles.searchResultSub} numberOfLines={1}>{r.loan_id}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <View style={{ flex: 1 }}>
                <MapErrorBoundary>
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_GOOGLE}
                        style={styles.map}
                        initialRegion={region}
                        onRegionChangeComplete={onRegionChangeComplete}
                        showsUserLocation
                        showsMyLocationButton={false}
                    >
                        {clusters.map(c => {
                            const [longitude, latitude] = c.geometry.coordinates;
                            if (c.properties.cluster) {
                                const clusterId = c.properties.cluster_id;
                                return (
                                    <Marker
                                        key={`cluster-${clusterId}`}
                                        coordinate={{ latitude, longitude }}
                                        onPress={() => onClusterPress(clusterId)}
                                    >
                                        <View style={styles.clusterBubble}>
                                            <Text style={styles.clusterText}>{c.properties.point_count}</Text>
                                        </View>
                                    </Marker>
                                );
                            }
                            const m = c.properties.marker;
                            return (
                                <Marker
                                    key={`cust-${m.id}`}
                                    coordinate={{ latitude, longitude }}
                                    pinColor={markerColorFor(m)}
                                    onPress={() => openMarkerDetail(m.id)}
                                />
                            );
                        })}
                        {showEmployees && parsedEmployees.map(e => (
                            <Marker
                                key={`emp-${e.employee_id}`}
                                coordinate={{ latitude: e.latitude, longitude: e.longitude }}
                                pinColor={colors.info}
                            >
                                <Callout tooltip={false}>
                                    <View style={{ minWidth: 120 }}>
                                        <Text style={{ fontWeight: '700', color: colors.textDark }}>{e.employee_name}</Text>
                                        <Text style={{ fontSize: 11, color: colors.textMuted }}>{e.branch_name || e.employee_code || ''}</Text>
                                    </View>
                                </Callout>
                            </Marker>
                        ))}
                    </MapView>

                    {loading && (
                        <View style={styles.loadingOverlay} pointerEvents="none">
                            <ActivityIndicator size="small" color={colors.primary} />
                        </View>
                    )}

                    <TouchableOpacity style={styles.recenterBtn} onPress={recenterToMyLocation} activeOpacity={0.75}>
                        <Icon name="crosshair" size={20} color={colors.primary} />
                    </TouchableOpacity>

                    {employeeLayerAvailable && (
                        <TouchableOpacity
                            style={[styles.employeeLayerBtn, showEmployees && styles.employeeLayerBtnActive]}
                            onPress={toggleEmployeeLayer}
                            activeOpacity={0.8}
                            disabled={employeesLoading}
                        >
                            {employeesLoading
                                ? <ActivityIndicator size="small" color={showEmployees ? '#fff' : colors.primary} />
                                : <Icon name="users" size={16} color={showEmployees ? '#fff' : colors.primary} />
                            }
                        </TouchableOpacity>
                    )}
                </MapErrorBoundary>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll} contentContainerStyle={styles.legendRow}>
                {STATUS_FILTER_OPTIONS.filter(o => o.value !== 'ALL').map(opt => (
                    <View key={opt.value} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: STATUS_FALLBACK_COLOR[opt.value] }]} />
                        <Text style={styles.legendText}>{opt.label}</Text>
                    </View>
                ))}
            </ScrollView>

            {/* ── Filter sheet ── */}
            <Modal visible={filterVisible} animationType="slide" transparent onRequestClose={() => setFilterVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.sheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Filters</Text>
                            <TouchableOpacity onPress={() => setFilterVisible(false)}>
                                <Icon name="x" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                            <Text style={styles.filterLabel}>Status</Text>
                            <View style={styles.chipRow}>
                                {STATUS_FILTER_OPTIONS.map(opt => (
                                    <TouchableOpacity
                                        key={opt.value}
                                        style={[styles.chip, statusFilter === opt.value && styles.chipActive]}
                                        onPress={() => setStatusFilter(opt.value)}
                                    >
                                        <Text style={[styles.chipText, statusFilter === opt.value && styles.chipTextActive]}>{opt.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.filterLabelRow}>
                                <Text style={styles.filterLabel}>Distance radius</Text>
                                <TouchableOpacity onPress={async () => {
                                    if (radiusEnabled) { setRadiusEnabled(false); return; }
                                    let loc = userLocation;
                                    if (!loc) {
                                        const cur = await LocationService.getCurrentLocation();
                                        if (cur?.latitude && cur?.longitude && !cur?.error) {
                                            loc = { latitude: cur.latitude, longitude: cur.longitude };
                                            setUserLocation(loc);
                                        } else {
                                            Alert.alert('Location needed', 'Could not detect your location.');
                                            return;
                                        }
                                    }
                                    setRadiusEnabled(true);
                                }}>
                                    <Text style={styles.filterToggleText}>{radiusEnabled ? 'On' : 'Off'}</Text>
                                </TouchableOpacity>
                            </View>
                            {radiusEnabled && (
                                <View style={styles.chipRow}>
                                    {RADIUS_OPTIONS_KM.map(km => (
                                        <TouchableOpacity
                                            key={km}
                                            style={[styles.chip, radiusKm === km && styles.chipActive]}
                                            onPress={() => setRadiusKm(km)}
                                        >
                                            <Text style={[styles.chipText, radiusKm === km && styles.chipTextActive]}>{km} km</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </ScrollView>

                        <TouchableOpacity style={styles.applyBtn} onPress={() => setFilterVisible(false)} activeOpacity={0.85}>
                            <Text style={styles.applyBtnText}>Apply</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── Detail sheet ── */}
            <Modal visible={!!selectedId} animationType="slide" transparent onRequestClose={closeDetail}>
                <View style={styles.modalOverlay}>
                    <View style={styles.sheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Customer Details</Text>
                            <TouchableOpacity onPress={closeDetail}>
                                <Icon name="x" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        {detailLoading ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl }} />
                        ) : detail ? (
                            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                                <Text style={styles.detailName}>{detail.customer_name}</Text>
                                <Text style={styles.detailSub}>{detail.loan_id}{detail.product_type ? ` · ${detail.product_type}` : ''}</Text>

                                <View style={styles.detailRow}>
                                    <Icon name="map-pin" size={14} color={colors.textMuted} />
                                    <Text style={styles.detailRowText}>
                                        {[detail.address, detail.area, detail.pincode].filter(Boolean).join(', ') || 'No address'}
                                    </Text>
                                </View>
                                {!!detail.customer_phone && (
                                    <TouchableOpacity style={styles.detailRow} onPress={() => Linking.openURL(`tel:${detail.customer_phone}`)}>
                                        <Icon name="phone" size={14} color={colors.primary} />
                                        <Text style={[styles.detailRowText, { color: colors.primary }]}>{detail.customer_phone}</Text>
                                    </TouchableOpacity>
                                )}
                                <View style={styles.detailRow}>
                                    <Icon name="dollar-sign" size={14} color={colors.textMuted} />
                                    <Text style={styles.detailRowText}>Outstanding: ₹{Number(detail.amount_due || 0).toLocaleString('en-IN')}</Text>
                                </View>
                                {detail.dpd_days != null && (
                                    <View style={styles.detailRow}>
                                        <Icon name="alert-circle" size={14} color={colors.warning} />
                                        <Text style={styles.detailRowText}>DPD: {detail.dpd_days} days{detail.dpd_bucket ? ` (${detail.dpd_bucket})` : ''}</Text>
                                    </View>
                                )}
                                {!!detail.due_date && (
                                    <View style={styles.detailRow}>
                                        <Icon name="calendar" size={14} color={colors.textMuted} />
                                        <Text style={styles.detailRowText}>Planned: {new Date(detail.due_date).toLocaleDateString('en-IN')}</Text>
                                    </View>
                                )}
                                {!!detail.branch_name && (
                                    <View style={styles.detailRow}>
                                        <Icon name="home" size={14} color={colors.textMuted} />
                                        <Text style={styles.detailRowText}>{detail.branch_name}</Text>
                                    </View>
                                )}
                                {!!detail.assigned_employee_name && (
                                    <View style={styles.detailRow}>
                                        <Icon name="user" size={14} color={colors.textMuted} />
                                        <Text style={styles.detailRowText}>Assigned: {detail.assigned_employee_name}</Text>
                                    </View>
                                )}
                                <View style={styles.detailRow}>
                                    <Icon name="clock" size={14} color={colors.textMuted} />
                                    <Text style={styles.detailRowText}>
                                        Last visit: {detail.last_collection_date ? new Date(detail.last_collection_date).toLocaleDateString('en-IN') : '—'}
                                    </Text>
                                </View>
                                {detail.distance_from_me_km != null && (
                                    <View style={styles.detailRow}>
                                        <Icon name="navigation" size={14} color={colors.info} />
                                        <Text style={[styles.detailRowText, { color: colors.info }]}>
                                            {detail.distance_from_me_km < 1
                                                ? `${Math.round(detail.distance_from_me_km * 1000)} m away (straight line)`
                                                : `${detail.distance_from_me_km.toFixed(1)} km away (straight line)`}
                                        </Text>
                                    </View>
                                )}

                                {eta && (
                                    <View style={styles.etaBox}>
                                        <Icon name="truck" size={14} color={colors.success} />
                                        <Text style={styles.etaText}>
                                            {eta.distance_text || `${eta.distance_km?.toFixed(1)} km`}{eta.duration ? ` · ${eta.duration}` : ''}
                                            {eta.is_approximate ? ' (approx.)' : ''}
                                        </Text>
                                    </View>
                                )}

                                <View style={styles.detailActions}>
                                    <TouchableOpacity style={styles.detailBtn} onPress={navigateToDetail} activeOpacity={0.8}>
                                        <Icon name="navigation" size={15} color="#fff" />
                                        <Text style={styles.detailBtnText}>Navigate</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.detailBtn, { backgroundColor: colors.info }]}
                                        onPress={fetchEta}
                                        disabled={etaLoading}
                                        activeOpacity={0.8}
                                    >
                                        {etaLoading ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="clock" size={15} color="#fff" />}
                                        <Text style={styles.detailBtnText}>Get ETA</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        ) : (
                            <Text style={styles.detailRowText}>Could not load this customer.</Text>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default CustomerMapScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: { padding: spacing.xs, marginRight: spacing.xs },
    refreshBtn: { padding: spacing.xs, marginLeft: spacing.xs },
    headerTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark },
    headerSub: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },

    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
        backgroundColor: colors.surface,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.sm,
        height: 40,
        gap: 6,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchInput: { flex: 1, fontSize: typography.sizes.sm, color: colors.textDark, padding: 0 },
    filterBtn: {
        width: 40, height: 40, borderRadius: borderRadius.md,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.primaryLight,
    },

    searchResultsBox: {
        position: 'absolute',
        top: 100,
        left: spacing.md,
        right: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        zIndex: 20,
        ...shadows.lg,
    },
    searchResultRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderBottomWidth: 1, borderBottomColor: colors.divider,
    },
    searchResultName: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textDark },
    searchResultSub: { fontSize: typography.sizes.xs, color: colors.textMuted },

    map: { flex: 1 },
    mapCrash: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    mapCrashTitle: { fontSize: 14, fontWeight: '700', color: '#92400e', marginTop: 12, textAlign: 'center' },
    mapCrashSub: { fontSize: 12, color: '#b45309', marginTop: 4, textAlign: 'center' },
    mapCrashRetry: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#fef3c7', borderRadius: 8, borderWidth: 1, borderColor: '#fbbf24' },
    mapCrashRetryText: { fontSize: 13, fontWeight: '700', color: '#92400e' },

    loadingOverlay: {
        position: 'absolute', top: spacing.sm, alignSelf: 'center',
        backgroundColor: colors.surface, borderRadius: borderRadius.full,
        padding: spacing.xs, ...shadows.sm,
    },

    clusterBubble: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: '#fff', ...shadows.sm,
    },
    clusterText: { color: '#fff', fontWeight: typography.weights.bold, fontSize: typography.sizes.sm },

    employeeLayerBtn: {
        position: 'absolute', right: spacing.md, bottom: spacing.md,
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
        ...shadows.md,
    },
    employeeLayerBtnActive: { backgroundColor: colors.info },
    // Stacked directly above employeeLayerBtn (60 = its bottom offset + height)
    // so the two floating buttons never overlap regardless of role.
    recenterBtn: {
        position: 'absolute', right: spacing.md, bottom: 60 + spacing.sm,
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
        ...shadows.md,
    },

    legendScroll: { maxHeight: 40, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
    legendRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.md, height: 40 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: typography.sizes.xs, color: colors.textMuted },

    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
        padding: spacing.md, maxHeight: '80%',
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    sheetTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.textDark },

    filterLabel: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textDark, marginTop: spacing.sm, marginBottom: spacing.xs },
    filterLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
    filterToggleText: { color: colors.primary, fontWeight: typography.weights.bold },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
        paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full,
        backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: typography.sizes.xs, color: colors.textMedium, fontWeight: typography.weights.medium },
    chipTextActive: { color: '#fff' },

    applyBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.lg },
    applyBtnText: { color: '#fff', fontWeight: typography.weights.bold, fontSize: typography.sizes.sm },

    detailName: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark },
    detailSub: { fontSize: typography.sizes.sm, color: colors.textMuted, marginBottom: spacing.sm },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
    detailRowText: { fontSize: typography.sizes.sm, color: colors.textMedium, flex: 1 },
    etaBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.successLight, borderRadius: borderRadius.md,
        padding: spacing.sm, marginTop: spacing.xs,
    },
    etaText: { fontSize: typography.sizes.sm, color: colors.textDark, fontWeight: typography.weights.medium },
    detailActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md },
    detailBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.sm,
    },
    detailBtnText: { color: '#fff', fontWeight: typography.weights.bold, fontSize: typography.sizes.sm },
});
