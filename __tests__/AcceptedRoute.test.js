import { buildAcceptedRoute, haversineKm, filterGpsOutliers, trackingPhase, formatRemaining } from '../src/utils/gpsUtils';

describe('buildAcceptedRoute', () => {
  const now = Date.now();
  const pt = (lat, lng, s, extra = {}) => ({ lat, lng, timestamp: now + s * 1000, ...extra });

  test('A: stationary 30 min with wander noise -> 1 accepted, 0 km', () => {
    // GPS wander oscillates around the true spot (not a monotonic walk):
    // ±0.0002° ≈ ±22m per axis around the anchor.
    const wander = [0.0001, -0.00015, 0.0002, -0.0001, 0.00005, -0.0002, 0.00015, -0.00005];
    const pts = Array.from({ length: 30 }, (_, i) => {
      const w = wander[i % wander.length];
      return pt(23.0 + w, 74.0 - w, i * 60);
    });
    const r = buildAcceptedRoute(pts);
    expect(r.accepted.length).toBe(1);
    expect(r.acceptedDistanceKm).toBe(0);
    expect(r.zones.length).toBe(1);
    expect(r.zones[0].rawCount).toBe(30);
    expect(r.filteredCount).toBe(29);
  });

  test('B: 50m move stays under radius -> 0 km', () => {
    const r = buildAcceptedRoute([pt(23.0, 74.0, 0), pt(23.0004, 74.0, 300)]);
    expect(r.acceptedDistanceKm).toBe(0);
  });

  test('C: 500m move captured', () => {
    const r = buildAcceptedRoute([pt(23.0, 74.0, 0), pt(23.0045, 74.0, 600)]);
    expect(r.accepted.length).toBe(2);
    expect(r.acceptedDistanceKm).toBeGreaterThan(0.4);
    expect(r.acceptedDistanceKm).toBeLessThan(0.6);
  });

  test('D: 5km move approximately correct', () => {
    const r = buildAcceptedRoute([pt(23.0, 74.0, 0), pt(23.045, 74.0, 1800)]);
    expect(r.acceptedDistanceKm).toBeGreaterThan(4.5);
    expect(r.acceptedDistanceKm).toBeLessThan(5.5);
  });

  test('E: 2km jump-and-return in seconds excluded', () => {
    const r = buildAcceptedRoute([
      pt(23.0, 74.0, 0), pt(23.018, 74.0, 5), pt(23.0, 74.0, 65),
    ]);
    expect(r.acceptedDistanceKm).toBe(0);
    expect(r.accepted.length).toBe(1);
  });

  test('I: poor-accuracy fix filtered, same spot stays 0', () => {
    const r = buildAcceptedRoute([
      pt(23.0, 74.0, 0, { accuracy: 10 }),
      pt(23.0001, 74.0001, 30, { accuracy: 500 }),
      pt(23.0, 74.0, 60, { accuracy: 12 }),
    ]);
    expect(r.acceptedDistanceKm).toBe(0);
    expect(r.filteredCount).toBe(2);
  });

  test('J: two zones with real movement between', () => {
    const zone1 = Array.from({ length: 5 }, (_, i) => pt(23.0 + i * 0.00001, 74.0, i * 60));
    const zone2 = Array.from({ length: 5 }, (_, i) => pt(23.00315 + i * 0.00001, 74.0, 1800 + i * 60));
    const r = buildAcceptedRoute([...zone1, ...zone2]);
    expect(r.zones.length).toBe(2);
    expect(r.accepted.length).toBe(2);
    expect(r.acceptedDistanceKm).toBeGreaterThan(0.3);
    expect(r.acceptedDistanceKm).toBeLessThan(0.4);
  });

  test('same coords, fresh timestamps are valid (no movement required)', () => {
    const r = buildAcceptedRoute([pt(23.025569, 74.02136, 0), pt(23.025571, 74.021362, 900)]);
    expect(r.accepted.length).toBe(1);
    expect(r.acceptedDistanceKm).toBe(0);
  });

  test('legacy filter exports still work', () => {
    expect(haversineKm(23, 74, 23.0045, 74)).toBeGreaterThan(0.4);
    expect(filterGpsOutliers([{ lat: 23, lng: 74 }, { lat: 23.1, lng: 74 }]).length).toBe(1);
  });
});

describe('trackingPhase', () => {
  // 08:00 IST start -> 11h mark 19:00 IST, auto-close 21:30 IST (UTC instants).
  const start = Date.parse('2026-09-01T02:30:00Z');
  const maxEnd = Date.parse('2026-09-01T13:30:00Z');
  const absEnd = Date.parse('2026-09-01T16:00:00Z');
  const marks = { startIso: new Date(start).toISOString(), maxDurationEndsAt: new Date(maxEnd).toISOString(), absoluteExpiresAt: new Date(absEnd).toISOString() };

  test('ACTIVE before 11h with remaining grace', () => {
    const r = trackingPhase(marks, Date.parse('2026-09-01T06:30:00Z'));
    expect(r.phase).toBe('ACTIVE');
    expect(r.remainingGraceSec).toBe(7 * 3600);
  });

  test('GRACE between 11h and 13.5h with remaining close', () => {
    const r = trackingPhase(marks, Date.parse('2026-09-01T13:30:00Z'));
    expect(r.phase).toBe('GRACE');
    expect(r.remainingCloseSec).toBe(2 * 3600 + 1800);
  });

  test('EXPIRED at 13.5h boundary', () => {
    const r = trackingPhase(marks, absEnd);
    expect(r.phase).toBe('EXPIRED');
    expect(r.remainingCloseSec).toBe(0);
  });

  test('missing marks fall back to start + defaults', () => {
    const r = trackingPhase({ startIso: marks.startIso }, start + 3600 * 1000);
    expect(r.phase).toBe('ACTIVE');
    const r2 = trackingPhase({ startIso: marks.startIso }, start + 12 * 3600 * 1000);
    expect(r2.phase).toBe('GRACE');
  });

  test('formatRemaining labels', () => {
    expect(formatRemaining(7380)).toBe('2h 03m');
    expect(formatRemaining(1500)).toBe('25m');
    expect(formatRemaining(45)).toBe('45s');
  });
});
