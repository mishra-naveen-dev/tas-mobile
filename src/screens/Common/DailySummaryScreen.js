import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, ScrollView, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';
import { filterGpsOutliers, calcTotalDistanceKm } from '../../utils/gpsUtils';
import { SkeletonStatsGrid, SkeletonListItem } from '../../components/SkeletonComponents';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const todayStr = () => fmt(new Date());

const fmtTime = (iso) => {
    if (!iso) return '--';
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return '--'; }
};

const fmtDuration = (start, end) => {
    if (!start || !end) return null;
    const mins = Math.round((new Date(end) - new Date(start)) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const addDays = (d, n) => {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
};

const PUNCH_META = {
    PUNCH_IN:     { icon: 'log-in',      color: '#059669', bg: '#D1FAE5', label: 'Punch In'     },
    PUNCH_OUT:    { icon: 'log-out',     color: '#DC2626', bg: '#FEE2E2', label: 'Punch Out'    },
    COLLECTION:   { icon: 'dollar-sign', color: '#2563EB', bg: '#DBEAFE', label: 'Collection'   },
    DISBURSEMENT: { icon: 'trending-up', color: '#D97706', bg: '#FEF3C7', label: 'Disbursement' },
};
const getMeta = (type = '') => PUNCH_META[type.toUpperCase()] || { icon: 'map-pin', color: colors.primary, bg: colors.primaryLight, label: type };

// ─── Sub-components ───────────────────────────────────────────────────────────

const KpiTile = ({ icon, label, value, sub, color, bg }) => (
    <View style={[kpiStyles.tile, { backgroundColor: bg }]}>
        <View style={[kpiStyles.iconWrap, { backgroundColor: color + '22' }]}>
            <Icon name={icon} size={18} color={color} />
        </View>
        <Text style={[kpiStyles.value, { color }]}>{value}</Text>
        {sub ? <Text style={kpiStyles.sub}>{sub}</Text> : null}
        <Text style={kpiStyles.label}>{label}</Text>
    </View>
);

const kpiStyles = StyleSheet.create({
    tile: { flex: 1, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center', marginHorizontal: 4, ...shadows.sm },
    iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    value: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
    sub: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
    label: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: typography.weights.medium },
});

const TimelinePunch = ({ punch, index, isLast }) => {
    const meta = getMeta(punch.punch_type);
    const hasGps = punch.latitude && punch.longitude &&
        parseFloat(punch.latitude) !== 0 && parseFloat(punch.longitude) !== 0;

    return (
        <View style={tlStyles.row}>
            {/* Left: dot + line */}
            <View style={tlStyles.rail}>
                <View style={[tlStyles.dot, { backgroundColor: meta.color, borderColor: meta.bg }]}>
                    <Icon name={meta.icon} size={11} color="#fff" />
                </View>
                {!isLast && <View style={tlStyles.line} />}
            </View>

            {/* Right: card */}
            <View style={[tlStyles.card, { borderLeftColor: meta.color }]}>
                <View style={tlStyles.cardTop}>
                    <View>
                        <View style={[tlStyles.typeBadge, { backgroundColor: meta.bg }]}>
                            <Text style={[tlStyles.typeText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                        {punch.customer_name ? (
                            <Text style={tlStyles.customerName}>{punch.customer_name}</Text>
                        ) : null}
                    </View>
                    <Text style={tlStyles.time}>{fmtTime(punch.punched_at)}</Text>
                </View>

                {punch.current_address ? (
                    <View style={tlStyles.addrRow}>
                        <Icon name="map-pin" size={11} color={colors.textMuted} />
                        <Text style={tlStyles.addr} numberOfLines={2}>{punch.current_address}</Text>
                    </View>
                ) : null}

                <View style={tlStyles.footerRow}>
                    {hasGps ? (
                        <View style={tlStyles.gpsBadge}>
                            <Icon name="crosshair" size={10} color={colors.success} />
                            <Text style={tlStyles.gpsText}>GPS</Text>
                        </View>
                    ) : (
                        <View style={[tlStyles.gpsBadge, { backgroundColor: '#FEF3C7' }]}>
                            <Icon name="alert-triangle" size={10} color={colors.warning} />
                            <Text style={[tlStyles.gpsText, { color: colors.warning }]}>No GPS</Text>
                        </View>
                    )}
                    {punch.amount ? (
                        <View style={[tlStyles.amtBadge, { backgroundColor: meta.bg }]}>
                            <Text style={[tlStyles.amtText, { color: meta.color }]}>
                                ₹{Number(punch.amount).toLocaleString('en-IN')}
                            </Text>
                        </View>
                    ) : null}
                    {punch.distance_km ? (
                        <Text style={tlStyles.distText}>{punch.distance_km} km</Text>
                    ) : null}
                </View>
            </View>
        </View>
    );
};

const tlStyles = StyleSheet.create({
    row: { flexDirection: 'row', marginBottom: 0 },
    rail: { width: 36, alignItems: 'center' },
    dot: {
        width: 28, height: 28, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, zIndex: 1,
    },
    line: { flex: 1, width: 2, backgroundColor: '#E5E7EB', marginTop: 2 },
    card: {
        flex: 1, marginLeft: 10, marginBottom: 16,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.sm, borderLeftWidth: 3,
        ...shadows.xs,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
    typeText: { fontSize: 11, fontWeight: '700' },
    customerName: { fontSize: 12, color: colors.textDark, marginTop: 3, fontWeight: '500' },
    time: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.textDark },
    addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 6 },
    addr: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
    footerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    gpsBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#D1FAE5', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    gpsText: { fontSize: 10, color: colors.success, fontWeight: '600' },
    amtBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    amtText: { fontSize: 11, fontWeight: '700' },
    distText: { fontSize: 11, color: colors.textMuted },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

const DailySummaryScreen = ({ navigation }) => {
    const auth = useAuth();
    const adminMode = auth.isAdmin || auth.isSuperAdmin;

    const [activeDate, setActiveDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);
    const [punches,    setPunches]    = useState([]);
    const [liveRoute,  setLiveRoute]  = useState(null); // { distance, points, sessions }
    const [duration,   setDuration]   = useState(null); // "Xh Ym" from session or API
    // P2P-aware "visits" count for collection activity today — from the same
    // CollectionUpdate-backed visit_summary() endpoint the Home Screen / My
    // Performance already use, not a raw punch count (see stats useMemo below).
    const [collectionVisits, setCollectionVisits] = useState(0);
    const [loading,    setLoading]    = useState(false);
    const [error,      setError]      = useState(null);
    const [fetched,    setFetched]    = useState(false);

    const dateStr = fmt(activeDate);
    const isToday = dateStr === todayStr();

    // ── Fetch ──────────────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const liveParams  = { date: dateStr };
            const punchParams = { date_from: dateStr, date_to: dateStr };
            if (adminMode) { /* keep unscoped — server returns all */ }

            const [punchRes, liveRes, summaryRes, visitRes] = await Promise.allSettled([
                api.getPunchHistory(punchParams),
                api.getLiveDailyRoute(liveParams),
                api.getDailySummary({ date: dateStr }),
                api.getVisitSummary({ date_from: dateStr, date_to: dateStr }),
            ]);

            // ── Punch records ──────────────────────────────────────────────────
            if (punchRes.status === 'fulfilled') {
                const raw = Array.isArray(punchRes.value.data)
                    ? punchRes.value.data
                    : (punchRes.value.data?.results || []);
                setPunches(raw.sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at)));
            }

            // ── GPS route & distance ───────────────────────────────────────────
            if (liveRes.status === 'fulfilled' && liveRes.value?.data?.route?.length > 0) {
                const clean = filterGpsOutliers(liveRes.value.data.route);
                setLiveRoute({
                    distance: calcTotalDistanceKm(clean),
                    points:   clean.length,
                    sessions: liveRes.value.data.total_sessions ?? 0,
                });
            } else {
                setLiveRoute(null);
            }

            // ── Duration from daily summary (most reliable source) ────────────
            if (summaryRes.status === 'fulfilled') {
                setDuration(summaryRes.value?.data?.duration || null);
            }

            // ── P2P-aware collection visits (VISIT rule's COLLECTION bucket:
            // P2P/NOT_PAID outcomes count, COLLECTED/PARTIALLY_COLLECTED don't) ──
            setCollectionVisits(visitRes.status === 'fulfilled'
                ? (visitRes.value?.data?.buckets?.COLLECTION?.count ?? 0)
                : 0);
        } catch {
            setError('Failed to load data. Pull down to retry.');
        } finally {
            setLoading(false);
            setFetched(true);
        }
    }, [dateStr, adminMode]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Derived stats ──────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const punchIns  = punches.filter(p => p.punch_type === 'PUNCH_IN');
        const punchOuts = punches.filter(p => p.punch_type === 'PUNCH_OUT');
        // AttendancePunch.punch_type is only ever PUNCH_IN/PUNCH_OUT — the
        // COLLECTION/DISBURSEMENT classification lives on visit_type (see
        // apps.attendance.views.daily_summary, which sums the same way).
        // Filtering on punch_type here always returned an empty set, so the
        // "Collected"/"Disbursed" tiles below silently showed ₹0 regardless
        // of real activity.
        const colls     = punches.filter(p => p.visit_type === 'COLLECTION');
        const disbs     = punches.filter(p => p.visit_type === 'DISBURSEMENT');
        return {
            punchInCount:  punchIns.length,
            punchOutCount: punchOuts.length,
            collection:    colls.reduce((s, p) => s + parseFloat(p.amount || 0), 0),
            disbursement:  disbs.reduce((s, p) => s + parseFloat(p.amount || 0), 0),
            disbursementCount: disbs.length,
            firstPunch:    punches[0]?.punched_at,
            lastPunch:     punches[punches.length - 1]?.punched_at,
        };
    }, [punches]);

    const sessionDuration = duration || fmtDuration(stats.firstPunch, stats.lastPunch);

    // ── Date navigation ────────────────────────────────────────────────────────
    const goDay = (dir) => {
        const next = addDays(activeDate, dir);
        if (next > new Date()) return;
        setFetched(false);
        setActiveDate(next);
    };

    const onDateChange = (_, selected) => {
        if (Platform.OS !== 'ios') setShowPicker(false);
        if (selected && selected <= new Date()) {
            setFetched(false);
            setActiveDate(selected);
        }
    };

    const displayDate = () => {
        if (isToday) return 'Today';
        const diff = Math.round((new Date().setHours(0,0,0,0) - activeDate.setHours(0,0,0,0)) / 86400000);
        if (diff === 1) return 'Yesterday';
        return activeDate.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={s.container} edges={['top']}>

            {/* ── Gradient header ── */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                    <Icon name="arrow-left" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={s.headerTitle}>Daily Activity</Text>
                    <Text style={s.headerSub}>
                        {adminMode ? 'All Employees' : 'My Activity'}
                    </Text>
                </View>
                <TouchableOpacity onPress={fetchAll} style={s.refreshBtn} disabled={loading}>
                    {loading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Icon name="refresh-cw" size={18} color="#fff" />}
                </TouchableOpacity>
            </View>

            {/* ── Date navigator ── */}
            <View style={s.dateNav}>
                <TouchableOpacity style={s.navArrow} onPress={() => goDay(-1)}>
                    <Icon name="chevron-left" size={22} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={s.datePill} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
                    <Icon name="calendar" size={14} color={colors.primary} />
                    <Text style={s.datePillText}>{displayDate()}</Text>
                    <Icon name="chevron-down" size={13} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[s.navArrow, isToday && s.navDisabled]}
                    onPress={() => goDay(1)}
                    disabled={isToday}
                >
                    <Icon name="chevron-right" size={22} color={isToday ? colors.border : colors.primary} />
                </TouchableOpacity>
            </View>

            {showPicker && (
                <DateTimePicker
                    value={activeDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    maximumDate={new Date()}
                    onChange={onDateChange}
                />
            )}

            {/* ── Content ── */}
            {loading && !fetched ? (
                <View style={{ padding: spacing.md }}>
                    <SkeletonStatsGrid style={{ marginBottom: spacing.md }} />
                    {[1, 2, 3].map(i => (
                        <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
                    ))}
                </View>
            ) : (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={s.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={loading && fetched}
                            onRefresh={fetchAll}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                >
                    {/* ── Error ── */}
                    {error ? (
                        <View style={s.errorBox}>
                            <Icon name="alert-circle" size={14} color={colors.error} />
                            <Text style={s.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {/* ── KPI tiles ── */}
                    {fetched && (
                        <>
                            <View style={s.kpiRow}>
                                <KpiTile
                                    icon="navigation"
                                    label="Distance"
                                    value={liveRoute ? `${liveRoute.distance} km` : '—'}
                                    sub={liveRoute ? `${liveRoute.points} pts` : 'No GPS track'}
                                    color="#7c3aed"
                                    bg="#F5F3FF"
                                />
                                <KpiTile
                                    icon="clock"
                                    label="Duration"
                                    value={sessionDuration || '—'}
                                    sub={stats.firstPunch ? fmtTime(stats.firstPunch) + ' → ' + fmtTime(stats.lastPunch) : null}
                                    color="#0891B2"
                                    bg="#CFFAFE"
                                />
                            </View>
                            <View style={[s.kpiRow, { marginTop: 0 }]}>
                                <KpiTile
                                    icon="log-in"
                                    label="Punch In"
                                    value={stats.punchInCount}
                                    sub={stats.punchInCount > 0 ? fmtTime(stats.firstPunch) : null}
                                    color={colors.success}
                                    bg={colors.successLight}
                                />
                                <KpiTile
                                    icon="log-out"
                                    label="Punch Out"
                                    value={stats.punchOutCount}
                                    sub={stats.punchOutCount > 0 ? fmtTime(stats.lastPunch) : null}
                                    color={colors.danger}
                                    bg={colors.dangerLight}
                                />
                                <KpiTile
                                    icon="dollar-sign"
                                    label="Collected"
                                    value={stats.collection > 0 ? `₹${Math.round(stats.collection).toLocaleString('en-IN')}` : '₹0'}
                                    sub={collectionVisits > 0 ? `${collectionVisits} visits` : null}
                                    color={colors.punchBlue}
                                    bg={colors.punchBlueLight}
                                />
                                <KpiTile
                                    icon="trending-up"
                                    label="Disbursed"
                                    value={stats.disbursement > 0 ? `₹${Math.round(stats.disbursement).toLocaleString('en-IN')}` : '₹0'}
                                    sub={stats.disbursementCount > 0 ? `${stats.disbursementCount} txns` : null}
                                    color={colors.warning}
                                    bg={colors.warningLight}
                                />
                            </View>

                            {/* ── Session summary bar ── */}
                            {stats.firstPunch && (
                                <View style={s.sessionBar}>
                                    <View style={s.sessionItem}>
                                        <View style={[s.sessionDot, { backgroundColor: colors.success }]} />
                                        <View>
                                            <Text style={s.sessionLabel}>First Check-in</Text>
                                            <Text style={s.sessionValue}>{fmtTime(stats.firstPunch)}</Text>
                                        </View>
                                    </View>
                                    <View style={s.sessionDivider} />
                                    <View style={s.sessionItem}>
                                        <View style={[s.sessionDot, { backgroundColor: colors.primary }]} />
                                        <View>
                                            <Text style={s.sessionLabel}>Last Check-out</Text>
                                            <Text style={s.sessionValue}>{fmtTime(stats.lastPunch)}</Text>
                                        </View>
                                    </View>
                                    {liveRoute?.sessions ? (
                                        <>
                                            <View style={s.sessionDivider} />
                                            <View style={s.sessionItem}>
                                                <View style={[s.sessionDot, { backgroundColor: '#7c3aed' }]} />
                                                <View>
                                                    <Text style={s.sessionLabel}>GPS Sessions</Text>
                                                    <Text style={s.sessionValue}>{liveRoute.sessions}</Text>
                                                </View>
                                            </View>
                                        </>
                                    ) : null}
                                </View>
                            )}

                            {/* ── Route Map CTA ── */}
                            <TouchableOpacity
                                style={s.routeCta}
                                onPress={() => navigation.navigate('RouteMap', {
                                    date: fmt(activeDate),
                                    employeeId: null,
                                })}
                                activeOpacity={0.8}
                            >
                                <Icon name="map" size={16} color={colors.primary} />
                                <Text style={s.routeCtaText}>View Route on Map</Text>
                                <Icon name="chevron-right" size={14} color={colors.primary} />
                            </TouchableOpacity>

                            {/* ── Timeline punch records ── */}
                            {punches.length > 0 ? (
                                <View style={s.section}>
                                    <Text style={s.sectionTitle}>
                                        Activity Timeline · {punches.length} record{punches.length !== 1 ? 's' : ''}
                                    </Text>
                                    <View style={{ paddingHorizontal: 4 }}>
                                        {punches.map((p, i) => (
                                            <TimelinePunch
                                                key={p.id ?? i}
                                                punch={p}
                                                index={i}
                                                isLast={i === punches.length - 1}
                                            />
                                        ))}
                                    </View>
                                </View>
                            ) : (
                                <View style={s.empty}>
                                    <Icon name="inbox" size={40} color={colors.textLight} />
                                    <Text style={s.emptyTitle}>No activity recorded</Text>
                                    <Text style={s.emptySub}>No punches found for {dateStr}</Text>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

// ─── styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    header: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    backBtn:    { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
    refreshBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: '#fff' },
    headerSub:   { fontSize: typography.sizes.xs, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

    dateNav: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    navArrow:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    navDisabled: { opacity: 0.25 },
    datePill: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 6,
    },
    datePillText: {
        fontSize: typography.sizes.md, fontWeight: typography.weights.semibold,
        color: colors.primary,
    },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
    loadingText: { marginTop: spacing.sm, fontSize: typography.sizes.sm, color: colors.textMuted },

    scrollContent: { padding: spacing.md, paddingBottom: 80 },

    errorBox: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.errorLight, borderRadius: borderRadius.sm,
        padding: spacing.sm, marginBottom: spacing.md, gap: spacing.xs,
    },
    errorText: { flex: 1, fontSize: typography.sizes.sm, color: colors.error },

    kpiRow: { flexDirection: 'row', marginBottom: spacing.sm },

    sessionBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.sm, marginBottom: spacing.sm, ...shadows.xs,
    },
    sessionItem:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    sessionDot:   { width: 8, height: 8, borderRadius: 4 },
    sessionLabel: { fontSize: 10, color: colors.textMuted },
    sessionValue: { fontSize: 13, fontWeight: '700', color: colors.textDark },
    sessionDivider: { width: 1, height: 28, backgroundColor: colors.border, marginHorizontal: 6 },

    routeCta: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.primaryLight, borderRadius: borderRadius.md,
        padding: spacing.sm, marginBottom: spacing.md, justifyContent: 'center',
    },
    routeCtaText: { flex: 1, textAlign: 'center', fontSize: typography.sizes.sm, fontWeight: '600', color: colors.primary },

    section: { marginBottom: spacing.md },
    sectionTitle: {
        fontSize: typography.sizes.sm, fontWeight: typography.weights.bold,
        color: colors.textDark, marginBottom: spacing.sm,
    },

    empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
    emptyTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.textDark },
    emptySub:   { fontSize: typography.sizes.sm, color: colors.textMuted },
});

export default DailySummaryScreen;
