import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../api/api';
import GlassCard from '../components/GlassCard';
import ErrorView from '../components/ErrorView';
import { SkeletonListItem } from '../components/SkeletonComponents';
import { colors, typography, spacing } from '../theme/tokens';

const PunchHistoryScreen = ({ navigation }) => {
    const [punches, setPunches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasError, setHasError] = useState(false);

    const fetchData = useCallback(async (isRefresh = false) => {
        try {
            setHasError(false);
            if (!isRefresh) setIsLoading(true);

            const response = await api.getPunchHistory();
            const data = response.data;
            setPunches(Array.isArray(data) ? data : data.results || []);

        } catch (err) {
            console.log('Failed to fetch punches:', err);
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

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getPunchIcon = (punchType) => {
        if (punchType === 'PUNCH_IN') return 'log-in';
        if (punchType === 'PUNCH_OUT') return 'log-out';
        return 'map-pin';
    };

    const getPunchColor = (punchType) => {
        if (punchType === 'PUNCH_IN') return '#10B981';
        if (punchType === 'PUNCH_OUT') return '#EF4444';
        return colors.primary;
    };

    const renderItem = useCallback(({ item }) => (
        <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconBadge, { backgroundColor: getPunchColor(item.punch_type) + '20' }]}>
                    <Icon name={getPunchIcon(item.punch_type)} size={18} color={getPunchColor(item.punch_type)} />
                </View>
                <View style={styles.cardHeaderText}>
                    <Text style={styles.punchType}>
                        {item.punch_type?.replace('_', ' ') || 'Punch'}
                    </Text>
                    <Text style={styles.dateText}>{formatDate(item.punched_at)}</Text>
                </View>
                <View style={styles.timeBadge}>
                    <Icon name="clock" size={14} color={colors.textMuted} />
                    <Text style={styles.timeText}>{formatTime(item.punched_at)}</Text>
                </View>
            </View>

            {item.current_address && (
                <View style={styles.addressRow}>
                    <Icon name="map-pin" size={14} color={colors.textMuted} />
                    <Text style={styles.addressText} numberOfLines={1}>{item.current_address}</Text>
                </View>
            )}

            {item.visit_type && (
                <View style={styles.visitTypeBadge}>
                    <Text style={styles.visitTypeText}>{item.visit_type}</Text>
                </View>
            )}
        </GlassCard>
    ), []);

    const ListHeader = useCallback(() => (
        <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Punch History</Text>
            <Text style={styles.listSubtitle}>{punches.length} records</Text>
        </View>
    ), [punches.length]);

    const ListEmpty = useCallback(() => (
        !isLoading && !hasError ? (
            <View style={styles.emptyContainer}>
                <Icon name="inbox" size={64} color={colors.textMuted} />
                <Text style={styles.emptyText}>No punch records found</Text>
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

    if (isLoading && punches.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Icon name="arrow-left" size={24} color={colors.textDark} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Punch History</Text>
                    <View style={{ width: 40 }} />
                </View>
                <ListSkeleton />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Punch History</Text>
                <View style={{ width: 40 }} />
            </View>

            {hasError ? (
                <ErrorView onRetry={fetchData} style={{ flex: 1, justifyContent: 'center' }} />
            ) : (
                <FlatList
                    data={punches}
                    keyExtractor={(item, index) => item.id?.toString() || index.toString()}
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
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: spacing.md, backgroundColor: colors.surface,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { padding: spacing.sm },
    headerTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark },
    listContent: { padding: spacing.md, paddingBottom: 100 },
    listHeader: { marginBottom: spacing.lg },
    listTitle: { fontSize: 24, fontWeight: '700', color: colors.textDark },
    listSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
    card: { marginBottom: spacing.md, padding: spacing.md },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    iconBadge: {
        width: 40, height: 40, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    cardHeaderText: { flex: 1 },
    punchType: { fontSize: 16, fontWeight: '600', color: colors.textDark },
    dateText: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    timeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    timeText: { fontSize: 13, color: colors.textMuted, marginLeft: 4, fontWeight: '500' },
    addressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    addressText: { fontSize: 13, color: colors.textMuted, marginLeft: 6, flex: 1 },
    visitTypeBadge: { alignSelf: 'flex-start', backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 10 },
    visitTypeText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyText: { fontSize: 16, color: colors.textMuted, marginTop: 16 }
});

export default PunchHistoryScreen;
