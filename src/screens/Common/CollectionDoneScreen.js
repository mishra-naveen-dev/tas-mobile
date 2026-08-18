import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    Linking,
    Animated,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import LocationService from '../../services/LocationService';
import ErrorView from '../../components/ErrorView';
import { SkeletonListItem } from '../../components/SkeletonComponents';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

const PAGE_SIZE = 20;

// Mirrors STATUS_META in CollectionsScreen.js — only the two "done" outcomes
// ever land on this screen (see backend's is_done filter).
const STATUS_META = {
    COLLECTED: { label: 'Collected', color: colors.success },
    PARTIALLY_COLLECTED: { label: 'Partial', color: colors.warning },
};

const TYPE_META = {
    REGULAR: { label: 'Regular', color: colors.info },
    OD: { label: 'OD', color: colors.danger },
    ADVANCE: { label: 'Advance', color: '#7b1fa2' },
};

const VISIT_REASON_META = { OD_VISIT: 'OD Visit', OTHER: 'Other' };

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtAmount = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Client-side hint only — the 7-day window is enforced server-side from
// last_collection_date using server time (see CollectionCorrectionRequestViewSet.create).
// This just avoids showing the button on a collection that's obviously past it.
const CORRECTION_WINDOW_DAYS = 7;
const withinCorrectionWindow = (lastCollectionDate) => {
    if (!lastCollectionDate) return false;
    const days = (Date.now() - new Date(lastCollectionDate).getTime()) / 86400000;
    return days <= CORRECTION_WINDOW_DAYS;
};

// Same fade-in-on-mount treatment as the main Collections list, so the two
// screens feel like one continuous list rather than two different products.
const AnimatedCard = React.memo(({ index, children }) => {
    const shouldAnimate = index < 10;
    const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
    const translateY = useRef(new Animated.Value(shouldAnimate ? 32 : 0)).current;

    useEffect(() => {
        if (!shouldAnimate) return;
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1, duration: 340, delay: index * 55, useNativeDriver: true,
            }),
            Animated.spring(translateY, {
                toValue: 0, tension: 65, friction: 9, delay: index * 55, useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View style={{ opacity, transform: [{ translateY }] }}>
            {children}
        </Animated.View>
    );
});

const CollectionDoneScreen = ({ navigation }) => {
    const [records, setRecords] = useState([]);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
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
            setHasMore(!!data?.next);
        } catch (err) {
            if (__DEV__) console.log('Collection Done fetch error:', err);
            setHasError(true);
            if (pageNum === 1) setHasMore(false);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
            setIsLoadingMore(false);
        }
    }, []);

    useEffect(() => { fetchData(1); }, [fetchData]);

    const onRefresh = useCallback(() => { fetchData(1, true); }, [fetchData]);

    const onEndReached = useCallback(() => {
        if (!isLoadingMore && !isLoading && hasMore) {
            fetchData(page + 1);
        }
    }, [isLoadingMore, isLoading, hasMore, page, fetchData]);

    const navigateToCustomer = useCallback((r) => {
        if (r.customer_latitude && r.customer_longitude) {
            LocationService.openMaps(r.customer_latitude, r.customer_longitude);
            return;
        }
        if (r.visit_latitude && r.visit_longitude) {
            LocationService.openMaps(r.visit_latitude, r.visit_longitude);
            return;
        }
        const addr = [r.address, r.area, r.pincode].filter(Boolean).join(', ');
        if (addr) {
            Linking.openURL(
                `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`
            ).catch(() => {});
        } else {
            Alert.alert('No Location', 'No address or GPS data available for this customer.');
        }
    }, []);

    const renderItem = useCallback(({ item, index }) => {
        const meta = STATUS_META[item.status] || STATUS_META.COLLECTED;
        const fullAddress = [item.address, item.area, item.pincode && `PIN: ${item.pincode}`]
            .filter(Boolean).join(', ');
        return (
            <AnimatedCard index={index}>
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
                                <Icon name="check-circle" size={12} color={meta.color} />
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

                        {!!item.visit_reason && (
                            <View style={styles.row}>
                                <Icon name="info" size={15} color={colors.info} />
                                <Text style={[styles.rowText, { color: colors.info }]}>
                                    Reason: {VISIT_REASON_META[item.visit_reason] || item.visit_reason}
                                </Text>
                            </View>
                        )}

                        <View style={styles.row}>
                            <Icon name="clock" size={15} color={colors.textMuted} />
                            <Text style={styles.rowText}>Completed: {fmtDate(item.last_collection_date)}</Text>
                        </View>

                        {!!item.remarks && (
                            <View style={styles.row}>
                                <Icon name="message-square" size={15} color={colors.textMuted} />
                                <Text style={styles.rowText} numberOfLines={2}>{item.remarks}</Text>
                            </View>
                        )}

                        <View style={styles.doneBanner}>
                            <Icon name="check-circle" size={14} color={meta.color} />
                            <Text style={[styles.doneBannerText, { color: meta.color }]}>Activity has been done</Text>
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
                                onPress={() => navigateToCustomer(item)}
                            >
                                <Icon name="navigation" size={16} color={colors.primary} />
                            </TouchableOpacity>
                            {withinCorrectionWindow(item.last_collection_date) && (
                                <TouchableOpacity
                                    style={styles.correctionBtn}
                                    onPress={() => navigation.navigate('CollectionCorrectionForm', { record: item })}
                                >
                                    <Icon name="edit-3" size={15} color={colors.warning} />
                                    <Text style={styles.correctionBtnText}>Request Correction</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </AnimatedCard>
        );
    }, [navigateToCustomer, navigation]);

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

    // ── Card — matches CollectionsScreen.js's customer card layout ──
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
    loanRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2, flexWrap: 'wrap' },
    loanId: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
    typeTag: { paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: borderRadius.sm, marginLeft: spacing.xs },
    typeTagText: { fontSize: 10, fontWeight: '700' },
    statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.md },
    statusChipText: { fontSize: 12, fontWeight: '700' },
    divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
    rowText: { flex: 1, fontSize: typography.sizes.sm, color: colors.textMedium, marginLeft: spacing.xs },
    bold: { fontWeight: typography.weights.bold, color: colors.textDark },
    doneBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: colors.successLight || '#d1fae5', borderRadius: borderRadius.md,
        paddingHorizontal: spacing.sm, paddingVertical: 6, marginTop: spacing.xs, alignSelf: 'flex-start',
    },
    doneBannerText: { fontSize: 12, fontWeight: '700' },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
    iconBtn: {
        width: 40, height: 40, borderRadius: borderRadius.md,
        borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    },
    correctionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6, height: 40,
        paddingHorizontal: spacing.sm, borderRadius: borderRadius.md,
        borderWidth: 1, borderColor: colors.warning, backgroundColor: `${colors.warning}12`,
    },
    correctionBtnText: { fontSize: 12, fontWeight: '700', color: colors.warning },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyText: { fontSize: 16, color: colors.textMuted, marginTop: 16 },
});

export default CollectionDoneScreen;
