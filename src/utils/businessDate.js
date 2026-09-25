/**
 * The BUSINESS DATE used for every route query.
 *
 * The backend buckets LiveSession rows by `timezone.localdate()` under
 * TIME_ZONE='Asia/Kolkata', so the day a route belongs to is the IST calendar
 * day of the fix - not the phone's local day. A field officer in a different
 * timezone, or any phone whose clock zone is wrong, would otherwise ask for
 * yesterday's (or tomorrow's) route and be shown an empty or mis-dated day.
 *
 * `en-CA` formats as YYYY-MM-DD, which is exactly what the API expects.
 */

export const IST_TZ = 'Asia/Kolkata';

/** YYYY-MM-DD business date (IST) of `d` (default: now). */
export function istDateStr(d = new Date()) {
    return new Date(d).toLocaleDateString('en-CA', { timeZone: IST_TZ });
}

/** Local-timezone YYYY-MM-DD — only for UI that is explicitly about the
 *  device's own calendar, never for a route query. */
export function localDateStr(d = new Date()) {
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
