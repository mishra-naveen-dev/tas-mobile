import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../monitoring/Logger';

const SYNC_QUEUE_KEY = '@sync_queue';
const CACHE_KEY = '@offline_cache';
const MAX_QUEUE_SIZE = 100;
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = [];
    this.syncInProgress = false;
    
    // Setup online/offline listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  addConnectionListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners(isOnline) {
    this.listeners.forEach(callback => {
      try {
        callback(isOnline);
      } catch (e) {
        console.error('Error in connection listener:', e);
      }
    });
  }

  handleOnline() {
    logger.info('Network: Online');
    this.isOnline = true;
    this.notifyListeners(true);
    this.processQueue();
  }

  handleOffline() {
    logger.warn('Network: Offline');
    this.isOnline = false;
    this.notifyListeners(false);
  }

  // ==================== SYNC QUEUE ====================

  async addToQueue(action) {
    try {
      const queue = await this.getQueue();
      
      const queueItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        action,
        timestamp: new Date().toISOString(),
        retries: 0,
        status: 'pending',
      };

      queue.push(queueItem);
      
      // Limit queue size
      if (queue.length > MAX_QUEUE_SIZE) {
        queue.shift();
      }

      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      logger.info('Added to sync queue', queueItem);
      
      // Try to process immediately if online
      if (this.isOnline) {
        this.processQueue();
      }

      return queueItem;
    } catch (error) {
      logger.error('Failed to add to queue', { error });
      throw error;
    }
  }

  async getQueue() {
    try {
      const queue = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      logger.error('Failed to get queue', { error });
      return [];
    }
  }

  async removeFromQueue(id) {
    try {
      const queue = await this.getQueue();
      const filtered = queue.filter(item => item.id !== id);
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
    } catch (error) {
      logger.error('Failed to remove from queue', { error });
    }
  }

  async updateQueueItem(id, updates) {
    try {
      const queue = await this.getQueue();
      const index = queue.findIndex(item => item.id === id);
      if (index !== -1) {
        queue[index] = { ...queue[index], ...updates };
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      }
    } catch (error) {
      logger.error('Failed to update queue item', { error });
    }
  }

  async processQueue() {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    logger.info('Processing sync queue');

    try {
      const queue = await this.getQueue();
      const pendingItems = queue.filter(item => item.status === 'pending');

      for (const item of pendingItems) {
        try {
          await this.processQueueItem(item);
          await this.removeFromQueue(item.id);
          logger.info('Processed queue item', item);
        } catch (error) {
          const retries = item.retries + 1;
          if (retries >= 3) {
            await this.updateQueueItem(item.id, { status: 'failed', error: error.message });
            logger.error('Queue item failed after 3 retries', { item, error });
          } else {
            await this.updateQueueItem(item.id, { retries, status: 'pending' });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to process queue', { error });
    } finally {
      this.syncInProgress = false;
    }
  }

  async processQueueItem(item) {
    const { action } = item;
    
    switch (action.type) {
      case 'CREATE_PUNCH':
        return this.processCreatePunch(action.payload);
      case 'CREATE_ALLOWANCE':
        return this.processCreateAllowance(action.payload);
      case 'CREATE_CORRECTION':
        return this.processCreateCorrection(action.payload);
      default:
        logger.warn('Unknown action type', { type: action.type });
    }
  }

  async processCreatePunch(payload) {
    const api = require('../../api/api').default;
    const response = await api.createPunchRecord(payload);
    return response;
  }

  async processCreateAllowance(payload) {
    const api = require('../../api/api').default;
    const response = await api.createAllowanceRequest(payload);
    return response;
  }

  async processCreateCorrection(payload) {
    const api = require('../../api/api').default;
    const response = await api.createCorrectionRequest(payload);
    return response;
  }

  async getQueueStatus() {
    const queue = await this.getQueue();
    return {
      total: queue.length,
      pending: queue.filter(i => i.status === 'pending').length,
      failed: queue.filter(i => i.status === 'failed').length,
      processing: this.syncInProgress,
    };
  }

  async clearFailedItems() {
    try {
      const queue = await this.getQueue();
      const filtered = queue.filter(item => item.status !== 'failed');
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
      return filtered.length;
    } catch (error) {
      logger.error('Failed to clear failed items', { error });
      return 0;
    }
  }

  // ==================== CACHE ====================

  async setCache(key, data, expiry = CACHE_EXPIRY) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + expiry,
      };
      await AsyncStorage.setItem(`${CACHE_KEY}_${key}`, JSON.stringify(cacheData));
    } catch (error) {
      logger.error('Failed to set cache', { error, key });
    }
  }

  async getCache(key) {
    try {
      const cached = await AsyncStorage.getItem(`${CACHE_KEY}_${key}`);
      if (!cached) return null;

      const { data, expiry } = JSON.parse(cached);
      
      if (Date.now() > expiry) {
        await this.removeCache(key);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get cache', { error, key });
      return null;
    }
  }

  async removeCache(key) {
    try {
      await AsyncStorage.removeItem(`${CACHE_KEY}_${key}`);
    } catch (error) {
      logger.error('Failed to remove cache', { error, key });
    }
  }

  async clearAllCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_KEY));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      logger.error('Failed to clear all cache', { error });
    }
  }

  async getCacheStats() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_KEY));
      return { count: cacheKeys.length };
    } catch (error) {
      return { count: 0 };
    }
  }
}

export const offlineManager = new OfflineManager();
export default offlineManager;
