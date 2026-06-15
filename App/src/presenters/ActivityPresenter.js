// Activity Presenter - Business logic for activity feed

import { ACTIVITY_TYPES, ACTIVITY_STATUS } from '../models/ActivityModel';

const TIME_GROUPS = {
    MORNING: 'Morning',
    AFTERNOON: 'Afternoon',
    EVENING: 'Evening',
};

const getTimeGroup = (timestamp) => {
    const hour = new Date(timestamp).getHours();
    if (hour >= 6 && hour < 12) return TIME_GROUPS.MORNING;
    if (hour >= 12 && hour < 18) return TIME_GROUPS.AFTERNOON;
    return TIME_GROUPS.EVENING;
};

const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

const formatRelativeTime = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return formatTime(timestamp);
};

const getActivityConfig = (type) => {
    const configs = {
        [ACTIVITY_TYPES.PUNCH_IN]: {
            icon: 'log-in',
            color: '#10B981',
            bgColor: '#D1FAE5',
            title: 'Punch In',
        },
        [ACTIVITY_TYPES.PUNCH_OUT]: {
            icon: 'log-out',
            color: '#EF4444',
            bgColor: '#FEE2E2',
            title: 'Punch Out',
        },
        [ACTIVITY_TYPES.VISIT]: {
            icon: 'map-pin',
            color: '#2563EB',
            bgColor: '#DBEAFE',
            title: 'Visit',
        },
        [ACTIVITY_TYPES.COLLECTION]: {
            icon: 'dollar-sign',
            color: '#F59E0B',
            bgColor: '#FEF3C7',
            title: 'Collection',
        },
        [ACTIVITY_TYPES.DISBURSEMENT]: {
            icon: 'trending-up',
            color: '#8B5CF6',
            bgColor: '#EDE9FE',
            title: 'Disbursement',
        },
        [ACTIVITY_TYPES.TRAVEL]: {
            icon: 'navigation',
            color: '#64748B',
            bgColor: '#F1F5F9',
            title: 'Travel',
        },
        [ACTIVITY_TYPES.OTHER]: {
            icon: 'activity',
            color: '#64748B',
            bgColor: '#F1F5F9',
            title: 'Activity',
        },
    };
    return configs[type] || configs[ACTIVITY_TYPES.OTHER];
};

const formatActivityTitle = (activity) => {
    const config = getActivityConfig(activity.type);
    
    if (activity.clientName) {
        return `Visited ${activity.clientName}`;
    }
    
    if (activity.withPerson) {
        return `Travel with ${activity.withPerson}`;
    }
    
    return config.title;
};

const formatActivitySubtitle = (activity) => {
    const parts = [];
    
    if (activity.notes) {
        parts.push(activity.notes.length > 40 ? activity.notes.substring(0, 40) + '...' : activity.notes);
    }
    
    if (activity.distance_from_last && activity.distance_from_last > 0) {
        parts.push(`${parseFloat(activity.distance_from_last).toFixed(2)} km since last punch`);
    } else if (activity.distance && activity.distance > 0) {
        parts.push(`${parseFloat(activity.distance).toFixed(2)} km traveled`);
    }
    
    if (parts.length > 0) {
        return parts.join(' • ');
    }

    if (activity.location) {
        return activity.location;
    }
    return null;
};

const getActivityAmount = (activity) => {
    if (!activity.amount) return null;
    
    const isCollection = activity.type === ACTIVITY_TYPES.COLLECTION;
    return {
        value: activity.amount,
        type: isCollection ? 'credit' : 'debit',
        prefix: '₹',
    };
};

const filterActivities = (activities, filterType) => {
    if (!filterType || filterType === 'ALL') {
        return activities;
    }

    const filterMap = {
        'PUNCH': [ACTIVITY_TYPES.PUNCH_IN, ACTIVITY_TYPES.PUNCH_OUT],
        'VISIT': [ACTIVITY_TYPES.VISIT],
        'COLLECTION': [ACTIVITY_TYPES.COLLECTION],
        'DISBURSEMENT': [ACTIVITY_TYPES.DISBURSEMENT],
        'TRAVEL': [ACTIVITY_TYPES.TRAVEL],
    };

    const typesToInclude = filterMap[filterType] || [];
    return activities.filter(activity => typesToInclude.includes(activity.type));
};

const groupActivitiesByTime = (activities) => {
    const groups = {};
    
    activities.forEach(activity => {
        const group = getTimeGroup(activity.timestamp);
        if (!groups[group]) {
            groups[group] = [];
        }
        groups[group].push(activity);
    });

    // Convert to array format for FlatList sections
    const sectionOrder = [TIME_GROUPS.MORNING, TIME_GROUPS.AFTERNOON, TIME_GROUPS.EVENING];
    const sections = [];

    sectionOrder.forEach(timeGroup => {
        if (groups[timeGroup] && groups[timeGroup].length > 0) {
            sections.push({
                title: timeGroup,
                data: groups[timeGroup],
            });
        }
    });

    return sections;
};

const presenter = {
    formatTime,
    formatRelativeTime,
    getActivityConfig,
    formatActivityTitle,
    formatActivitySubtitle,
    getActivityAmount,
    filterActivities,
    groupActivitiesByTime,
    TIME_GROUPS,
    ACTIVITY_TYPES,
    ACTIVITY_STATUS,
};

export default presenter;
