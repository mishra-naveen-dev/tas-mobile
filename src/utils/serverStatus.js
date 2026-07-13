// Lightweight pub-sub for server online/offline state.
// API module calls setOffline/setOnline; UI components subscribe to changes.

const listeners = new Set();

export const serverStatus = {
    _online: true,
    _cachedAt: null,

    subscribe(fn) {
        listeners.add(fn);
        fn({ online: this._online, cachedAt: this._cachedAt });
        return () => listeners.delete(fn);
    },

    setOffline(cachedAt) {
        if (!this._online && this._cachedAt === cachedAt) return; // no change
        this._online = false;
        this._cachedAt = cachedAt;
        listeners.forEach(fn => fn({ online: false, cachedAt }));
    },

    setOnline() {
        if (this._online) return; // no change
        this._online = true;
        this._cachedAt = null;
        listeners.forEach(fn => fn({ online: true, cachedAt: null }));
    },
};
