import { routeSegmentsFrom, routeQualityFrom } from '../src/utils/gpsUtils';

// The Route Map draws the BACKEND's trusted geometry and nothing else. These
// tests pin that contract, because the previous implementation rebuilt a line
// on-device: it filtered out one-point segments and then drew the survivors as
// ONE continuous line, which bridged every session boundary and every gap
// between them - the diagonal-line defect.

const run = (id, lats) => ({
    segment_id: id,
    geometry_runs: [lats.map((lat) => ({ lat, lng: 72.0 }))],
    points: lats.map((lat) => ({ lat, lng: 72.0 })),
});

describe('routeSegmentsFrom', () => {
    test('returns one run per continuous piece of road, never a joined list', () => {
        const data = {
            trusted_route_segments: [run(1, [23.0, 23.01]), run(2, [23.2, 23.21])],
        };
        const runs = routeSegmentsFrom(data);
        expect(runs).toHaveLength(2);
        expect(runs[0].map((p) => p.latitude)).toEqual([23.0, 23.01]);
        expect(runs[1].map((p) => p.latitude)).toEqual([23.2, 23.21]);
    });

    test('16 segments and 15 gaps render 16 lines with no shared vertex', () => {
        const segments = Array.from({ length: 16 }, (_, i) => run(i + 1, [23 + i, 23.01 + i]));
        const runs = routeSegmentsFrom({ trusted_route_segments: segments });
        expect(runs).toHaveLength(16);
        for (let i = 0; i < runs.length - 1; i += 1) {
            const here = runs[i].map((p) => p.latitude);
            const next = runs[i + 1].map((p) => p.latitude);
            // Not one vertex is shared: a shared vertex is a drawn connection.
            expect(here.some((lat) => next.includes(lat))).toBe(false);
        }
    });

    test('a segment the matcher split further stays several runs', () => {
        const data = {
            trusted_route_segments: [{
                segment_id: 1,
                geometry_runs: [
                    [{ lat: 23.0, lng: 72.0 }, { lat: 23.1, lng: 72.0 }],
                    [{ lat: 24.0, lng: 73.0 }, { lat: 24.1, lng: 73.0 }],
                ],
                points: [],
            }],
        };
        const runs = routeSegmentsFrom(data);
        expect(runs).toHaveLength(2);
        expect(runs[0].map((p) => p.latitude)).toEqual([23.0, 23.1]);
        expect(runs[1].map((p) => p.latitude)).toEqual([24.0, 24.1]);
    });

    test('draws nothing when the backend could not match the road network', () => {
        // The old fallback answered this case with raw GPS vertices joined by
        // straight lines. An honest "no geometry" is the correct answer.
        const data = {
            geometry_status: 'UNAVAILABLE',
            trusted_route_segments: [{
                segment_id: 1, match_status: 'UNAVAILABLE', points: [], geometry_runs: [],
            }],
            route: [
                { lat: 23.0, lng: 72.0 }, { lat: 23.5, lng: 72.5 },
                { lat: 24.0, lng: 73.0 },
            ],
        };
        expect(routeSegmentsFrom(data)).toEqual([]);
    });

    test('draws nothing for a legacy response with no trusted geometry', () => {
        // Even though it carries raw points and accepted segments, this app
        // must not reconstruct a route: only the backend decides the geometry.
        expect(routeSegmentsFrom({
            route: [{ lat: 23.0, lng: 72.0 }, { lat: 23.1, lng: 72.0 }],
            route_segments: [[{ lat: 23.0, lng: 72.0 }, { lat: 23.1, lng: 72.0 }]],
        })).toEqual([]);
        expect(routeSegmentsFrom(null)).toEqual([]);
    });

    test('a single-fix segment draws no line and is not joined to a neighbour', () => {
        const data = {
            trusted_route_segments: [
                { segment_id: 1, geometry_runs: [[{ lat: 23.0, lng: 72.0 }]], points: [] },
                run(2, [23.5, 23.51]),
            ],
        };
        const runs = routeSegmentsFrom(data);
        expect(runs).toHaveLength(1);
        expect(runs[0].map((p) => p.latitude)).toEqual([23.5, 23.51]);
    });

    test('unusable coordinates inside a run are dropped, not drawn as zero', () => {
        const data = {
            trusted_route_segments: [{
                segment_id: 1,
                geometry_runs: [[
                    { lat: 23.0, lng: 72.0 },
                    { lat: 0, lng: 0 },              // null island
                    { lat: 91, lng: 72.0 },          // out of range
                    { lat: 23.1, lng: 72.0 },
                ]],
                points: [],
            }],
        };
        const runs = routeSegmentsFrom(data);
        expect(runs[0].map((p) => p.latitude)).toEqual([23.0, 23.1]);
    });
});

describe('routeQualityFrom', () => {
    test('reads the backend figures and computes none of them', () => {
        const q = routeQualityFrom({
            geometry_status: 'PARTIAL',
            trusted_distance_km: 1.42,
            valid_points: 234,
            raw_points_count: 240,
            gps_gaps: 15,
            rejected_count: 3,
            low_accuracy_count: 2,
            duplicate_points: 1,
            last_gps_update: '2026-09-25T10:00:00Z',
            tracking_status: 'STALE',
            filter_reason_counts: { LOW_ACCURACY: 2, STATIONARY_NOISE: 4 },
            route: [{}, {}],
            trusted_route_segments: [run(1, [23, 23.01])],
        });
        expect(q).toMatchObject({
            geometryStatus: 'PARTIAL',
            trustedDistanceKm: 1.42,
            validPoints: 234,
            rawPoints: 240,
            gapCount: 15,
            rejectedCount: 3,
            lowAccuracyCount: 2,
            duplicatePoints: 1,
            segmentCount: 1,
            lastGpsUpdate: '2026-09-25T10:00:00Z',
            trackingStatus: 'STALE',
            hasRawEvidence: true,
        });
        expect(q.filterReasonCounts).toEqual({ LOW_ACCURACY: 2, STATIONARY_NOISE: 4 });
    });

    test('a withheld distance stays null rather than falling back to a guess', () => {
        const q = routeQualityFrom({ geometry_status: 'UNAVAILABLE', trusted_distance_km: null });
        expect(q.trustedDistanceKm).toBeNull();
    });
});
