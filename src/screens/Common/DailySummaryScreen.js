import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';

import api from '../../api/api';
import GlassCard from '../../components/GlassCard';
import StatCard from '../../components/StatCard';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

// ─── helpers ────────────────────────────────────────────────────────────────

const fmtTime = (iso) => {
    if (!iso) return '--';
    try {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return '--'; }
};

const CHIPS = {
    PUNCH_IN:   { bg: '#D1FAE5', text: '#059669' },
    PUNCH_OUT:  { bg: '#FEE2E2', text: '#DC2626' },
    VISIT:      { bg: '#CFFAFE', text: '#0891B2' },
    COLLECTION: { bg: '#FEF3C7', text: '#D97706' },
    PAYMENT:    { bg: '#FEF3C7', text: '#D97706' },
    DEFAULT:    { bg: '#F3F4F6', text: '#9CA3AF' },
};

const getChip = (type = '') => {
    const t = type.toUpperCase();
    if (t.includes('PUNCH_IN') || t === 'IN')         return CHIPS.PUNCH_IN;
    if (t.includes('PUNCH_OUT') || t === 'OUT')       return CHIPS.PUNCH_OUT;
    if (t.includes('COLLECTION'))                      return CHIPS.COLLECTION;
    if (t.includes('PAYMENT'))                        return CHIPS.PAYMENT;
    if (t.includes('VISIT'))                          return CHIPS.VISIT;
    return CHIPS.DEFAULT;
};

const isVisit = (p) => {
    const t = (p.punch_type || p.visit_type || '').toUpperCase();
    return t.includes('VISIT') || (p.visit_type && p.visit_type !== '' && !t.includes('PUNCH'));
};

// ─── main screen ────────────────────────────────────────────────────────────

const DailySummaryScreen = ({ navigation }) => {
    const auth = useAuth();
    const adminMode = auth.isAdmin || auth.isSuperAdmin;

    const [date, setDate]           = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);
    const [summary, setSummary]     = useState(null);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState(null);

    const dateStr = date.toISOString().split('T')[0];

    const fetchSummary = async () => {
        setError(null);
        setLoading(true);
        setSummary(null);
        try {
            if (adminMode) {
                // Admin/SuperAdmin: aggregate all employees for the day
                const res = await api.getPunchHistory({ date: dateStr });
                const punches = Array.isArray(res.data)
                    ? res.data
                    : (res.data?.results || []);

                const empMap = {};
                let totDist = 0, totColl = 0, totDisb = 0, totVisits = 0;

                punches.forEach(p => {
                    const eid  = String(p.employee_id || p.user_id || p.user || p.id || 'unk');
                    const name = p.employee_name || p.user_name || p.user_full_name || `Emp-${eid}`;
                    if (!empMap[eid]) {
                        empMap[eid] = { name, distance: 0, punches: 0, collection: 0 };
                    }
                    empMap[eid].punches += 1;
                    empMap[eid].distance += parseFloat(p.distance_km || 0);
                    totDist += parseFloat(p.distance_km || 0);

                    if (p.amount) {
                        const amt = parseFloat(p.amount) || 0;
                        const t   = (p.punch_type || p.visit_type || '').toUpperCase();
                        if (t.includes('COLLECTION') || t.includes('PAYMENT')) {
                            empMap[eid].collection += amt;
                            totColl += amt;
                        } else if (t.includes('DISBURS')) {
                            totDisb += amt;
                        }
                    }
                    if (isVisit(p)) totVisits += 1;
                });

                setSummary({
                    mode: 'admin',
                    totalDistance:     Math.round(totDist * 10) / 10,
                    punchCount:        punches.length,
                    totalCollection:   Math.round(totColl),
                    totalDisbursement: Math.round(totDisb),
                    visitCount:        totVisits,
                    employees: Object.values(empMap)
                        .map(e => ({ ...e, distance: Math.round(e.distance * 10) / 10 }))
                        .sort((a, b) => b.distance - a.distance),
                });
            } else {
                // Employee: server-scoped to request.user
                const res  = await api.getDailySummary({ date: dateStr });
                const data = res.data;
                const punches = Array.isArray(data.punches) ? data.punches : [];

                setSummary({
                    mode:              'employee',
                    totalDistance:     parseFloat(data.total_distance_today || 0),
                    punchCount:        data.punch_count || 0,
                    duration:          data.duration || null,
                    totalCollection:   Math.round(parseFloat(data.total_collection  || 0)),
                    totalDisbursement: Math.round(parseFloat(data.total_disbursement || 0)),
                    visitCount:        punches.filter(isVisit).length,
                    punches,
                });
            }
        } catch (err) {
            setError(
                err.response?.data?.error  ||
                err.response?.data?.detail ||
                'Failed to load data. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    const onDateChange = (_, selected) => {
        if (Platform.OS !== 'ios') setShowPicker(false);
        if (selected) setDate(selected);
    };

    const statData = summary ? [
        { label: 'Distance',     value: parseFloat(summary.totalDistance) || 0,     suffix: ' km', icon: 'map-pin',      iconColor: colors.primary,  bgColor: colors.primaryLight },
        { label: 'Punches',      value: summary.punchCount        || 0,              icon: 'clock',         iconColor: colors.punchBlue, bgColor: colors.punchBlueLight },
        { label: 'Collection',   value: summary.totalCollection   || 0,              prefix: '₹',  icon: 'trending-up',  iconColor: colors.success,  bgColor: colors.successLight },
        { label: 'Disbursement', value: summary.totalDisbursement || 0,              prefix: '₹',  icon: 'trending-down',iconColor: colors.warning,  bgColor: colors.warningLight },
        { label: 'Visits',       value: summary.visitCount        || 0,              icon: 'navigation',    iconColor: colors.info,     bgColor: colors.infoLight },
    ] : [];

    return (
        <SafeAreaView style={styles.container}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={22} color={colors.textDark} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Daily Activity</Text>
                    <Text style={styles.headerSub}>
                        {adminMode ? 'All Employees · Select Date' : 'My Activity · Select Date'}
                    </Text>
                </View>
            </View>

            <ScrollView
                style={styles.scroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* ── Date Picker Row ── */}
                <GlassCard style={styles.dateCard}>
                    <TouchableOpacity style={styles.dateTouchable} onPress={() => setShowPicker(true)}>
                        <Icon name="calendar" size={17} color={colors.primary} />
                        <Text style={styles.dateText}>{dateStr}</Text>
                        <Icon name="chevron-down" size={15} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.fetchBtn, loading && { opacity: 0.6 }]}
                        onPress={fetchSummary}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator size="small" color="#fff" />
                            : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Icon name="refresh-cw" size={14} color="#fff" />
                                    <Text style={styles.fetchBtnText}>Fetch</Text>
                                </View>
                            )
                        }
                    </TouchableOpacity>
                </GlassCard>

                {showPicker && (
                    <DateTimePicker
                        value={date}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        maximumDate={new Date()}
                        onChange={onDateChange}
                    />
                )}

                {/* ── Error ── */}
                {!!error && (
                    <View style={styles.errorBox}>
                        <Icon name="alert-circle" size={14} color={colors.error} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* ── Stats grid ── */}
                {summary && (
                    <>
                        <StatCard data={statData} columns={2} style={styles.statCard} />

                        {/* Duration badge — employee only */}
                        {summary.mode === 'employee' && !!summary.duration && (
                            <GlassCard style={styles.durationRow}>
                                <Icon name="clock" size={15} color={colors.textMuted} />
                                <Text style={styles.durationLabel}> Time tracked: </Text>
                                <Text style={styles.durationValue}>{summary.duration}</Text>
                            </GlassCard>
                        )}

                        {/* ── Punch list (employee) ── */}
                        {summary.mode === 'employee' && (
                            summary.punches.length > 0 ? (
                                <GlassCard style={styles.tableCard}>
                                    <Text style={styles.tableTitle}>
                                        Punch Records · {summary.punches.length}
                                    </Text>
                                    <View style={styles.tableHeader}>
                                        <Text style={[styles.th, { width: 52 }]}>Time</Text>
                                        <Text style={[styles.th, { flex: 2 }]}>Type</Text>
                                        <Text style={[styles.th, { flex: 3 }]}>Location</Text>
                                        <Text style={[styles.th, { width: 58, textAlign: 'right' }]}>Amt/km</Text>
                                    </View>
                                    {summary.punches.map((p, i) => {
                                        const chip = getChip(p.punch_type || p.visit_type);
                                        return (
                                            <View key={i} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
                                                <Text style={[styles.td, { width: 52 }]}>
                                                    {fmtTime(p.timestamp || p.created_at)}
                                                </Text>
                                                <View style={[styles.chip, { flex: 2, backgroundColor: chip.bg }]}>
                                                    <Text style={[styles.chipTxt, { color: chip.text }]} numberOfLines={1}>
                                                        {(p.punch_type || p.visit_type || 'PUNCH').replace(/_/g, ' ')}
                                                    </Text>
                                                </View>
                                                <Text style={[styles.td, { flex: 3 }]} numberOfLines={1}>
                                                    {p.current_address || p.customer_address || '—'}
                                                </Text>
                                                <Text style={[styles.td, { width: 58, textAlign: 'right', fontWeight: '600' }]}>
                                                    {p.amount ? `₹${p.amount}` : p.distance_km ? `${p.distance_km}` : '—'}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </GlassCard>
                            ) : (
                                <View style={styles.empty}>
                                    <Icon name="inbox" size={34} color={colors.textLight} />
                                    <Text style={styles.emptyText}>No records for {dateStr}</Text>
                                </View>
                            )
                        )}

                        {/* ── Employee breakdown (admin) ── */}
                        {summary.mode === 'admin' && (
                            summary.employees.length > 0 ? (
                                <GlassCard style={styles.tableCard}>
                                    <Text style={styles.tableTitle}>
                                        Employee Breakdown · {summary.employees.length}
                                    </Text>
                                    <View style={styles.tableHeader}>
                                        <Text style={[styles.th, { flex: 3 }]}>Employee</Text>
                                        <Text style={[styles.th, { width: 50, textAlign: 'right' }]}>Dist</Text>
                                        <Text style={[styles.th, { width: 50, textAlign: 'right' }]}>Punch</Text>
                                        <Text style={[styles.th, { width: 66, textAlign: 'right' }]}>Coll.</Text>
                                    </View>
                                    {summary.employees.map((emp, i) => (
                                        <View key={i} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
                                            <View style={[styles.avatar, { marginRight: 6 }]}>
                                                <Text style={styles.avatarTxt}>
                                                    {(emp.name || 'U').charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text style={[styles.td, { flex: 3 }]} numberOfLines={1}>
                                                {emp.name}
                                            </Text>
                                            <Text style={[styles.td, { width: 50, textAlign: 'right' }]}>
                                                {emp.distance}
                                            </Text>
                                            <Text style={[styles.td, { width: 50, textAlign: 'right' }]}>
                                                {emp.punches}
                                            </Text>
                                            <Text style={[styles.td, { width: 66, textAlign: 'right', fontWeight: '600', color: colors.success }]}>
                                                {emp.collection > 0 ? `₹${emp.collection}` : '—'}
                                            </Text>
                                        </View>
                                    ))}
                                </GlassCard>
                            ) : (
                                <View style={styles.empty}>
                                    <Icon name="inbox" size={34} color={colors.textLight} />
                                    <Text style={styles.emptyText}>No activity on {dateStr}</Text>
                                </View>
                            )
                        )}
                    </>
                )}

                {/* ── Initial state ── */}
                {!loading && !summary && !error && (
                    <View style={styles.empty}>
                        <Icon name="bar-chart-2" size={36} color={colors.textLight} />
                        <Text style={styles.emptyText}>Pick a date and tap Fetch</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default DailySummaryScreen;

// ─── styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn:    { marginRight: spacing.md },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    headerSub: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 1,
    },

    scroll:        { flex: 1 },
    scrollContent: { padding: spacing.md, paddingBottom: 60 },

    dateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    dateTouchable: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: spacing.xs,
    },
    dateText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginHorizontal: 4,
    },
    fetchBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        minWidth: 74,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fetchBtnText: {
        color: '#fff',
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
    },

    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.errorLight,
        borderRadius: borderRadius.sm,
        padding: spacing.sm,
        marginBottom: spacing.md,
        gap: spacing.xs,
    },
    errorText: { flex: 1, fontSize: typography.sizes.sm, color: colors.error },

    statCard: { marginBottom: spacing.md },

    durationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.sm,
        marginBottom: spacing.md,
    },
    durationLabel: { fontSize: typography.sizes.sm, color: colors.textMuted },
    durationValue: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },

    tableCard:   { padding: spacing.md, marginBottom: spacing.md },
    tableTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.sm,
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: spacing.xxs,
    },
    th: {
        fontSize: 11,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
        textTransform: 'uppercase',
    },
    tr: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xxs + 2,
        gap: 4,
    },
    trAlt: { backgroundColor: colors.background, borderRadius: borderRadius.xs },
    td:   { fontSize: typography.sizes.xs, color: colors.textDark },
    chip: {
        borderRadius: borderRadius.xs,
        paddingHorizontal: 5,
        paddingVertical: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipTxt: { fontSize: 10, fontWeight: typography.weights.semibold },

    avatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarTxt: { fontSize: 10, fontWeight: 'bold', color: colors.primary },

    empty: {
        alignItems: 'center',
        paddingVertical: spacing.xxxl,
        gap: spacing.sm,
    },
    emptyText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        textAlign: 'center',
    },
});
