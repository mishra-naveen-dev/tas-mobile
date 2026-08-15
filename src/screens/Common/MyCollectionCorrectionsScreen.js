import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    FlatList,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/api';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';
import { SkeletonListItem } from '../../components/SkeletonComponents';
import { STATUS_META, fmtDate, fmtDateTime } from '../../utils/requestAdapters';

const FILTERS = ['ALL', 'PENDING_APPROVAL', 'RETURNED_FOR_CORRECTION', 'COMPLETED', 'REJECTED'];

const fmtAmount = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const MyCollectionCorrectionsScreen = ({ navigation }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('ALL');

    const fetchRequests = useCallback(async () => {
        try {
            setError('');
            const params = filter !== 'ALL' ? { status: filter } : {};
            const res = await api.getCollectionCorrections(params);
            const data = res.data;
            setRequests(Array.isArray(data) ? data : (data?.results || []));
        } catch (err) {
            setError('Failed to load correction requests.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    useFocusEffect(useCallback(() => { fetchRequests(); }, [fetchRequests]));

    const onRefresh = () => {
        setRefreshing(true);
        fetchRequests();
    };

    const renderCard = ({ item }) => {
        const meta = STATUS_META[item.status] || STATUS_META.PENDING_APPROVAL;
        const daysRemaining = item.days_remaining;
        const deadlineUrgent = daysRemaining != null && daysRemaining <= 2 && daysRemaining >= 0;

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('CollectionCorrectionDetail', { correctionId: item.id })}
            >
                <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />
                <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.requestNumber}>{item.request_number}</Text>
                            <Text style={styles.loanId}>Loan ID: {item.loan_id}</Text>
                        </View>
                        <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
                            <Icon name={meta.icon} size={12} color={meta.color} />
                            <Text style={[styles.statusChipText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                    </View>

                    <Text style={styles.customerName}>{item.customer_name}</Text>

                    <View style={styles.divider} />

                    <View style={styles.amountRow}>
                        <View style={styles.amountItem}>
                            <Text style={styles.amountLabel}>Original</Text>
                            <Text style={styles.amountValue}>{fmtAmount(item.original_collected_amount)}</Text>
                        </View>
                        <Icon name="arrow-right" size={14} color={colors.textMuted} />
                        <View style={styles.amountItem}>
                            <Text style={styles.amountLabel}>Requested</Text>
                            <Text style={[styles.amountValue, { color: colors.primary }]}>{fmtAmount(item.requested_amount)}</Text>
                        </View>
                    </View>

                    <View style={styles.metaRow}>
                        <Icon name="calendar" size={13} color={colors.textMuted} />
                        <Text style={styles.metaText}>Collection Date: {fmtDate(item.collection_date)}</Text>
                    </View>

                    <View style={styles.metaRow}>
                        <Icon name="hash" size={13} color={colors.textMuted} />
                        <Text style={styles.metaText}>
                            Requests Used: {item.request_count}/3 · Edits Used: {item.edit_count}/3
                        </Text>
                    </View>

                    {daysRemaining != null && daysRemaining >= 0 && (
                        <View style={styles.metaRow}>
                            <Icon name="clock" size={13} color={deadlineUrgent ? colors.danger : colors.textMuted} />
                            <Text style={[styles.metaText, deadlineUrgent && { color: colors.danger, fontWeight: '700' }]}>
                                {daysRemaining === 0 ? 'Correction window expires today' : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left in correction window`}
                            </Text>
                        </View>
                    )}

                    <Text style={styles.createdAt}>Created {fmtDateTime(item.created_at)}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader title="Collection Corrections" subtitle="Track your correction requests" navigation={navigation} />

            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {FILTERS.map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterChip, filter === f && styles.filterChipActive]}
                            onPress={() => setFilter(f)}
                        >
                            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                                {f === 'ALL' ? 'All' : (STATUS_META[f]?.label || f)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {error ? (
                <View style={styles.errorBanner}>
                    <Icon name="alert-circle" size={15} color={colors.danger} />
                    <Text style={styles.errorBannerText}>{error}</Text>
                    <TouchableOpacity onPress={fetchRequests}>
                        <Text style={styles.retryLink}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {loading && requests.length === 0 ? (
                <View style={{ padding: spacing.md }}>
                    {[1, 2, 3, 4].map(i => <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />)}
                </View>
            ) : (
                <FlatList
                    data={requests}
                    renderItem={renderCard}
                    keyExtractor={(item, index) => String(item?.id || index)}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="file-text" size={48} color={colors.textLight} />
                            <Text style={styles.emptyText}>No correction requests found</Text>
                            <Text style={styles.emptySubtext}>
                                Request a correction from a completed collection's "Request Correction" button.
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filterContainer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    filterChip: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface,
        borderRadius: 20, marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontSize: typography.sizes.sm, color: colors.textMuted, fontWeight: '500' },
    filterTextActive: { color: colors.surface, fontWeight: '600' },
    listContent: { paddingHorizontal: spacing.md, paddingBottom: 100 },

    card: {
        flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.lg,
        marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    cardAccent: { width: 4 },
    cardBody: { flex: 1, padding: spacing.md },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
    requestNumber: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, color: colors.textDark },
    loanId: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
    statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.md },
    statusChipText: { fontSize: 11, fontWeight: '700' },
    customerName: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.textDark, marginTop: spacing.xs },
    divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },

    amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    amountItem: { flex: 1 },
    amountLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' },
    amountValue: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.textDark, marginTop: 1 },

    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    metaText: { fontSize: typography.sizes.xs, color: colors.textMuted },
    createdAt: { fontSize: 10, color: colors.textLight, marginTop: spacing.xs },

    emptyContainer: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
    emptyText: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: spacing.md, fontWeight: '600' },
    emptySubtext: { fontSize: typography.sizes.xs, color: colors.textLight, marginTop: spacing.xs, textAlign: 'center' },

    errorBanner: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF0F0', borderRadius: 10,
        padding: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.xs, gap: 8,
    },
    errorBannerText: { flex: 1, fontSize: typography.sizes.sm, color: colors.danger },
    retryLink: { fontSize: typography.sizes.sm, color: colors.primary, fontWeight: '600' },
});

export default MyCollectionCorrectionsScreen;
