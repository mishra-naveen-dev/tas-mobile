/**
 * GPS utility helpers — enterprise-grade outlier filtering.
 *
 * Field officers travel by motorcycle / car. Any GPS point that implies a
 * speed above MAX_SPEED_KMH (relative to the previous *accepted* point) is
 * a satellite multipath / NLOS outlier and is dropped.  This keeps the
 * displayed route and cumulative distance accurate even when the device
 * momentarily receives a wildly wrong fix.
 */

const MAX_SPEED_KMH = 120; // realistic upper bound for a field officer

// ─── Accepted-route pipeline (Route Map display) ────────────────────────────
// Mirrors backend apps/livetracking/services.build_accepted_route with the
// same thresholds, so mobile display, web display, and backend ingest all
// apply ONE rule. Raw points are never deleted — excluded ones are counted
// in filteredCount and (optionally) inspectable via zones. Activity
// snapshots (punch/collection visit) are separate records and must never be
// passed through this.
const STATIONARY_RADIUS_M = 50; // same radius as backend STATIONARY_DIST_M
const MIN_MOVEMENT_M = 50;      // steps shorter than this contribute 0 km
const MAX_JUMP_KM = 50;         // single steps beyond this are GPS anomalies
const MIN_JUMP_CHECK_KM = 0.5;  // implied-speed check only beyond this
const MAX_IMPLIED_SPEED_KMH = 250;

/**
 * Cluster one chronological point list into accepted route + stationary zones.
 * Accepts {lat,lng}|{lat,lon}|{latitude,longitude} shapes with timestamp |
 * captured_at (Date, ISO string, or epoch ms/s) and optional accuracy/speed.
 *
 * Returns { accepted, zones, acceptedDistanceKm, rawCount, filteredCount }.
 * Distance is summed ONLY between accepted points — noise inside a stationary
 * radius never inflates it. Same coordinates across activities are valid;
 * each accepted point keeps its own timestamp.
 */
export function buildAcceptedRoute(points, opts = {}) {
    const stationaryRadiusM = opts.stationaryRadiusM ?? STATIONARY_RADIUS_M;
    const minMovementM = opts.minMovementM ?? MIN_MOVEMENT_M;
    const maxSpeedKmh = opts.maxSpeedKmh ?? MAX_SPEED_KMH;

    const input = points || [];
    const getLat = (p) => Number(p.lat ?? p.latitude ?? 0);
    const getLon = (p) => Number(p.lon ?? p.lng ?? p.longitude ?? 0);
    const getTs = (p) => {
        const v = p.timestamp ?? p.captured_at ?? p.ts ?? null;
        if (v == null) return null;
        if (typeof v === 'number') {
            const ms = v > 1e12 ? v : v * 1000;
            const t = new Date(ms).getTime();
            return Number.isNaN(t) ? null : t;
        }
        const t = new Date(v).getTime();
        return Number.isNaN(t) ? null : t;
    };

    const ordered = [...input].sort((a, b) => {
        const ta = getTs(a);
        const tb = getTs(b);
        if (ta == null && tb == null) return 0;
        if (ta == null) return 1;
        if (tb == null) return -1;
        return ta - tb;
    });

    const accepted = [];
    const zones = [];
    let filteredCount = 0;
    let acceptedDistanceKm = 0;
    let zoneSeq = 0;
    let currentZone = null;
    let lastAccepted = null; // { lat, lon, ts }

    const closeZone = () => {
        if (currentZone) {
            currentZone.end = currentZone.lastTs;
            delete currentZone.lastTs;
            zones.push(currentZone);
            currentZone = null;
        }
    };

    for (const p of ordered) {
        const lat = getLat(p);
        const lon = getLon(p);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) { filteredCount += 1; continue; }
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) { filteredCount += 1; continue; }
        if (lat === 0 && lon === 0) { filteredCount += 1; continue; }
        const ts = getTs(p);
        const acc = p.accuracy != null ? Number(p.accuracy) : null;
        const spd = p.speed != null ? Number(p.speed) : null;

        // Accuracy: mark noise, exclude from route, keep counted as raw.
        if (acc != null && Number.isFinite(acc) && acc > 150) { filteredCount += 1; continue; }
        // Reported-speed sanity.
        if (spd != null && Number.isFinite(spd) && spd > maxSpeedKmh) { filteredCount += 1; continue; }

        if (!lastAccepted) {
            zoneSeq += 1;
            currentZone = {
                zoneId: zoneSeq, lat, lon, start: ts, lastTs: ts,
                rawCount: 1, acceptedCount: 1, distanceContributionKm: 0,
            };
            accepted.push({ ...p, lat, lon, timestamp: ts, processedStatus: 'ACCEPTED_ROUTE_POINT', filterReason: '', distanceFromPreviousAcceptedKm: 0, stationaryZoneId: zoneSeq });
            lastAccepted = { lat, lon, ts };
            continue;
        }

        const distKm = haversineKm(lastAccepted.lat, lastAccepted.lon, lat, lon);
        const distM = distKm * 1000;

        // Jump / implied-speed anomaly: never a route segment.
        if (distKm > MAX_JUMP_KM) { filteredCount += 1; continue; }
        if (distKm >= MIN_JUMP_CHECK_KM && ts != null && lastAccepted.ts != null) {
            const deltaS = (ts - lastAccepted.ts) / 1000;
            if (deltaS > 0 && (distKm / deltaS) * 3600 > MAX_IMPLIED_SPEED_KMH) { filteredCount += 1; continue; }
        }

        // Stationary clustering: inside the radius → same zone, 0 km.
        if (distM < stationaryRadiusM && distM < minMovementM) {
            filteredCount += 1;
            if (currentZone) {
                currentZone.rawCount += 1;
                if (ts != null) currentZone.lastTs = ts;
            }
            continue;
        }

        // Real movement: close the zone, add the segment, anchor a new zone.
        closeZone();
        acceptedDistanceKm += distKm;
        zoneSeq += 1;
        currentZone = {
            zoneId: zoneSeq, lat, lon, start: ts, lastTs: ts,
            rawCount: 1, acceptedCount: 1, distanceContributionKm: 0,
        };
        accepted.push({ ...p, lat, lon, timestamp: ts, processedStatus: 'ACCEPTED_ROUTE_POINT', filterReason: '', distanceFromPreviousAcceptedKm: Math.round(distKm * 10000) / 10000, stationaryZoneId: zoneSeq });
        lastAccepted = { lat, lon, ts };
    }
    closeZone();

    return {
        accepted,
        zones,
        acceptedDistanceKm: Math.round(acceptedDistanceKm * 100) / 100,
        rawCount: input.length,
        filteredCount,
    };
}

/**
 * Haversine great-circle distance in kilometres between two lat/lon pairs.
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Remove GPS outlier points using a speed-based forward filter.
 *
 * Each candidate point is compared against the last *accepted* point.
 * If the implied speed exceeds maxSpeedKmh the point is discarded.
 * Points with no timestamp are assumed to be 1 second apart (safe default).
 *
 * Accepts either {lat, lng} or {lat, lon} or {latitude, longitude} shapes.
 *
 * @param {Array<object>} points  — ordered chronologically
 * @param {number}        [maxSpeedKmh=120]
 * @returns {Array<object>}  filtered points (same shape as input)
 */
export function filterGpsOutliers(points, maxSpeedKmh = MAX_SPEED_KMH) {
    if (!points || points.length < 2) return points || [];

    const getLat = (p) => Number(p.lat ?? p.latitude ?? 0);
    const getLon = (p) => Number(p.lon ?? p.lng ?? p.longitude ?? 0);
    const getTs  = (p) => (p.timestamp ? new Date(p.timestamp).getTime() : null);

    const result = [points[0]];

    for (let i = 1; i < points.length; i++) {
        const prev = result[result.length - 1];
        const curr = points[i];

        const distKm = haversineKm(getLat(prev), getLon(prev), getLat(curr), getLon(curr));

        const prevTs = getTs(prev);
        const currTs = getTs(curr);
        // If no timestamps, assume 1-second spacing (avoids ÷0 while still
        // catching huge spatial jumps — 1 s budget = 0.033 km at 120 km/h)
        const timeDeltaHr =
            prevTs != null && currTs != null
                ? Math.max((currTs - prevTs) / 3_600_000, 1 / 3600)
                : 1 / 3600;

        const speedKmh = distKm / timeDeltaHr;

        if (speedKmh <= maxSpeedKmh) {
            result.push(curr);
        }
    }

    return result;
}

/**
 * Sum consecutive Haversine distances over an array of already-filtered points.
 * Returns km rounded to 2 decimal places.
 */
export function calcTotalDistanceKm(points) {
    if (!points || points.length < 2) return 0;

    const getLat = (p) => Number(p.lat ?? p.latitude ?? 0);
    const getLon = (p) => Number(p.lon ?? p.lng ?? p.longitude ?? 0);

    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += haversineKm(getLat(points[i - 1]), getLon(points[i - 1]), getLat(points[i]), getLon(points[i]));
    }
    return Math.round(total * 100) / 100;
}

/**
 * Tracking-session lifecycle phase for display ONLY (the backend watchers
 * remain authoritative for actually closing sessions).
 *
 * Derives ACTIVE (first 11h) → GRACE (11h–13.5h) → EXPIRED (past 13.5h) from
 * the persisted server marks (maxDurationEndsAt/absoluteExpiresAt as ISO
 * strings — absolute instants, so device clock skew cannot drift them; no
 * independent in-app timer is maintained). Missing marks fall back to
 * startIso + defaults so older sessions still report sanely.
 */
export function trackingPhase(marks, nowMs = Date.now()) {
    const toMs = (v) => {
        if (v == null) return null;
        const t = new Date(v).getTime();
        return Number.isNaN(t) ? null : t;
    };
    const DEFAULT_MAX_MIN = 660;   // 11h active tracking
    const DEFAULT_GRACE_MIN = 150; // 2.5h grace
    const startMs = toMs(marks?.startIso);
    let maxEnd = toMs(marks?.maxDurationEndsAt);
    let absEnd = toMs(marks?.absoluteExpiresAt);
    if (maxEnd == null && startMs != null) maxEnd = startMs + DEFAULT_MAX_MIN * 60000;
    if (absEnd == null && startMs != null) absEnd = startMs + (DEFAULT_MAX_MIN + DEFAULT_GRACE_MIN) * 60000;

    let phase = 'ACTIVE';
    if (absEnd != null && nowMs >= absEnd) phase = 'EXPIRED';
    else if (maxEnd != null && nowMs >= maxEnd) phase = 'GRACE';
    return {
        phase,
        remainingGraceSec: maxEnd != null ? Math.max(0, Math.floor((maxEnd - nowMs) / 1000)) : null,
        remainingCloseSec: absEnd != null ? Math.max(0, Math.floor((absEnd - nowMs) / 1000)) : null,
    };
}

/**
 * Compact remaining-time label: 7380s -> '2h 03m', 1500s -> '25m', 45s -> '45s'.
 */
export function formatRemaining(totalSec) {
    if (totalSec == null) return '—';
    const s = Math.max(0, Math.floor(totalSec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
}

/**
 * Convenience: filter outliers then return the total distance.
 * Use this when you have raw GPS data from the server.
 */
export function safeDistanceKm(rawPoints, maxSpeedKmh = MAX_SPEED_KMH) {
    return calcTotalDistanceKm(filterGpsOutliers(rawPoints, maxSpeedKmh));
}

// ─── Gap/session-aware route segments (display) ─────────────────────────────
// Mirrors backend build_accepted_route's `segments`: ONE inner array per
// continuous run — render one Polyline per entry and never a single flat
// line across a gap (no GPS evidence exists for what happened in between).

/** {lat|latitude, lng|lon|longitude} → {latitude, longitude}, or null. */
export function pointCoords(p) {
    const latitude = Number(p?.lat ?? p?.latitude);
    const longitude = Number(p?.lon ?? p?.lng ?? p?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude === 0 && longitude === 0) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return { latitude, longitude };
}

/** One segment/run → [{latitude, longitude}, ...], unusable rows dropped. */
export function segmentCoords(seg) {
    if (!Array.isArray(seg)) return [];
    return seg.map(pointCoords).filter(Boolean);
}

/**
 * Coordinate runs for a daily-route response (§9).
 * PREFER the backend's `route_segments` (validated, split at session
 * boundaries and > max_gap_minutes gaps); fall back to a client-side gap
 * split over `fallback` points on the SAME configured threshold (backend
 * response's max_gap_minutes, else 15 = module default).
 *
 * @param {object|null} data       daily-route response
 * @param {Array}       [fallback] points to split when route_segments absent
 * @returns {Array<Array<{latitude, longitude}>>} chronological coord runs
 */
export function routeSegmentsFrom(data, fallback) {
    if (Array.isArray(data?.route_segments) && data.route_segments.length > 0) {
        return data.route_segments.map(segmentCoords).filter(c => c.length > 0);
    }
    const src = Array.isArray(fallback) ? fallback : [];
    if (src.length === 0) return [];

    const getTs = (p) => {
        const v = p?.timestamp ?? p?.captured_at ?? p?.punched_at ?? null;
        if (v == null) return null;
        if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
        const t = new Date(v).getTime();
        return Number.isNaN(t) ? null : t;
    };

    const gapMs = (Number(data?.max_gap_minutes) > 0 ? Number(data.max_gap_minutes) : 15) * 60000;
    const sorted = [...src].sort((a, b) => (getTs(a) ?? 0) - (getTs(b) ?? 0));

    const runs = [];
    let current = [];
    let prevT = null;
    for (const p of sorted) {
        const t = getTs(p);
        if (current.length > 0 && t != null && prevT != null && t - prevT > gapMs) {
            if (current.length) runs.push(current);
            current = [];
        }
        const c = pointCoords(p);
        if (c) current.push(c);
        if (t != null) prevT = t;
    }
    if (current.length) runs.push(current);
    return runs;
}
