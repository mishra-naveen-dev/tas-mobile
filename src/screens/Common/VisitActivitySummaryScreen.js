import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../api/api';
import ScreenHeader from '../../components/ScreenHeader';
import ErrorView from '../../components/ErrorView';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

// Same DPD bucket labels the Collection Visit form's own OD Visit dropdown
// uses (DPD_BUCKET_OPTIONS in collectionVisitRules.js) — kept in the same
// order the backend returns them (DPD_BUCKET_ORDER, apps/loans/views.py).
const DPD_BUCKET_LABELS = { '60': '1-60', '90': '61-90', '180': '91-180', '360': '181-360', '360+': '360+' };

const toISODate = (d) => d.toISOString().slice(0, 10);
const startOfWeek = (d) => {
    const day = d.getDay(); // 0 = Sunday
    const diff = day === 0 ? 6 : day - 1; // Monday as the first day
    const s = new Date(d);
    s.setDate(d.getDate() - diff);
    return s;
};

const RANGE_PRESETS = [
    { id: 'today', label: 'Today', range: () => { const t = new Date(); return [t, t]; } },
    { id: 'yesterday', label: 'Yesterday', range: () => { const y = new Date(); y.setDate(y.getDate() - 1); return [y, y]; } },
    { id: 'week', label: 'This Week', range: () => [startOfWeek(new Date()), new Date()] },
    { id: 'month', label: 'This Month', range: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), n]; } },
    {
        id: 'prev_month', label: 'Previous Month', range: () => {
            const n = new Date();
            return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 0)];
        },
    },
    { id: 'custom', label: 'Custom' },
];

// ── One VISIT / COLLECTION / OTHER card, with its nested breakdown shown as
// a simple label/count list below the headline number. Every row is styled
// as tappable (chevron, pressable opacity) even though drilling into the
// actual customer list is a follow-up phase — the visual language is ready
// for it, so that later addition is a pure behavior change, not a redesign.
function BucketCard({ icon, color, title, count, rows }) {
    return (
        <View style={[styles.card, { borderLeftColor: color }]}>
            <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: `${color}18` }]}>
                    <Icon name={icon} size={20} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardSubtitle}>{count} {count === 1 ? 'visit' : 'visits'}</Text>
                </View>
                <Text style={[styles.cardCount, { color }]}>{count}</Text>
            </View>
            {rows.length > 0 && (
                <View style={styles.breakdownList}>
                    {rows.map((row) => (
                        <TouchableOpacity key={row.label} style={styles.breakdownRow} activeOpacity={0.6} disabled>
                            <Text style={styles.breakdownLabel}>{row.label}</Text>
                            <View style={styles.breakdownRight}>
                                <Text style={styles.breakdownValue}>{row.value}</Text>
                                <Icon name="chevron-right" size={16} color={colors.textLight} />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

const VisitActivitySummaryScreen = ({ navigation }) => {
    const [preset, setPreset] = useState('today');
    const [customFrom, setCustomFrom] = useState(new Date());
    const [customTo, setCustomTo] = useState(new Date());
    const [pickerOpen, setPickerOpen] = useState(null); // 'from' | 'to' | null
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { dateFrom, dateTo } = useMemo(() => {
        if (preset === 'custom') {
            return { dateFrom: toISODate(customFrom), dateTo: toISODate(customTo) };
        }
        const found = RANGE_PRESETS.find((p) => p.id === preset);
        const [from, to] = found.range();
        return { dateFrom: toISODate(from), dateTo: toISODate(to) };
    }, [preset, customFrom, customTo]);

    const fetchSummary = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.getVisitSummary({ date_from: dateFrom, date_to: dateTo });
            setSummary(res.data);
        } catch (e) {
            setError(e?.response?.data?.error || 'Could not load visit summary.');
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo]);

    useFocusEffect(useCallback(() => { fetchSummary(); }, [fetchSummary]));

    const visit = summary?.buckets?.VISIT;
    const collection = summary?.buckets?.COLLECTION;
    const other = summary?.buckets?.OTHER;

    return (
        <View style={styles.container}>
            <ScreenHeader title="Visit Activity Summary" subtitle="Today's Activity" navigation={navigation} />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
                {RANGE_PRESETS.map((p) => (
                    <TouchableOpacity
                        key={p.id}
                        style={[styles.presetChip, preset === p.id && styles.presetChipActive]}
                        onPress={() => setPreset(p.id)}
                    >
                        <Text style={[styles.presetChipText, preset === p.id && styles.presetChipTextActive]}>{p.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {preset === 'custom' && (
                <View style={styles.customRow}>
                    <TouchableOpacity style={styles.dateBtn} onPress={() => setPickerOpen('from')}>
                        <Icon name="calendar" size={14} color={colors.textMuted} />
                        <Text style={styles.dateBtnText}>{toISODate(customFrom)}</Text>
                    </TouchableOpacity>
                    <Text style={styles.dateSep}>to</Text>
                    <TouchableOpacity style={styles.dateBtn} onPress={() => setPickerOpen('to')}>
                        <Icon name="calendar" size={14} color={colors.textMuted} />
                        <Text style={styles.dateBtnText}>{toISODate(customTo)}</Text>
                    </TouchableOpacity>
                </View>
            )}
            {pickerOpen && (
                <DateTimePicker
                    value={pickerOpen === 'from' ? customFrom : customTo}
                    mode="date"
                    maximumDate={new Date()}
                    onChange={(event, selected) => {
                        setPickerOpen(null);
                        if (!selected) return;
                        if (pickerOpen === 'from') setCustomFrom(selected);
                        else setCustomTo(selected);
                    }}
                />
            )}

            {loading ? (
                <View style={styles.centerFill}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : error ? (
                <ErrorView message={error} onRetry={fetchSummary} />
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.totalBanner}>
                        <Text style={styles.totalLabel}>TOTAL</Text>
                        <Text style={styles.totalValue}>{summary?.total_visits ?? 0} Visits</Text>
                    </View>

                    <BucketCard
                        icon="map-pin" color={colors.primary} title="VISIT" count={visit?.count || 0}
                        rows={[
                            { label: 'Home Visit', value: visit?.breakdown?.HOME_VISIT || 0 },
                            { label: 'OD Visit', value: visit?.breakdown?.OD_VISIT || 0 },
                            { label: 'Other', value: visit?.breakdown?.OTHER || 0 },
                        ]}
                    />
                    {visit?.breakdown?.OD_VISIT > 0 && (
                        <View style={styles.subCard}>
                            <Text style={styles.subCardTitle}>OD Visit — by DPD</Text>
                            {Object.entries(visit.breakdown.od_dpd_buckets || {}).map(([bucket, count]) => (
                                <View key={bucket} style={styles.breakdownRow}>
                                    <Text style={styles.breakdownLabel}>{DPD_BUCKET_LABELS[bucket] || bucket} days</Text>
                                    <Text style={styles.breakdownValue}>{count}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    <BucketCard
                        icon="dollar-sign" color={colors.success} title="COLLECTION" count={collection?.count || 0}
                        rows={[
                            { label: 'P2P', value: collection?.breakdown?.P2P || 0 },
                            { label: 'Not Paid', value: collection?.breakdown?.NOT_PAID || 0 },
                        ]}
                    />

                    <BucketCard
                        icon="more-horizontal" color={colors.warning} title="OTHER" count={other?.count || 0}
                        rows={[]}
                    />
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    presetRow: { flexGrow: 0, marginTop: spacing.sm },
    presetChip: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full || 20,
        backgroundColor: colors.surface, marginRight: spacing.xs, borderWidth: 1, borderColor: colors.border,
    },
    presetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    presetChipText: { fontSize: typography.sizes.sm, color: colors.textMuted, fontWeight: typography.weights.medium },
    presetChipTextActive: { color: '#fff', fontWeight: typography.weights.bold },
    customRow: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, marginTop: spacing.sm, gap: spacing.sm,
    },
    dateBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm || 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    dateBtnText: { fontSize: typography.sizes.sm, color: colors.text },
    dateSep: { color: colors.textMuted, fontSize: typography.sizes.sm },
    scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
    totalBanner: {
        backgroundColor: colors.primary, borderRadius: borderRadius.md || 12, padding: spacing.md,
        alignItems: 'center', marginBottom: spacing.md,
    },
    totalLabel: { color: '#ffffffaa', fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, letterSpacing: 1 },
    totalValue: { color: '#fff', fontSize: typography.sizes.xxl || 28, fontWeight: typography.weights.bold, marginTop: 2 },
    card: {
        backgroundColor: colors.surface, borderRadius: borderRadius.md || 12, padding: spacing.md,
        marginBottom: spacing.md, borderLeftWidth: 4, elevation: 1,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    cardIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.text },
    cardSubtitle: { fontSize: typography.sizes.xs, color: colors.textMuted },
    cardCount: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold },
    breakdownList: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs },
    breakdownRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: spacing.xs,
    },
    breakdownLabel: { fontSize: typography.sizes.sm, color: colors.textMuted },
    breakdownRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    breakdownValue: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, color: colors.text },
    subCard: {
        backgroundColor: colors.surface, borderRadius: borderRadius.md || 12, padding: spacing.md,
        marginTop: -spacing.sm, marginBottom: spacing.md, marginLeft: spacing.md,
    },
    subCardTitle: { fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, color: colors.textMuted, marginBottom: spacing.xs },
});

export default VisitActivitySummaryScreen;
