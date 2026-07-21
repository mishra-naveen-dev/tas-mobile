import { colors } from '../theme/tokens';

// Shared normalization for the four approvable request types (Allowance,
// Punch Correction, Device, Profile Update) so any screen — the admin
// Approvals inbox or an employee's own request tracker — can render them
// through one common shape instead of branching by type everywhere.

export const STATUS_META = {
    PENDING:  { label: 'Pending',  color: colors.warning, bg: colors.warningLight, icon: 'clock' },
    APPROVED: { label: 'Approved', color: colors.success, bg: colors.successLight, icon: 'check-circle' },
    REJECTED: { label: 'Rejected', color: colors.danger,  bg: colors.dangerLight,  icon: 'x-circle' },
    PAID:     { label: 'Paid',     color: colors.info,    bg: colors.infoLight,    icon: 'check-circle' },
    DRAFT:    { label: 'Draft',    color: colors.textMuted, bg: colors.background, icon: 'file' },
    BLOCKED:  { label: 'Blocked',  color: colors.danger,  bg: colors.dangerLight,  icon: 'slash' },
};

export const STATUS_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

export const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : null;

export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export const adaptAllowance = (item) => ({
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
    // Allowance approval isn't branch-scoped — any Admin or Super Admin can act on it.
    pendingWith: 'Admin / Super Admin',
});

export const adaptCorrection = (item) => ({
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
    // Corrections are reviewed by the employee's own Branch Admin (or Super Admin).
    pendingWith: 'Your Branch Admin / Super Admin',
});

export const adaptDevice = (item) => ({
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
    pendingWith: 'Admin / Super Admin',
});

export const adaptProfile = (item) => ({
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
    pendingWith: 'Admin / Super Admin',
});
