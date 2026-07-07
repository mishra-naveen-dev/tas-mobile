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
 * Convenience: filter outliers then return the total distance.
 * Use this when you have raw GPS data from the server.
 */
export function safeDistanceKm(rawPoints, maxSpeedKmh = MAX_SPEED_KMH) {
    return calcTotalDistanceKm(filterGpsOutliers(rawPoints, maxSpeedKmh));
}
