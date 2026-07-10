import React, { useState, useCallback, useMemo } from 'react';
import {
    View, Text, FlatList, StyleSheet,
    TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';
import { parseApiError } from '../../core/error/AppErrorHandler';

// ─── Date helpers ─────────────────────────────────────────────────────────────
const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const today = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

const displayDate = (d) => {
    const t = today();
    const diff = Math.round((t - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fmtDateShort = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// ─── Punch type config ────────────────────────────────────────────────────────
const PUNCH_CFG = {
    PUNCH_IN:     { icon: 'log-in',      color: '#059669', bg: '#D1FAE5', label: 'Punch In'     },
    PUNCH_OUT:    { icon: 'log-out',     color: '#DC2626', bg: '#FEE2E2', label: 'Punch Out'    },
    COLLECTION:   { icon: 'dollar-sign', color: '#2563EB', bg: '#DBEAFE', label: 'Collection'   },
    DISBURSEMENT: { icon: 'trending-up', color: '#D97706', bg: '#FEF3C7', label: 'Disbursement' },
};
const getCfg = (t) => PUNCH_CFG[String(t || '').toUpperCase()] || { icon: 'map-pin', color: colors.primary, bg: colors.primaryLight, label: String(t || 'Punch') };

const QUICK_FILTERS = [
    { key: 'week',  label: 'This Week'  },
    { key: 'month', label: 'This Month' },
    { key: 'all',   label: 'All Records'},
];

const getQuickRange = (key) => {
    const t = today();
    if (key === 'week') {
        const mon = new Date(t);
        mon.setDate(t.getDate() - t.getDay() + (t.getDay() === 0 ? -6 : 1));
        return { date_from: fmt(mon), date_to: fmt(t) };
    }
    if (key === 'month') {
        return { date_from: fmt(new Date(t.getFullYear(), t.getMonth(), 1)), date_to: fmt(t) };
    }
    return {};
};

// ─── Summary bar (shown above list) ──────────────────────────────────────────
const SummaryBar = ({ punches, collectionTotal }) => {
    const stats = useMemo(() => {
        const punchCollected = punches
            .filter(p => ['COLLECTION', 'DISBURSEMENT'].includes(p.punch_type))
            .reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        return {
            total:      punches.length,
            punchIns:   punches.filter(p => p.punch_type === 'PUNCH_IN').length,
            punchOuts:  punches.filter(p => p.punch_type === 'PUNCH_OUT').length,
            // Authoritative source: collections API amount; fall back to punch-record sum
            collection: collectionTotal !== null ? collectionTotal : punchCollected,
        };
    }, [punches, collectionTotal]);

    if (punches.length === 0) return null;

    return (
        <View style={sb.bar}>
            <View style={sb.tile}>
                <Text style={sb.val}>{stats.total}</Text>
                <Text style={sb.lbl}>Total</Text>
            </View>
            <View style={[sb.tile, sb.divider]}>
                <Text style={[sb.val, { color: '#059669' }]}>{stats.punchIns}</Text>
                <Text style={sb.lbl}>Punch In</Text>
            </View>
            <View style={[sb.tile, sb.divider]}>
                <Text style={[sb.val, { color: colors.danger }]}>{stats.punchOuts}</Text>
                <Text style={sb.lbl}>Punch Out</Text>
            </View>
            <View style={[sb.tile, sb.divider]}>
                <Text style={[sb.val, { color: '#2563EB', fontSize: 13 }]}>
                    {stats.collection > 0 ? `₹${Math.round(stats.collection).toLocaleString('en-IN')}` : '₹0'}
                </Text>
                <Text style={sb.lbl}>Collected</Text>
            </View>
        </View>
    );
};

const sb = StyleSheet.create({
    bar: {
        flexDirection: 'row', backgroundColor: colors.surface,
        marginHorizontal: spacing.md, marginBottom: spacing.sm,
        borderRadius: borderRadius.md, overflow: 'hidden', ...shadows.xs,
    },
    tile:    { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
    divider: { borderLeftWidth: 1, borderLeftColor: colors.border },
    val:     { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.textDark },
    lbl:     { fontSize: 10, color: colors.textMuted, marginTop: 2 },
});

// ─── Punch card ───────────────────────────────────────────────────────────────
const PunchCard = ({ item, onViewRoute }) => {
    const cfg = getCfg(item.punch_type);
    const hasGps = item.latitude && item.longitude &&
        parseFloat(item.latitude) !== 0 && parseFloat(item.longitude) !== 0;
    const hasAmount  = item.amount && parseFloat(item.amount) > 0;
    const hasNotes   = item.notes && item.notes.trim().length > 0;
    const hasCustomer= item.customer_name && item.customer_name.trim().length > 0;

    return (
        <View style={pc.card}>
            {/* ── Top row: icon + type + time ── */}
            <View style={pc.topRow}>
                <View style={[pc.iconWrap, { backgroundColor: cfg.bg }]}>
                    <Icon name={cfg.icon} size={20} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={pc.typeRow}>
                        <View style={[pc.typeBadge, { backgroundColor: cfg.bg }]}>
                            <Text style={[pc.typeText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        {hasAmount && (
                            <View style={[pc.amtBadge, { backgroundColor: cfg.bg }]}>
                                <Text style={[pc.amtText, { color: cfg.color }]}>
                                    ₹{Number(item.amount).toLocaleString('en-IN')}
                                </Text>
                            </View>
                        )}
                    </View>
                    {hasCustomer && (
                        <Text style={pc.customerName} numberOfLines={1}>{item.customer_name}</Text>
                    )}
                </View>
                <View style={pc.timeBlock}>
                    <Text style={pc.time}>{fmtTime(item.punched_at)}</Text>
                    <Text style={pc.dateSmall}>{fmtDateShort(item.punched_at)}</Text>
                </View>
            </View>

            {/* ── Address ── */}
            {item.current_address ? (
                <View style={pc.addrRow}>
                    <Icon name="map-pin" size={12} color={colors.textMuted} />
                    <Text style={pc.addrText} numberOfLines={2}>{item.current_address}</Text>
                </View>
            ) : null}

            {/* ── Customer address (if different) ── */}
            {item.customer_address && item.customer_address !== item.current_address ? (
                <View style={pc.addrRow}>
                    <Icon name="briefcase" size={12} color={colors.textMuted} />
                    <Text style={pc.addrText} numberOfLines={1}>{item.customer_address}</Text>
                </View>
            ) : null}

            {/* ── Notes ── */}
            {hasNotes && (
                <View style={pc.notesRow}>
                    <Icon name="message-square" size={11} color={colors.textMuted} />
                    <Text style={pc.notesText} numberOfLines={2}>{item.notes}</Text>
                </View>
            )}

            {/* ── Footer: GPS badge + distance + loan ID ── */}
            <View style={pc.footer}>
                {hasGps ? (
                    <View style={pc.gpsBadge}>
                        <Icon name="crosshair" size={10} color={colors.success} />
                        <Text style={pc.gpsText}>GPS</Text>
                    </View>
                ) : (
                    <View style={[pc.gpsBadge, { backgroundColor: '#FEF3C7' }]}>
                        <Icon name="alert-triangle" size={10} color={colors.warning} />
                        <Text style={[pc.gpsText, { color: colors.warning }]}>No GPS</Text>
                    </View>
                )}
                {item.distance_km ? (
                    <View style={pc.distBadge}>
                        <Icon name="activity" size={10} color="#7c3aed" />
                        <Text style={pc.distText}>{item.distance_km} km</Text>
                    </View>
                ) : null}
                {item.loan_id ? (
                    <View style={pc.loanBadge}>
                        <Text style={pc.loanText}>Loan: {item.loan_id}</Text>
                    </View>
                ) : null}
                <View style={{ flex: 1 }} />
                {item.punch_type === 'PUNCH_IN' && onViewRoute && (
                    <TouchableOpacity style={pc.routeBtn} onPress={onViewRoute} activeOpacity={0.7}>
                        <Icon name="map" size={11} color={colors.primary} />
                        <Text style={pc.routeBtnText}>Map</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const pc = StyleSheet.create({
    card: {
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        marginBottom: spacing.sm, padding: spacing.md,
        ...shadows.sm,
    },
    topRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    iconWrap: {
        width: 44, height: 44, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', marginRight: 10,
    },
    typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    typeText:  { fontSize: 12, fontWeight: '700' },
    amtBadge:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    amtText:   { fontSize: 12, fontWeight: '700' },
    customerName: { fontSize: 13, color: colors.textDark, fontWeight: '500' },
    timeBlock: { alignItems: 'flex-end', marginLeft: 6 },
    time:      { fontSize: typography.sizes.md, fontWeight: '700', color: colors.textDark },
    dateSmall: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

    addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: 4 },
    addrText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17 },

    notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: 6,
        backgroundColor: '#F8FAFC', borderRadius: 6, padding: 6 },
    notesText: { flex: 1, fontSize: 12, color: colors.textDark, lineHeight: 16, fontStyle: 'italic' },

    footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
    gpsBadge: { flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: colors.successLight, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    gpsText: { fontSize: 10, color: colors.success, fontWeight: '600' },
    distBadge: { flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: '#F5F3FF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    distText:  { fontSize: 10, color: '#7c3aed', fontWeight: '600' },
    loanBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    loanText:  { fontSize: 10, color: colors.success, fontWeight: '600' },
    routeBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    routeBtnText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
const PunchHistoryScreen = ({ navigation }) => {
    const [punches, setPunches]           = useState([]);
    const [collectionTotal, setCollectionTotal] = useState(null);
    const [isLoading, setIsLoading]       = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasError, setHasError]         = useState(false);
    const [errorMsg, setErrorMsg]         = useState('');
    const [mode, setMode]                 = useState('date');
    const [activeDate, setActiveDate]     = useState(today());
    const [quickFilter, setQuickFilter]   = useState(null);

    const getParams = useCallback(() => {
        if (mode === 'date') {
            const d = fmt(activeDate);
            return { date_from: d, date_to: d };
        }
        return getQuickRange(quickFilter);
    }, [mode, activeDate, quickFilter]);

    const fetchData = useCallback(async (params, isRefresh = false) => {
        try {
            setHasError(false);
            setErrorMsg('');
            if (isRefresh) setIsRefreshing(true);
            else { setIsLoading(true); setPunches([]); setCollectionTotal(null); }

            const [response, collRes] = await Promise.all([
                api.getPunchHistory(params),
                api.getCollections(params).catch(() => null),
            ]);

            const data = Array.isArray(response.data)
                ? response.data
                : (response.data?.results || []);
            setPunches(data.sort((a, b) => new Date(b.punched_at) - new Date(a.punched_at)));

            const collList = Array.isArray(collRes?.data)
                ? collRes.data
                : (collRes?.data?.results || []);
            const total = collList.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
            setCollectionTotal(total);
        } catch (err) {
            setHasError(true);
            const { message } = parseApiError(err);
            setErrorMsg(message);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData(getParams());
    }, [mode, activeDate, quickFilter]);

    const goDay = (dir) => {
        const next = addDays(activeDate, dir);
        if (next > today()) return;
        setMode('date');
        setQuickFilter(null);
        setActiveDate(next);
    };

    const selectQuick = (key) => {
        setMode('quick');
        setQuickFilter(key);
        setActiveDate(today());
    };

    const goToday = () => {
        setMode('date');
        setQuickFilter(null);
        setActiveDate(today());
    };

    const isDateToday = fmt(activeDate) === fmt(today());

    const handleViewRoute = (punchDate) => {
        navigation.navigate('RouteMap', { date: punchDate });
    };

    return (
        <SafeAreaView style={s.container} edges={['top']}>

            {/* ── Header ── */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                    <Icon name="arrow-left" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Punch History</Text>
                <View style={{ width: 38 }} />
            </View>

            {/* ── Date navigator ── */}
            <View style={s.dateNav}>
                <TouchableOpacity style={s.navArrow} onPress={() => goDay(-1)}>
                    <Icon name="chevron-left" size={22} color={colors.textDark} />
                </TouchableOpacity>
                <TouchableOpacity style={s.dateLabel} onPress={goToday} activeOpacity={0.7}>
                    <Icon name="calendar" size={14} color={mode === 'date' ? colors.primary : colors.textMuted} />
                    <Text style={[s.dateLabelText, mode === 'date' && s.dateLabelActive]}>
                        {mode === 'date' ? displayDate(activeDate) : 'Custom range'}
                    </Text>
                    {mode === 'date' && !isDateToday && (
                        <View style={s.todayPill}><Text style={s.todayPillTxt}>Tap for today</Text></View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[s.navArrow, isDateToday && mode === 'date' && s.navDisabled]}
                    onPress={() => goDay(1)}
                    disabled={isDateToday && mode === 'date'}
                >
                    <Icon name="chevron-right" size={22}
                        color={isDateToday && mode === 'date' ? colors.border : colors.textDark} />
                </TouchableOpacity>
            </View>

            {/* ── Quick filter chips ── */}
            <View style={s.chipRow}>
                {QUICK_FILTERS.map(f => {
                    const active = mode === 'quick' && quickFilter === f.key;
                    return (
                        <TouchableOpacity
                            key={f.key}
                            style={[s.chip, active && s.chipActive]}
                            onPress={() => selectQuick(f.key)}
                            activeOpacity={0.7}
                        >
                            <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── Content ── */}
            {isLoading ? (
                <View style={s.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={s.loadingTxt}>Loading records…</Text>
                </View>
            ) : hasError && punches.length === 0 ? (
                <View style={s.centered}>
                    <Icon name="wifi-off" size={44} color={colors.danger} />
                    <Text style={s.errorTxt}>{errorMsg || 'Could not load data'}</Text>
                    <TouchableOpacity style={s.retryBtn} onPress={() => fetchData(getParams())}>
                        <Icon name="refresh-cw" size={14} color="#fff" />
                        <Text style={s.retryTxt}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={punches}
                    keyExtractor={(item, i) => item?.id ? String(item.id) : String(i)}
                    renderItem={({ item }) => (
                        <PunchCard
                            item={item}
                            onViewRoute={item.punched_at ? () => handleViewRoute(item.punched_at.slice(0, 10)) : null}
                        />
                    )}
                    contentContainerStyle={s.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => fetchData(getParams(), true)}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                    ListHeaderComponent={
                        <>
                            {hasError && (
                                <View style={s.warnBanner}>
                                    <Icon name="wifi-off" size={13} color={colors.warning} />
                                    <Text style={s.warnTxt}>{errorMsg || 'Could not refresh'} — showing cached data</Text>
                                    <TouchableOpacity onPress={() => fetchData(getParams(), true)}>
                                        <Text style={s.retryLink}>Retry</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            <SummaryBar punches={punches} collectionTotal={collectionTotal} />
                        </>
                    }
                    ListEmptyComponent={
                        <View style={s.centered}>
                            <Icon name="inbox" size={44} color={colors.border} />
                            <Text style={s.emptyTitle}>No punches found</Text>
                            <Text style={s.emptySub}>No records for this period</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    header: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    },
    backBtn:     { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: typography.sizes.lg, fontWeight: '700', color: '#fff' },

    dateNav: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface,
        paddingVertical: spacing.xs, paddingHorizontal: spacing.xs,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    navArrow:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    navDisabled: { opacity: 0.25 },
    dateLabel:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
    dateLabelText: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.textMuted },
    dateLabelActive: { color: colors.primary },
    todayPill:    { backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    todayPillTxt: { fontSize: 10, color: colors.primary, fontWeight: '600' },

    chipRow: {
        flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        gap: spacing.sm, backgroundColor: colors.surface,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    chip:         { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    chipActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText:     { fontSize: typography.sizes.sm, color: colors.textMuted, fontWeight: '500' },
    chipTextActive: { color: '#fff', fontWeight: '600' },

    listContent: { padding: spacing.md, paddingBottom: 100 },

    centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
    loadingTxt:  { marginTop: spacing.sm, fontSize: typography.sizes.sm, color: colors.textMuted },
    errorTxt:    { fontSize: typography.sizes.sm, color: colors.danger, marginTop: spacing.md, textAlign: 'center', paddingHorizontal: spacing.lg },
    retryBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20 },
    retryTxt:    { color: '#fff', fontSize: typography.sizes.sm, fontWeight: '600' },
    emptyTitle:  { fontSize: typography.sizes.md, fontWeight: '600', color: colors.textDark, marginTop: spacing.md },
    emptySub:    { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 4 },

    warnBanner:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 10, padding: spacing.sm, marginBottom: spacing.sm, gap: 8, borderWidth: 1, borderColor: '#FCD34D' },
    warnTxt:     { flex: 1, fontSize: typography.sizes.xs, color: '#92400E' },
    retryLink:   { fontSize: typography.sizes.sm, color: colors.primary, fontWeight: '600' },
});

export default PunchHistoryScreen;
