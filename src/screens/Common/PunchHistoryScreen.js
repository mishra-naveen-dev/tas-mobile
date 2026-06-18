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

// ─── Date helpers ─────────────────────────────────────────────────────────────
const fmt = (d) => d.toISOString().split('T')[0]; // YYYY-MM-DD

const getRange = (period) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (period === 'today') {
        return { date_from: fmt(today), date_to: fmt(today) };
    }
    if (period === 'week') {
        const mon = new Date(today);
        mon.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
        return { date_from: fmt(mon), date_to: fmt(today) };
    }
    if (period === 'month') {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        return { date_from: fmt(first), date_to: fmt(today) };
    }
    if (period === 'last30') {
        const from = new Date(today);
        from.setDate(today.getDate() - 29);
        return { date_from: fmt(from), date_to: fmt(today) };
    }
    return {}; // 'all' — no filter
};

const FILTERS = [
    { key: 'week',   label: 'This Week' },
    { key: 'today',  label: 'Today'     },
    { key: 'month',  label: 'This Month'},
    { key: 'last30', label: 'Last 30 Days' },
    { key: 'all',    label: 'All'       },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const formatTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const PUNCH_CONFIG = {
    PUNCH_IN:     { icon: 'log-in',      color: colors.success  },
    PUNCH_OUT:    { icon: 'log-out',     color: colors.danger   },
    COLLECTION:   { icon: 'dollar-sign', color: '#059669'       },
    DISBURSEMENT: { icon: 'trending-up', color: colors.warning  },
};
const punchCfg = (t) => PUNCH_CONFIG[t] || { icon: 'map-pin', color: colors.primary };

// ─── Punch card ───────────────────────────────────────────────────────────────
const PunchCard = ({ item }) => {
    const cfg  = punchCfg(item.punch_type);
    const label = String(item.punch_type || 'PUNCH').replace(/_/g, ' ');
    return (
        <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconBadge, { backgroundColor: cfg.color + '20' }]}>
                    <Icon name={cfg.icon} size={18} color={cfg.color} />
                </View>
                <View style={styles.cardHeaderText}>
                    <Text style={styles.punchType}>{label}</Text>
                    <Text style={styles.dateText}>{formatDate(item.punched_at)}</Text>
                </View>
                <View style={styles.timeBadge}>
                    <Icon name="clock" size={13} color={colors.textMuted} />
                    <Text style={styles.timeText}>{formatTime(item.punched_at)}</Text>
                </View>
            </View>
            {item.current_address ? (
                <View style={styles.addressRow}>
                    <Icon name="map-pin" size={13} color={colors.textMuted} />
                    <Text style={styles.addressText} numberOfLines={1}>{item.current_address}</Text>
                </View>
            ) : null}
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
    const [punches, setPunches]       = useState([]);
    const [isLoading, setIsLoading]   = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasError, setHasError]     = useState(false);
    const [activeFilter, setActiveFilter] = useState('week'); // default: this week

    const fetchData = useCallback(async (period = activeFilter, isRefresh = false) => {
        try {
            setHasError(false);
            if (isRefresh) setIsRefreshing(true);
            else setIsLoading(true);

            const params = getRange(period);
            const response = await api.getPunchHistory(params);
            const data = Array.isArray(response.data)
                ? response.data
                : (response.data?.results || []);
            setPunches(data);
        } catch {
            setHasError(true);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [activeFilter]);

    React.useEffect(() => {
        fetchData(activeFilter);
    }, [activeFilter]);

    const handleFilterChange = (key) => {
        setActiveFilter(key);
        setPunches([]);
    };

    // ── Filter tab bar ──
    const FilterBar = () => (
        <View style={styles.filterBar}>
            <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={FILTERS}
                keyExtractor={f => f.key}
                contentContainerStyle={styles.filterBarContent}
                renderItem={({ item: f }) => (
                    <TouchableOpacity
                        style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}
                        onPress={() => handleFilterChange(f.key)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.filterTabText, activeFilter === f.key && styles.filterTabTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );

    // ── Date range label ──
    const rangeLabel = () => {
        const r = getRange(activeFilter);
        if (!r.date_from) return 'All records';
        if (r.date_from === r.date_to) return formatDate(r.date_from);
        return `${formatDate(r.date_from)} – ${formatDate(r.date_to)}`;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Punch History</Text>
                    <Text style={styles.headerSub}>{rangeLabel()}</Text>
                </View>
                <View style={{ width: 38 }} />
            </View>

            {/* Filter tabs */}
            <FilterBar />

            {/* Content */}
            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : hasError ? (
                <View style={styles.centered}>
                    <Icon name="alert-circle" size={48} color={colors.danger} />
                    <Text style={styles.errorText}>Something went wrong</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData(activeFilter)}>
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
                            onRefresh={() => fetchData(activeFilter, true)}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                    ListHeaderComponent={
                        punches.length > 0 ? (
                            <Text style={styles.countLabel}>{punches.length} record{punches.length !== 1 ? 's' : ''}</Text>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Icon name="inbox" size={48} color={colors.border} />
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

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: '#fff' },
    headerSub: { fontSize: typography.sizes.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

    filterBar: {
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    filterBarContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
    filterTab: {
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    filterTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterTabText: { fontSize: typography.sizes.sm, color: colors.textMuted, fontWeight: typography.weights.medium },
    filterTabTextActive: { color: '#fff', fontWeight: typography.weights.semibold },

    listContent: { padding: spacing.md, paddingBottom: 100 },
    countLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: spacing.sm,
        fontWeight: typography.weights.medium,
    },

    card: { marginBottom: spacing.sm, padding: spacing.md },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    iconBadge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    cardHeaderText: { flex: 1 },
    punchType: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.textDark, textTransform: 'capitalize' },
    dateText: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
    timeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    timeText: { fontSize: typography.sizes.xs, color: colors.textMuted, marginLeft: 4, fontWeight: typography.weights.medium },
    addressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
    addressText: { fontSize: typography.sizes.xs, color: colors.textMuted, marginLeft: 6, flex: 1 },
    visitBadge: { alignSelf: 'flex-start', backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 8 },
    visitText: { fontSize: typography.sizes.xs, color: colors.primary, fontWeight: typography.weights.semibold },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
    errorText: { fontSize: typography.sizes.md, color: colors.textMuted, marginTop: spacing.md },
    retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20 },
    retryText: { color: '#fff', fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
    emptyTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.textDark, marginTop: spacing.md },
    emptySubtitle: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 4 },
});

export default PunchHistoryScreen;
