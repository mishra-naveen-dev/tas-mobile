import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../monitoring/Logger';

const SSE_TOKEN_KEY = '@sse_token';
const SSE_RECONNECT_DELAY = 3000;
const SSE_MAX_RETRIES = 5;

class SSEService {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.isConnected = false;
    this.baseUrl = 'https://api.tas.namracred.co.in';
  }

  // ==================== EVENT TYPES ====================

  static Events = {
    PUNCH_CREATED: 'punch:created',
    PUNCH_UPDATED: 'punch:updated',
    TRACKING_UPDATE: 'tracking:update',
    NOTIFICATION: 'notification',
    ALLOWANCE_UPDATE: 'allowance:update',
    CORRECTION_UPDATE: 'correction:update',
    DEVICE_STATUS: 'device:status',
    SYSTEM_ALERT: 'system:alert',
    CONNECTION_STATUS: 'connection:status',
  };

  // ==================== LISTENERS ====================

  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
      }
    };
  }

  removeEventListener(event, callback) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  emit(event, data) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error('Error in SSE event listener', { event, error });
        }
      });
    }

    // Also emit to 'all' listeners
    const allListeners = this.listeners.get('*');
    if (allListeners) {
      allListeners.forEach(callback => {
        try {
          callback({ event, data });
        } catch (error) {
          logger.error('Error in SSE wildcard listener', { event, error });
        }
      });
    }
  }

  // ==================== CONNECTION ====================

  async connect() {
    if (this.isConnecting || this.isConnected) {
      logger.info('SSE already connected or connecting');
      return;
    }

    try {
      this.isConnecting = true;
      const token = await AsyncStorage.getItem('access');

      if (!token) {
        logger.warn('No token available for SSE connection');
        this.isConnecting = false;
        return;
      }

      // For React Native, we'll use polling instead of native EventSource
      // since EventSource has limited support
      await this.startPolling(token);

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit(SSEService.Events.CONNECTION_STATUS, { status: 'connected' });
      logger.info('SSE connected successfully');

    } catch (error) {
      logger.error('Failed to connect SSE', { error });
      this.handleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  async startPolling(token) {
    // Store polling interval ID
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Poll every 10 seconds for updates
    this.pollingInterval = setInterval(async () => {
      try {
        const data = await this.fetchUpdates(token);
        if (data) {
          this.processUpdates(data);
        }
      } catch (error) {
        if (error.response?.status === 401) {
          this.handleReconnect();
        }
      }
    }, 10000);

    // Initial fetch
    const initialData = await this.fetchUpdates(token);
    if (initialData) {
      this.processUpdates(initialData);
    }
  }

  async fetchUpdates(token) {
    try {
      const api = require('../../api/api').default;
      const response = await api.get('/sse/updates/', {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      return response.data;
    } catch (error) {
      // Silently fail polling
      return null;
    }
  }

  processUpdates(data) {
    if (data.punches) {
      data.punches.forEach(punch => {
        this.emit(SSEService.Events.PUNCH_UPDATED, punch);
      });
    }

    if (data.notifications) {
      data.notifications.forEach(notification => {
        this.emit(SSEService.Events.NOTIFICATION, notification);
      });
    }

    if (data.tracking) {
      this.emit(SSEService.Events.TRACKING_UPDATE, data.tracking);
    }

    if (data.allowance) {
      this.emit(SSEService.Events.ALLOWANCE_UPDATE, data.allowance);
    }

    if (data.correction) {
      this.emit(SSEService.Events.CORRECTION_UPDATE, data.correction);
    }
  }

  disconnect() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.emit(SSEService.Events.CONNECTION_STATUS, { status: 'disconnected' });
    logger.info('SSE disconnected');
  }

  handleReconnect() {
    if (this.reconnectAttempts >= SSE_MAX_RETRIES) {
      logger.error('Max SSE reconnect attempts reached');
      this.emit(SSEService.Events.CONNECTION_STATUS, { status: 'failed' });
      return;
    }

    this.reconnectAttempts++;
    this.isConnected = false;
    
    logger.info(`SSE reconnect attempt ${this.reconnectAttempts}/${SSE_MAX_RETRIES}`);
    
    setTimeout(() => {
      this.connect();
    }, SSE_RECONNECT_DELAY * this.reconnectAttempts);
  }

  // ==================== EMIT EVENTS ====================

  emitPunchCreated(punch) {
    this.emit(SSEService.Events.PUNCH_CREATED, punch);
  }

  emitPunchUpdated(punch) {
    this.emit(SSEService.Events.PUNCH_UPDATED, punch);
  }

  emitTrackingUpdate(tracking) {
    this.emit(SSEService.Events.TRACKING_UPDATE, tracking);
  }

  emitNotification(notification) {
    this.emit(SSEService.Events.NOTIFICATION, notification);
  }

  emitSystemAlert(alert) {
    this.emit(SSEService.Events.SYSTEM_ALERT, alert);
  }

  // ==================== STATUS ====================

  getStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      eventCount: this.listeners.size,
    };
  }
}

export const sseService = new SSEService();
export default sseService;
