import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import api, { getBaseURL } from '../api/api';

const IS_DEV = __DEV__;

/**
 * Live route tracking — a standalone system, independent of the existing
 * BackgroundTrackingService. It captures one GPS ping every 10 seconds from
 * punch-in until punch-out and streams them to the `livetracking` backend so
 * the full daily route can be replayed.
 *
 * Lifecycle (wired from PunchContext):
 *   - start()  -> after a successful PUNCH_IN
 *   - stop()   -> on PUNCH_OUT
 *
 * Reliability:
 *   - Pings are queued and flushed to the server in small batches.
 *   - The queue is persisted to AsyncStorage so it survives an app/OS kill.
 *   - On Android we (re)use the existing native foreground service bridge,
 *     when present, so the OS keeps the process alive while the screen is off.
 */

const CONFIG = {
  pingIntervalMs:    10 * 1000,  // capture a fresh fix every 10 seconds (per spec)
  fixTimeoutMs:       9 * 1000,  // per-fix GPS timeout — must be < pingIntervalMs
  syncIntervalMs:    60 * 1000,  // flush queued pings to server once a minute (low server load)
  maxBatchSize:               6, // ...or sooner once this many are queued (~60s)
  maxQueueRetained:        2000, // safety cap on the in-memory/persisted queue
  maxAccuracyMetres:         80, // reject fixes worse than 80 m (server also checks this)
  maxSpeedKmh:              200, // reject device-reported speed above this
  duplicateDistMetres:        3, // suppress if < 3 m from last queued fix…
  duplicateTimeSecs:         10, // …within 10 seconds
  stationaryDistMetres:       5, // suppress if < 5 m from last queued fix…
  stationaryWindowSecs:      60, // …and we already queued a fix within this window
};

const QUEUE_KEY = '@tas_live_tracking_queue';

// Haversine distance between two coordinates in metres (client-side copy)
function _distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

class LiveTrackingService {
  static sessionId = null;
  static isRunning = false;
  static queue = [];
  static pingTimer = null;
  static syncTimer = null;
  static lastBattery = null;

  // Client-side state for pre-queue validation
  static _lastQueuedLat = null;
  static _lastQueuedLng = null;
  static _lastQueuedTs  = null;       // Date.now() ms
  static _lastStationaryKeepTs = null; // Date.now() ms

  static async start(battery_level = null) {
    // An employee can punch in many times a day. If a session is still running
    // (e.g. a second punch-in without a punch-out in between), close the old one
    // cleanly first so we never stream pings into a stale session. The backend's
    // start endpoint also force-closes any prior active session, so the two stay
    // in sync and at most one session is ever active.
    if (this.isRunning || this.sessionId) {
      await this.stop(battery_level);
    }

    this.lastBattery = battery_level;

    // Restore any pings left over from a previous crash/kill.
    await this._loadQueue();

    // Best-effort background permission (Android 10+); tracking still works
    // in foreground without it.
    await this._requestBackgroundPermission();

    try {
      const res = await api.startLiveSession({ battery_level });
      this.sessionId = res.data?.session_id || null;
    } catch (err) {
      if (IS_DEV) console.warn('[Live] start session failed:', err.message);
      return { success: false, error: err.message };
    }

    if (!this.sessionId) {
      return { success: false, error: 'No session id returned' };
    }

    this.isRunning = true;

    if (Platform.OS === 'android') {
      // Hand capture to the native foreground service: it records a fix every
      // 10s and POSTs directly, so tracking continues when the app is in the
      // background, the screen is off, or the app has been closed — none of
      // which a JS timer survives. JS does NOT capture on Android (would
      // double-count). Token lifetime is 8h, enough for a full shift.
      try {
        const token = await AsyncStorage.getItem('access');
        NativeModules.TrackingBridge?.startLiveTracking?.(
          getBaseURL(),
          token || '',
          this.sessionId
        );
        if (IS_DEV) console.log('[Live] Native capture started');
      } catch (e) {
        if (IS_DEV) console.warn('[Live] Native start failed, falling back to JS timer:', e.message);
        this._startJsCapture();
      }
    } else {
      // iOS: JS timers run in the background for location apps, so capture here.
      this._startJsCapture();
    }

    if (IS_DEV) console.log('[Live] Started — session:', this.sessionId);
    return { success: true, sessionId: this.sessionId };
  }

  static async stop(battery_level = null) {
    if (!this.isRunning && !this.sessionId) return { success: true };
    if (IS_DEV) console.log('[Live] Stopping...');

    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; }

    this.isRunning = false;

    // Final flush of any remaining pings before closing the session.
    await this._sync(true);

    try {
      await api.stopLiveSession({
        session_id: this.sessionId,
        battery_level: battery_level ?? this.lastBattery,
      });
    } catch (err) {
      if (IS_DEV) console.warn('[Live] stop session failed:', err.message);
    }

    if (Platform.OS === 'android') {
      try {
        NativeModules.TrackingBridge?.stopForeground?.();
      } catch (e) {
        if (IS_DEV) console.warn('[Live] Stop foreground error:', e.message);
      }
    }

    this.sessionId = null;
    this.queue     = [];
    this._lastQueuedLat       = null;
    this._lastQueuedLng       = null;
    this._lastQueuedTs        = null;
    this._lastStationaryKeepTs = null;
    try { await AsyncStorage.removeItem(QUEUE_KEY); } catch {}

    if (IS_DEV) console.log('[Live] Stopped');
    return { success: true };
  }

  // JS-timer capture (iOS, and Android fallback if the native bridge is absent).
  // Fixed-clock getCurrentPosition every 10s — NOT watchPosition, which is
  // movement-driven and goes silent when the user is stationary.
  static _startJsCapture() {
    this._captureFix();
    this.pingTimer = setInterval(() => this._captureFix(), CONFIG.pingIntervalMs);
    this.syncTimer = setInterval(() => this._sync(), CONFIG.syncIntervalMs);
  }

  // Ask the OS for one fresh fix. Called immediately at start and then every
  // 10s by the interval timer.
  static _captureFix() {
    if (!this.isRunning) return;
    Geolocation.getCurrentPosition(
      (position) => this._enqueue(position),
      (error) => { if (IS_DEV) console.warn('[Live] GPS error:', error.code, error.message); },
      { enableHighAccuracy: true, timeout: CONFIG.fixTimeoutMs, maximumAge: 0 }
    );
  }

  static _enqueue(position) {
    if (!this.isRunning) return;

    const coords = position?.coords;
    if (!coords) return;
    const { latitude, longitude, accuracy, speed, altitude, heading } = coords;
    if (!this._isValidCoord(latitude, longitude)) return;

    // 1 — Accuracy gate (matches server threshold)
    if (accuracy != null && accuracy > CONFIG.maxAccuracyMetres) {
      if (IS_DEV) console.log('[Live] Skipped low-accuracy fix:', accuracy.toFixed(0), 'm');
      return;
    }

    const speedKmh = speed != null ? speed * 3.6 : null; // m/s → km/h

    // 2 — Speed gate
    if (speedKmh != null && speedKmh > CONFIG.maxSpeedKmh) {
      if (IS_DEV) console.log('[Live] Skipped high-speed fix:', speedKmh.toFixed(0), 'km/h');
      return;
    }

    const now = Date.now();

    // 3 — Duplicate & stationary suppression (client-side, reduces data volume)
    if (this._lastQueuedLat != null) {
      const distM = _distanceM(
        this._lastQueuedLat, this._lastQueuedLng, latitude, longitude,
      );
      const deltaS = (now - this._lastQueuedTs) / 1000;

      // Exact duplicate — same spot within 10 s
      if (distM < CONFIG.duplicateDistMetres && deltaS < CONFIG.duplicateTimeSecs) {
        if (IS_DEV) console.log('[Live] Skipped duplicate fix:', distM.toFixed(1), 'm');
        return;
      }

      // Stationary — barely moved within the stationary window
      if (distM < CONFIG.stationaryDistMetres) {
        const lastKeepAge = this._lastStationaryKeepTs != null
          ? (now - this._lastStationaryKeepTs) / 1000
          : Infinity;
        if (lastKeepAge < CONFIG.stationaryWindowSecs) {
          if (IS_DEV) console.log('[Live] Skipped stationary fix:', distM.toFixed(1), 'm');
          return;
        }
        this._lastStationaryKeepTs = now;
      } else {
        this._lastStationaryKeepTs = null;
      }
    }

    this._lastQueuedLat = latitude;
    this._lastQueuedLng = longitude;
    this._lastQueuedTs  = now;

    this.queue.push({
      latitude,
      longitude,
      accuracy:      accuracy ?? null,
      speed:         speedKmh,
      altitude:      altitude ?? null,
      heading:       heading ?? null,
      battery_level: this.lastBattery,
      timestamp:     new Date(position.timestamp || now).toISOString(),
    });

    if (this.queue.length > CONFIG.maxQueueRetained) {
      this.queue = this.queue.slice(-CONFIG.maxQueueRetained);
    }

    if (IS_DEV) console.log('[Live] Ping queued, total:', this.queue.length);

    // Persist immediately so an OS kill never loses captured points, then flush
    // once we have a small batch (the 30s timer is unreliable in background).
    this._saveQueue();
    if (this.queue.length >= CONFIG.maxBatchSize) this._sync();
  }

  static async _sync(isFinal = false) {
    if (!this.sessionId) return;
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    if (IS_DEV) console.log('[Live] Syncing', batch.length, 'pings', isFinal ? '(final)' : '');

    try {
      await api.sendLivePoints({ session_id: this.sessionId, points: batch });
      // Re-persist whatever arrived while the request was in flight (may be empty).
      await this._saveQueue();
    } catch (err) {
      if (IS_DEV) console.warn('[Live] Sync failed, will retry:', err.message);
      // Requeue (preserving chronological order) and persist for crash recovery.
      this.queue = [...batch, ...this.queue];
      await this._saveQueue();
    }
  }

  static async _saveQueue() {
    try {
      await AsyncStorage.setItem(
        QUEUE_KEY,
        JSON.stringify({ sessionId: this.sessionId, points: this.queue })
      );
    } catch {}
  }

  static async _loadQueue() {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (!raw) return;
      const { sessionId, points } = JSON.parse(raw);
      if (points?.length) {
        this.queue = points;
        if (!this.sessionId && sessionId) this.sessionId = sessionId;
        if (IS_DEV) console.log('[Live] Restored', points.length, 'offline pings');
      }
    } catch {}
  }

  /**
   * Request every permission live tracking needs, in the order Android requires:
   *   1. Foreground location (ACCESS_FINE_LOCATION) — must be granted first.
   *   2. Notifications (Android 13+) — so the foreground-service notification shows.
   *   3. Background location ("Allow all the time", Android 10+) — only meaningful
   *      once foreground is granted; on Android 11+ this routes the user to the
   *      system settings screen.
   *
   * Call this once up-front (first launch) so tracking actually works when the
   * user later punches in. Without the "Allow all the time" grant, Android stops
   * delivering locations as soon as the screen goes off.
   *
   * Returns { fine, notifications, background } booleans.
   */
  static async bootstrapPermissions() {
    if (Platform.OS === 'ios') {
      try {
        const res = await Geolocation.requestAuthorization('always');
        const ok = res === 'granted';
        return { fine: ok, notifications: true, background: ok };
      } catch {
        return { fine: false, notifications: true, background: false };
      }
    }
    if (Platform.OS !== 'android') {
      return { fine: true, notifications: true, background: true };
    }

    const GRANTED = PermissionsAndroid.RESULTS.GRANTED;
    const apiLevel = parseInt(Platform.Version, 10);
    const result = { fine: false, notifications: true, background: false };

    try {
      // 1. Foreground (fine) location.
      const alreadyFine = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      result.fine = alreadyFine || (await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'TAS needs location access to record your punches and travel route.',
          buttonNeutral: 'Ask Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      )) === GRANTED;

      // 2. Notifications (Android 13+ / API 33) for the foreground-service notification.
      if (apiLevel >= 33 && PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
        const notif = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        result.notifications = notif === GRANTED;
      }

      // 3. Background location — only after fine is granted (Android 10+ / API 29).
      if (result.fine && apiLevel >= 29) {
        const alreadyBg = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
        );
        if (alreadyBg) {
          result.background = true;
        } else {
          const bg = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
            {
              title: 'Allow Background Location',
              message:
                'To keep recording your route when the screen is off or the app is ' +
                'minimised, please choose "Allow all the time".',
              buttonNeutral: 'Ask Later',
              buttonNegative: 'Deny',
              buttonPositive: 'Allow',
            }
          );
          result.background = bg === GRANTED;
        }
      } else {
        result.background = result.fine && apiLevel < 29; // implicit pre-Android 10
      }
    } catch (e) {
      if (IS_DEV) console.warn('[Live] Permission bootstrap error:', e.message);
    }

    if (IS_DEV) console.log('[Live] Permissions:', JSON.stringify(result));
    return result;
  }

  static async _requestBackgroundPermission() {
    // Ensure the "Allow all the time" grant exists before a tracking session
    // starts; delegates to the full ordered bootstrap.
    const res = await this.bootstrapPermissions();
    return res.background;
  }

  static _isValidCoord(lat, lng) {
    if (lat == null || lng == null) return false;
    if (lat === 0 && lng === 0) return false;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    return true;
  }

  static getStatus() {
    return {
      isRunning: this.isRunning,
      sessionId: this.sessionId,
      pendingPings: this.queue.length,
    };
  }
}

export default LiveTrackingService;
