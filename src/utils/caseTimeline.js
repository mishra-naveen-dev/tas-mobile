import { colors } from '../theme/tokens';

const fmtDateTime = (d) => (d
  ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '');
const label = (s) => (s || '').replace(/_/g, ' ');
const person = (p) => (p ? `${p.name || p.employee_id}${p.employee_id && p.name ? ` (${p.employee_id})` : ''}` : '');

/**
 * Load a case's activity for the Collection Visit "Activity & History" card.
 *
 * Preferred: GET /loans/collections/<id>/case_activity/ — one call, scoped by the
 * backend's case-visibility rules, with who did what, ownership changes and
 * transfers. Fallback (older backend): the two legacy calls, run INDEPENDENTLY —
 * previously they were combined with Promise.all, so a refusal from one
 * (assignment history is 404 for ordinary employees) discarded the other and the
 * whole card read "No activity recorded" even though updates were available.
 * Never throws.
 */
export async function loadCaseTimeline(api, collectionId) {
  try {
    const res = await api.getCaseActivity(collectionId, { page_size: 20 });
    return { events: res?.data?.results || [] };
  } catch (e) {
    const [updates, history] = await Promise.allSettled([
      api.getCollectionUpdates({ collection: collectionId, ordering: '-created_at', page_size: 20 }),
      api.getAssignmentHistory(collectionId),
    ]);
    return {
      updates: updates.status === 'fulfilled' ? (updates.value?.data?.results || updates.value?.data || []) : [],
      history: history.status === 'fulfilled' ? (history.value?.data || []) : [],
    };
  }
}

/** case_activity events -> the card's rows (newest first, as the server sends them). */
export function buildCaseTimeline(events) {
  return (events || []).map((e) => {
    const time = fmtDateTime(e.at);
    const id = `${e.kind}-${e.id}`;
    if (e.kind === 'OWNERSHIP') {
      const moved = e.type === 'TRANSFERRED';
      return {
        id, icon: moved ? 'repeat' : 'user-check', iconColor: moved ? colors.warning : colors.success,
        title: moved ? `Transferred ${person(e.from)} → ${person(e.to)}` : `Assigned to ${person(e.to)}`,
        detail: [e.by && `By ${person(e.by)}`, e.reason && `Reason: ${e.reason}`].filter(Boolean).join(' · '),
        time,
      };
    }
    if (e.kind === 'REQUEST') {
      return {
        id, icon: 'repeat', iconColor: colors.textMuted,
        title: `${label(e.type.replace('TRANSFER_REQUEST_', 'Transfer request '))}: ${person(e.from)} → ${person(e.to)}`,
        detail: [e.by && `By ${person(e.by)}`, e.reason && `Reason: ${e.reason}`].filter(Boolean).join(' · '),
        time,
      };
    }
    const amount = e.amount > 0 ? ` · ₹${Number(e.amount).toLocaleString('en-IN')}` : '';
    const tone = e.status === 'COLLECTED' ? colors.success
      : e.status === 'PARTIALLY_COLLECTED' ? colors.warning
      : e.status === 'NOT_PAID' ? colors.error : colors.textMuted;
    return {
      id,
      icon: e.status === 'COLLECTED' ? 'check-circle' : e.status === 'NOT_PAID' ? 'alert-circle' : 'edit-3',
      iconColor: tone,
      title: `${label(e.status) || 'Updated'}${amount}`,
      detail: [
        e.performed_by && `By ${person(e.performed_by)}`,
        e.sync_status === 'SYNCED_LATE' && 'recorded offline',
        e.remarks,
      ].filter(Boolean).join(' · '),
      time,
    };
  });
}
