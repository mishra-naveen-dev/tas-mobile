/**
 * isServerUnreachable(err) is what keeps api.js's 401 -> refresh-token flow
 * from treating "the refresh call couldn't reach the server" (network
 * failure, or a 502/503/504 gateway error) the same as "the refresh token
 * is genuinely invalid" - only the latter should ever force a logout. See
 * the catch block around the token-refresh call in api.js for where this
 * actually matters: a field employee's access token expiring while they're
 * in a connectivity dead zone must not force-log them out.
 */
import { isServerUnreachable } from '../src/utils/isServerUnreachable';

describe('isServerUnreachable', () => {
    test('no response at all (network failure) is unreachable', () => {
        expect(isServerUnreachable({ message: 'Network Error' })).toBe(true);
    });

    test.each([502, 503, 504])('a %i gateway error is unreachable', (status) => {
        expect(isServerUnreachable({ response: { status } })).toBe(true);
    });

    test('a genuine 401 (invalid refresh token) is not "unreachable"', () => {
        expect(isServerUnreachable({ response: { status: 401 } })).toBe(false);
    });

    test('a genuine 400 (malformed refresh request) is not "unreachable"', () => {
        expect(isServerUnreachable({ response: { status: 400 } })).toBe(false);
    });
});
