import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import GlassCard from '../../components/GlassCard';
import ErrorView from '../../components/ErrorView';
import { SkeletonListItem } from '../../components/SkeletonComponents';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, typography, spacing } from '../../theme/tokens';

const AllowanceHistoryScreen = ({ navigation }) => {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasError, setHasError] = useState(false);

    const fetchData = useCallback(async (isRefresh = false) => {
        try {
            setHasError(false);
            if (!isRefresh) setIsLoading(true);

            const res = await api.getAllowanceHistory();
            const rawData = res.data?.results || res.data || [];
            const processedData = api.processData.normalizeList(res, { keyField: 'id' });
            
            console.log('[AllowanceHistory] Raw items:', rawData.length, 'Processed:', processedData.length);
            setRequests(processedData);

        } catch (err) {
            console.log("Allowance History Error:", err);
            setHasError(true);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData(false);
    }, [fetchData]);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchData(true);
    }, [fetchData]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'APPROVED': return '#10B981';
            case 'REJECTED': return '#EF4444';
            case 'PENDING': return '#F59E0B';
            default: return colors.textMuted;
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'APPROVED': return 'check-circle';
            case 'REJECTED': return 'x-circle';
            case 'PENDING': return 'clock';
            default: return 'help-circle';
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const renderItem = useCallback(({ item }) => (
        <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                    <Text style={styles.dateText}>{formatDate(item.travel_date)}</Text>
                    <Text style={styles.locationText} numberOfLines={1}>
                        {item.from_location} → {item.to_location}
                    </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Icon name={getStatusIcon(item.status)} size={14} color={getStatusColor(item.status)} />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status || 'PENDING'}
                    </Text>
                </View>
            </View>

            <View style={styles.cardDetails}>
                <View style={styles.detailItem}>
                    <Icon name="navigation" size={16} color={colors.textMuted} />
                    <Text style={styles.detailValue}>{item.total_distance || 0} km</Text>
                </View>
                <View style={styles.detailItem}>
                    <Icon name="dollar-sign" size={16} color={colors.textMuted} />
                    <Text style={styles.detailValue}>₹{item.approved_amount || item.requested_amount || 0}</Text>
                </View>
            </View>

            {item.reason && (
                <View style={styles.reasonRow}>
                    <Icon name="message-square" size={14} color={colors.textMuted} />
                    <Text style={styles.reasonText} numberOfLines={2}>{item.reason}</Text>
                </View>
            )}
        </GlassCard>
    ), []);

    const ListHeader = useCallback(() => (
        <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Allowance History</Text>
            <Text style={styles.listSubtitle}>{requests.length} requests</Text>
        </View>
    ), [requests.length]);

    const ListEmpty = useCallback(() => (
        !isLoading && !hasError ? (
            <View style={styles.emptyContainer}>
                <Icon name="file-text" size={64} color={colors.textMuted} />
                <Text style={styles.emptyText}>No allowance requests found</Text>
            </View>
        ) : null
    ), [isLoading, hasError]);

    const ListSkeleton = useCallback(() => (
        <View style={{ padding: spacing.md }}>
            {[1, 2, 3, 4, 5].map(i => (
                <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
            ))}
        </View>
    ), []);

    if (isLoading && requests.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScreenHeader
                    title="Allowance History"
                    subtitle="Your travel claims"
                    navigation={navigation}
                />
                <ListSkeleton />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader
                title="Allowance History"
                subtitle={`${requests.length} requests`}
                navigation={navigation}
            />

            {hasError ? (
                <ErrorView onRetry={fetchData} style={{ flex: 1, justifyContent: 'center' }} />
            ) : (
                <FlatList
                    data={requests}
                    keyExtractor={(item, index) => api.processData.generateKey(item, 'allow', index)}
                    renderItem={renderItem}
                    ListHeaderComponent={ListHeader}
                    ListEmptyComponent={ListEmpty}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            colors={[colors.primary]}
                        />
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
    dateText: { fontSize: 16, fontWeight: '600', color: colors.textDark },
    locationText: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    statusText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
    cardDetails: { flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    detailItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    detailValue: { fontSize: 15, fontWeight: '600', color: colors.textDark, marginLeft: 6 },
    reasonRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    reasonText: { fontSize: 13, color: colors.textMuted, marginLeft: 6, flex: 1, lineHeight: 18 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyText: { fontSize: 16, color: colors.textMuted, marginTop: 16 }
});

export default AllowanceHistoryScreen;
