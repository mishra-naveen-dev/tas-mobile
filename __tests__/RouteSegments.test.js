import { routeSegmentsFrom, segmentCoords, pointCoords } from '../src/utils/gpsUtils';

// §9: the drawn track is ONE Polyline per continuous run — a gap (session
// boundary / > max_gap_minutes) is a visible break, never a bridging line.
describe('routeSegmentsFrom', () => {
  test('prefers backend route_segments as-is (validated, already split)', () => {
    const data = {
      route_segments: [
        [{ lat: 23.0, lng: 72.0 }, { lat: 23.01, lng: 72.0 }],
        [{ lat: 23.05, lng: 72.0 }],
      ],
    };
    const runs = routeSegmentsFrom(data, [{ lat: 9, lng: 9 }]);
    expect(runs.length).toBe(2);
    expect(runs[0]).toEqual([
      { latitude: 23.0, longitude: 72.0 },
      { latitude: 23.01, longitude: 72.0 },
    ]);
    expect(runs[1]).toEqual([{ latitude: 23.05, longitude: 72.0 }]);
  });

  test('fallback splits at > 15 min — never one flat line across the gap', () => {
    const base = Date.now() - 6 * 3600 * 1000;
    const pts = [
      { lat: 23.0, lng: 72.0, timestamp: base },
      { lat: 23.01, lng: 72.0, timestamp: base + 5 * 60000 },
      // 3-hour GPS gap — must become a segment boundary
      { lat: 23.05, lng: 72.0, timestamp: base + 185 * 60000 },
      { lat: 23.06, lng: 72.0, timestamp: base + 190 * 60000 },
    ];
    const runs = routeSegmentsFrom(null, pts);
    expect(runs.length).toBe(2);
    expect(runs[0].length).toBe(2);
    expect(runs[1].length).toBe(2);
  });

  test('honors max_gap_minutes from the response', () => {
    const base = Date.now() - 3 * 3600 * 1000;
    const pts = [
      { lat: 23.0, lng: 72.0, timestamp: base },
      { lat: 23.01, lng: 72.0, timestamp: base + 30 * 60000 },   // 30 min apart
    ];
    expect(routeSegmentsFrom({ max_gap_minutes: 15 }, pts).length).toBe(2);
    expect(routeSegmentsFrom({ max_gap_minutes: 60 }, pts).length).toBe(1);
  });

  test('sorts newest-first input chronologically before splitting', () => {
    const base = Date.now() - 3 * 3600 * 1000;
    const desc = [
      { lat: 23.02, lng: 72.0, timestamp: base + 20 * 60000 },
      { lat: 23.0, lng: 72.0, timestamp: base },
      { lat: 23.01, lng: 72.0, timestamp: base + 10 * 60000 },
    ];
    const runs = routeSegmentsFrom(null, desc);
    expect(runs.length).toBe(1);
    expect(runs[0].map(p => p.latitude)).toEqual([23.0, 23.01, 23.02]);
  });

  test('drops unusable rows; empty input → []', () => {
    expect(routeSegmentsFrom(null, [])).toEqual([]);
    const runs = routeSegmentsFrom(null, [
      { lat: 23.0, lng: 72.0, timestamp: Date.now() },
      { lat: null, lng: null, timestamp: Date.now() },
      { lat: 0, lng: 0, timestamp: Date.now() },
    ]);
    expect(runs).toEqual([[{ latitude: 23.0, longitude: 72.0 }]]);
  });

  test('segmentCoords / pointCoords handle every key shape', () => {
    expect(segmentCoords([{ latitude: '23.5', longitude: '72.5' }])).toEqual([
      { latitude: 23.5, longitude: 72.5 },
    ]);
    expect(pointCoords({ lat: 999, lng: 0 })).toBeNull();   // out of range
    expect(pointCoords({ lat: 0, lng: 0 })).toBeNull();      // null island
    expect(pointCoords(null)).toBeNull();
  });
});
