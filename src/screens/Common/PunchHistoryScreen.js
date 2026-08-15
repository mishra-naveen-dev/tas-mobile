import React, { useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet,
    TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';
import { parseApiError } from '../../core/error/AppErrorHandler';
import { SkeletonListItem } from '../../components/SkeletonComponents';
import { geoStatusInfo, fmtDurationSeconds, fmtTime, fmtDate } from '../../utils/geoVerification';

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

const QUICK_FILTERS = [
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'all', label: 'All Records' },
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

// ─── Summary card ─────────────────────────────────────────────────────────────
const SummaryRow = ({ label, value, bold }) => (
    <View style={sc.row}>
        <Text style={sc.rowLabel}>{label}</Text>
        <Text style={[sc.rowValue, bold && sc.rowValueBold]}>{value}</Text>
    </View>
);

const SessionSummaryCard = ({ item, onPress }) => {
    const geo = geoStatusInfo(item.geo_status);
    return (
        <TouchableOpacity style={sc.card} onPress={onPress} activeOpacity={0.85}>
            <View style={sc.dateRow}>
                <Text style={sc.dateText}>{fmtDate(item.date)}</Text>
                {item.is_open && (
                    <View style={sc.openBadge}><Text style={sc.openBadgeText}>Active</Text></View>
                )}
            </View>

            <View style={sc.timesRow}>
                <View style={sc.timeBlock}>
                    <Icon name="log-in" size={14} color="#059669" />
                    <Text style={sc.timeLabel}>Punch In</Text>
                    <Text style={sc.timeValue}>{fmtTime(item.punch_in_time)}</Text>
                </View>
                <View style={sc.timeDivider} />
                <View style={sc.timeBlock}>
                    <Icon name="log-out" size={14} color={colors.danger} />
                    <Text style={sc.timeLabel}>Punch Out</Text>
                    <Text style={sc.timeValue}>{item.punch_out_time ? fmtTime(item.punch_out_time) : '—'}</Text>
                </View>
                <View style={sc.timeDivider} />
                <View style={sc.timeBlock}>
                    <Icon name="clock" size={14} color={colors.primary} />
                    <Text style={sc.timeLabel}>Duration</Text>
                    <Text style={sc.timeValue}>{fmtDurationSeconds(item.duration_seconds)}</Text>
                </View>
            </View>

            <SummaryRow label="Branch" value={item.branch_name || 'Not assigned'} />
            <SummaryRow label="Customer Activities" value={item.total_activities} />
            <SummaryRow label="Collections" value={item.collections} />
            <SummaryRow label="Visits" value={item.visits} />

            <View style={sc.footer}>
                <View style={[sc.geoBadge, { backgroundColor: `${geo.color}18` }]}>
                    <Icon name={geo.icon} size={12} color={geo.color} />
                    <Text style={[sc.geoBadgeText, { color: geo.color }]}>{geo.label}</Text>
                </View>
                <View style={sc.viewDetails}>
                    <Text style={sc.viewDetailsText}>View Details</Text>
                    <Icon name="chevron-right" size={14} color={colors.primary} />
                </View>
            </View>
        </TouchableOpacity>
    );
};

const sc = StyleSheet.create({
    card: {
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        marginBottom: spacing.sm, padding: spacing.md, ...shadows.sm,
    },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    dateText: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.textDark },
    openBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    openBadgeText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },

    timesRow: {
        flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: borderRadius.sm,
        paddingVertical: spacing.sm, marginBottom: spacing.sm,
    },
    timeBlock: { flex: 1, alignItems: 'center', gap: 2 },
    timeDivider: { width: 1, backgroundColor: colors.border },
    timeLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
    timeValue: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.textDark },

    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    rowLabel: { fontSize: typography.sizes.sm, color: colors.textMuted },
    rowValue: { fontSize: typography.sizes.sm, color: colors.textDark, fontWeight: '500' },
    rowValueBold: { fontWeight: '700' },

    footer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
    },
    geoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    geoBadgeText: { fontSize: 11, fontWeight: '700' },
    viewDetails: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    viewDetailsText: { fontSize: typography.sizes.sm, color: colors.primary, fontWeight: '700' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
const PunchHistoryScreen = ({ navigation }) => {
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [mode, setMode] = useState('date');
    const [activeDate, setActiveDate] = useState(today());
    const [quickFilter, setQuickFilter] = useState(null);

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
            else { setIsLoading(true); setSessions([]); }

            const response = await api.getPunchSessions({ ...params, page_size: 100 });
            const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            setSessions(data);
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

    const openDetail = (session) => {
        navigation.navigate('PunchSessionDetail', { punchId: session.session_start });
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
                <View style={{ padding: spacing.md }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
                    ))}
                </View>
            ) : hasError && sessions.length === 0 ? (
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
                    data={sessions}
                    keyExtractor={(item, i) => item?.session_start ? String(item.session_start) : String(i)}
                    renderItem={({ item }) => (
                        <SessionSummaryCard item={item} onPress={() => openDetail(item)} />
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
                        hasError && (
                            <View style={s.warnBanner}>
                                <Icon name="wifi-off" size={13} color={colors.warning} />
                                <Text style={s.warnTxt}>{errorMsg || 'Could not refresh'} — showing cached data</Text>
                                <TouchableOpacity onPress={() => fetchData(getParams(), true)}>
                                    <Text style={s.retryLink}>Retry</Text>
                                </TouchableOpacity>
                            </View>
                        )
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
    backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: typography.sizes.lg, fontWeight: '700', color: '#fff' },

    dateNav: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface,
        paddingVertical: spacing.xs, paddingHorizontal: spacing.xs,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    navArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    navDisabled: { opacity: 0.25 },
    dateLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
    dateLabelText: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.textMuted },
    dateLabelActive: { color: colors.primary },
    todayPill: { backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    todayPillTxt: { fontSize: 10, color: colors.primary, fontWeight: '600' },

    chipRow: {
        flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        gap: spacing.sm, backgroundColor: colors.surface,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: typography.sizes.sm, color: colors.textMuted, fontWeight: '500' },
    chipTextActive: { color: '#fff', fontWeight: '600' },

    listContent: { padding: spacing.md, paddingBottom: 100 },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
    errorTxt: { fontSize: typography.sizes.sm, color: colors.danger, marginTop: spacing.md, textAlign: 'center', paddingHorizontal: spacing.lg },
    retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20 },
    retryTxt: { color: '#fff', fontSize: typography.sizes.sm, fontWeight: '600' },
    emptyTitle: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.textDark, marginTop: spacing.md },
    emptySub: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 4 },

    warnBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 10, padding: spacing.sm, marginBottom: spacing.sm, gap: 8, borderWidth: 1, borderColor: '#FCD34D' },
    warnTxt: { flex: 1, fontSize: typography.sizes.xs, color: '#92400E' },
    retryLink: { fontSize: typography.sizes.sm, color: colors.primary, fontWeight: '600' },
});

export default PunchHistoryScreen;
