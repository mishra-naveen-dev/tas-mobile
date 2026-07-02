import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import api from '../../api/api';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

const STATUS_OPTIONS = [
    { value: 'PENDING', label: 'Pending', color: colors.textMuted },
    { value: 'VISITED', label: 'Visited', color: colors.info },
    { value: 'COLLECTED', label: 'Collected', color: colors.success },
    { value: 'PARTIALLY_COLLECTED', label: 'Partial', color: colors.warning },
    { value: 'NOT_PAID', label: 'Not Paid', color: colors.danger },
];

const STATUS_META = STATUS_OPTIONS.reduce((a, o) => { a[o.value] = o; return a; }, {});

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

const FilterChip = ({ label, color, count, active, onPress }) => (
    <TouchableOpacity
        style={[styles.filterChip, active && { backgroundColor: color || colors.primary, borderColor: color || colors.primary }]}
        onPress={onPress}
        activeOpacity={0.8}
    >
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
        <View style={[styles.filterCount, active && styles.filterCountActive]}>
            <Text style={[styles.filterCountText, active && styles.filterChipTextActive]}>{count}</Text>
        </View>
    </TouchableOpacity>
);

const CollectionsScreen = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('ALL');
    const [typeFilter, setTypeFilter] = useState('ALL');

    const [modal, setModal] = useState({ open: false, record: null });
    const [form, setForm] = useState({ status: 'PENDING', collected_amount: '', remarks: '' });
    const [saving, setSaving] = useState(false);

    const fetchRecords = useCallback(async () => {
        try {
            const res = await api.getCollections();
            setRecords(res.data.results || res.data || []);
        } catch (e) {
            Alert.alert('Error', 'Could not load your collections.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    const onRefresh = () => { setRefreshing(true); fetchRecords(); };

    // ── Derived stats & filtering ───────────────────────────────────────────
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
            if (!q) return true;
            return (
                (r.loan_id || '').toLowerCase().includes(q) ||
                (r.customer_name || '').toLowerCase().includes(q) ||
                (r.customer_phone || '').toLowerCase().includes(q) ||
                (r.pincode || '').toLowerCase().includes(q)
            );
        });
    }, [records, activeFilter, typeFilter, search]);

    const openUpdate = (record) => {
        setForm({
            status: record.status || 'PENDING',
            collected_amount: record.collected_amount != null ? String(record.collected_amount) : '',
            remarks: record.remarks || '',
        });
        setModal({ open: true, record });
    };

    const save = async () => {
        setSaving(true);
        try {
            const payload = { status: form.status, remarks: form.remarks };
            if (form.collected_amount !== '') payload.collected_amount = parseFloat(form.collected_amount);
            await api.updateCollectionStatus(modal.record.id, payload);
            setModal({ open: false, record: null });
            fetchRecords();
        } catch (e) {
            Alert.alert('Error', 'Failed to update status.');
        } finally {
            setSaving(false);
        }
    };

    const renderItem = ({ item }) => {
        const meta = STATUS_META[item.status] || STATUS_META.PENDING;
        const fullAddress = [item.address, item.area, item.pincode && `PIN: ${item.pincode}`]
            .filter(Boolean).join(', ');
        return (
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

                    {!!item.due_date && (
                        <View style={styles.row}>
                            <Icon name="calendar" size={15} color={colors.textMuted} />
                            <Text style={styles.rowText}>Planned: {fmtDate(item.due_date)}</Text>
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
                            onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`)}
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
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

            {/* ── Enterprise header ── */}
            <View style={styles.header}>
                <View style={styles.headerTopRow}>
                    <View>
                        <Text style={styles.headerTitle}>My Collections</Text>
                        <Text style={styles.headerSub}>{stats.total} assigned · {stats.pending} pending</Text>
                    </View>
                    <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                        <Icon name="refresh-cw" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.kpiRow}>
                    <KpiPill label="To Collect" value={fmtCompact(stats.totalDue)} />
                    <KpiPill label="Collected" value={fmtCompact(stats.totalCollected)} accent={colors.successLight} />
                    <KpiPill label="Pending" value={stats.pending} />
                    <KpiPill label="Done" value={stats.collected} />
                </View>
            </View>

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

            {/* ── Status filters ── */}
            <View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                >
                    <FilterChip
                        label="All"
                        count={stats.total}
                        active={activeFilter === 'ALL'}
                        onPress={() => setActiveFilter('ALL')}
                    />
                    {STATUS_OPTIONS.map(o => (
                        <FilterChip
                            key={o.value}
                            label={o.label}
                            color={o.color}
                            count={stats.countBy[o.value] || 0}
                            active={activeFilter === o.value}
                            onPress={() => setActiveFilter(o.value)}
                        />
                    ))}
                </ScrollView>

                {/* Collection type filter */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.typeRow}
                >
                    {TYPE_OPTIONS.map(o => {
                        const active = typeFilter === o.value;
                        return (
                            <TouchableOpacity
                                key={o.value}
                                style={[styles.typeChip, active && { backgroundColor: (o.color || colors.textDark), borderColor: (o.color || colors.textDark) }]}
                                onPress={() => setTypeFilter(o.value)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.typeChipText, active && styles.filterChipTextActive]}>{o.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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

            {/* Update modal */}
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
                                        onPress={() => setForm(f => ({ ...f, status: o.value }))}
                                    >
                                        <Text style={[styles.statusOptionText, active && { color: '#FFFFFF' }]}>{o.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {(form.status === 'COLLECTED' || form.status === 'PARTIALLY_COLLECTED') && (
                            <>
                                <Text style={styles.fieldLabel}>Collected Amount (₹)</Text>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    value={form.collected_amount}
                                    onChangeText={(v) => setForm(f => ({ ...f, collected_amount: v.replace(/[^0-9.]/g, '') }))}
                                    placeholder="0"
                                    placeholderTextColor={colors.textMuted}
                                />
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
    emptyText: { marginTop: spacing.sm, color: colors.textMuted, fontSize: typography.sizes.sm },

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

    // Search
    searchWrap: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        backgroundColor: colors.surface, marginHorizontal: spacing.md, marginTop: spacing.md,
        paddingHorizontal: spacing.md, borderRadius: borderRadius.md,
        borderWidth: 1, borderColor: colors.border,
    },
    searchInput: { flex: 1, paddingVertical: spacing.sm, fontSize: typography.sizes.sm, color: colors.textDark, marginLeft: spacing.xs },

    // Filters
    filterRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
    filterChip: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginRight: spacing.xs,
        borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    filterChipText: { fontSize: typography.sizes.xs, fontWeight: '600', color: colors.textMedium },
    filterChipTextActive: { color: '#FFFFFF' },
    filterCount: { backgroundColor: colors.background, borderRadius: borderRadius.full, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 4 },
    filterCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
    filterCountText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },

    // Type filter row
    typeRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
    typeChip: {
        paddingHorizontal: spacing.md, paddingVertical: 5, marginRight: spacing.xs,
        borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    typeChipText: { fontSize: 11, fontWeight: '600', color: colors.textMedium },
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
    saveBtn: {
        backgroundColor: colors.primary, borderRadius: borderRadius.md,
        paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg,
    },
    saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: typography.sizes.md },
});

export default CollectionsScreen;
