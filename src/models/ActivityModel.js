// Activity Model - Data structure for TAS activities

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
    FAILED: 'failed',
};

export const createActivity = (data) => ({
    id: data.id || `${Date.now()}-${Math.random()}`,
    type: data.type || ACTIVITY_TYPES.OTHER,
    timestamp: data.timestamp || data.punched_at || new Date().toISOString(),
    location: data.location || data.current_address || null,
    amount: data.amount || data.total_amount || null,
    clientName: data.client_name || data.clientName || null,
    notes: data.notes || data.reason || null,
    withPerson: data.with_person || data.withPerson || null,
    status: data.status || ACTIVITY_STATUS.SUCCESS,
    punchType: data.punch_type || null,
    visitType: data.visit_type || null,
    distance: data.distance || null,
});

export const mapApiResponseToActivities = (punchesData = [], allowanceData = []) => {
    const activities = [];

    // Map punches to activities
    if (Array.isArray(punchesData)) {
        punchesData.forEach(punch => {
            const isPunchIn = punch.visit_type === 'PUNCH_IN' || punch.punch_type === 'PUNCH_IN';
            const isPunchOut = punch.visit_type === 'PUNCH_OUT' || punch.punch_type === 'PUNCH_OUT';

            activities.push(createActivity({
                ...punch,
                type: isPunchIn ? ACTIVITY_TYPES.PUNCH_IN : 
                      isPunchOut ? ACTIVITY_TYPES.PUNCH_OUT : 
                      ACTIVITY_TYPES.VISIT,
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
    mapApiResponseToActivities,
};
