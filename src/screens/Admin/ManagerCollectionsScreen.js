import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';
import ScreenHeader from '../../components/ScreenHeader';
import EmployeeSearchInput from '../../components/EmployeeSearchInput';

const PAGE_SIZE = 20;
const fmtAmount = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDateTime = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
};
const STATUS_COLOR = {
    COLLECTED: colors.success, PARTIALLY_COLLECTED: colors.info, NOT_PAID: colors.error,
    VISITED: colors.info, PENDING: colors.warning,
};
const label = (s) => (s || '').replace(/_/g, ' ');

/**
 * Manager view of the shared case pool: who owns each case now, who updated it
 * last, what that update was and how many activities the case has. Data is the
 * same collections API the employee screen uses, with ?with_activity=1 and the
 * server-side employee filter (owns OR ever worked). Visibility is decided by
 * the backend, not this screen.
 */
const ManagerCollectionsScreen = ({ navigation }) => {
    const [rows, setRows] = useState([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [searchText, setSearchText] = useState('');
    const [search, setSearch] = useState('');
    const [employee, setEmployee] = useState(null);
    const seq = useRef(0);

    useEffect(() => {
        const t = setTimeout(() => setSearch(searchText.trim()), 400);
        return () => clearTimeout(t);
    }, [searchText]);

    const load = useCallback(async (pageNo, mode) => {
        const mine = ++seq.current;
        if (mode === 'more') setLoadingMore(true);
        else if (mode === 'initial') setLoading(true);
        setError('');
        try {
            const res = await api.getCollections({
                page: pageNo, page_size: PAGE_SIZE, with_activity: 1,
                ...(search ? { search } : {}),
                ...(employee ? { employee: employee.id } : {}),
            });
            if (mine !== seq.current) return;           // a newer request superseded this one
            const data = res.data;
            const list = data.results || data || [];
            setRows((prev) => (pageNo === 1 ? list : [...prev, ...list]));
            setCount(data.count ?? list.length);
            setPage(pageNo);
        } catch {
            if (mine === seq.current) setError('Could not load cases. Pull down to retry.');
        } finally {
            if (mine === seq.current) { setLoading(false); setLoadingMore(false); setRefreshing(false); }
        }
    }, [search, employee]);

    useEffect(() => { load(1, 'initial'); }, [load]);
    // Coming back from a case (after a transfer, say) refreshes what's on screen.
    useFocusEffect(useCallback(() => { if (!loading) load(1, 'refresh'); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

    const onEnd = () => {
        if (!loadingMore && !loading && rows.length < count) load(page + 1, 'more');
    };

    const renderItem = ({ item }) => {
        const tone = STATUS_COLOR[item.status] || colors.textMuted;
        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('CaseActivity', { recordId: item.id, loanId: item.loan_id })}
            >
                <View style={styles.rowTop}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.loanId}>Loan {item.loan_id}</Text>
                        <Text style={styles.customer} numberOfLines={1}>{item.customer_name}</Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: `${tone}22` }]}>
                        <Text style={[styles.chipText, { color: tone }]}>{item.status_display || label(item.status)}</Text>
                    </View>
                </View>

                <View style={styles.line}>
                    <Icon name="user" size={14} color={colors.textMuted} />
                    <Text style={styles.lineText} numberOfLines={1}>
                        Owner: <Text style={styles.bold}>
                            {item.assigned_employee_name ? `${item.assigned_employee_name} (${item.assigned_employee_code})` : 'Unassigned'}
                        </Text>
                    </Text>
                </View>
                <View style={styles.line}>
                    <Icon name="edit-3" size={14} color={colors.textMuted} />
                    <Text style={styles.lineText} numberOfLines={1}>
                        Last updated by: <Text style={styles.bold}>
                            {item.last_updated_by_name ? `${item.last_updated_by_name} (${item.last_updated_by_code})` : '—'}
                        </Text>
                    </Text>
                </View>
                <View style={styles.line}>
                    <Icon name="clock" size={14} color={colors.textMuted} />
                    <Text style={styles.lineText} numberOfLines={1}>
                        {item.last_activity_at
                            ? `${label(item.last_activity_status)}${item.last_activity_amount ? ` · ${fmtAmount(item.last_activity_amount)}` : ''}  ·  ${fmtDateTime(item.last_activity_at)}`
                            : 'No activity yet'}
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.meta} numberOfLines={1}>
                        {[item.branch_name, item.region_name].filter(Boolean).join(' · ') || '—'}
                    </Text>
                    <Text style={styles.meta}>{item.activity_count ?? 0} activities</Text>
                    <Icon name="chevron-right" size={16} color={colors.textMuted} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader
                title="Team Collections"
                subtitle={loading ? '' : `${count.toLocaleString('en-IN')} case${count === 1 ? '' : 's'}`}
                navigation={navigation}
            />
            <View style={styles.filters}>
                <View style={styles.searchRow}>
                    <Icon name="search" size={16} color={colors.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholder="Search loan ID, customer, phone"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>
                <EmployeeSearchInput
                    style={{ marginTop: spacing.xs }}
                    value={employee}
                    onSelect={setEmployee}
                    placeholder="Employee (owns or worked) — name or ID"
                />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(i) => String(i.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    keyboardShouldPersistTaps="handled"
                    onEndReached={onEnd}
                    onEndReachedThreshold={0.4}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1, 'refresh'); }} colors={[colors.primary]} />}
                    ListEmptyComponent={<Text style={styles.empty}>{error || 'No cases match.'}</Text>}
                    ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: spacing.sm }} color={colors.primary} /> : null}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filters: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
    searchRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1,
        borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.sm, height: 46,
    },
    searchInput: { flex: 1, marginLeft: spacing.xs, fontSize: typography.sizes.sm, color: colors.text, paddingVertical: 0 },
    list: { padding: spacing.md, paddingBottom: 90 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: {
        backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, marginBottom: spacing.sm,
        borderWidth: 1, borderColor: colors.border,
    },
    rowTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
    loanId: { fontSize: typography.sizes.md, fontWeight: '800', color: colors.text },
    customer: { fontSize: typography.sizes.sm, color: colors.text, marginTop: 2 },
    chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginLeft: spacing.xs },
    chipText: { fontSize: typography.sizes.xs, fontWeight: '700' },
    line: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    lineText: { flex: 1, marginLeft: 8, fontSize: typography.sizes.sm, color: colors.text },
    bold: { fontWeight: '700' },
    footer: {
        flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, paddingTop: spacing.xs,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    },
    meta: { flex: 1, fontSize: typography.sizes.xs, color: colors.textMuted },
    empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
});

export default ManagerCollectionsScreen;
