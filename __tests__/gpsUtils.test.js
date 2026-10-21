/**
 * routeSegmentsFrom() only ever draws road-matched geometry - a segment
 * whose match failed contributes nothing to it. unverifiedSegmentsFrom() is
 * the deliberate fallback: that same segment's own raw_points (its already
 * noise-filtered, gap-split accepted GPS trail), so a day whose road-match
 * failed still shows something instead of a blank map even though the GPS
 * data already synced - see RouteMapScreen.js for how the two are drawn
 * together (solid blue vs dashed gray), never as an either/or.
 */
import { routeSegmentsFrom, unverifiedSegmentsFrom } from '../src/utils/gpsUtils';

const matchedSegment = {
    segment_id: 1,
    points: [{ lat: 23.03, lng: 72.55 }, { lat: 23.031, lng: 72.551 }],
    raw_points: [],
};

const unmatchedSegment = {
    segment_id: 2,
    points: [],
    raw_points: [{ lat: 23.04, lng: 72.56 }, { lat: 23.041, lng: 72.561 }, { lat: 23.042, lng: 72.562 }],
};

describe('routeSegmentsFrom', () => {
    test('draws only the matched segment, never the unmatched one\'s raw_points', () => {
        const runs = routeSegmentsFrom({ trusted_route_segments: [matchedSegment, unmatchedSegment] });
        expect(runs).toHaveLength(1);
        expect(runs[0]).toHaveLength(2);
    });

    test('returns empty when no segments at all', () => {
        expect(routeSegmentsFrom({ trusted_route_segments: [] })).toEqual([]);
        expect(routeSegmentsFrom({})).toEqual([]);
    });
});

describe('unverifiedSegmentsFrom', () => {
    test('draws only the unmatched segment\'s raw_points, never the matched one\'s geometry', () => {
        const runs = unverifiedSegmentsFrom({ trusted_route_segments: [matchedSegment, unmatchedSegment] });
        expect(runs).toHaveLength(1);
        expect(runs[0]).toHaveLength(3);
    });

    test('a segment with only 1 raw point is dropped (cannot draw a line)', () => {
        const onePointSegment = { segment_id: 3, points: [], raw_points: [{ lat: 23.05, lng: 72.57 }] };
        const runs = unverifiedSegmentsFrom({ trusted_route_segments: [onePointSegment] });
        expect(runs).toEqual([]);
    });

    test('returns empty when every segment matched (nothing unverified to show)', () => {
        const runs = unverifiedSegmentsFrom({ trusted_route_segments: [matchedSegment] });
        expect(runs).toEqual([]);
    });

    test('returns empty when no segments at all', () => {
        expect(unverifiedSegmentsFrom({ trusted_route_segments: [] })).toEqual([]);
        expect(unverifiedSegmentsFrom({})).toEqual([]);
    });
});
