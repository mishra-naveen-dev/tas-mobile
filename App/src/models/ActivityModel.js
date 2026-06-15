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
    distance_from_last: data.distance_from_last || 0,
});

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
    mapApiResponseToActivities,
};
