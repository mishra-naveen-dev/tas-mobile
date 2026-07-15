import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import GlassCard from '../../components/GlassCard';
import ErrorView from '../../components/ErrorView';
import { SkeletonListItem } from '../../components/SkeletonComponents';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, typography, spacing } from '../../theme/tokens';

const PAGE_SIZE = 20;

const STATUS_META = {
    COLLECTED: { label: 'Collected', color: colors.success, icon: 'check-circle' },
    PARTIALLY_COLLECTED: { label: 'Partial', color: colors.warning, icon: 'check-circle' },
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '';

const fmtAmount = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const CollectionDoneScreen = ({ navigation }) => {
    const [records, setRecords] = useState([]);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasError, setHasError] = useState(false);

    const fetchData = useCallback(async (pageNum = 1, isRefresh = false) => {
        try {
            setHasError(false);
            if (isRefresh) setIsRefreshing(true);
            else if (pageNum === 1) setIsLoading(true);
            else setIsLoadingMore(true);

            const res = await api.getCollections({ is_done: true, page: pageNum, page_size: PAGE_SIZE });
            const data = res.data;
            const results = data?.results || (Array.isArray(data) ? data : []);
            setTotalCount(data?.count ?? results.length);
            setRecords(prev => pageNum === 1 ? results : [...prev, ...results]);
            setPage(pageNum);
        } catch (err) {
            console.log('Collection Done fetch error:', err);
            setHasError(true);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
            setIsLoadingMore(false);
        }
    }, []);

    React.useEffect(() => { fetchData(1); }, [fetchData]);

    const onRefresh = useCallback(() => { fetchData(1, true); }, [fetchData]);

    const onEndReached = useCallback(() => {
        if (!isLoadingMore && records.length < totalCount) {
            fetchData(page + 1);
        }
    }, [isLoadingMore, records.length, totalCount, page, fetchData]);

    const renderItem = useCallback(({ item }) => {
        const meta = STATUS_META[item.status] || STATUS_META.COLLECTED;
        return (
            <GlassCard style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                        <Text style={styles.nameText} numberOfLines={1}>{item.customer_name}</Text>
                        <Text style={styles.loanText}>Loan {item.loan_id}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: meta.color + '20' }]}>
                        <Icon name={meta.icon} size={14} color={meta.color} />
                        <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                </View>

                <View style={styles.cardDetails}>
                    <View style={styles.detailItem}>
                        <Icon name="dollar-sign" size={16} color={colors.textMuted} />
                        <Text style={styles.detailValue}>{fmtAmount(item.collected_amount)}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Icon name="clock" size={16} color={colors.textMuted} />
                        <Text style={styles.detailValue}>{fmtDate(item.last_collection_date)}</Text>
                    </View>
                </View>

                {!!item.remarks && (
                    <View style={styles.reasonRow}>
                        <Icon name="message-square" size={14} color={colors.textMuted} />
                        <Text style={styles.reasonText} numberOfLines={2}>{item.remarks}</Text>
                    </View>
                )}
            </GlassCard>
        );
    }, []);

    const ListHeader = useCallback(() => (
        <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Collection Done</Text>
            <Text style={styles.listSubtitle}>{totalCount} completed record{totalCount === 1 ? '' : 's'}</Text>
        </View>
    ), [totalCount]);

    const ListEmpty = useCallback(() => (
        !isLoading && !hasError ? (
            <View style={styles.emptyContainer}>
                <Icon name="check-circle" size={64} color={colors.textMuted} />
                <Text style={styles.emptyText}>No completed collections yet</Text>
            </View>
        ) : null
    ), [isLoading, hasError]);

    const ListFooter = useCallback(() => (
        isLoadingMore ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
        ) : null
    ), [isLoadingMore]);

    const ListSkeleton = useCallback(() => (
        <View style={{ padding: spacing.md }}>
            {[1, 2, 3, 4, 5].map(i => (
                <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
            ))}
        </View>
    ), []);

    if (isLoading && records.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScreenHeader title="Collection Done" subtitle="Completed collections" navigation={navigation} />
                <ListSkeleton />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader title="Collection Done" subtitle={`${totalCount} completed`} navigation={navigation} />

            {hasError ? (
                <ErrorView onRetry={() => fetchData(1)} style={{ flex: 1, justifyContent: 'center' }} />
            ) : (
                <FlatList
                    data={records}
                    keyExtractor={(item, index) => item?.id ? String(item.id) : String(index)}
                    renderItem={renderItem}
                    ListHeaderComponent={ListHeader}
                    ListEmptyComponent={ListEmpty}
                    ListFooterComponent={ListFooter}
                    onEndReached={onEndReached}
                    onEndReachedThreshold={0.4}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: spacing.md, paddingBottom: 100 },
    listHeader: { marginBottom: spacing.lg },
    listTitle: { fontSize: 24, fontWeight: '700', color: colors.textDark },
    listSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
    card: { marginBottom: spacing.md, padding: spacing.md },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardHeaderLeft: { flex: 1, marginRight: 12 },
    nameText: { fontSize: 16, fontWeight: '600', color: colors.textDark },
    loanText: { fontSize: 13, color: colors.textMuted, marginTop: 4, fontFamily: 'monospace' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    statusText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
    cardDetails: { flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    detailItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    detailValue: { fontSize: 15, fontWeight: '600', color: colors.textDark, marginLeft: 6 },
    reasonRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    reasonText: { fontSize: 13, color: colors.textMuted, marginLeft: 6, flex: 1, lineHeight: 18 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyText: { fontSize: 16, color: colors.textMuted, marginTop: 16 },
});

export default CollectionDoneScreen;
