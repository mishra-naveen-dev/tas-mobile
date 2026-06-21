import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';

const MAX_EDITS = 3;

const FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

const STATUS_CONFIG = {
    PENDING:  { label: 'Pending',  bg: '#FEF3C7', text: '#D97706', icon: 'clock' },
    APPROVED: { label: 'Approved', bg: '#D1FAE5', text: '#059669', icon: 'check-circle' },
    REJECTED: { label: 'Rejected', bg: '#FEE2E2', text: '#DC2626', icon: 'x-circle' },
};

const TYPE_LABEL = {
    ADD:    'Add Punch',
    EDIT:   'Edit Punch',
    DELETE: 'Delete Punch',
};

const PUNCH_LABEL = {
    PUNCH_IN:  'Punch In',
    PUNCH_OUT: 'Punch Out',
};

// ─── Summary card ────────────────────────────────────────────────────────────
const SummaryCard = ({ label, count, iconName, iconColor, iconBg }) => (
    <View style={styles.summaryCard}>
        <View style={[styles.summaryIcon, { backgroundColor: iconBg }]}>
            <Icon name={iconName} size={18} color={iconColor} />
        </View>
        <Text style={styles.summaryCount}>{count}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
    </View>
);

const DetailRow = ({ icon, label, value }) => (
    <View style={styles.detailRow}>
        <Icon name={icon} size={13} color={colors.textMuted} style={styles.detailIcon} />
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
);

// ─── Request card ─────────────────────────────────────────────────────────────
const RequestCard = ({ item, onEdit, onDelete, isDeleting }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
    const date = item.correction_date
        ? new Date(item.correction_date).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
          })
        : '—';

    const isPending  = item.status === 'PENDING';
    const editCount  = item.edit_count || 0;
    const canEdit    = isPending && editCount < MAX_EDITS;
    const canDelete  = isPending;

    return (
        <View style={styles.card}>
            {/* Top row: date + status */}
            <View style={styles.cardHeader}>
                <View style={styles.cardDateRow}>
                    <Icon name="calendar" size={13} color={colors.textMuted} />
                    <Text style={styles.cardDate}>{date}</Text>
                    {item.correction_time ? (
                        <Text style={styles.cardTime}>
                            {item.correction_time.slice(0, 5)}
                        </Text>
                    ) : null}
                </View>
                <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                    <Icon name={cfg.icon} size={11} color={cfg.text} />
                    <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
                </View>
            </View>

            {/* Details */}
            <View style={styles.cardBody}>
                <DetailRow
                    icon="tag"
                    label="Type"
                    value={TYPE_LABEL[item.correction_type] || item.correction_type}
                />
                <DetailRow
                    icon="activity"
                    label="Punch"
                    value={PUNCH_LABEL[item.punch_type] || item.punch_type}
                />
                {item.loan_id ? (
                    <DetailRow icon="hash" label="Loan No." value={item.loan_id} />
                ) : null}
                {item.from_address ? (
                    <DetailRow icon="map-pin" label="From" value={item.from_address} />
                ) : null}
                {item.to_address ? (
                    <DetailRow icon="map-pin" label="To" value={item.to_address} />
                ) : null}
                {item.calculated_distance > 0 ? (
                    <DetailRow icon="navigation" label="Distance" value={`${item.calculated_distance} km`} />
                ) : null}
                {item.reason ? (
                    <DetailRow icon="file-text" label="Reason" value={item.reason} />
                ) : null}

                {/* Edit count indicator */}
                {isPending && (
                    <View style={styles.editCountRow}>
                        <Icon name="edit" size={11} color={editCount >= MAX_EDITS ? colors.danger : colors.textMuted} />
                        <Text style={[styles.editCountText, editCount >= MAX_EDITS && styles.editCountExhausted]}>
                            Edits used: {editCount}/{MAX_EDITS}
                        </Text>
                    </View>
                )}
            </View>

            {/* Manager remarks */}
            {item.review_comment ? (
                <View style={styles.remarkBox}>
                    <Icon name="message-circle" size={13} color={colors.textMuted} />
                    <Text style={styles.remarkText}>
                        <Text style={styles.remarkLabel}>Remarks: </Text>
                        {item.review_comment}
                    </Text>
                </View>
            ) : null}

            {/* Action buttons — only for PENDING */}
            {(canEdit || canDelete) && (
                <View style={styles.actionRow}>
                    {canEdit && (
                        <TouchableOpacity
                            style={styles.editBtn}
                            onPress={() => onEdit(item)}
                            disabled={isDeleting}
                        >
                            <Icon name="edit-2" size={13} color={colors.primary} />
                            <Text style={styles.editBtnText}>
                                Edit ({MAX_EDITS - editCount} left)
                            </Text>
                        </TouchableOpacity>
                    )}
                    {canDelete && (
                        <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => onDelete(item)}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <ActivityIndicator size="small" color={colors.danger} />
                            ) : (
                                <>
                                    <Icon name="trash-2" size={13} color={colors.danger} />
                                    <Text style={styles.deleteBtnText}>Delete</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

// ─── Main screen ─────────────────────────────────────────────────────────────
const MissedPunchDashboardScreen = ({ navigation }) => {
    const [requests, setRequests]     = useState([]);
    const [loading, setLoading]       = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('ALL');
    const [error, setError]           = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const fetchRequests = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await api.getMyCorrectionRequests();
            const raw = Array.isArray(res.data)
                ? res.data
                : Array.isArray(res.data?.results)
                ? res.data.results
                : [];
            setRequests(raw);
            setError(null);
        } catch {
            setError('Failed to load requests. Pull down to retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => { fetchRequests(); }, [fetchRequests])
    );

    const handleEdit = (item) => {
        navigation.navigate('PunchCorrection', {
            editMode: true,
            correctionId: item.id,
            existingData: item,
            editsLeft: MAX_EDITS - (item.edit_count || 0),
        });
    };

    const handleDelete = (item) => {
        Alert.alert(
            'Delete Request',
            'Are you sure you want to delete this correction request? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => confirmDelete(item.id),
                },
            ]
        );
    };

    const confirmDelete = async (id) => {
        setDeletingId(id);
        try {
            await api.deleteCorrectionRequest(id);
            setRequests(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            const msg = err?.response?.data?.error || 'Failed to delete request.';
            Alert.alert('Error', msg);
        } finally {
            setDeletingId(null);
        }
    };

    // ── Derived counts ──
    const total    = requests.length;
    const pending  = requests.filter(r => r.status === 'PENDING').length;
    const approved = requests.filter(r => r.status === 'APPROVED').length;
    const rejected = requests.filter(r => r.status === 'REJECTED').length;

    const filtered = activeFilter === 'ALL'
        ? requests
        : requests.filter(r => r.status === activeFilter);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={22} color={colors.textDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Missed Punch</Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate('PunchCorrection')}
                    style={styles.addBtn}
                >
                    <Icon name="plus" size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => String(item.id)}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchRequests(true)}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                    ListHeaderComponent={
                        <>
                            {/* Summary cards */}
                            <View style={styles.summaryGrid}>
                                <SummaryCard
                                    label="Total Raised"
                                    count={total}
                                    iconName="file-text"
                                    iconColor={colors.info}
                                    iconBg={colors.infoLight}
                                />
                                <SummaryCard
                                    label="Pending"
                                    count={pending}
                                    iconName="clock"
                                    iconColor={colors.warning}
                                    iconBg={colors.warningLight}
                                />
                                <SummaryCard
                                    label="Approved"
                                    count={approved}
                                    iconName="check-circle"
                                    iconColor={colors.success}
                                    iconBg={colors.successLight}
                                />
                                <SummaryCard
                                    label="Rejected"
                                    count={rejected}
                                    iconName="x-circle"
                                    iconColor={colors.primary}
                                    iconBg={colors.primaryLight}
                                />
                            </View>

                            {error ? (
                                <View style={styles.errorBanner}>
                                    <Icon name="alert-circle" size={15} color={colors.danger} />
                                    <Text style={styles.errorBannerText}>{error}</Text>
                                    <TouchableOpacity onPress={() => fetchRequests()}>
                                        <Text style={styles.retryLink}>Retry</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null}

                            {/* Filter tabs */}
                            <View style={styles.filterBar}>
                                {FILTERS.map(f => (
                                    <TouchableOpacity
                                        key={f}
                                        style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
                                        onPress={() => setActiveFilter(f)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
                                            {f === 'ALL'      ? `All (${total})`          :
                                             f === 'PENDING'  ? `Pending (${pending})`    :
                                             f === 'APPROVED' ? `Approved (${approved})`  :
                                             `Rejected (${rejected})`}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    }
                    renderItem={({ item }) => (
                        <RequestCard
                            item={item}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            isDeleting={deletingId === item.id}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Icon name="inbox" size={48} color={colors.border} />
                            <Text style={styles.emptyTitle}>No requests found</Text>
                            <Text style={styles.emptySubtitle}>
                                {activeFilter === 'ALL'
                                    ? 'Tap + to raise a missed punch request'
                                    : `No ${activeFilter.toLowerCase()} requests`}
                            </Text>
                            {activeFilter === 'ALL' && (
                                <TouchableOpacity
                                    style={styles.raiseBtn}
                                    onPress={() => navigation.navigate('PunchCorrection')}
                                >
                                    <Text style={styles.raiseBtnText}>Raise Request</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    addBtn: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primaryLight,
        borderRadius: 10,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxxl,
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        padding: spacing.md,
        paddingBottom: spacing.xs,
    },
    summaryCard: {
        width: '47%',
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
    },
    summaryIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    summaryCount: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.extrabold,
        color: colors.textDark,
    },
    summaryLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
        textAlign: 'center',
    },
    filterBar: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
    },
    filterTab: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 20,
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterTabActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterText: {
        fontSize: 11,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
    },
    filterTextActive: {
        color: '#fff',
    },
    listContent: {
        paddingBottom: 100,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        padding: spacing.md,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    cardDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    cardDate: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    cardTime: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 20,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: typography.weights.semibold,
    },
    cardBody: {
        gap: 6,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailIcon: {
        marginRight: 6,
    },
    detailLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        width: 60,
    },
    detailValue: {
        flex: 1,
        fontSize: typography.sizes.xs,
        color: colors.textDark,
        fontWeight: typography.weights.medium,
    },
    editCountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    editCountText: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    },
    editCountExhausted: {
        color: colors.danger,
        fontWeight: '600',
    },
    remarkBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
    },
    remarkText: {
        flex: 1,
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        lineHeight: 18,
    },
    remarkLabel: {
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    actionRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    editBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}10`,
    },
    editBtnText: {
        fontSize: typography.sizes.xs,
        fontWeight: '600',
        color: colors.primary,
    },
    deleteBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: colors.danger,
        backgroundColor: `${colors.danger}10`,
    },
    deleteBtnText: {
        fontSize: typography.sizes.xs,
        fontWeight: '600',
        color: colors.danger,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0F0',
        borderRadius: 10,
        padding: spacing.sm,
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
        marginBottom: spacing.xs,
        gap: 8,
    },
    errorBannerText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: colors.danger,
    },
    retryLink: {
        fontSize: typography.sizes.sm,
        color: colors.primary,
        fontWeight: '600',
    },
    emptyTitle: {
        marginTop: spacing.md,
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    emptySubtitle: {
        marginTop: spacing.xs,
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        textAlign: 'center',
    },
    raiseBtn: {
        marginTop: spacing.lg,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        borderRadius: 24,
    },
    raiseBtnText: {
        color: '#fff',
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.bold,
    },
});

export default MissedPunchDashboardScreen;
