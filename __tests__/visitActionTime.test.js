/**
 * Fix Plan 3.1: a visit carries the moment Save was tapped (device_timestamp)
 * plus when its GPS fix was taken (captured_at) and how old that fix was, so
 * several visits saved from one reused fix still get their own times.
 */
jest.mock('../src/api/api', () => ({}));
jest.mock('../src/services/OfflineQueue', () => ({ registerReplayer: jest.fn() }));

const { buildCompleteVisitFormData } = require('../src/utils/collectionVisitRules');

const fields = (fd) => Object.fromEntries(fd._parts || fd.entries());
const build = (localLocation) => fields(buildCompleteVisitFormData({
    form: { status: 'PAID' },
    localLocation: { latitude: 23, longitude: 72, ...localLocation },
}));

test('sends the save time, the fix time and the fix age', () => {
    const out = build({
        device_timestamp: '2026-11-03T09:00:00.000Z',
        captured_at: '2026-11-03T09:00:00.000Z',
        saved_at: '2026-11-03T09:12:30.000Z',
    });
    expect(out.device_timestamp).toBe('2026-11-03T09:12:30.000Z');
    expect(out.captured_at).toBe('2026-11-03T09:00:00.000Z');
    expect(out.location_age_seconds).toBe('750');
});

test('two visits from the same cached fix keep their own save times', () => {
    const fix = { captured_at: '2026-11-03T09:00:00.000Z' };
    const a = build({ ...fix, saved_at: '2026-11-03T09:10:00.000Z' });
    const b = build({ ...fix, saved_at: '2026-11-03T09:11:00.000Z' });
    expect(a.device_timestamp).not.toBe(b.device_timestamp);
    expect(a.captured_at).toBe(b.captured_at);
});

test('a visit queued by an older build (no saved_at) keeps its old timestamp', () => {
    const out = build({ device_timestamp: '2026-11-03T09:00:00.000Z', location_age_seconds: 40 });
    expect(out.device_timestamp).toBe('2026-11-03T09:00:00.000Z');
    expect(out.location_age_seconds).toBe('40');
});
