import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import api from '../api/api';

const IS_DEV = __DEV__;

/**
 * Real OS-level push notifications (FCM) — reaches the device even
 * backgrounded or fully killed, unlike the existing WebSocket push
 * (SSEClient), which only reaches an app with an open socket.
 *
 * Deliberately does NOT surface a toast for a message that arrives while
 * the app is in the FOREGROUND (messaging().onMessage): the existing
 * WebSocket push already covers that case in real time (App.jsx's
 * SSEClient handler), and showing both would duplicate the same
 * notification. FCM's whole job here is the gap the WebSocket can't cover
 * - background and quit-state delivery, and routing a TAP on those to the
 * right screen.
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
    this._cleanup();

    (async () => {
      const granted = await this._ensurePermission();
      if (!granted) {
        if (IS_DEV) console.log('[Push] Notification permission not granted - FCM registration skipped.');
        return;
      }
      await this._registerToken();
    })();

    this._unsubscribers.push(
      messaging().onTokenRefresh((token) => {
        api.registerFCMToken(token).catch((e) => {
          if (IS_DEV) console.warn('[Push] Token refresh registration failed:', e.message);
        });
      }),
    );

    // Foreground: deliberately no toast here (see class doc) - just keep
    // Crashlytics/analytics-style visibility in dev.
    this._unsubscribers.push(
      messaging().onMessage(async (remoteMessage) => {
        if (IS_DEV) console.log('[Push] Foreground message (no toast - WebSocket already covers this):', remoteMessage.data);
      }),
    );

    // Tapped while the app was backgrounded (not killed).
    this._unsubscribers.push(
      messaging().onNotificationOpenedApp((remoteMessage) => {
        if (remoteMessage?.data) onNotificationOpened?.(remoteMessage.data);
      }),
    );

    // Tapped from a fully quit state - only ever relevant once, at startup.
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage?.data) onNotificationOpened?.(remoteMessage.data);
      })
      .catch(() => {});

    return () => this._cleanup();
  }

  static async _ensurePermission() {
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
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  static async _registerToken() {
    try {
      const token = await messaging().getToken();
      if (token) await api.registerFCMToken(token);
    } catch (e) {
      if (IS_DEV) console.warn('[Push] Token registration failed:', e.message);
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
