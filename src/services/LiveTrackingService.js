import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import api, { getBaseURL } from '../api/api';

const IS_DEV = __DEV__;

/**
 * Live route tracking — captures GPS pings from punch-in until punch-out and
 * streams them to the `livetracking` backend so the full daily route can be
 * replayed.
 *
 * Milestone 1 (server-orchestrated tracking engine): the session itself is no
 * longer opened/closed by this service — PUNCH_IN/PUNCH_OUT
 * (POST /attendance/punches/) now open and close the LiveSession server-side
 * (see apps.livetracking.orchestration), returning `live_session_id` on the
 * punch response. PunchContext calls attach()/detach() (not start()/stop())
 * to hand that already-existing session id to this service, instead of this
 * service calling /livetracking/sessions/start//stop/ itself.
 *
 * Lifecycle (wired from PunchContext):
 *   - attach(sessionId, { battery_level }) -> after a successful PUNCH_IN
 *   - detach()                              -> on PUNCH_OUT
 *
 * Reliability:
 *   - Pings are queued and flushed to the server in small batches.
 *   - The queue is persisted to AsyncStorage so it survives an app/OS kill.
 *   - On Android capture is handed to the native foreground service
 *     (TrackingService.kt), which keeps running (and keeps the OS process
 *     alive) while the screen is off or the app is backgrounded — a JS timer
 *     alone does not survive either state. The JS timer path below only ever
 *     runs on iOS, or as a degraded Android fallback if the native bridge
 *     call itself fails (logged as a heartbeat so it's visible server-side,
 *     not silent).
 *   - The capture interval is backend-configurable (GET /livetracking/config/)
 *     rather than a fixed constant — see fetchAndApplyConfig().
 */

const DEFAULT_CONFIG = {
  interval_moving_s: 10,
  interval_walking_s: 15,
  interval_stationary_s: 30,
  interval_low_battery_s: 60,
  low_battery_threshold_pct: 20,
  max_accuracy_m: 80,
  max_speed_kmh: 200,
  batch_upload_interval_s: 60,
  batch_max_points: 6,
};

const QUEUE_KEY = '@tas_live_tracking_queue';
const CONFIG_CACHE_KEY = '@tas_tracking_config';

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

function _uuid() {
  // RFC-4122-ish v4 UUID, good enough as a client-generated idempotency key
  // (no crypto dependency needed — the server only needs it to be unique
  // per session, not cryptographically random).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class LiveTrackingService {
  static sessionId = null;
  static isRunning = false;
  static queue = [];
  static pingTimer = null;
  static syncTimer = null;
  static lastBattery = null;
  static config = DEFAULT_CONFIG;
  static usingJsFallback = false;

  // Client-side state for pre-queue validation
  static _lastQueuedLat = null;
  static _lastQueuedLng = null;
  static _lastQueuedTs  = null;       // Date.now() ms
  static _lastStationaryKeepTs = null; // Date.now() ms

  /** Fetch the backend-driven tracking config, cache it, and (if capture is
   * already running) push it down to the native service. Safe to call
   * whenever — falls back to the last-cached (or hardcoded default) config
   * on any failure, so a config-fetch outage never stops tracking. */
  static async fetchAndApplyConfig() {
    try {
      const res = await api.getTrackingConfig();
      if (res?.data) {
        this.config = { ...DEFAULT_CONFIG, ...res.data };
        await AsyncStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(this.config));
      }
    } catch (err) {
      if (IS_DEV) console.warn('[Live] Config fetch failed, using cached/default:', err.message);
      try {
        const cached = await AsyncStorage.getItem(CONFIG_CACHE_KEY);
        if (cached) this.config = { ...DEFAULT_CONFIG, ...JSON.parse(cached) };
      } catch {}
    }

    if (Platform.OS === 'android' && this.isRunning && !this.usingJsFallback) {
      try {
        NativeModules.TrackingBridge?.updateConfig?.(JSON.stringify(this.config));
      } catch (e) {
        if (IS_DEV) console.warn('[Live] updateConfig bridge call failed:', e.message);
      }
    }
    return this.config;
  }

  /** Attach to an already-open, server-created LiveSession (its id comes
   * back on the PUNCH_IN response) and start capturing. Does NOT call
   * /livetracking/sessions/start/ — the server already opened the session
   * from inside the punch flow. */
  static async attach(sessionId, { battery_level = null } = {}) {
    if (!sessionId) {
      if (IS_DEV) console.warn('[Live] attach() called without a session id');
      return { success: false, error: 'No session id' };
    }

    // An employee can punch in many times a day; if we're somehow still
    // attached to a previous session, detach cleanly first so pings never
    // stream into a stale one.
    if (this.isRunning || this.sessionId) {
      await this.detach();
    }

    this.lastBattery = battery_level;
    this.sessionId = sessionId;

    // Restore any pings left over from a previous crash/kill.
    await this._loadQueue();

    // Best-effort background permission (Android 10+); tracking still works
    // in foreground without it.
    await this._requestBackgroundPermission();

    await this.fetchAndApplyConfig();

    this.isRunning = true;
    this.usingJsFallback = false;

    if (Platform.OS === 'android') {
      // Hand capture to the native foreground service: it records fixes at a
      // config-driven, movement-adaptive interval and POSTs directly, so
      // tracking continues when the app is in the background, the screen is
      // off, or the app has been closed — none of which a JS timer survives.
      // JS does NOT capture on Android (would double-count).
      try {
        const token = await AsyncStorage.getItem('access');
        NativeModules.TrackingBridge?.startLiveTracking?.(
          getBaseURL(),
          token || '',
          this.sessionId,
          JSON.stringify(this.config),
        );
        if (IS_DEV) console.log('[Live] Native capture started');
      } catch (e) {
        if (IS_DEV) console.warn('[Live] Native start failed, falling back to JS timer:', e.message);
        this.usingJsFallback = true;
        this._sendHeartbeat('SERVICE_RESTARTED', 'Native tracking bridge unavailable — JS fallback engaged');
        this._startJsCapture();
      }
    } else {
      // iOS: JS timers run in the background for location apps, so capture here.
      // (iOS native background tracking is a separate, later phase — see
      // Milestone 1 scope notes; this JS-timer path is today's best effort.)
      this._startJsCapture();
    }

    if (IS_DEV) console.log('[Live] Attached — session:', this.sessionId);
    return { success: true, sessionId: this.sessionId };
  }

  /** Stop capturing and detach from the session. Does NOT call
   * /livetracking/sessions/stop/ — the server already closed the session
   * from inside the punch-out flow (or a background watcher already did,
   * for an auto-punch-out). */
  static async detach() {
    if (!this.isRunning && !this.sessionId) return { success: true };
    if (IS_DEV) console.log('[Live] Detaching...');

    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; }

    this.isRunning = false;

    // Final flush of any remaining pings before letting go of the session.
    await this._sync(true);

    if (Platform.OS === 'android') {
      try {
        NativeModules.TrackingBridge?.stopForeground?.();
      } catch (e) {
        if (IS_DEV) console.warn('[Live] Stop foreground error:', e.message);
      }
    }

    this.sessionId = null;
    this.queue     = [];
    this.usingJsFallback = false;
    this._lastQueuedLat       = null;
    this._lastQueuedLng       = null;
    this._lastQueuedTs        = null;
    this._lastStationaryKeepTs = null;
    try { await AsyncStorage.removeItem(QUEUE_KEY); } catch {}

    if (IS_DEV) console.log('[Live] Detached');
    return { success: true };
  }

  // JS-timer capture (iOS, and Android fallback if the native bridge is absent).
  // Fixed-clock getCurrentPosition on a config-driven interval — NOT
  // watchPosition, which is movement-driven and goes silent when the user is
  // stationary. Uses the conservative "stationary" interval rather than the
  // full moving/walking/stationary/low-battery state machine the native
  // Android service runs — this path is either iOS (a separate future phase)
  // or a rare native-bridge-failure fallback, not the primary engine.
  static _startJsCapture() {
    const intervalMs = (this.config.interval_stationary_s || 30) * 1000;
    this._captureFix();
    this.pingTimer = setInterval(() => this._captureFix(), intervalMs);
    const syncMs = (this.config.batch_upload_interval_s || 60) * 1000;
    this.syncTimer = setInterval(() => this._sync(), syncMs);
  }

  // Ask the OS for one fresh fix.
  static _captureFix() {
    if (!this.isRunning) return;
    Geolocation.getCurrentPosition(
      (position) => this._enqueue(position),
      (error) => { if (IS_DEV) console.warn('[Live] GPS error:', error.code, error.message); },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
    );
  }

  static _enqueue(position) {
    if (!this.isRunning) return;

    const coords = position?.coords;
    if (!coords) return;
    const { latitude, longitude, accuracy, speed, altitude, heading } = coords;
    if (!this._isValidCoord(latitude, longitude)) return;

    const maxAccuracy = this.config.max_accuracy_m ?? 80;
    const maxSpeed = this.config.max_speed_kmh ?? 200;

    // 1 — Accuracy gate (matches server threshold)
    if (accuracy != null && accuracy > maxAccuracy) {
      if (IS_DEV) console.log('[Live] Skipped low-accuracy fix:', accuracy.toFixed(0), 'm');
      return;
    }

    const speedKmh = speed != null ? speed * 3.6 : null; // m/s → km/h

    // 2 — Speed gate
    if (speedKmh != null && speedKmh > maxSpeed) {
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
      if (distM < 3 && deltaS < 10) {
        if (IS_DEV) console.log('[Live] Skipped duplicate fix:', distM.toFixed(1), 'm');
        return;
      }

      // Stationary — barely moved within the stationary window
      if (distM < 5) {
        const lastKeepAge = this._lastStationaryKeepTs != null
          ? (now - this._lastStationaryKeepTs) / 1000
          : Infinity;
        if (lastKeepAge < 60) {
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
      // Idempotency key (Milestone 1) — lets the server dedup a batch that
      // gets resent after its HTTP response was lost in transit.
      client_point_id: _uuid(),
    });

    const maxQueueRetained = 2000;
    if (this.queue.length > maxQueueRetained) {
      this.queue = this.queue.slice(-maxQueueRetained);
    }

    if (IS_DEV) console.log('[Live] Ping queued, total:', this.queue.length);

    // Persist immediately so an OS kill never loses captured points, then flush
    // once we have a small batch (the timer is unreliable in background).
    this._saveQueue();
    const maxBatch = this.config.batch_max_points || 6;
    if (this.queue.length >= maxBatch) this._sync();
  }

  static async _sync(isFinal = false) {
    if (!this.sessionId) return;
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    if (IS_DEV) console.log('[Live] Syncing', batch.length, 'pings', isFinal ? '(final)' : '');

    // A batch whose oldest point is well older than one normal sync interval
    // accumulated while offline — flag it for the server's sync audit trail.
    const syncMs = (this.config.batch_upload_interval_s || 60) * 1000;
    const oldestAgeMs = Date.now() - new Date(batch[0]?.timestamp || Date.now()).getTime();
    const source = oldestAgeMs > syncMs * 2 ? 'offline_sync' : 'live';

    try {
      await api.sendLivePoints({ session_id: this.sessionId, points: batch, source });
      // Re-persist whatever arrived while the request was in flight (may be empty).
      await this._saveQueue();
    } catch (err) {
      if (IS_DEV) console.warn('[Live] Sync failed, will retry:', err.message);
      // Requeue (preserving chronological order) and persist for crash recovery.
      // Each point kept its client_point_id, so if the request actually
      // succeeded server-side before this error (e.g. the response itself
      // was lost), the retry is a safe no-op for those points server-side.
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

  /** Fire-and-forget non-GPS lifecycle event — see /livetracking/heartbeat/.
   * Never throws; a telemetry failure must never affect tracking itself. */
  static async _sendHeartbeat(eventType, detail = '') {
    try {
      await api.sendTrackingHeartbeat({
        session_id: this.sessionId,
        event_type: eventType,
        battery_level: this.lastBattery,
        detail,
      });
    } catch (err) {
      if (IS_DEV) console.warn('[Live] Heartbeat failed:', eventType, err.message);
    }
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
