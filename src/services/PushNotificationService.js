import { Platform, PermissionsAndroid } from 'react-native';
import {
  getMessaging,
  getToken,
  onTokenRefresh,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  requestPermission,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import crashlytics from '@react-native-firebase/crashlytics';
import api from '../api/api';

const IS_DEV = __DEV__;

// console.warn/log calls below are compiled out of release builds (__DEV__
// is false), so they're useless for diagnosing a real production failure -
// recordFailure logs a non-fatal to Crashlytics (visible in the Firebase
// console on any build, dev or release) as well as the dev console.
function recordFailure(context, error) {
  if (IS_DEV) console.warn(`[Push] ${context}:`, error?.message);
  try {
    crashlytics().recordError(error instanceof Error ? error : new Error(`${context}: ${error}`));
  } catch {}
}

// Native-level breadcrumb trail (visible attached to the next Crashlytics
// report, even without a JS console attached) - kept from diagnosing the
// "undefined is not a function" bug below; cheap enough to leave in for
// future production visibility.
function trace(step) {
  try { crashlytics().log(`[Push] ${step}`); } catch {}
}

/**
 * Real OS-level push notifications (FCM) — reaches the device even
 * backgrounded or fully killed, unlike the existing WebSocket push
 * (SSEClient), which only reaches an app with an open socket.
 *
 * Deliberately does NOT surface a toast for a message that arrives while
 * the app is in the FOREGROUND (onMessage): the existing WebSocket push
 * already covers that case in real time (App.jsx's SSEClient handler),
 * and showing both would duplicate the same notification. FCM's whole
 * job here is the gap the WebSocket can't cover - background and
 * quit-state delivery, and routing a TAP on those to the right screen.
 *
 * Uses @react-native-firebase/messaging's modular API (getMessaging() +
 * free functions taking that instance) - the old
 * `import messaging from '...'; messaging().getToken()` namespaced
 * pattern this file used until now no longer exists in v26: that import
 * resolves to undefined, so every call on it threw
 * "TypeError: undefined is not a function", silently caught by the
 * try/catch below and never reaching Crashlytics as a distinct error
 * (just the generic message), nor ever registering a token.
 */
class PushNotificationService {
  static _unsubscribers = [];

  /**
   * Call once per app session, after the user is authenticated (token
   * registration requires auth). Returns an unsubscribe function.
   * `onNotificationOpened(payload)` fires when the user taps a
   * background or quit-state notification - payload is remoteMessage.data
   * (all string values; see apps.organization.services.notify_user's FCM
   * data shape on the backend).
   */
  static initialize({ onNotificationOpened } = {}) {
    trace('initialize() called');
    this._cleanup();

    // This feature must never be able to take the whole app down with it -
    // same no-op-on-failure discipline as the backend side
    // (apps.organization.push.send_push_to_user never raises either).
    try {
      const messagingInstance = getMessaging();

      (async () => {
        trace('permission check starting');
        try {
          const granted = await this._ensurePermission(messagingInstance);
          trace(`permission check resolved: granted=${granted}`);
          if (!granted) {
            if (IS_DEV) console.log('[Push] Notification permission not granted - FCM registration skipped.');
            return;
          }
          await this._registerToken(messagingInstance);
        } catch (e) {
          trace(`permission/token setup threw: ${e?.message}`);
          recordFailure('Permission/token setup failed', e);
        }
      })();

      this._unsubscribers.push(
        onTokenRefresh(messagingInstance, (token) => {
          api.registerFCMToken(token).catch((e) => recordFailure('Token refresh registration failed', e));
        }),
      );

      // Foreground: deliberately no toast here (see class doc) - just keep
      // dev-console visibility.
      this._unsubscribers.push(
        onMessage(messagingInstance, async (remoteMessage) => {
          if (IS_DEV) console.log('[Push] Foreground message (no toast - WebSocket already covers this):', remoteMessage.data);
        }),
      );

      // Tapped while the app was backgrounded (not killed).
      this._unsubscribers.push(
        onNotificationOpenedApp(messagingInstance, (remoteMessage) => {
          if (remoteMessage?.data) onNotificationOpened?.(remoteMessage.data);
        }),
      );

      // Tapped from a fully quit state - only ever relevant once, at startup.
      getInitialNotification(messagingInstance)
        .then((remoteMessage) => {
          if (remoteMessage?.data) onNotificationOpened?.(remoteMessage.data);
        })
        .catch(() => {});
    } catch (e) {
      trace(`initialize() synchronous section threw: ${e?.message}`);
      recordFailure('initialize() failed - continuing without push', e);
      return () => {};
    }

    trace('initialize() synchronous section completed, listeners attached');
    return () => this._cleanup();
  }

  static async _ensurePermission(messagingInstance) {
    if (Platform.OS === 'android') {
      // Android < 13 has no runtime notification permission at all (manifest
      // grant is enough); the tracking service's own flow already requests
      // POST_NOTIFICATIONS on 13+ (same AndroidManifest entry), so this is
      // very likely already granted by the time a user reaches login - this
      // call is just the safety net for whichever happens first.
      if (Platform.Version < 33 || !PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) return true;
      const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (already) return true;
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    const authStatus = await requestPermission(messagingInstance);
    return (
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL
    );
  }

  static async _registerToken(messagingInstance) {
    trace('_registerToken: calling getToken()');
    try {
      const token = await getToken(messagingInstance);
      trace(`_registerToken: getToken() resolved, length=${token?.length ?? 0}`);
      if (token) {
        await api.registerFCMToken(token);
        trace('_registerToken: server registration call completed');
      }
    } catch (e) {
      trace(`_registerToken: threw: ${e?.message}`);
      recordFailure('Token registration failed', e);
    }
  }

  static _cleanup() {
    this._unsubscribers.forEach((unsub) => {
      try { unsub(); } catch {}
    });
    this._unsubscribers = [];
  }
}

export default PushNotificationService;
