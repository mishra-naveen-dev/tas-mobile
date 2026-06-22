import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import GlassCard from '../../components/GlassCard';
import { colors, typography, spacing } from '../../theme/tokens';
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

const addDays = (d, n) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
};

const displayDate = (d) => {
    const t = today();
    const diff = Math.round((t - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const QUICK_FILTERS = [
    { key: 'week',  label: 'This Week'   },
    { key: 'month', label: 'This Month'  },
    { key: 'all',   label: 'All Records' },
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
    return {}; // all
};

// ─── Punch card ───────────────────────────────────────────────────────────────
const PUNCH_CFG = {
    PUNCH_IN:     { icon: 'log-in',      color: '#059669' },
    PUNCH_OUT:    { icon: 'log-out',     color: '#DC2626' },
    COLLECTION:   { icon: 'dollar-sign', color: '#2563EB' },
    DISBURSEMENT: { icon: 'trending-up', color: '#D97706' },
};
const punchCfg = (t) => PUNCH_CFG[t] || { icon: 'map-pin', color: colors.primary };

const formatTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const formatDateShort = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const PunchCard = ({ item }) => {
    const cfg   = punchCfg(item.punch_type);
    const label = String(item.punch_type || 'PUNCH').replace(/_/g, ' ');
    return (
        <GlassCard style={styles.card}>
            <View style={styles.cardRow}>
                <View style={[styles.iconBadge, { backgroundColor: cfg.color + '18' }]}>
                    <Icon name={cfg.icon} size={18} color={cfg.color} />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.punchType}>{label}</Text>
                    {item.current_address ? (
                        <Text style={styles.addressText} numberOfLines={1}>{item.current_address}</Text>
                    ) : null}
                </View>
                <View style={styles.cardRight}>
                    <Text style={styles.timeText}>{formatTime(item.punched_at)}</Text>
                    <Text style={styles.dateSmall}>{formatDateShort(item.punched_at)}</Text>
                </View>
            </View>
            {item.visit_type ? (
                <View style={styles.visitBadge}>
                    <Text style={styles.visitText}>{item.visit_type}</Text>
                </View>
            ) : null}
        </GlassCard>
    );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
const PunchHistoryScreen = ({ navigation }) => {
    const [punches, setPunches]           = useState([]);
    const [isLoading, setIsLoading]       = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasError, setHasError]         = useState(false);
    const [errorMsg, setErrorMsg]         = useState('');

    // Mode: 'date' (single day) or a quick-filter key
    const [mode, setMode]         = useState('date');
    const [activeDate, setActiveDate] = useState(today());   // used in date mode
    const [quickFilter, setQuickFilter] = useState(null);    // used in quick mode

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
            if (isRefresh) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
                setPunches([]); // clear only for fresh (non-refresh) loads
            }

            const response = await api.getPunchHistory(params);
            const data = Array.isArray(response.data)
                ? response.data
                : (response.data?.results || []);
            setPunches(data);
        } catch (err) {
            setHasError(true);
            const { message } = parseApiError(err);
            setErrorMsg(message);
            // punches preserved on error so stale data stays visible on refresh
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData(getParams());
    }, [mode, activeDate, quickFilter]);

    // Navigate prev / next day
    const goDay = (dir) => {
        const next = addDays(activeDate, dir);
        if (next > today()) return; // can't go into future
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

    const isToday = fmt(activeDate) === fmt(today());

    return (
        <SafeAreaView style={styles.container} edges={['top']}>

            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Punch History</Text>
                <View style={{ width: 38 }} />
            </View>

            {/* ── Date navigator (date mode) ── */}
            <View style={styles.dateNav}>
                <TouchableOpacity style={styles.navArrow} onPress={() => goDay(-1)}>
                    <Icon name="chevron-left" size={22} color={colors.textDark} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.dateLabel} onPress={goToday} activeOpacity={0.7}>
                    <Icon name="calendar" size={14} color={mode === 'date' ? colors.primary : colors.textMuted} />
                    <Text style={[styles.dateLabelText, mode === 'date' && styles.dateLabelActive]}>
                        {mode === 'date' ? displayDate(activeDate) : 'Pick a date'}
                    </Text>
                    {mode === 'date' && !isToday && (
                        <View style={styles.todayPill}>
                            <Text style={styles.todayPillText}>Tap for today</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navArrow, isToday && mode === 'date' && styles.navArrowDisabled]}
                    onPress={() => goDay(1)}
                    disabled={isToday && mode === 'date'}
                >
                    <Icon name="chevron-right" size={22} color={isToday && mode === 'date' ? colors.border : colors.textDark} />
                </TouchableOpacity>
            </View>

            {/* ── Quick filter chips ── */}
            <View style={styles.chipRow}>
                {QUICK_FILTERS.map(f => (
                    <TouchableOpacity
                        key={f.key}
                        style={[styles.chip, mode === 'quick' && quickFilter === f.key && styles.chipActive]}
                        onPress={() => selectQuick(f.key)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.chipText, mode === 'quick' && quickFilter === f.key && styles.chipTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── Content ── */}
            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : hasError && punches.length === 0 ? (
                /* Full-page error — no stale data to fall back on */
                <View style={styles.centered}>
                    <Icon name="wifi-off" size={44} color={colors.danger} />
                    <Text style={styles.errorText}>{errorMsg || 'Could not load data'}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData(getParams())}>
                        <Icon name="refresh-cw" size={14} color="#fff" />
                        <Text style={styles.retryText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={punches}
                    keyExtractor={(item, i) => item?.id ? String(item.id) : String(i)}
                    renderItem={({ item }) => <PunchCard item={item} />}
                    contentContainerStyle={styles.listContent}
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
                                <View style={styles.errorBanner}>
                                    <Icon name="wifi-off" size={14} color={colors.warning} />
                                    <Text style={styles.errorBannerText}>
                                        {errorMsg || 'Could not refresh'} — showing last loaded data
                                    </Text>
                                    <TouchableOpacity onPress={() => fetchData(getParams(), true)}>
                                        <Text style={styles.retryLink}>Retry</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {punches.length > 0 && (
                                <Text style={styles.countLabel}>
                                    {punches.length} record{punches.length !== 1 ? 's' : ''}
                                </Text>
                            )}
                        </>
                    }
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Icon name="inbox" size={44} color={colors.border} />
                            <Text style={styles.emptyTitle}>No punches found</Text>
                            <Text style={styles.emptySubtitle}>No records for this period</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: '#fff' },

    // Date navigator
    dateNav: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    navArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    navArrowDisabled: { opacity: 0.3 },
    dateLabel: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 6,
    },
    dateLabelText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
    },
    dateLabelActive: { color: colors.primary },
    todayPill: {
        backgroundColor: colors.primaryLight,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    todayPillText: { fontSize: 10, color: colors.primary, fontWeight: typography.weights.semibold },

    // Quick filter chips
    chipRow: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    chip: {
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: typography.sizes.sm, color: colors.textMuted, fontWeight: typography.weights.medium },
    chipTextActive: { color: '#fff', fontWeight: typography.weights.semibold },

    // List
    listContent: { padding: spacing.md, paddingBottom: 100 },
    countLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: spacing.sm,
        fontWeight: typography.weights.medium,
    },

    // Card
    card: { marginBottom: spacing.sm, padding: spacing.md },
    cardRow: { flexDirection: 'row', alignItems: 'center' },
    iconBadge: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    cardInfo: { flex: 1 },
    punchType: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.textDark, textTransform: 'capitalize' },
    addressText: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
    cardRight: { alignItems: 'flex-end' },
    timeText: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.textDark },
    dateSmall: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
    visitBadge: { alignSelf: 'flex-start', backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, marginTop: 8 },
    visitText: { fontSize: 11, color: colors.primary, fontWeight: typography.weights.semibold },

    // States
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
    errorText: { fontSize: typography.sizes.md, color: colors.danger, marginTop: spacing.md, textAlign: 'center', paddingHorizontal: spacing.lg },
    retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20 },
    retryText: { color: '#fff', fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
    emptyTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.textDark, marginTop: spacing.md },
    emptySubtitle: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 4 },

    // Error banner (shown over stale data)
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        borderRadius: 10,
        padding: spacing.sm,
        marginBottom: spacing.sm,
        gap: 8,
        borderWidth: 1,
        borderColor: '#FCD34D',
    },
    errorBannerText: {
        flex: 1,
        fontSize: typography.sizes.xs,
        color: '#92400E',
    },
    retryLink: {
        fontSize: typography.sizes.sm,
        color: colors.primary,
        fontWeight: '600',
    },
});

export default PunchHistoryScreen;
