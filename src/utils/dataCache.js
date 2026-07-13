import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'tas_cache_';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — stale is still better than nothing

export async function cacheWrite(key, data) {
    try {
        await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
    } catch (_) {}
}

export async function cacheRead(key) {
    try {
        const raw = await AsyncStorage.getItem(PREFIX + key);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts > TTL_MS) {
            await AsyncStorage.removeItem(PREFIX + key);
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
