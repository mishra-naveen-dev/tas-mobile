import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';
import ScreenHeader from '../../components/ScreenHeader';
import EmployeeSearchInput from '../../components/EmployeeSearchInput';

const PAGE = 15;
const POLL_MS = 30000;
const fmtAmount = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`);
const fmtDateTime = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
};
const who = (p) => (p ? `${p.name}${p.employee_id ? ` (${p.employee_id})` : ''}` : '—');
const errText = (e, fb) => e?.response?.data?.error || e?.response?.data?.detail || fb;

const TYPES = [
    ['', 'All'], ['VISIT', 'Visits'], ['COLLECTION', 'Collections'], ['PROMISE_TO_PAY', 'P2P'],
    ['NOT_PAID', 'Not paid'], ['ASSIGNED', 'Assigned'], ['TRANSFERRED', 'Transfers'],
];
const TYPE_META = {
    ASSIGNED: { label: 'Assigned', color: colors.textMuted, icon: 'user-plus' },
    TRANSFERRED: { label: 'Transferred', color: '#7C3AED', icon: 'repeat' },
    VISIT: { label: 'Collection Visit', color: colors.info, icon: 'map-pin' },
    COLLECTION: { label: 'Collection', color: colors.success, icon: 'check-circle' },
    PROMISE_TO_PAY: { label: 'Promise to Pay', color: colors.warning, icon: 'clock' },
    NOT_PAID: { label: 'Not Paid', color: colors.error, icon: 'x-circle' },
    UPDATE: { label: 'Update', color: colors.textMuted, icon: 'edit-3' },
    TRANSFER_REQUEST_PENDING: { label: 'Transfer requested', color: colors.warning, icon: 'repeat' },
    TRANSFER_REQUEST_REJECTED: { label: 'Transfer rejected', color: colors.error, icon: 'repeat' },
    TRANSFER_REQUEST_CANCELLED: { label: 'Transfer cancelled', color: colors.textMuted, icon: 'repeat' },
};

const Event = ({ e }) => {
    const meta = TYPE_META[e.type] || { label: e.type, color: colors.textMuted, icon: 'circle' };
    return (
        <View style={styles.event}>
            <View style={[styles.eventDot, { backgroundColor: `${meta.color}22` }]}>
                <Icon name={meta.icon} size={14} color={meta.color} />
            </View>
            <View style={{ flex: 1 }}>
                <View style={styles.eventHead}>
                    <Text style={[styles.eventType, { color: meta.color }]}>{meta.label}</Text>
                    {e.amount > 0 && <Text style={styles.eventAmount}>{fmtAmount(e.amount)}</Text>}
                </View>
                <Text style={styles.small}>{fmtDateTime(e.at)}</Text>
                {e.kind === 'ACTIVITY' && (
                    <>
                        <Text style={styles.body}>
                            <Text style={styles.bold}>{who(e.performed_by)}</Text>
                            {e.performed_by?.designation ? ` · ${e.performed_by.designation}` : ''}
                        </Text>
                        {e.previous_status !== e.status && (
                            <Text style={styles.small}>{label(e.previous_status)} → {label(e.status)}</Text>
                        )}
                        {e.owner_at_time && e.owner_at_time.employee_id !== e.performed_by?.employee_id && (
                            <Text style={styles.small}>Case was with {who(e.owner_at_time)} at the time</Text>
                        )}
                        {e.sync_status === 'SYNCED_LATE' && <Text style={[styles.small, { color: colors.warning }]}>Recorded offline · synced {fmtDateTime(e.synced_at)}</Text>}
                        {!!e.remarks && <Text style={styles.small}>{e.remarks}</Text>}
                        {(e.address || e.device_id) && (
                            <Text style={styles.small} numberOfLines={2}>
                                {[e.address, e.device_id && `Device ${e.device_id}`].filter(Boolean).join(' · ')}
                            </Text>
                        )}
                    </>
                )}
                {(e.kind === 'OWNERSHIP' || e.kind === 'REQUEST') && (
                    <>
                        <Text style={styles.body}>
                            {e.from ? `${who(e.from)} → ` : ''}<Text style={styles.bold}>{who(e.to)}</Text>
                        </Text>
                        {e.by && <Text style={styles.small}>By {who(e.by)}{e.decided_by ? ` · decided by ${who(e.decided_by)}` : ''}</Text>}
                        {!!e.reason && <Text style={styles.small}>Reason: {e.reason}</Text>}
                        {(e.ip || e.device_id) && (
                            <Text style={styles.small}>{[e.ip && `IP ${e.ip}`, e.device_id && `Device ${e.device_id}`].filter(Boolean).join(' · ')}</Text>
                        )}
                    </>
                )}
            </View>
        </View>
    );
};
const label = (s) => (s || '').replace(/_/g, ' ');

/**
 * One case, for a manager: details, current owner, ownership history, who worked
 * on it (per employee — totals survive a transfer), a paginated timeline and a
 * transfer flow. Data comes from GET /loans/collections/<id>/case_activity/;
 * what the user may see is decided by the backend. Refreshes every 30s while open.
 */
const CaseActivityScreen = ({ navigation, route }) => {
    const { recordId } = route.params;
    const [data, setData] = useState(null);
    const [events, setEvents] = useState([]);
    const [page, setPage] = useState(1);
    const [type, setType] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [target, setTarget] = useState(null);
    const [reason, setReason] = useState('');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [xferError, setXferError] = useState('');
    const seq = useRef(0);

    const load = useCallback(async (pageNo, mode) => {
        const mine = ++seq.current;
        if (mode === 'more') setLoadingMore(true);
        try {
            const res = await api.getCaseActivity(recordId, { page: pageNo, page_size: PAGE, ...(type ? { type } : {}) });
            if (mine !== seq.current) return;
            const d = res.data;
            setData(d);
            setEvents((prev) => (pageNo === 1 ? d.results : [...prev, ...d.results]));
            setPage(pageNo);
            setError('');
        } catch (e) {
            if (mine === seq.current) setError(errText(e, 'Could not load this case.'));
        } finally {
            if (mine === seq.current) { setLoading(false); setLoadingMore(false); setRefreshing(false); }
        }
    }, [recordId, type]);

    useEffect(() => { setLoading(true); load(1, 'initial'); }, [load]);
    useFocusEffect(useCallback(() => {
        const t = setInterval(() => load(1, 'poll'), POLL_MS);
        return () => clearInterval(t);
    }, [load]));

    const c = data?.case;
    const owner = c?.current_owner;
    const hasMore = data && page * PAGE < data.count;

    const submit = async () => {
        setSaving(true);
        setXferError('');
        try {
            const res = await api.transferCase(recordId, target.id, reason.trim());
            const moved = res.data?.transferred ?? 0;
            setConfirmOpen(false);
            Alert.alert(moved ? 'Case transferred' : 'No change',
                moved ? `Now owned by ${target.name} (${target.employee_id}).` : 'That employee already owns this case.');
            setTarget(null);
            setReason('');
            load(1, 'refresh');
        } catch (e) {
            setXferError(errText(e, 'Transfer failed.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader title="Case Activity" subtitle={c ? `Loan ${c.loan_id}` : ''} navigation={navigation} />
            {loading && !data ? (
                <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1, 'refresh'); }} colors={[colors.primary]} />}
                >
                    {!!error && <Text style={styles.error}>{error}</Text>}
                    {c && (
                        <>
                            <View style={styles.card}>
                                <Text style={styles.title}>{c.customer_name}</Text>
                                <Text style={styles.small}>{[c.cust_id, c.branch, c.region, c.state].filter(Boolean).join(' · ')}</Text>
                                <View style={styles.grid}>
                                    <View style={styles.cell}><Text style={styles.cellLabel}>CURRENT OWNER</Text>
                                        <Text style={styles.cellValue}>{owner ? who(owner) : 'Unassigned'}</Text></View>
                                    <View style={styles.cell}><Text style={styles.cellLabel}>STATUS</Text>
                                        <Text style={styles.cellValue}>{label(c.status)}</Text></View>
                                    <View style={styles.cell}><Text style={styles.cellLabel}>EMI / DEMAND</Text>
                                        <Text style={styles.cellValue}>{fmtAmount(c.amount_due)}</Text></View>
                                    <View style={styles.cell}><Text style={styles.cellLabel}>ALL EMPLOYEES</Text>
                                        <Text style={styles.cellValue}>{data.totals.visits} visits · {fmtAmount(data.totals.amount)}</Text></View>
                                </View>
                            </View>

                            <Text style={styles.section}>Ownership history</Text>
                            <View style={styles.card}>
                                {data.owners.length === 0 && <Text style={styles.small}>No ownership ledger for this case.</Text>}
                                {data.owners.map((o, i) => (
                                    <View key={i} style={styles.ownerRow}>
                                        <Icon name={o.is_current ? 'user-check' : 'user'} size={15} color={o.is_current ? colors.primary : colors.textMuted} />
                                        <View style={{ flex: 1, marginLeft: 8 }}>
                                            <Text style={[styles.body, o.is_current && styles.bold]}>{who(o.employee)}{o.is_current ? '  · current' : ''}</Text>
                                            <Text style={styles.small}>{fmtDateTime(o.from)} → {o.to ? fmtDateTime(o.to) : 'now'}</Text>
                                            {!!o.reason && <Text style={styles.small}>{o.reason}</Text>}
                                        </View>
                                    </View>
                                ))}
                            </View>

                            <Text style={styles.section}>Who worked on it</Text>
                            <View style={styles.card}>
                                {data.breakdown.length === 0 && <Text style={styles.small}>No activity yet.</Text>}
                                {data.breakdown.map((b) => (
                                    <View key={b.employee_id} style={styles.brow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.body, styles.bold]} numberOfLines={1}>{b.name} ({b.employee_id})</Text>
                                            <Text style={styles.small}>{b.designation || b.role} · last {fmtDateTime(b.last_at)}</Text>
                                        </View>
                                        <Text style={styles.small}>{b.visits} visits · {b.collections} coll · {fmtAmount(b.amount)}</Text>
                                    </View>
                                ))}
                            </View>

                            <Text style={styles.section}>Activity timeline ({data.count})</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xs }}>
                                {TYPES.map(([val, name]) => (
                                    <TouchableOpacity key={val || 'all'} onPress={() => setType(val)}
                                        style={[styles.pill, type === val && styles.pillActive]}>
                                        <Text style={[styles.pillText, type === val && styles.pillTextActive]}>{name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <View style={styles.card}>
                                {events.length === 0 && <Text style={styles.small}>Nothing matches.</Text>}
                                {events.map((e) => <Event key={`${e.kind}-${e.id}`} e={e} />)}
                                {hasMore && (
                                    <TouchableOpacity style={styles.more} onPress={() => load(page + 1, 'more')} disabled={loadingMore}>
                                        {loadingMore ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.moreText}>Load more</Text>}
                                    </TouchableOpacity>
                                )}
                            </View>

                            <Text style={styles.section}>Transfer this case</Text>
                            <View style={styles.card}>
                                <EmployeeSearchInput value={target} onSelect={setTarget} excludeId={owner?.id} placeholder="New employee — name or ID" />
                                <TextInput
                                    style={styles.reason}
                                    value={reason}
                                    onChangeText={setReason}
                                    placeholder="Reason (required)"
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                />
                                <TouchableOpacity
                                    style={[styles.button, (!target || !reason.trim()) && styles.buttonOff]}
                                    disabled={!target || !reason.trim()}
                                    onPress={() => { setXferError(''); setConfirmOpen(true); }}
                                >
                                    <Icon name="repeat" size={16} color="#fff" />
                                    <Text style={styles.buttonText}>Review transfer</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </ScrollView>
            )}

            <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => !saving && setConfirmOpen(false)}>
                <View style={styles.backdrop}>
                    <View style={styles.modal}>
                        <Text style={styles.title}>Confirm transfer</Text>
                        {c && target && (
                            <View style={{ marginTop: spacing.xs }}>
                                <Text style={styles.body}><Text style={styles.bold}>Loan ID: </Text>{c.loan_id}</Text>
                                <Text style={styles.body}><Text style={styles.bold}>Customer: </Text>{c.customer_name}</Text>
                                <Text style={styles.body}><Text style={styles.bold}>Current: </Text>{owner ? who(owner) : 'Unassigned'}</Text>
                                <Text style={styles.body}><Text style={styles.bold}>New: </Text>{who(target)}</Text>
                                <Text style={styles.body}><Text style={styles.bold}>Branch: </Text>{c.branch || '—'}</Text>
                                <Text style={styles.body}><Text style={styles.bold}>Reason: </Text>{reason}</Text>
                                <Text style={[styles.small, { marginTop: 6 }]}>The previous owner's activity stays on the case; only ownership moves from now on.</Text>
                            </View>
                        )}
                        {!!xferError && <Text style={styles.error}>{xferError}</Text>}
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancel} onPress={() => setConfirmOpen(false)} disabled={saving}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={submit} disabled={saving}>
                                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm transfer</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing.md, paddingBottom: 90 },
    card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
    title: { fontSize: typography.sizes.md, fontWeight: '800', color: colors.text },
    section: { fontSize: typography.sizes.xs, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing.xs, marginBottom: 6 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
    cell: { width: '50%', marginBottom: spacing.xs, paddingRight: 6 },
    cellLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700' },
    cellValue: { fontSize: typography.sizes.sm, color: colors.text, fontWeight: '700', marginTop: 2 },
    body: { fontSize: typography.sizes.sm, color: colors.text },
    bold: { fontWeight: '700' },
    small: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
    error: { color: colors.error, fontSize: typography.sizes.sm, marginBottom: spacing.xs },
    ownerRow: { flexDirection: 'row', marginBottom: spacing.xs },
    brow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginRight: 6 },
    pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    pillText: { fontSize: typography.sizes.xs, color: colors.text, fontWeight: '600' },
    pillTextActive: { color: '#fff' },
    event: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    eventDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    eventHead: { flexDirection: 'row', justifyContent: 'space-between' },
    eventType: { fontSize: typography.sizes.sm, fontWeight: '800' },
    eventAmount: { fontSize: typography.sizes.sm, fontWeight: '800', color: colors.text },
    more: { alignItems: 'center', paddingVertical: spacing.sm },
    moreText: { color: colors.primary, fontWeight: '700' },
    reason: {
        minHeight: 64, marginTop: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm,
        color: colors.text, fontSize: typography.sizes.sm, textAlignVertical: 'top',
    },
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, marginTop: spacing.sm },
    buttonOff: { backgroundColor: colors.textMuted },
    buttonText: { color: '#fff', fontWeight: '800', marginLeft: 6, fontSize: typography.sizes.sm },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg },
    modal: { backgroundColor: colors.surface, borderRadius: 18, padding: spacing.md },
    modalActions: { flexDirection: 'row', marginTop: spacing.sm, alignItems: 'center' },
    cancel: { paddingVertical: 12, paddingHorizontal: spacing.md, marginTop: spacing.sm, marginRight: spacing.xs },
    cancelText: { color: colors.textMuted, fontWeight: '700' },
});

export default CaseActivityScreen;
