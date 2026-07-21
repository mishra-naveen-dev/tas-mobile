import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'tas_cache_';
// Ordered (oldest-first) list of live cache keys, used to bound total growth —
// without this, every distinct (url, params) combination ever requested gets
// its own permanent AsyncStorage entry, only removed lazily if that exact key
// is ever read again after expiring. On Android, AsyncStorage is backed by a
// SQLite file on-device; an unbounded cache like that can genuinely grow
// until it hits SQLITE_FULL, which then breaks unrelated writes — including
// storing the login session token, surfacing as "Authentication Failed".
const INDEX_KEY = 'tas_cache_index';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — stale is still better than nothing
const MAX_ENTRIES = 150; // caps local cache growth regardless of device storage

async function readIndex() {
    try {
        const raw = await AsyncStorage.getItem(INDEX_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (_) {
        return [];
    }
}

async function writeIndex(index) {
    try {
        await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
    } catch (_) {}
}

export async function cacheWrite(key, data) {
    try {
        await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
        let index = await readIndex();
        index = index.filter(k => k !== key);
        index.push(key);
        if (index.length > MAX_ENTRIES) {
            const evicted = index.splice(0, index.length - MAX_ENTRIES);
            await Promise.all(evicted.map(k => AsyncStorage.removeItem(PREFIX + k).catch(() => {})));
        }
        await writeIndex(index);
    } catch (_) {}
}

export async function cacheRead(key) {
    try {
        const raw = await AsyncStorage.getItem(PREFIX + key);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts > TTL_MS) {
            await AsyncStorage.removeItem(PREFIX + key);
            const index = await readIndex();
            await writeIndex(index.filter(k => k !== key));
            return null;
        }
        return { data, ts };
    } catch (_) {
        return null;
    }
}

export function makeCacheKey(url, params = {}) {
    const qs = Object.keys(params).length ? JSON.stringify(params) : '';
    return `${url}${qs}`;
}
