// Pub-sub for server connectivity state.
// API module calls setOffline/setOnline; UI components subscribe to changes.
//
// Public shape (_online/_cachedAt/setOffline/setOnline/subscribe) is
// unchanged for existing callers. Internally this also tracks the fuller
// state a device can actually be in - NETWORK_AVAILABLE (device has a
// network interface) is not the same as SERVER_REACHABLE/ONLINE (the API
// actually answered), and a device can be NETWORK_AVAILABLE with the
// server unreachable for a while before either resolves. See
// CONNECTIVITY_STATE for the explicit states.
import NetInfo from '@react-native-community/netinfo';

const listeners = new Set();

export const CONNECTIVITY_STATE = {
    UNKNOWN: 'UNKNOWN',
    NETWORK_AVAILABLE: 'NETWORK_AVAILABLE',   // has a network interface, server not yet confirmed
    ONLINE: 'ONLINE',                          // server confirmed reachable
    SUSPECT_OFFLINE: 'SUSPECT_OFFLINE',        // a request failed or no network at all
};

export const serverStatus = {
    _online: true,
    _cachedAt: null,
    _networkAvailable: true,
    _state: CONNECTIVITY_STATE.UNKNOWN,

    subscribe(fn) {
        listeners.add(fn);
        fn(this._snapshot());
        return () => listeners.delete(fn);
    },

    _snapshot() {
        return {
            online: this._online, cachedAt: this._cachedAt,
            state: this._state, networkAvailable: this._networkAvailable,
        };
    },

    _notify() {
        const snap = this._snapshot();
        listeners.forEach(fn => fn(snap));
    },

    // Fed by the module-level NetInfo listener below - "no network interface
    // at all" is a stronger, more immediate signal than a timed-out request.
    setNetworkAvailable(available) {
        if (this._networkAvailable === available) return;
        this._networkAvailable = available;
        if (!available) {
            this._online = false;
            this._state = CONNECTIVITY_STATE.SUSPECT_OFFLINE;
            this._notify();
        } else if (this._state !== CONNECTIVITY_STATE.ONLINE) {
            this._state = CONNECTIVITY_STATE.NETWORK_AVAILABLE;
            this._notify();
        }
    },

    setOffline(cachedAt) {
        const changed = this._online || this._cachedAt !== cachedAt
            || this._state !== CONNECTIVITY_STATE.SUSPECT_OFFLINE;
        this._online = false;
        this._cachedAt = cachedAt;
        this._state = CONNECTIVITY_STATE.SUSPECT_OFFLINE;
        if (changed) this._notify();
    },

    setOnline() {
        const changed = !this._online || this._state !== CONNECTIVITY_STATE.ONLINE;
        this._online = true;
        this._cachedAt = null;
        this._state = CONNECTIVITY_STATE.ONLINE;
        if (changed) this._notify();
    },
};

NetInfo.addEventListener((state) => {
    serverStatus.setNetworkAvailable(!!state.isConnected && state.isInternetReachable !== false);
});
