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
    TextInput,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../api/api';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';
import { SkeletonListItem } from '../../components/SkeletonComponents';

const STATUS_META = {
    PENDING:  { label: 'Pending',  color: colors.warning, bg: colors.warningLight, icon: 'clock' },
    APPROVED: { label: 'Approved', color: colors.success, bg: colors.successLight, icon: 'check-circle' },
    REJECTED: { label: 'Rejected', color: colors.danger,  bg: colors.dangerLight,  icon: 'x-circle' },
    PAID:     { label: 'Paid',     color: colors.info,    bg: colors.infoLight,    icon: 'check-circle' },
    DRAFT:    { label: 'Draft',    color: colors.textMuted, bg: colors.background, icon: 'file' },
    BLOCKED:  { label: 'Blocked',  color: colors.danger,  bg: colors.dangerLight,  icon: 'slash' },
};

const STATUS_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : null;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

// Normalizes each backend model's shape into one common display shape so the
// list/detail UI never has to branch by request type.
const adaptAllowance = (item) => ({
    id: item.id,
    type: 'allowance',
    typeLabel: 'Travel Allowance',
    icon: 'dollar-sign',
    title: `${item.employee_details?.first_name || ''} ${item.employee_details?.last_name || ''}`.trim() || item.employee_details?.username || 'Employee',
    subtitle: `₹${item.amount ?? 0} · ${item.from_location} → ${item.to_location}`,
    meta: fmtDate(item.travel_date),
    status: item.status,
    raisedAt: item.created_at,
    raisedBy: `${item.employee_details?.first_name || ''} ${item.employee_details?.last_name || ''}`.trim() || item.employee_details?.username,
    processedBy: item.approved_by_name,
    processedAt: item.approved_at || (item.status === 'REJECTED' ? item.updated_at : null),
    rejectionReason: item.rejection_reason,
});

const adaptCorrection = (item) => ({
    id: item.id,
    type: 'correction',
    typeLabel: 'Punch Correction',
    icon: 'edit-2',
    title: item.employee_name || 'Employee',
    subtitle: `${item.correction_type} Punch · ${item.from_address || 'N/A'}`,
    meta: `${fmtDate(item.correction_date)} ${item.correction_time || ''}`,
    status: item.status,
    raisedAt: item.created_at,
    raisedBy: item.employee_name,
    processedBy: item.reviewed_by_name,
    processedAt: item.reviewed_at,
    rejectionReason: item.review_comment,
});

const adaptDevice = (item) => ({
    id: item.id,
    type: 'device',
    typeLabel: 'Device Approval',
    icon: 'smartphone',
    title: item.username || 'User',
    subtitle: `${item.device_name || item.platform} · ${item.os || ''}`,
    meta: item.platform,
    status: item.status,
    raisedAt: item.created_at,
    raisedBy: item.username,
    processedBy: item.approved_by !== 'Auto' ? item.approved_by : null,
    processedAt: item.approved_at || item.rejected_at,
    rejectionReason: null,
});

const adaptProfile = (item) => ({
    id: item.id,
    type: 'profile',
    typeLabel: 'Profile Update',
    icon: 'user',
    title: item.requested_by_name || 'Employee',
    subtitle: [
        item.phone && `Phone: ${item.phone}`,
        item.designation && item.designation !== 'N/A' && `Designation: ${item.designation}`,
    ].filter(Boolean).join(' · ') || 'Profile change requested',
    meta: null,
    status: item.status,
    raisedAt: item.created_at,
    raisedBy: item.requested_by_name,
    processedBy: item.approved_by_name,
    processedAt: item.status !== 'PENDING' ? item.updated_at : null,
    rejectionReason: null,
});

const AdminApprovalsScreen = ({ navigation }) => {
    const [allowances, setAllowances] = useState([]);
    const [corrections, setCorrections] = useState([]);
    const [devices, setDevices] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [statusFilter, setStatusFilter] = useState('PENDING');
    const [dateFrom, setDateFrom] = useState(null);
    const [dateTo, setDateTo] = useState(null);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [detail, setDetail] = useState(null); // normalized item currently shown in detail modal
    const [rejectModal, setRejectModal] = useState({ visible: false, item: null });
    const [rejectReason, setRejectReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const handleBack = () => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('AdminDashboard');
    };

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
            Alert.alert('Error', 'Failed to load approvals');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const onRefresh = () => fetchData(true);

    // ── Normalize + filter the active tab's data ──────────────────────────────
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
        // Newest first — the latest request is always shown by default at the top.
        return [...list].sort((a, b) => new Date(b.raisedAt) - new Date(a.raisedAt));
    }, [adaptedByTab, activeTab, statusFilter, dateFrom, dateTo]);

    const hasDateFilter = !!(dateFrom || dateTo);

    const clearFilters = () => {
        setStatusFilter('ALL');
        setDateFrom(null);
        setDateTo(null);
    };

    // ── Approve / Reject ──────────────────────────────────────────────────────
    const runApprove = async (item) => {
        setActionLoading(true);
        try {
            if (item.type === 'allowance') await api.approveAllowanceRequest(item.id);
            else if (item.type === 'correction') await api.reviewCorrection(item.id, 'APPROVE');
            else if (item.type === 'device') await api.approveDevice(item.id);
            else if (item.type === 'profile') await api.approveProfileUpdateRequest(item.id);
            setDetail(null);
            fetchData();
        } catch (err) {
            Alert.alert('Error', 'Failed to approve');
        } finally {
            setActionLoading(false);
        }
    };

    const openReject = (item) => {
        setRejectReason('');
        setRejectModal({ visible: true, item });
    };

    const confirmReject = async () => {
        const item = rejectModal.item;
        if (!item) return;
        setActionLoading(true);
        try {
            if (item.type === 'allowance') await api.rejectAllowanceRequest(item.id, rejectReason);
            else if (item.type === 'correction') await api.reviewCorrection(item.id, 'REJECT', rejectReason);
            else if (item.type === 'device') await api.rejectDevice(item.id);
            else if (item.type === 'profile') await api.rejectProfileUpdateRequest(item.id);
            setRejectModal({ visible: false, item: null });
            setDetail(null);
            fetchData();
        } catch (err) {
            Alert.alert('Error', 'Failed to reject');
        } finally {
            setActionLoading(false);
        }
    };

    // ── Card ───────────────────────────────────────────────────────────────────
    const renderItem = ({ item, index }) => {
        const meta = STATUS_META[item.status] || STATUS_META.PENDING;
        const isLatest = index === 0 && !hasDateFilter && statusFilter === 'PENDING';
        return (
            <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => setDetail(item)}>
                <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />
                <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.titleRow}>
                                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                                {isLatest && (
                                    <View style={styles.latestBadge}>
                                        <Text style={styles.latestBadgeText}>LATEST</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                            {!!item.meta && <Text style={styles.cardMeta}>{item.meta}</Text>}
                        </View>
                        <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
                            <Icon name={meta.icon} size={12} color={meta.color} />
                            <Text style={[styles.statusChipText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                    </View>

                    <Text style={styles.raisedText}>Raised {fmtDateTime(item.raisedAt)}</Text>

                    {item.status === 'PENDING' && (
                        <View style={styles.cardActions}>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.approveBtn]}
                                onPress={() => runApprove(item)}
                                disabled={actionLoading}
                            >
                                <Icon name="check" size={14} color="#fff" />
                                <Text style={styles.actionBtnText}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.rejectBtn]}
                                onPress={() => openReject(item)}
                                disabled={actionLoading}
                            >
                                <Icon name="x" size={14} color="#fff" />
                                <Text style={styles.actionBtnText}>Reject</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const tabs = [
        { title: 'Allowances', count: allowances.filter(a => a.status === 'PENDING').length },
        { title: 'Corrections', count: corrections.filter(c => c.status === 'PENDING').length },
        { title: 'Devices', count: devices.filter(d => d.status === 'PENDING').length },
        { title: 'Profile Updates', count: profiles.filter(p => p.status === 'PENDING').length },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Icon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Approvals</Text>
                    <Text style={styles.headerSubtitle}>Review and take action</Text>
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
                    {[1, 2, 3, 4, 5].map(i => (
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
                            <Icon name="check-circle" size={48} color={colors.success} />
                            <Text style={styles.emptyText}>No requests found</Text>
                            <Text style={styles.emptySubtext}>
                                {statusFilter !== 'ALL' || hasDateFilter ? 'Try adjusting your filters' : 'All caught up!'}
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
                                onChange={(e, selected) => {
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
                                onChange={(e, selected) => {
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

            {/* ── Detail / audit-trail modal ── */}
            <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {detail && (() => {
                            const meta = STATUS_META[detail.status] || STATUS_META.PENDING;
                            return (
                                <>
                                    <View style={styles.modalHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.modalTitle}>{detail.typeLabel}</Text>
                                            <Text style={styles.detailSubtitle}>{detail.title}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => setDetail(null)}>
                                            <Icon name="x" size={22} color={colors.textDark} />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={[styles.detailStatusChip, { backgroundColor: meta.bg }]}>
                                        <Icon name={meta.icon} size={14} color={meta.color} />
                                        <Text style={[styles.detailStatusText, { color: meta.color }]}>{meta.label}</Text>
                                    </View>

                                    <Text style={styles.detailBodyText}>{detail.subtitle}</Text>

                                    {/* ── Timeline ── */}
                                    <View style={styles.timeline}>
                                        <View style={styles.timelineNode}>
                                            <View style={[styles.timelineDot, { backgroundColor: colors.info }]} />
                                            <View style={styles.timelineCard}>
                                                <Text style={styles.timelineTitle}>Request Raised</Text>
                                                <Text style={styles.timelineMeta}>{fmtDateTime(detail.raisedAt)}</Text>
                                                {!!detail.raisedBy && <Text style={styles.timelineMeta}>{detail.raisedBy}</Text>}
                                            </View>
                                        </View>

                                        <View style={styles.timelineConnector} />

                                        <View style={styles.timelineNode}>
                                            <View style={[styles.timelineDot, { backgroundColor: meta.color }]} />
                                            <View style={styles.timelineCard}>
                                                <Text style={styles.timelineTitle}>
                                                    {detail.status === 'PENDING' ? 'Awaiting Approval' : meta.label}
                                                </Text>
                                                {detail.status === 'PENDING' ? (
                                                    <Text style={styles.timelineMeta}>Pending with approver</Text>
                                                ) : (
                                                    <>
                                                        <Text style={styles.timelineMeta}>{fmtDateTime(detail.processedAt) || '—'}</Text>
                                                        {!!detail.processedBy && <Text style={styles.timelineMeta}>{detail.processedBy}</Text>}
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                    </View>

                                    {!!detail.rejectionReason && (
                                        <View style={styles.reasonBox}>
                                            <Icon name="message-square" size={14} color={colors.danger} />
                                            <Text style={styles.reasonText}>{detail.rejectionReason}</Text>
                                        </View>
                                    )}

                                    {/* ── Audit info ── */}
                                    <View style={styles.auditBox}>
                                        <Text style={styles.auditTitle}>Audit Info</Text>
                                        <View style={styles.auditDivider} />
                                        <View style={styles.auditGrid}>
                                            <View style={styles.auditItem}>
                                                <Text style={styles.auditLabel}>Created By</Text>
                                                <Text style={styles.auditValue}>{detail.raisedBy || '—'}</Text>
                                            </View>
                                            <View style={styles.auditItem}>
                                                <Text style={styles.auditLabel}>Created On</Text>
                                                <Text style={styles.auditValue}>{fmtDateTime(detail.raisedAt) || '—'}</Text>
                                            </View>
                                            <View style={styles.auditItem}>
                                                <Text style={styles.auditLabel}>Updated By</Text>
                                                <Text style={styles.auditValue}>{detail.processedBy || '—'}</Text>
                                            </View>
                                            <View style={styles.auditItem}>
                                                <Text style={styles.auditLabel}>Updated On</Text>
                                                <Text style={styles.auditValue}>{fmtDateTime(detail.processedAt) || '—'}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {detail.status === 'PENDING' && (
                                        <View style={styles.detailActions}>
                                            <TouchableOpacity
                                                style={[styles.actionBtn, styles.approveBtn, { flex: 1 }]}
                                                onPress={() => runApprove(detail)}
                                                disabled={actionLoading}
                                            >
                                                {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                                                    <>
                                                        <Icon name="check" size={16} color="#fff" />
                                                        <Text style={styles.actionBtnText}>Approve</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.actionBtn, styles.rejectBtn, { flex: 1 }]}
                                                onPress={() => openReject(detail)}
                                                disabled={actionLoading}
                                            >
                                                <Icon name="x" size={16} color="#fff" />
                                                <Text style={styles.actionBtnText}>Reject</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </>
                            );
                        })()}
                    </View>
                </View>
            </Modal>

            {/* ── Reject reason modal — plain TextInput, not Alert.prompt (Android has no native prompt dialog) ── */}
            <Modal visible={rejectModal.visible} transparent animationType="fade" onRequestClose={() => setRejectModal({ visible: false, item: null })}>
                <View style={styles.modalOverlay}>
                    <View style={styles.rejectModalContent}>
                        <Text style={styles.modalTitle}>Reject Request</Text>
                        <Text style={styles.fieldLabel}>Reason (optional)</Text>
                        <TextInput
                            style={styles.reasonInput}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            placeholder="Why is this being rejected?"
                            placeholderTextColor={colors.textMuted}
                            multiline
                        />
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.clearBtn} onPress={() => setRejectModal({ visible: false, item: null })}>
                                <Text style={styles.clearBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.danger }]} onPress={confirmReject} disabled={actionLoading}>
                                {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.applyBtnText}>Reject</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    cardSubtitle: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 2 },
    cardMeta: { fontSize: 11, color: colors.textLight, marginTop: 2 },
    statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.md },
    statusChipText: { fontSize: 11, fontWeight: '700' },
    raisedText: { fontSize: 11, color: colors.textLight, marginTop: spacing.sm },
    cardActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, gap: spacing.xs },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: spacing.sm, borderRadius: 8,
    },
    approveBtn: { backgroundColor: colors.success },
    rejectBtn: { backgroundColor: colors.danger },
    actionBtnText: { color: '#fff', fontWeight: typography.weights.bold, fontSize: typography.sizes.sm },

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
    detailSubtitle: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 2 },
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

    detailStatusChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: borderRadius.md, marginTop: spacing.xs,
    },
    detailStatusText: { fontSize: 12, fontWeight: '700' },
    detailBodyText: { fontSize: typography.sizes.sm, color: colors.textMedium, marginTop: spacing.sm },

    timeline: { marginTop: spacing.md },
    timelineNode: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
    timelineConnector: { width: 2, height: 20, backgroundColor: colors.border, marginLeft: 5, marginVertical: 2 },
    timelineCard: {
        flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.md,
        padding: spacing.sm, marginBottom: spacing.xs,
    },
    timelineTitle: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.textDark },
    timelineMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

    reasonBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
        backgroundColor: colors.dangerLight, borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.sm,
    },
    reasonText: { flex: 1, fontSize: typography.sizes.sm, color: colors.danger },

    auditBox: { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.md },
    auditTitle: { fontSize: 12, fontWeight: '700', color: colors.textDark },
    auditDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
    auditGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    auditItem: { width: '50%', marginBottom: spacing.xs },
    auditLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' },
    auditValue: { fontSize: 12, color: colors.textDark, fontWeight: '600', marginTop: 1 },

    detailActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },

    rejectModalContent: {
        backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, margin: spacing.lg,
    },
    reasonInput: {
        borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
        padding: spacing.sm, minHeight: 70, textAlignVertical: 'top', color: colors.textDark,
    },
});

export default AdminApprovalsScreen;
