import { AppState } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import api from '../api/api';

const IS_DEV = __DEV__;

/**
 * App open/close (foreground/background) session tracking for the backend's
 * Device Management "Application Activity" feature — see
 * apps.organization.views.UserDeviceViewSet.app_session_start/app_session_end.
 *
 * Every foreground transition (including cold launch) starts a new session;
 * every background transition closes it. No grace-window resume — a quick
 * app-switch and back counts as two sessions, matching the literal spec this
 * was built against. Mirrors LiveTrackingService's static-class attach/detach
 * shape rather than being a React hook, for the same reason: it needs to
 * survive whichever component happens to mount/unmount around it.
 */
class ApplicationActivityService {
  static appStateSubscription = null;
  static sessionId = null;
  static sessionStartedAt = null;
  static currentAppState = null;

  static start() {
    if (this.appStateSubscription) return; // already running

    this.currentAppState = AppState.currentState;
    this.appStateSubscription = AppState.addEventListener('change', this._onAppStateChange);

    // Cold launch counts as a foreground transition.
    this._openSession();
  }

  static stop() {
    if (this.sessionId) {
      this._closeSession();
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  static _onAppStateChange = (nextState) => {
    const prevState = this.currentAppState;
    this.currentAppState = nextState;

    const wasBackground = prevState === 'background' || prevState === 'inactive';
    const isNowActive = nextState === 'active';
    const isNowBackground = nextState === 'background';

    if (wasBackground && isNowActive) {
      this._openSession();
    } else if (isNowBackground && this.sessionId) {
      this._closeSession();
    }
  };

  static async _openSession() {
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    this.sessionId = sessionId;
    this.sessionStartedAt = Date.now();

    try {
      const [manufacturer, model, appVersion, buildNumber] = await Promise.all([
        DeviceInfo.getManufacturer(),
        DeviceInfo.getModel(),
        DeviceInfo.getVersion(),
        DeviceInfo.getBuildNumber(),
      ]);
      await api.startAppSession({
        session_id: sessionId,
        manufacturer,
        model,
        app_version: appVersion,
        app_build_number: buildNumber,
      });
    } catch (e) {
      if (IS_DEV) console.warn('[AppActivity] startAppSession failed:', e.message);
    }
  }

  static async _closeSession() {
    const sessionId = this.sessionId;
    const startedAt = this.sessionStartedAt;
    this.sessionId = null;
    this.sessionStartedAt = null;
    if (!sessionId) return;

    const foregroundSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined;
    try {
      await api.endAppSession({ session_id: sessionId, foreground_seconds: foregroundSeconds });
    } catch (e) {
      if (IS_DEV) console.warn('[AppActivity] endAppSession failed:', e.message);
    }
  }
}

export default ApplicationActivityService;
