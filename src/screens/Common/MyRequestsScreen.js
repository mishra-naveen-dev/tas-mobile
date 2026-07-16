import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Alert,
    Modal,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../api/api';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';
import { SkeletonListItem } from '../../components/SkeletonComponents';
import RequestDetailModal from '../../components/RequestDetailModal';
import {
    STATUS_META, STATUS_FILTERS, fmtDateTime, fmtDate,
    adaptAllowance, adaptCorrection, adaptDevice, adaptProfile,
} from '../../utils/requestAdapters';

// Read-only counterpart to the admin Approvals inbox — same normalization
// and detail/timeline view, but scoped to "my own requests" (every backend
// endpoint here already filters to the logged-in user for non-admin roles)
// and with no approve/reject actions.
const MyRequestsScreen = ({ navigation }) => {
    const [allowances, setAllowances] = useState([]);
    const [corrections, setCorrections] = useState([]);
    const [devices, setDevices] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [dateFrom, setDateFrom] = useState(null);
    const [dateTo, setDateTo] = useState(null);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [detail, setDetail] = useState(null);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            const [correctionRes, allowanceRes, deviceRes, profileRes] = await Promise.allSettled([
                api.get('/attendance/correction-requests/'),
                api.getAllowanceRequests(),
                api.get('/organization/devices/'),
                api.getProfileUpdateRequests(),
            ]);

            const unwrap = (res) => {
                if (res.status !== 'fulfilled') return [];
                const d = res.value?.data;
                return Array.isArray(d) ? d : (d?.results || []);
            };

            setCorrections(unwrap(correctionRes));
            setAllowances(unwrap(allowanceRes));
            setDevices(unwrap(deviceRes));
            setProfiles(unwrap(profileRes));
        } catch (err) {
            Alert.alert('Error', 'Failed to load your requests');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const onRefresh = () => fetchData(true);

    const adaptedByTab = useMemo(() => ([
        allowances.map(adaptAllowance),
        corrections.map(adaptCorrection),
        devices.map(adaptDevice),
        profiles.map(adaptProfile),
    ]), [allowances, corrections, devices, profiles]);

    const currentItems = useMemo(() => {
        let list = adaptedByTab[activeTab] || [];

        if (statusFilter !== 'ALL') {
            list = list.filter(i => i.status === statusFilter);
        }
        if (dateFrom) {
            const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
            list = list.filter(i => i.raisedAt && new Date(i.raisedAt) >= from);
        }
        if (dateTo) {
            const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
            list = list.filter(i => i.raisedAt && new Date(i.raisedAt) <= to);
        }
        return [...list].sort((a, b) => new Date(b.raisedAt) - new Date(a.raisedAt));
    }, [adaptedByTab, activeTab, statusFilter, dateFrom, dateTo]);

    const hasDateFilter = !!(dateFrom || dateTo);

    const clearFilters = () => {
        setStatusFilter('ALL');
        setDateFrom(null);
        setDateTo(null);
    };

    const renderItem = ({ item, index }) => {
        const meta = STATUS_META[item.status] || STATUS_META.PENDING;
        const isLatest = index === 0 && !hasDateFilter && statusFilter === 'ALL';
        return (
            <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => setDetail(item)}>
                <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />
                <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.titleRow}>
                                <Text style={styles.cardTitle} numberOfLines={1}>{item.subtitle}</Text>
                                {isLatest && (
                                    <View style={styles.latestBadge}>
                                        <Text style={styles.latestBadgeText}>LATEST</Text>
                                    </View>
                                )}
                            </View>
                            {!!item.meta && <Text style={styles.cardMeta}>{item.meta}</Text>}
                        </View>
                        <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
                            <Icon name={meta.icon} size={12} color={meta.color} />
                            <Text style={[styles.statusChipText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                    </View>
                    <Text style={styles.raisedText}>Raised {fmtDateTime(item.raisedAt)}</Text>
                    {item.status === 'PENDING' && (
                        <View style={styles.pendingWithRow}>
                            <Icon name="user-check" size={12} color={colors.warning} />
                            <Text style={styles.pendingWithText}>Pending with {item.pendingWith}</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const tabs = [
        { title: 'Allowances', count: allowances.length },
        { title: 'Corrections', count: corrections.length },
        { title: 'Devices', count: devices.length },
        { title: 'Profile Updates', count: profiles.length },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>My Requests</Text>
                    <Text style={styles.headerSubtitle}>Track all your requests</Text>
                </View>
                <TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
                    <Icon name="filter" size={20} color="#FFFFFF" />
                    {(statusFilter !== 'ALL' || hasDateFilter) && <View style={styles.filterDot} />}
                </TouchableOpacity>
            </View>

            <View style={styles.tabContainer}>
                {tabs.map((tab, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.tab, activeTab === index && styles.activeTab]}
                        onPress={() => setActiveTab(index)}
                    >
                        <Text style={[styles.tabText, activeTab === index && styles.activeTabText]} numberOfLines={1}>
                            {tab.title} ({tab.count})
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {(statusFilter !== 'ALL' || hasDateFilter) && (
                <View style={styles.activeFilterBar}>
                    <Text style={styles.activeFilterText} numberOfLines={1}>
                        {statusFilter !== 'ALL' ? STATUS_META[statusFilter]?.label : 'All statuses'}
                        {hasDateFilter ? ` · ${dateFrom ? fmtDate(dateFrom) : 'Any'} – ${dateTo ? fmtDate(dateTo) : 'Any'}` : ''}
                    </Text>
                    <TouchableOpacity onPress={clearFilters}>
                        <Text style={styles.clearFilterText}>Clear</Text>
                    </TouchableOpacity>
                </View>
            )}

            {loading && currentItems.length === 0 ? (
                <View style={{ padding: spacing.md }}>
                    {[1, 2, 3].map(i => (
                        <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={currentItems}
                    keyExtractor={(item) => `${item.type}-${item.id}`}
                    renderItem={renderItem}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="inbox" size={48} color={colors.textMuted} />
                            <Text style={styles.emptyText}>No requests found</Text>
                            <Text style={styles.emptySubtext}>
                                {statusFilter !== 'ALL' || hasDateFilter ? 'Try adjusting your filters' : 'Nothing submitted yet'}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* ── Filter modal ── */}
            <Modal visible={filterModalVisible} transparent animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filter Requests</Text>
                            <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                                <Icon name="x" size={22} color={colors.textDark} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.fieldLabel}>Status</Text>
                        <View style={styles.statusGrid}>
                            {STATUS_FILTERS.map(s => {
                                const active = statusFilter === s;
                                const m = STATUS_META[s];
                                return (
                                    <TouchableOpacity
                                        key={s}
                                        style={[styles.statusOption, active && { backgroundColor: m?.color || colors.textDark, borderColor: m?.color || colors.textDark }]}
                                        onPress={() => setStatusFilter(s)}
                                    >
                                        <Text style={[styles.statusOptionText, active && { color: '#FFFFFF' }]}>
                                            {s === 'ALL' ? 'All' : m.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={styles.fieldLabel}>Date Range</Text>
                        <View style={styles.dateRow}>
                            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowFromPicker(true)}>
                                <Icon name="calendar" size={15} color={colors.textMuted} />
                                <Text style={styles.dateBtnText}>{dateFrom ? fmtDate(dateFrom) : 'From'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowToPicker(true)}>
                                <Icon name="calendar" size={15} color={colors.textMuted} />
                                <Text style={styles.dateBtnText}>{dateTo ? fmtDate(dateTo) : 'To'}</Text>
                            </TouchableOpacity>
                        </View>

                        {showFromPicker && (
                            <DateTimePicker
                                value={dateFrom || new Date()}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                maximumDate={new Date()}
                                onChange={(event, selected) => {
                                    setShowFromPicker(Platform.OS === 'ios');
                                    if (selected) setDateFrom(selected);
                                }}
                            />
                        )}
                        {showToPicker && (
                            <DateTimePicker
                                value={dateTo || new Date()}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                maximumDate={new Date()}
                                onChange={(event, selected) => {
                                    setShowToPicker(Platform.OS === 'ios');
                                    if (selected) setDateTo(selected);
                                }}
                            />
                        )}

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                                <Text style={styles.clearBtnText}>Clear All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.applyBtn} onPress={() => setFilterModalVisible(false)}>
                                <Text style={styles.applyBtnText}>Apply</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <RequestDetailModal detail={detail} onClose={() => setDetail(null)} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        backgroundColor: colors.primaryDark,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        paddingTop: spacing.lg,
    },
    backButton: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
    },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: '#FFFFFF' },
    headerSubtitle: { fontSize: typography.sizes.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    filterButton: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
    },
    filterDot: {
        position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tab: {
        flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: 8, marginHorizontal: 3,
    },
    activeTab: { backgroundColor: colors.primary },
    tabText: { fontSize: 11, fontWeight: typography.weights.medium, color: colors.textMuted },
    activeTabText: { color: '#fff', fontWeight: typography.weights.bold },
    activeFilterBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.primaryLight,
    },
    activeFilterText: { flex: 1, fontSize: 12, color: colors.textDark, fontWeight: '600' },
    clearFilterText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
    listContent: { padding: spacing.md, paddingBottom: 100 },

    card: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        marginBottom: spacing.md,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    cardAccent: { width: 4 },
    cardBody: { flex: 1, padding: spacing.md },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.textDark, flexShrink: 1 },
    latestBadge: { backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
    latestBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
    cardMeta: { fontSize: 11, color: colors.textLight, marginTop: 2 },
    statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.md },
    statusChipText: { fontSize: 11, fontWeight: '700' },
    raisedText: { fontSize: 11, color: colors.textLight, marginTop: spacing.sm },
    pendingWithRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    pendingWithText: { fontSize: 11, color: colors.warning, fontWeight: '600' },

    emptyContainer: { padding: spacing.xxl, alignItems: 'center' },
    emptyText: { fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.textDark, marginTop: spacing.md },
    emptySubtext: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: spacing.xs },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: spacing.md, maxHeight: '85%',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
    modalTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark },
    fieldLabel: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.textMedium, marginTop: spacing.sm, marginBottom: spacing.xs },
    statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    statusOption: {
        paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
        borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs, marginBottom: spacing.xs,
    },
    statusOptionText: { fontSize: typography.sizes.xs, color: colors.textMedium, fontWeight: '600' },
    dateRow: { flexDirection: 'row', gap: spacing.sm },
    dateBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    },
    dateBtnText: { fontSize: typography.sizes.sm, color: colors.textDark },
    modalFooter: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    clearBtn: {
        flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm,
        borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    },
    clearBtnText: { color: colors.textMedium, fontWeight: '700' },
    applyBtn: {
        flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm,
        borderRadius: borderRadius.md, backgroundColor: colors.primary,
    },
    applyBtnText: { color: '#fff', fontWeight: '700' },
});

export default MyRequestsScreen;
