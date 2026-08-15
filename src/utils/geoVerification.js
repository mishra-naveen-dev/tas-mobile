/**
 * Shared display helpers for the Punch & Activity Verification screens —
 * one place for "what does this status/value mean to an employee," so the
 * Punch History summary card, the session detail screen, and the activity
 * timeline never drift into three different labels for the same thing.
 *
 * Mirrors tas-backend/common/geo_status.py's GEO_STATUS_CHOICES exactly —
 * update both together.
 */

export const GEO_STATUS_LABELS = {
    VERIFIED: { label: 'Verified', icon: 'check-circle', color: '#059669' },
    OUTSIDE_RADIUS: { label: 'Outside Allowed Radius', icon: 'alert-triangle', color: '#D97706' },
    GPS_ACCURACY_LOW: { label: 'GPS Accuracy Low', icon: 'alert-triangle', color: '#D97706' },
    CUSTOMER_COORDS_MISSING: { label: 'Customer Location Missing', icon: 'help-circle', color: '#6B7280' },
    BRANCH_COORDS_MISSING: { label: 'Branch Location Missing', icon: 'help-circle', color: '#6B7280' },
    GPS_UNAVAILABLE: { label: 'GPS Unavailable', icon: 'wifi-off', color: '#DC2626' },
    LOCATION_EXCEPTION: { label: 'Location Exception', icon: 'alert-circle', color: '#DC2626' },
    '': { label: 'Not Verified', icon: 'help-circle', color: '#9CA3AF' },
};

export const geoStatusInfo = (status) => GEO_STATUS_LABELS[status || ''] || GEO_STATUS_LABELS[''];

// Mirrors common.geo_status.gps_accuracy_tier's boundaries exactly.
export const gpsAccuracyTier = (accuracyM) => {
    if (accuracyM == null) return null;
    if (accuracyM <= 10) return 'Excellent';
    if (accuracyM <= 25) return 'Good';
    if (accuracyM <= 50) return 'Moderate';
    return 'Poor';
};

export const ACCURACY_TIER_COLOR = {
    Excellent: '#059669', Good: '#16A34A', Moderate: '#D97706', Poor: '#DC2626',
};

export const fmtDurationSeconds = (seconds) => {
    if (seconds == null) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};

export const fmtDistanceMeters = (meters) => {
    if (meters == null) return '—';
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
};

export const fmtTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

export const fmtDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

export const fmtCoord = (value) => (value == null ? '—' : Number(value).toFixed(6));
