import React, { useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet,
    RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';
import { parseApiError } from '../../core/error/AppErrorHandler';
import { SkeletonListItem } from '../../components/SkeletonComponents';

const fmtDateTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
};

const displayName = (u) => {
    if (!u) return 'A colleague';
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    return name || u.username || 'A colleague';
};

const CompanionCard = ({ item }) => (
    <View style={c.card}>
        <View style={c.topRow}>
            <View style={c.iconWrap}>
                <Icon name="users" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={c.name}>{displayName(item.employee_details)}</Text>
                <Text style={c.sub}>named you as their travel companion</Text>
            </View>
        </View>
        <View style={c.metaRow}>
            <Icon name="clock" size={12} color={colors.textMuted} />
            <Text style={c.metaText}>{fmtDateTime(item.punched_at)}</Text>
        </View>
        {!!item.address && (
            <View style={c.metaRow}>
                <Icon name="map-pin" size={12} color={colors.textMuted} />
                <Text style={c.metaText} numberOfLines={2}>{item.address}</Text>
            </View>
        )}
        {!!item.loan_id && (
            <View style={c.loanBadge}>
                <Text style={c.loanText}>Loan: {item.loan_id}</Text>
            </View>
        )}
    </View>
);

const c = StyleSheet.create({
    card: {
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        marginBottom: spacing.sm, padding: spacing.md, ...shadows.sm,
    },
    topRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    iconWrap: {
        width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primaryLight,
        alignItems: 'center', justifyContent: 'center', marginRight: 10,
    },
    name: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.textDark },
    sub:  { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 4 },
    metaText: { flex: 1, fontSize: 12, color: colors.textMuted },
    loanBadge: { alignSelf: 'flex-start', backgroundColor: '#F0FDF4', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
    loanText: { fontSize: 10, color: colors.success, fontWeight: '600' },
});

const CompanionHistoryScreen = ({ navigation }) => {
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const fetchData = useCallback(async (isRefresh = false) => {
        try {
            setHasError(false);
            setErrorMsg('');
            if (isRefresh) setIsRefreshing(true);
            else setIsLoading(true);

            const res = await api.getCompanionHistory({ page_size: 200 });
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setEntries(data);
        } catch (err) {
            setHasError(true);
            const { message } = parseApiError(err);
            setErrorMsg(message);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                    <Icon name="arrow-left" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Travel Companion History</Text>
                <View style={{ width: 38 }} />
            </View>

            {isLoading ? (
                <View style={{ padding: spacing.md }}>
                    {[1, 2, 3].map(i => (
                        <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
                    ))}
                </View>
            ) : hasError && entries.length === 0 ? (
                <View style={s.centered}>
                    <Icon name="wifi-off" size={44} color={colors.danger} />
                    <Text style={s.errorTxt}>{errorMsg || 'Could not load data'}</Text>
                    <TouchableOpacity style={s.retryBtn} onPress={() => fetchData()}>
                        <Icon name="refresh-cw" size={14} color="#fff" />
                        <Text style={s.retryTxt}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(item, i) => item?.id ? String(item.id) : String(i)}
                    renderItem={({ item }) => <CompanionCard item={item} />}
                    contentContainerStyle={s.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => fetchData(true)}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={s.centered}>
                            <Icon name="users" size={44} color={colors.border} />
                            <Text style={s.emptyTitle}>No companion history yet</Text>
                            <Text style={s.emptySub}>
                                You'll see it here whenever a colleague names you as their
                                travel companion on a punch or visit.
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    },
    backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: typography.sizes.lg, fontWeight: '700', color: '#fff' },
    listContent: { padding: spacing.md, paddingBottom: 100 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: spacing.lg },
    errorTxt: { fontSize: typography.sizes.sm, color: colors.danger, marginTop: spacing.md, textAlign: 'center' },
    retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20 },
    retryTxt: { color: '#fff', fontSize: typography.sizes.sm, fontWeight: '600' },
    emptyTitle: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.textDark, marginTop: spacing.md, textAlign: 'center' },
    emptySub: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
});

export default CompanionHistoryScreen;
