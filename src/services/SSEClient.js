/**
 * SSE (Server-Sent Events) Client for Mobile
 * Handles real-time updates from backend
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';

const { RNRCTEventSource } = NativeModules;

class SSEClient {
  static instance = null;
  static eventListeners = new Map();
  static isConnected = false;
  static reconnectAttempts = 0;
  static maxReconnectAttempts = 5;

  static getInstance() {
    if (!SSEClient.instance) {
      SSEClient.instance = new SSEClient();
    }
    return SSEClient.instance;
  }

  /**
   * Connect to SSE endpoint
   */
  static async connect() {
    try {
      const baseURL = await this.getBaseURL();
      const eventSourceUrl = `${baseURL}/notifications/events/`;
      
      console.log('[SSE] Connecting to:', eventSourceUrl);
      
      // Store connection state
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Start polling for events (simpler for mobile)
      this.startPolling();
      
      return true;
    } catch (error) {
      console.log('[SSE] Connection error:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from SSE
   */
  static disconnect() {
    this.isConnected = false;
    this.stopPolling();
    console.log('[SSE] Disconnected');
  }

  /**
   * Get base URL from storage
   */
  static async getBaseURL() {
    // Use the same base URL as API
    return 'https://tas-backend-8emb.onrender.com/api/v1';
  }

  /**
   * Poll for events (mobile-friendly SSE)
   */
  static pollingInterval = null;
  static lastEventTime = null;

  static startPolling(intervalMs = 5000) {
    if (this.pollingInterval) {
      return;
    }

    console.log('[SSE] Starting polling every', intervalMs / 1000, 'seconds');

    // Poll immediately
    this.pollEvents();

    // Then set interval
    this.pollingInterval = setInterval(() => {
      if (this.isConnected) {
        this.pollEvents();
      }
    }, intervalMs);
  }

  static stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Poll for new events from backend
   */
  static async pollEvents() {
    try {
      // Get events from backend using polling endpoint
      const response = await api.get('/notifications/events/', {
        params: { since: this.lastEventTime }
      });

      if (response?.data?.events) {
        const events = response.data.events;
        
        for (const event of events) {
          this.handleEvent(event);
        }

        if (events.length > 0) {
          this.lastEventTime = events[events.length - 1].timestamp;
        }
      }
    } catch (error) {
      // Silently handle polling errors
      if (!error.message?.includes('404')) {
        console.log('[SSE] Polling error:', error.message);
      }
    }
  }

  /**
   * Handle incoming event
   */
  static handleEvent(event) {
    const eventType = event.type;
    const eventData = event.data;

    console.log('[SSE] Event received:', eventType, eventData);

    // Notify listeners
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(eventData);
        } catch (err) {
          console.log('[SSE] Listener error:', err);
        }
      });
    }

    // Also notify 'all' listeners
    const allListeners = this.eventListeners.get('all');
    if (allListeners) {
      allListeners.forEach(callback => {
        try {
          callback(eventType, eventData);
        } catch (err) {
          console.log('[SSE] All listener error:', err);
        }
      });
    }

    // Show in-app notification for important events
    if (eventType !== 'heartbeat') {
      this.showLocalNotification(eventType, eventData);
    }
  }

  /**
   * Show local notification for event
   */
  static showLocalNotification(eventType, data) {
    // Can be extended with react-native-push-notification
    console.log('[SSE] Notification:', eventType, data);
  }

  /**
   * Subscribe to event
   * @param {string} eventType - Event type to listen for ('all', 'correction_approved', etc.)
   * @param {function} callback - Callback function
   */
  static on(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(callback);
  }

  /**
   * Unsubscribe from event
   * @param {string} eventType - Event type
   * @param {function} callback - Callback to remove
   */
  static off(eventType, callback) {
    if (this.eventListeners.has(eventType)) {
      const listeners = this.eventListeners.get(eventType);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Quick subscribe helpers
   */
  static onCorrection(callback) {
    this.on('correction_approved', callback);
    this.on('correction_rejected', callback);
    this.on('correction_created', callback);
  }

  static onAllowance(callback) {
    this.on('allowance_approved', callback);
    this.on('allowance_rejected', callback);
    this.on('allowance_created', callback);
  }

  static onPunch(callback) {
    this.on('punch_created', callback);
  }

  static onNotification(callback) {
    this.on('notification', callback);
  }
}

export { SSEClient };
export default SSEClient.getInstance();