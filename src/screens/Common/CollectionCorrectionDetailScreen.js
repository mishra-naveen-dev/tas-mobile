import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';
import { STATUS_META, fmtDate, fmtDateTime } from '../../utils/requestAdapters';

const ACTIVE_STATUSES = ['SUBMITTED', 'PENDING_APPROVAL', 'UNDER_REVIEW', 'ESCALATED', 'RETURNED_FOR_CORRECTION'];

const ACTION_META = {
    SUBMITTED: { label: 'Submitted', icon: 'send', color: colors.info },
    APPROVED: { label: 'Approved', icon: 'check-circle', color: colors.success },
    REJECTED: { label: 'Rejected', icon: 'x-circle', color: colors.danger },
    SKIPPED: { label: 'Skipped', icon: 'skip-forward', color: colors.textMuted },
    ESCALATED: { label: 'Escalated', icon: 'trending-up', color: colors.punchBlue },
    DELEGATED: { label: 'Delegated', icon: 'user-plus', color: colors.info },
    AUTO_APPROVED: { label: 'Auto Approved', icon: 'zap', color: colors.success },
    CANCELLED: { label: 'Cancelled', icon: 'x', color: colors.textMuted },
};

const fmtAmount = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Per plan's Key Design Decision: one CollectionCorrectionRequest can have
// several hierarchy.ApprovalRequest instances underneath it (one per submit
// or resubmit-after-return). The N-step visual flow below reflects only the
// LATEST submission (the currently-live approval chain); the chronological
// timeline further down merges every submission's history — see §23's
// "Request Version" vs "Approval History" split.
const CollectionCorrectionDetailScreen = ({ navigation, route }) => {
    const auth = useAuth();
    const userId = auth?.user?.id;
    const correctionId = route?.params?.correctionId;

    const [detail, setDetail] = useState(null);
    const [timeline, setTimeline] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const fetchAll = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        setError('');
        try {
            const [detailRes, timelineRes] = await Promise.all([
                api.getCollectionCorrection(correctionId),
                api.getCollectionCorrectionTimeline(correctionId),
            ]);
            setDetail(detailRes.data);
            setTimeline(timelineRes.data);
        } catch (err) {
            setError('Failed to load correction request.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [correctionId]);

    useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

    const handleWithdraw = () => {
        Alert.alert(
            'Withdraw Request',
            'This request will be permanently recorded as withdrawn and will still count toward your 3-request limit for this collection. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Withdraw', style: 'destructive', onPress: async () => {
                        setActionLoading(true);
                        try {
                            await api.withdrawCollectionCorrection(correctionId);
                            fetchAll();
                        } catch (err) {
                            const msg = err?.response?.data?.error || 'Failed to withdraw request.';
                            Alert.alert('Error', msg);
                        } finally {
                            setActionLoading(false);
                        }
                    },
                },
            ],
        );
    };

    const handleEdit = () => {
        navigation.navigate('CollectionCorrectionForm', {
            editMode: true,
            correctionId: detail.id,
            existingData: detail,
        });
    };

    if (loading && !detail) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Icon name="arrow-left" size={24} color={colors.textDark} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Correction Request</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (error && !detail) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Icon name="arrow-left" size={24} color={colors.textDark} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Correction Request</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <Icon name="alert-circle" size={40} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchAll()}>
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const meta = STATUS_META[detail.status] || STATUS_META.PENDING_APPROVAL;
    const isCreator = detail.employee === userId;
    const canWithdraw = isCreator && ACTIVE_STATUSES.includes(detail.status);
    const canEdit = isCreator && detail.status === 'RETURNED_FOR_CORRECTION' && detail.edit_count < 3;
    const daysRemaining = detail.days_remaining;
    const deadlineUrgent = daysRemaining != null && daysRemaining <= 2;

    const submissions = timeline?.submissions || [];
    const latestSubmission = submissions[submissions.length - 1];
    const levels = [...(latestSubmission?.levels || [])].sort((a, b) => a.sequence - b.sequence);

    // Merged chronological history across every submission — §22's "one
    // continuous thread", tagged with which version/submission each action
    // belongs to since a return->edit->resubmit cycle spans more than one.
    const mergedHistory = submissions.flatMap((s) =>
        (s.history || []).map((h) => ({ ...h, version_number: s.version_number }))
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const stepStatusFor = (level) => {
        if (!latestSubmission) return { label: 'Not Started', color: colors.textMuted };
        const { current_sequence, status: subStatus } = latestSubmission;
        const actionAtLevel = [...(latestSubmission.history || [])]
            .reverse()
            .find((h) => h.sequence === level.sequence && h.action !== 'SUBMITTED');

        if (actionAtLevel) {
            const am = ACTION_META[actionAtLevel.action] || { label: actionAtLevel.action, color: colors.textMuted };
            return { ...am, actor: actionAtLevel.actor, timestamp: actionAtLevel.timestamp, comments: actionAtLevel.comments };
        }
        if (level.sequence === current_sequence && subStatus === 'PENDING') {
            return { label: 'Pending', color: colors.warning, icon: 'clock', current: true };
        }
        if (level.sequence < current_sequence) {
            return { label: 'Approved', color: colors.success, icon: 'check-circle' };
        }
        return { label: 'Not Started', color: colors.textMuted, icon: 'circle' };
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{detail.request_number}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} colors={[colors.primary]} />}
            >
                {/* ── Status + summary ── */}
                <View style={styles.statusCard}>
                    <View style={[styles.statusChip, { backgroundColor: meta.bg, alignSelf: 'flex-start' }]}>
                        <Icon name={meta.icon} size={14} color={meta.color} />
                        <Text style={[styles.statusChipText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <Text style={styles.customerName}>{detail.customer_name}</Text>
                    <Text style={styles.loanId}>Loan ID: {detail.loan_id}{detail.branch_name ? ` · ${detail.branch_name}` : ''}</Text>

                    <View style={styles.amountBlock}>
                        <View style={styles.amountItem}>
                            <Text style={styles.amountLabel}>Original Amount</Text>
                            <Text style={styles.amountValue}>{fmtAmount(detail.original_collected_amount)}</Text>
                        </View>
                        <Icon name="arrow-right" size={18} color={colors.textMuted} />
                        <View style={styles.amountItem}>
                            <Text style={styles.amountLabel}>Requested Amount</Text>
                            <Text style={[styles.amountValue, { color: colors.primary }]}>
                                {fmtAmount(detail.versions?.[detail.versions.length - 1]?.requested_amount)}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.infoGrid}>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Collection Date</Text>
                            <Text style={styles.infoValue}>{fmtDate(detail.collection_date)}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Requests Used</Text>
                            <Text style={styles.infoValue}>{detail.request_count}/3</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Edits Used</Text>
                            <Text style={styles.infoValue}>{detail.edit_count}/3</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Requested By</Text>
                            <Text style={styles.infoValue} numberOfLines={1}>
                                {detail.employee_details?.first_name
                                    ? `${detail.employee_details.first_name} ${detail.employee_details.last_name || ''}`.trim()
                                    : (detail.employee_details?.username || '—')}
                            </Text>
                        </View>
                    </View>

                    {daysRemaining != null && ACTIVE_STATUSES.includes(detail.status) && (
                        <View style={[styles.deadlineBanner, deadlineUrgent && styles.deadlineBannerUrgent]}>
                            <Icon name="clock" size={14} color={deadlineUrgent ? colors.danger : colors.warning} />
                            <Text style={[styles.deadlineText, { color: deadlineUrgent ? colors.danger : colors.warning }]}>
                                {daysRemaining === 0
                                    ? 'Correction window expires today'
                                    : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining in the correction window (deadline: ${fmtDate(detail.correction_window_expires_at)})`}
                            </Text>
                        </View>
                    )}
                </View>

                {/* ── N-step visual approval flow (latest submission) ── */}
                {levels.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Approval Flow</Text>
                        <View style={styles.stepFlow}>
                            {levels.map((level, index) => {
                                const step = stepStatusFor(level);
                                const isLast = index === levels.length - 1;
                                return (
                                    <View key={level.sequence} style={styles.stepRow}>
                                        <View style={styles.stepIndicatorCol}>
                                            <View style={[
                                                styles.stepDot,
                                                { backgroundColor: step.color },
                                                step.current && styles.stepDotCurrent,
                                            ]}>
                                                <Icon name={step.icon || (step.current ? 'clock' : 'circle')} size={12} color="#fff" />
                                            </View>
                                            {!isLast && <View style={[styles.stepConnector, { backgroundColor: step.label !== 'Not Started' ? colors.border : colors.border }]} />}
                                        </View>
                                        <View style={[styles.stepCard, step.current && styles.stepCardCurrent]}>
                                            <View style={styles.stepCardHeader}>
                                                <Text style={styles.stepName}>{level.name}</Text>
                                                <Text style={[styles.stepStatusLabel, { color: step.color }]}>{step.label}</Text>
                                            </View>
                                            {step.actor && (
                                                <Text style={styles.stepMeta}>{step.actor} · {fmtDateTime(step.timestamp)}</Text>
                                            )}
                                            {!!step.comments && <Text style={styles.stepComments}>"{step.comments}"</Text>}
                                            {step.current && latestSubmission?.current_pending_approvers?.length > 0 && (
                                                <Text style={styles.stepPendingWith}>
                                                    Pending with: {latestSubmission.current_pending_approvers.map(a => a.approver).join(', ')}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* ── Chronological timeline (merged across resubmissions) ── */}
                {mergedHistory.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Timeline</Text>
                        {mergedHistory.map((h, i) => {
                            const am = ACTION_META[h.action] || { label: h.action, icon: 'circle', color: colors.textMuted };
                            return (
                                <View key={i} style={styles.timelineItem}>
                                    <Icon name={am.icon} size={14} color={am.color} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.timelineText}>
                                            <Text style={{ fontWeight: '700' }}>{h.actor}</Text> {am.label.toLowerCase()}
                                            {h.version_number ? ` (v${h.version_number})` : ''}
                                        </Text>
                                        {!!h.comments && <Text style={styles.timelineComment}>"{h.comments}"</Text>}
                                        <Text style={styles.timelineDate}>{fmtDateTime(h.timestamp)}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* ── Version history ── */}
                {!!detail.versions?.length && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Version History</Text>
                        {[...detail.versions].reverse().map((v) => (
                            <View key={v.id} style={styles.versionCard}>
                                <View style={styles.versionHeader}>
                                    <Text style={styles.versionNumber}>Version {v.version_number}</Text>
                                    <Text style={styles.versionDate}>{fmtDateTime(v.created_at)}</Text>
                                </View>
                                <Text style={styles.versionAmount}>{fmtAmount(v.requested_amount)}</Text>
                                <Text style={styles.versionReason}>{v.reason}</Text>
                                {!!v.edit_reason && <Text style={styles.versionEditReason}>Edit reason: {v.edit_reason}</Text>}
                                {!!v.changed_fields?.length && (
                                    <Text style={styles.versionChanged}>Changed: {v.changed_fields.join(', ')}</Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {(canEdit || canWithdraw) && (
                    <View style={styles.actionRow}>
                        {canEdit && (
                            <TouchableOpacity style={styles.editBtn} onPress={handleEdit} disabled={actionLoading}>
                                <Icon name="edit-2" size={16} color={colors.primary} />
                                <Text style={styles.editBtnText}>Edit & Resubmit</Text>
                            </TouchableOpacity>
                        )}
                        {canWithdraw && (
                            <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw} disabled={actionLoading}>
                                {actionLoading ? <ActivityIndicator size="small" color={colors.danger} /> : (
                                    <>
                                        <Icon name="x-circle" size={16} color={colors.danger} />
                                        <Text style={styles.withdrawBtnText}>Withdraw</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.textDark },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    errorText: { fontSize: typography.sizes.sm, color: colors.danger, marginTop: spacing.sm, textAlign: 'center' },
    retryBtn: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primary, borderRadius: borderRadius.md },
    retryBtnText: { color: '#fff', fontWeight: '700' },

    scrollContent: { padding: spacing.md, paddingBottom: 60 },

    statusCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: borderRadius.md },
    statusChipText: { fontSize: 12, fontWeight: '700' },
    customerName: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark, marginTop: spacing.sm },
    loanId: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 2 },

    amountBlock: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.background,
        borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.md,
    },
    amountItem: { flex: 1 },
    amountLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' },
    amountValue: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.textDark, marginTop: 2 },

    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
    infoItem: { width: '50%', marginBottom: spacing.sm },
    infoLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' },
    infoValue: { fontSize: typography.sizes.sm, color: colors.textDark, fontWeight: '600', marginTop: 1 },

    deadlineBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warningLight,
        borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.sm,
    },
    deadlineBannerUrgent: { backgroundColor: colors.dangerLight },
    deadlineText: { flex: 1, fontSize: typography.sizes.xs, fontWeight: '600' },

    section: { marginTop: spacing.lg },
    sectionTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.textDark, marginBottom: spacing.sm },

    stepFlow: {},
    stepRow: { flexDirection: 'row' },
    stepIndicatorCol: { alignItems: 'center', width: 32 },
    stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    stepDotCurrent: { elevation: 3, shadowColor: colors.warning, shadowOpacity: 0.5, shadowRadius: 6 },
    stepConnector: { width: 2, flex: 1, minHeight: 24, marginVertical: 2 },
    stepCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.sm, marginLeft: spacing.xs, borderWidth: 1, borderColor: colors.border },
    stepCardCurrent: { borderColor: colors.warning, backgroundColor: colors.warningLight },
    stepCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    stepName: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.textDark, flex: 1 },
    stepStatusLabel: { fontSize: 11, fontWeight: '700' },
    stepMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    stepComments: { fontSize: 11, color: colors.textMedium, fontStyle: 'italic', marginTop: 2 },
    stepPendingWith: { fontSize: 11, color: colors.warning, fontWeight: '600', marginTop: 4 },

    timelineItem: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    timelineText: { fontSize: typography.sizes.sm, color: colors.textDark },
    timelineComment: { fontSize: 12, color: colors.textMedium, fontStyle: 'italic', marginTop: 2 },
    timelineDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

    versionCard: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
    versionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    versionNumber: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.textDark },
    versionDate: { fontSize: 11, color: colors.textMuted },
    versionAmount: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.primary, marginTop: 4 },
    versionReason: { fontSize: typography.sizes.sm, color: colors.textMedium, marginTop: 2 },
    versionEditReason: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },
    versionChanged: { fontSize: 11, color: colors.textLight, marginTop: 2 },

    actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    editBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: spacing.sm, borderRadius: 8, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: `${colors.primary}10`,
    },
    editBtnText: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.primary },
    withdrawBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: spacing.sm, borderRadius: 8, borderWidth: 1.5, borderColor: colors.danger, backgroundColor: `${colors.danger}10`,
    },
    withdrawBtnText: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.danger },
});

export default CollectionCorrectionDetailScreen;
