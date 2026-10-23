// True when `err` means the SERVER is unreachable (network failure, or a
// 502/503/504 gateway error) rather than a real rejection from it.
//
// Used by api.js's 401 -> refresh-token interceptor to keep "the refresh
// call couldn't reach the server" from being treated the same as "the
// refresh token is genuinely invalid" - the two look identical as a caught
// exception, but only one of them should ever force a logout. A field
// employee's access token expiring (routine) while they're in a
// connectivity dead zone - this app's entire user base, by definition -
// must not force-log them out on the next API call.
export const isServerUnreachable = (err) =>
    !err?.response || [502, 503, 504].includes(err.response.status);

export default isServerUnreachable;
