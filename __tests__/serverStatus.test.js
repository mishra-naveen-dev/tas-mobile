/**
 * The connectivity state machine (CONNECTIVITY_STATE: UNKNOWN ->
 * NETWORK_AVAILABLE -> ONLINE, with SUSPECT_OFFLINE on failure/no network)
 * layered onto serverStatus without changing its existing public shape
 * (_online/_cachedAt/setOffline/setOnline/subscribe), which api.js's
 * interceptors and LiveTrackingService's offline gate already rely on.
 */

const { serverStatus, CONNECTIVITY_STATE } = require('../src/utils/serverStatus');

describe('serverStatus connectivity state', () => {
    beforeEach(() => {
        serverStatus._online = true;
        serverStatus._cachedAt = null;
        serverStatus._networkAvailable = true;
        serverStatus._state = CONNECTIVITY_STATE.UNKNOWN;
    });

    test('setOffline still flips the legacy _online flag (existing callers unaffected)', () => {
        serverStatus.setOffline(12345);
        expect(serverStatus._online).toBe(false);
        expect(serverStatus._cachedAt).toBe(12345);
        expect(serverStatus._state).toBe(CONNECTIVITY_STATE.SUSPECT_OFFLINE);
    });

    test('setOnline clears offline state and marks ONLINE', () => {
        serverStatus.setOffline(1);
        serverStatus.setOnline();
        expect(serverStatus._online).toBe(true);
        expect(serverStatus._cachedAt).toBeNull();
        expect(serverStatus._state).toBe(CONNECTIVITY_STATE.ONLINE);
    });

    test('losing the network interface forces SUSPECT_OFFLINE even without a failed request', () => {
        serverStatus.setOnline();
        serverStatus.setNetworkAvailable(false);
        expect(serverStatus._online).toBe(false);
        expect(serverStatus._state).toBe(CONNECTIVITY_STATE.SUSPECT_OFFLINE);
    });

    test('network returning moves to NETWORK_AVAILABLE, not straight to ONLINE (server not yet confirmed)', () => {
        serverStatus.setNetworkAvailable(false);
        serverStatus.setNetworkAvailable(true);
        expect(serverStatus._state).toBe(CONNECTIVITY_STATE.NETWORK_AVAILABLE);
        expect(serverStatus._online).toBe(false);
    });

    test('subscribe fires immediately with the current snapshot, including the new fields', () => {
        serverStatus.setOnline();
        const snapshots = [];
        const unsub = serverStatus.subscribe((s) => snapshots.push(s));
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]).toMatchObject({ online: true, state: CONNECTIVITY_STATE.ONLINE });
        unsub();
    });
});
