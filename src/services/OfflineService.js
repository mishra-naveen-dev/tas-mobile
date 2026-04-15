// src/services/OfflineService.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const STORAGE_PREFIX = '@tas_cache_';

class OfflineService {
    static isOnline = true;
    static listeners = [];

    static async init() {
        const unsubscribe = NetInfo.addEventListener(state => {
            const wasOnline = this.isOnline;
            this.isOnline = state.isConnected && state.isInternetReachable !== false;

            if (!wasOnline && this.isOnline) {
                this.notifyListeners('ONLINE');
            } else if (wasOnline && !this.isOnline) {
                this.notifyListeners('OFFLINE');
            }
        });

        const state = await NetInfo.fetch();
        this.isOnline = state.isConnected && state.isInternetReachable !== false;

        return () => unsubscribe();
    }

    static addConnectionListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    static notifyListeners(event) {
        this.listeners.forEach(callback => callback(event));
    }

    static async getNetworkStatus() {
        const state = await NetInfo.fetch();
        return {
            isConnected: state.isConnected,
            isInternetReachable: state.isInternetReachable,
            type: state.type
        };
    }

    static async get(key, options = {}) {
        const {
            maxAge = CACHE_DURATION,
            fallback = null
        } = options;

        try {
            const storageKey = STORAGE_PREFIX + key;
            const cached = await AsyncStorage.getItem(storageKey);

            if (!cached) {
                return { data: fallback, isCached: false, isStale: true };
            }

            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            const isStale = age > maxAge;

            return {
                data,
                isCached: true,
                isStale,
                age,
                timestamp
            };
        } catch (error) {
            console.log(`[OfflineService] Get error for ${key}:`, error);
            return { data: fallback, isCached: false, isStale: true };
        }
    }

    static async set(key, data, options = {}) {
        const {
            metadata = {}
        } = options;

        try {
            const storageKey = STORAGE_PREFIX + key;
            const cacheEntry = {
                data,
                timestamp: Date.now(),
                metadata
            };

            await AsyncStorage.setItem(storageKey, JSON.stringify(cacheEntry));
            return true;
        } catch (error) {
            console.log(`[OfflineService] Set error for ${key}:`, error);
            return false;
        }
    }

    static async remove(key) {
        try {
            await AsyncStorage.removeItem(STORAGE_PREFIX + key);
            return true;
        } catch (error) {
            console.log(`[OfflineService] Remove error for ${key}:`, error);
            return false;
        }
    }

    static async clear(pattern = null) {
        try {
            const keys = await AsyncStorage.getAllKeys();

            if (pattern) {
                const matchingKeys = keys.filter(k =>
                    k.startsWith(STORAGE_PREFIX) && k.includes(pattern)
                );
                await AsyncStorage.multiRemove(matchingKeys);
            } else {
                const cacheKeys = keys.filter(k => k.startsWith(STORAGE_PREFIX));
                await AsyncStorage.multiRemove(cacheKeys);
            }

            return true;
        } catch (error) {
            console.log('[OfflineService] Clear error:', error);
            return false;
        }
    }

    static async getMultiple(keys) {
        const results = {};
        for (const key of keys) {
            const result = await this.get(key);
            results[key] = result.data;
        }
        return results;
    }

    static async setMultiple(items) {
        for (const { key, data, options } of items) {
            await this.set(key, data, options);
        }
    }

    static async getCacheInfo() {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(k => k.startsWith(STORAGE_PREFIX));

            const cacheItems = [];
            let totalSize = 0;

            for (const key of cacheKeys) {
                const item = await AsyncStorage.getItem(key);
                if (item) {
                    const { timestamp, metadata } = JSON.parse(item);
                    const size = new Blob([item]).size;
                    totalSize += size;

                    cacheItems.push({
                        key: key.replace(STORAGE_PREFIX, ''),
                        timestamp,
                        age: Date.now() - timestamp,
                        metadata
                    });
                }
            }

            return {
                itemCount: cacheItems.length,
                totalSize,
                items: cacheItems.sort((a, b) => b.timestamp - a.timestamp)
            };
        } catch (error) {
            console.log('[OfflineService] Cache info error:', error);
            return { itemCount: 0, totalSize: 0, items: [] };
        }
    }

    static async pruneExpired(maxAge = CACHE_DURATION) {
        try {
            const info = await this.getCacheInfo();
            let prunedCount = 0;

            for (const item of info.items) {
                if (item.age > maxAge) {
                    await this.remove(item.key);
                    prunedCount++;
                }
            }

            console.log(`[OfflineService] Pruned ${prunedCount} expired items`);
            return prunedCount;
        } catch (error) {
            console.log('[OfflineService] Prune error:', error);
            return 0;
        }
    }
}

// Cache key constants
export const CacheKeys = {
    DASHBOARD_SUMMARY: 'dashboard_summary',
    TODAY_PUNCHES: 'today_punches',
    PUNCH_HISTORY: 'punch_history',
    ALLOWANCE_HISTORY: 'allowance_history',
    DAILY_SUMMARY: 'daily_summary',
    USER_PROFILE: 'user_profile',
    LAST_LOCATION: 'last_location',
    PENDING_PUNCHES: 'pending_punches',
    PENDING_ALLOWANCES: 'pending_allowances',
    DEVICE_INFO: 'device_info'
};

export default OfflineService;
