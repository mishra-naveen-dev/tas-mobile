import { useState, useCallback, useRef, useMemo } from 'react';
import { offlineManager } from '../core/offline/OfflineManager';

export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({ total: 0, pending: 0, failed: 0 });
  const listenersRef = useRef([]);

  const handleConnectionChange = useCallback((online) => {
    setIsOnline(online);
    listenersRef.current.forEach(callback => callback(online));
  }, []);

  const subscribe = useCallback((callback) => {
    listenersRef.current.push(callback);
    const unsubscribe = offlineManager.addConnectionListener(handleConnectionChange);
    
    return () => {
      listenersRef.current = listenersRef.current.filter(cb => cb !== callback);
      unsubscribe();
    };
  }, [handleConnectionChange]);

  const refreshSyncStatus = useCallback(async () => {
    const status = await offlineManager.getQueueStatus();
    setSyncStatus(status);
    return status;
  }, []);

  const addToSyncQueue = useCallback(async (action) => {
    const item = await offlineManager.addToQueue(action);
    await refreshSyncStatus();
    return item;
  }, [refreshSyncStatus]);

  const clearFailedSync = useCallback(async () => {
    const count = await offlineManager.clearFailedItems();
    await refreshSyncStatus();
    return count;
  }, [refreshSyncStatus]);

  const cacheData = useCallback(async (key, data, expiry) => {
    await offlineManager.setCache(key, data, expiry);
  }, []);

  const getCachedData = useCallback(async (key) => {
    return await offlineManager.getCache(key);
  }, []);

  const clearCache = useCallback(async (key) => {
    if (key) {
      await offlineManager.removeCache(key);
    } else {
      await offlineManager.clearAllCache();
    }
  }, []);

  const value = useMemo(() => ({
    isOnline,
    syncStatus,
    subscribe,
    refreshSyncStatus,
    addToSyncQueue,
    clearFailedSync,
    cacheData,
    getCachedData,
    clearCache,
  }), [isOnline, syncStatus, subscribe, refreshSyncStatus, addToSyncQueue, clearFailedSync, cacheData, getCachedData, clearCache]);

  return value;
};

export default useOffline;
