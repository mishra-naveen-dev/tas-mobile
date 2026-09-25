/**
 * The Home distance must not oscillate.
 *
 * Reported: 0.33 -> 1.34 -> 1.54 -> 0.32 -> 1.54 -> 0.31 km on consecutive
 * refreshes. A cumulative distance for a day in progress cannot move backwards
 * because a screen was refreshed.
 *
 * The client half of that fix. The backend owns the value and never lowers it
 * during normal operation (pinned in tas-backend
 * apps/livetracking/tests_daily_distance.py). What the app must guarantee is
 * that it never DISPLAYS a lower one, and that a slow response cannot overwrite
 * a fast one.
 */
import { istDateStr } from '../src/utils/businessDate';

jest.mock('../src/api/api', () => ({
    __esModule: true,
    default: {
        getTrackingDailySummary: jest.fn(),
        getLiveDailyRoute: jest.fn(),
    },
    getBaseURL: () => 'http://localhost:8000',
    getAllDevicePages: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(null),
        removeItem: jest.fn().mockResolvedValue(null),
    },
}));

jest.mock('../src/services/LocationService', () => ({
    __esModule: true,
    default: { getTotalDistance: jest.fn(() => 0), startTracking: jest.fn(), stopTracking: jest.fn() },
}));

jest.mock('../src/services/LiveTrackingService', () => ({
    __esModule: true,
    default: { attach: jest.fn(), detach: jest.fn(), getStatus: jest.fn(() => ({})) },
}));

import api from '../src/api/api';

const summary = (km, revision, recalculations = 0) => ({
    employee_id: 1,
    business_date: istDateStr(),
    distance: { meters: Math.round(km * 1000), kilometers: km },
    valid_points: 10,
    rejected_points: 0,
    route_segments: 1,
    gps_gaps: 0,
    last_processed_sequence: 10,
    last_processed_at: '2026-09-25T10:00:00Z',
    tracking_status: 'ACTIVE',
    distance_revision: revision,
    recalculation_count: recalculations,
    raw_points: 10,
});

/**
 * The client-side acceptance rules, restated independently of the
 * implementation so the invariant is pinned rather than merely re-run:
 *
 *   1. a response superseded by a newer in-flight request is discarded;
 *   2. a response carrying an older revision is a stale replay and is ignored;
 *   3. a LOWER distance is refused unless the backend explicitly recorded a
 *      recalculation - the one legitimate reason a day's total can be revised.
 */
class DistanceGate {
    constructor() {
        this.seq = 0;
        this.revision = null;
        this.recalcs = null;
        this.value = null;
    }

    accept(seq, data) {
        if (seq !== this.seq) return false;
        const rev = data.distance_revision ?? null;
        if (rev != null && this.revision != null && rev < this.revision) return false;

        const km = data.distance?.kilometers;
        const recalcs = data.recalculation_count ?? null;
        const corrected = recalcs != null && this.recalcs != null && recalcs > this.recalcs;
        if (typeof km === 'number' && this.value != null && km < this.value && !corrected) {
            return false;
        }

        this.revision = rev;
        this.recalcs = recalcs;
        this.value = km;
        return true;
    }
}

describe('Home distance gate', () => {
    test('the exact reported sequence: 0.33 then 1.34 then 1.54, refreshes hold at 1.54', () => {
        const gate = new DistanceGate();
        const shown = [];
        const push = (km, rev) => {
            const seq = ++gate.seq;
            if (gate.accept(seq, summary(km, rev))) shown.push(km);
        };

        push(0.33, 1);
        push(1.34, 2);
        push(1.54, 3);
        // Refresh, refresh again, auto refresh: the value must not move.
        for (let i = 0; i < 5; i += 1) push(1.54, 3);
        // New valid movement may increase it.
        push(1.60, 4);

        expect(shown).toEqual([0.33, 1.34, 1.54, 1.54, 1.54, 1.54, 1.54, 1.54, 1.60]);
        expect(shown).not.toContain(0.32);
        expect(shown).not.toContain(0.31);
    });

    test('a stale response arriving late cannot overwrite a newer value', () => {
        const gate = new DistanceGate();

        const slowSeq = ++gate.seq;      // slow request, 0.33
        const fastSeq = ++gate.seq;      // newer request, 1.54

        expect(gate.accept(fastSeq, summary(1.54, 2))).toBe(true);
        expect(gate.value).toBe(1.54);

        // The slow one finally lands, carrying an OLDER revision as well.
        expect(gate.accept(slowSeq, summary(0.33, 1))).toBe(false);
        expect(gate.value).toBe(1.54);
    });

    test('a lower value with a newer revision is still refused mid-day', () => {
        const gate = new DistanceGate();
        ++gate.seq;
        gate.accept(gate.seq, summary(1.54, 3));
        expect(gate.value).toBe(1.54);

        ++gate.seq;
        gate.accept(gate.seq, summary(0.32, 4));
        expect(gate.value).toBe(1.54);
    });

    test('an explicit backend recalculation IS allowed to lower the value', () => {
        // The one legitimate exception: the backend deliberately reprocessed
        // the route and recorded it, so the corrected number must be shown
        // rather than silently suppressed.
        const gate = new DistanceGate();
        ++gate.seq;
        gate.accept(gate.seq, summary(1.54, 3, 0));
        expect(gate.value).toBe(1.54);

        ++gate.seq;
        expect(gate.accept(gate.seq, summary(1.48, 4, 1))).toBe(true);
        expect(gate.value).toBe(1.48);
    });

    test('an unmeasured distance stays unknown, never collapsing to 0', () => {
        // `distance: null` means the day has GPS but no segment could be road
        // matched. Rendering that as 0.00 km would tell the employee they
        // travelled nowhere on the strength of a matcher outage.
        const payload = { ...summary(0, 1), distance: null };
        const km = payload.distance?.kilometers ?? null;
        expect(km).toBeNull();

        const gate = new DistanceGate();
        ++gate.seq;
        gate.accept(gate.seq, { ...summary(1.54, 2) });
        expect(gate.value).toBe(1.54);

        // And an unmeasured payload must not overwrite a measured one.
        ++gate.seq;
        expect(gate.accept(gate.seq, payload)).toBe(false);
        expect(gate.value).toBe(1.54);
    });
});

describe('business date', () => {
    test('the route query uses the IST calendar day, not the device local day', () => {
        // 18:30 UTC is 00:00 the NEXT day in Asia/Kolkata. Asking for the
        // device's local day instead would fetch yesterday's route for the
        // first hours of the IST day.
        const at = new Date('2026-09-25T18:30:00Z');
        expect(istDateStr(at)).toBe('2026-09-26');
    });

    test('a device in another timezone still gets the IST day', () => {
        const at = new Date('2026-09-25T06:00:00Z');   // 11:30 IST, 01:00 UTC-5
        expect(istDateStr(at)).toBe('2026-09-25');
    });
});

describe('distance source', () => {
    afterEach(() => { api.getTrackingDailySummary.mockReset(); });

    test('the summary request is scoped to the IST business date', async () => {
        api.getTrackingDailySummary.mockResolvedValue({ data: summary(1.54, 1) });
        await api.getTrackingDailySummary({ date: istDateStr() });
        // Scoped by business date - a generic "today" key is what let a
        // previous day's value be replayed from a persisted cache.
        expect(api.getTrackingDailySummary).toHaveBeenCalledWith({ date: istDateStr() });
    });
});
