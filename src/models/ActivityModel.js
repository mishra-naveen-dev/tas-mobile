// Activity Model - Data structure for TAS activities

import { QUEUE_STATUS } from '../services/OfflineQueue';

export const ACTIVITY_TYPES = {
    PUNCH_IN: 'PUNCH_IN',
    PUNCH_OUT: 'PUNCH_OUT',
    VISIT: 'VISIT',
    COLLECTION: 'COLLECTION',
    DISBURSEMENT: 'DISBURSEMENT',
    TRAVEL: 'TRAVEL',
    OTHER: 'OTHER',
};

export const ACTIVITY_STATUS = {
    SUCCESS: 'success',
    PENDING: 'pending',
    SYNCING: 'syncing',
    FAILED: 'failed',
};

export const createActivity = (data) => ({
    id: data.id || `${Date.now()}-${Math.random()}`,
    type: data.type || ACTIVITY_TYPES.OTHER,
    timestamp: data.timestamp || data.punched_at || new Date().toISOString(),
    location: data.location || data.current_address || null,
    amount: data.amount || data.total_amount || null,
    clientName: data.client_name || data.clientName || data.customer_name || null,
    notes: data.notes || data.reason || null,
    withPerson: data.with_person || data.withPerson || null,
    status: data.status || ACTIVITY_STATUS.SUCCESS,
    punchType: data.punch_type || null,
    visitType: data.visit_type || null,
    distance: data.distance || null,
    distance_from_last: data.distance_from_last || 0,
    // The full source punch/collection-update record, kept as-is (not
    // normalized) — the activity detail view reads customer_phone/loan_id/
    // latitude/longitude/travel_type/companion_name straight from here
    // rather than growing the curated field list above for every screen
    // that only needs the summary card fields.
    raw: data,
});

// Shapes a raw OfflineQueue item into the same createActivity() structure
// server-confirmed activities use, so the "Pending Sync" section of the
// Activity screen can reuse ActivityCard/ActivitySection unchanged rather
// than needing a second, parallel rendering path. id is prefixed with
// `queue-` so it can never collide with a server-sourced activity id (a
// record only ever lives in one of the two sources at a time — the queue
// until it syncs, the server feed afterwards — so there's no de-dup logic
// to write here, just a stable, non-colliding key).
const QUEUE_STATUS_TO_ACTIVITY_STATUS = {
    [QUEUE_STATUS.PENDING]: ACTIVITY_STATUS.PENDING,
    [QUEUE_STATUS.SYNCING]: ACTIVITY_STATUS.SYNCING,
    // SYNCED falls through to SUCCESS — ActivityCard has no SYNC_STATUS_META
    // entry for it, so it renders exactly like a normal confirmed activity
    // during its brief window before pruneSynced() removes it from the queue.
    [QUEUE_STATUS.SYNCED]: ACTIVITY_STATUS.SUCCESS,
    [QUEUE_STATUS.RETRY_PENDING]: ACTIVITY_STATUS.PENDING,
    [QUEUE_STATUS.FAILED]: ACTIVITY_STATUS.FAILED,
};

export const activityFromQueueItem = (item) => {
    const payload = item.payload || {};
    const form = payload.form || {};

    let type = ACTIVITY_TYPES.OTHER;
    if (item.kind === 'PUNCH_IN') {
        type = ACTIVITY_TYPES.PUNCH_IN;
    } else if (item.kind === 'COLLECTION_VISIT') {
        type = form.reasonBucket === 'VISIT' ? ACTIVITY_TYPES.VISIT : ACTIVITY_TYPES.COLLECTION;
    }

    return createActivity({
        id: `queue-${item.id}`,
        type,
        timestamp: new Date(item.queuedAt).toISOString(),
        location: payload.customerAddress || payload.address || null,
        amount: form.collected_amount || payload.amount || null,
        client_name: payload.customerName || payload.customer_name || null,
        notes: item.status === QUEUE_STATUS.FAILED ? (item.lastError || 'Sync failed — tap to retry') : null,
        status: QUEUE_STATUS_TO_ACTIVITY_STATUS[item.status] || ACTIVITY_STATUS.PENDING,
        // Carried through on `raw` (see createActivity's doc comment) so
        // ActivityCard can show the loan id and wire a retry action without
        // this model needing its own dedicated fields for them.
        loanId: payload.loanId || payload.loan_id || null,
        queueId: item.id,
        queueStatus: item.status,
    });
};

export const mapApiResponseToActivities = (punchesData = [], allowanceData = []) => {
    const activities = [];

    // Map punches to activities
    if (Array.isArray(punchesData)) {
        punchesData.forEach(punch => {
            let activityType = ACTIVITY_TYPES.PUNCH_IN; // Default

            // If it has a specific visit_type, use it to determine the activity type
            if (punch.visit_type && ACTIVITY_TYPES[punch.visit_type]) {
                activityType = ACTIVITY_TYPES[punch.visit_type];
            } else if (punch.visit_type === 'PUNCH_OUT' || punch.punch_type === 'PUNCH_OUT') {
                activityType = ACTIVITY_TYPES.PUNCH_OUT;
            } else if (punch.visit_type === 'PUNCH_IN' || punch.punch_type === 'PUNCH_IN') {
                // If it really is just a standard generic Punch In
                activityType = ACTIVITY_TYPES.PUNCH_IN;
            }

            activities.push(createActivity({
                ...punch,
                type: activityType,
            }));
        });
    }

    // Map allowance requests to activities
    if (Array.isArray(allowanceData)) {
        allowanceData.forEach(allowance => {
            activities.push(createActivity({
                id: `allowance-${allowance.id}`,
                type: ACTIVITY_TYPES.TRAVEL,
                timestamp: allowance.travel_date,
                location: allowance.from_location && allowance.to_location 
                    ? `${allowance.from_location} → ${allowance.to_location}` 
                    : null,
                amount: allowance.requested_amount || allowance.approved_amount,
                notes: allowance.reason,
                status: ACTIVITY_STATUS.SUCCESS,
            }));
        });
    }

    // Sort by timestamp descending (newest first)
    return activities.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
};

export default {
    ACTIVITY_TYPES,
    ACTIVITY_STATUS,
    createActivity,
    activityFromQueueItem,
    mapApiResponseToActivities,
};
