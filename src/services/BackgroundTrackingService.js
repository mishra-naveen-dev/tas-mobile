import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import LocationService from './LocationService';
import api from '../api/api';

const IS_DEV = __DEV__;
const QUEUE_KEY = '@tas_tracking_queue';
const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const MAX_BATCH_SIZE = 50;

/**
 * Manages background GPS tracking lifecycle:
 * - Starts when employee punches in (receives sessionId from API response)
 * - Periodically syncs batched points to backend
 * - Persists queue to AsyncStorage for crash recovery
 * - Stops and flushes remaining points on punch-out
 * - Starts/stops a native Android foreground service to keep the process alive
 */
class BackgroundTrackingService {
  static sessionId = null;
  static isRunning = false;
  static pointQueue = [];
  static syncTimer = null;
  static locationUnsubscribe = null;

  static async start(sessionId) {
    if (this.isRunning) {
      if (IS_DEV) console.log('[BTS] Already running, session:', this.sessionId);
      return;
    }

    this.sessionId = sessionId;
    this.isRunning = true;
    this.pointQueue = [];

    if (IS_DEV) console.log('[BTS] Starting — session:', sessionId);

    // Restore any offline-queued points from a previous crash
    await this._loadQueue();

    // Request background location on Android 10+
    await LocationService.requestBackgroundPermission();

    // Start GPS watching (distanceFilter=100m, interval=2min — battery efficient)
    await LocationService.startTracking();

    // Listen for each new GPS point
    this.locationUnsubscribe = LocationService.addListener(
      this._onNewPoint.bind(this)
    );

    // Periodic sync every 2 minutes
    this.syncTimer = setInterval(() => this._syncPoints(), SYNC_INTERVAL_MS);

    // Start native foreground service on Android so OS doesn't kill the process
    if (Platform.OS === 'android') {
      try {
        NativeModules.TrackingBridge?.startForeground();
      } catch (e) {
        if (IS_DEV) console.warn('[BTS] Foreground service unavailable:', e.message);
      }
    }

    if (IS_DEV) console.log('[BTS] Started');
  }

  static async stop() {
    if (!this.isRunning) return;
    if (IS_DEV) console.log('[BTS] Stopping...');

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.locationUnsubscribe) {
      this.locationUnsubscribe();
      this.locationUnsubscribe = null;
    }

    LocationService.stopTracking();

    // Final flush — send all remaining queued points before punch-out
    await this._syncPoints(true);

    if (Platform.OS === 'android') {
      try {
        NativeModules.TrackingBridge?.stopForeground();
      } catch (e) {
        if (IS_DEV) console.warn('[BTS] Stop foreground service error:', e.message);
      }
    }

    this.sessionId = null;
    this.isRunning = false;
    this.pointQueue = [];

    try { await AsyncStorage.removeItem(QUEUE_KEY); } catch {}

    if (IS_DEV) console.log('[BTS] Stopped');
  }

  static _onNewPoint(point) {
    if (!this.isRunning) return;

    this.pointQueue.push({
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy: point.accuracy || 50,
      speed: point.speed || 0,
      timestamp: new Date(point.timestamp).toISOString(),
    });

    if (IS_DEV) console.log('[BTS] Point queued, total:', this.pointQueue.length);

    if (this.pointQueue.length >= MAX_BATCH_SIZE) {
      this._syncPoints();
    }
  }

  static async _syncPoints(isFinal = false) {
    if (this.pointQueue.length === 0) return;
    if (!this.sessionId) return;

    const batch = [...this.pointQueue];
    this.pointQueue = [];

    if (IS_DEV) console.log('[BTS] Syncing', batch.length, 'points...');

    try {
      await api.bulkTrackingPoints({
        tracking_session_id: this.sessionId,
        points: batch,
      });
      if (IS_DEV) console.log('[BTS] Sync OK');
      try { await AsyncStorage.removeItem(QUEUE_KEY); } catch {}
    } catch (err) {
      if (IS_DEV) console.warn('[BTS] Sync failed, will retry:', err.message);
      // Put points back and persist so they survive app restart
      this.pointQueue = [...batch, ...this.pointQueue];
      await this._saveQueue();
    }
  }

  static async _saveQueue() {
    try {
      await AsyncStorage.setItem(
        QUEUE_KEY,
        JSON.stringify({ sessionId: this.sessionId, points: this.pointQueue })
      );
    } catch {}
  }

  static async _loadQueue() {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (!raw) return;
      const { sessionId, points } = JSON.parse(raw);
      if (sessionId === this.sessionId && points?.length > 0) {
        this.pointQueue = points;
        if (IS_DEV) console.log('[BTS] Restored', points.length, 'offline points');
      }
    } catch {}
  }

  static getStatus() {
    return {
      isRunning: this.isRunning,
      sessionId: this.sessionId,
      pendingPoints: this.pointQueue.length,
    };
  }
}

export default BackgroundTrackingService;
