import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';
import { STATUS_META, fmtDateTime } from '../utils/requestAdapters';

// Shared detail/audit-trail view for a normalized request item (see
// utils/requestAdapters.js). `actions` is optional — pass
// { onApprove, onReject, loading } to show Approve/Reject buttons for a
// pending item (the admin Approvals inbox); omit it for a read-only
// tracking view (an employee looking at their own requests).
const RequestDetailModal = ({ detail, onClose, actions }) => (
    <Modal visible={!!detail} transparent animationType="slide" onRequestClose={onClose}>
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
                                <TouchableOpacity onPress={onClose}>
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
                                            <Text style={styles.timelineMeta}>
                                                Pending with {detail.pendingWith || 'Admin / Super Admin'}
                                            </Text>
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

                            {actions && detail.status === 'PENDING' && (
                                <View style={styles.detailActions}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.approveBtn]}
                                        onPress={() => actions.onApprove(detail)}
                                        disabled={actions.loading}
                                    >
                                        {actions.loading ? <ActivityIndicator size="small" color="#fff" /> : (
                                            <>
                                                <Icon name="check" size={16} color="#fff" />
                                                <Text style={styles.actionBtnText}>Approve</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.rejectBtn]}
                                        onPress={() => actions.onReject(detail)}
                                        disabled={actions.loading}
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
);

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: spacing.md, maxHeight: '85%',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
    modalTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark },
    detailSubtitle: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 2 },

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
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: spacing.sm, borderRadius: 8,
    },
    approveBtn: { backgroundColor: colors.success },
    rejectBtn: { backgroundColor: colors.danger },
    actionBtnText: { color: '#fff', fontWeight: typography.weights.bold, fontSize: typography.sizes.sm },
});

export default RequestDetailModal;
