import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import AsyncStorage from '@react-native-async-storage/async-storage';

const IS_DEV = __DEV__;
const CACHE_KEY = '@tas_location_cache';

const CONFIG = {
  mockEnabled: IS_DEV,
  mockLocation: {
    latitude: 28.6139,
    longitude: 77.2090,
    address: 'New Delhi (Dev Mode)',
    accuracy: 20,
    speed: 0,
  },
  gpsTimeout: 20000,
  trackingInterval: 120000, // 2 minutes — battery efficient per spec
  distanceFilter: 100,      // 100 metres — triggers update on movement even within interval
  maxAccuracy: 100,         // reject fixes worse than 100 m — filters WiFi/cell-tower noise
};

class LocationService {
  static watchId = null;
  static routePoints = [];
  static listeners = new Set();
  static isTracking = false;
  static _bgRequested = false;

  // Request foreground location permission and report a granular status so the
  // UI can react correctly:
  //   'granted'  – good to go
  //   'denied'   – user said no but can be asked again (show Retry)
  //   'blocked'  – user picked "Don't ask again" / iOS denied (must open Settings)
  static async requestForegroundStatus() {
    if (Platform.OS === 'ios') {
      try {
        const result = await Geolocation.requestAuthorization('whenInUse');
        if (result === 'granted') return 'granted';
        if (result === 'denied' || result === 'restricted' || result === 'disabled') return 'blocked';
        return 'denied';
      } catch {
        return 'denied';
      }
    }

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'TAS needs location access to record your punch and track routes.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
        if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
        return 'denied';
      } catch {
        return 'denied';
      }
    }

    return 'denied';
  }

  // Backwards-compatible boolean wrapper.
  static async requestPermission() {
    const status = await this.requestForegroundStatus();
    return status === 'granted';
  }

  // Opens the OS settings screen for this app so the user can flip a blocked
  // permission back on.
  static openSettings() {
    Linking.openSettings().catch(() => {});
  }

  static async checkPermission() {
    if (Platform.OS === 'android') {
      try {
        return await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
      } catch {
        return false;
      }
    }
    return true;
  }

  // True if background ("Allow all the time") location is granted. On Android
  // below 10 background location is implicit, and on iOS this check isn't
  // applicable here — treat both as satisfied so we never hard-block them.
  static async checkBackgroundPermission() {
    if (Platform.OS !== 'android') return true;
    try {
      if (parseInt(Platform.Version, 10) < 29) return true;
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
      );
    } catch {
      return true;
    }
  }

  static getMockLocation() {
    if (__DEV__) console.log('[Location] Using mock location (Dev mode)');
    return {
      latitude: CONFIG.mockLocation.latitude,
      longitude: CONFIG.mockLocation.longitude,
      address: CONFIG.mockLocation.address,
      accuracy: CONFIG.mockLocation.accuracy,
      speed: CONFIG.mockLocation.speed,
      altitude: null,
      heading: null,
      // This IS a fake location (dev-mode fallback with no real GPS) — flag
      // it the same way a device-mocked fix would be, so a dev build never
      // silently passes off a fabricated point as a genuine reading.
      coordsMocked: true,
      timestamp: Date.now(),
      isMock: true,
    };
  }

  static async getCurrentLocation() {
    if (__DEV__) console.log('[Location] Fetching current location...');

    const status = await this.requestForegroundStatus();
    if (status !== 'granted') {
      console.warn('[Location] Permission not granted:', status);
      if (status === 'blocked') {
        return this.createError(
          'Location permission is turned off for TAS. Please enable it in Settings to punch.',
          'PERMISSION_BLOCKED'
        );
      }
      return this.createError(
        'Location access is required to punch. Please allow location permission.',
        'PERMISSION_DENIED'
      );
    }

    // Foreground granted — ask once for "Allow all the time" so route tracking
    // keeps working when the app is in the background. Best-effort; never blocks.
    this.ensureBackgroundPermission();

    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('[Location] GPS timeout');
          if (CONFIG.mockEnabled) {
            resolve(this.getMockLocation());
          } else {
            resolve(this.createError('GPS request timed out. Please try again.', 'TIMEOUT'));
          }
        }
      }, CONFIG.gpsTimeout);

      Geolocation.getCurrentPosition(
        (position) => {
          if (resolved) return;
          clearTimeout(timeout);
          resolved = true;

          const { latitude, longitude, accuracy, speed, altitude, heading, mocked } = position.coords;

          if (!this.isValidCoord(latitude, longitude)) {
            console.warn('[Location] Invalid coordinates');
            if (CONFIG.mockEnabled) {
              resolve(this.getMockLocation());
            } else {
              resolve(this.createError('Invalid GPS coordinates detected.', 'INVALID'));
            }
            return;
          }

          if (__DEV__) console.log('[Location] GPS success:', latitude.toFixed(4), longitude.toFixed(4));

          resolve({
            latitude,
            longitude,
            accuracy: accuracy || 50,
            speed: speed ? speed * 3.6 : 0,
            altitude: altitude ?? null,
            heading: heading ?? null,
            // Real device/OS mock-location signal (Android only — `mocked` is
            // undefined on iOS, which has no equivalent OS-level flag).
            coordsMocked: mocked === true,
            timestamp: Date.now(),
            isMock: false,
            address: '',
          });
        },
        (error) => {
          if (resolved) return;
          clearTimeout(timeout);
          resolved = true;

          console.error('[Location] GPS error:', error.code, error.message);

          if (CONFIG.mockEnabled) {
            if (__DEV__) console.log('[Location] Falling back to mock');
            resolve(this.getMockLocation());
          } else {
            // code 1 = permission, 2 = location services (GPS) off, 3 = timeout
            const type = error.code === 1 ? 'PERMISSION_BLOCKED'
              : error.code === 2 ? 'LOCATION_OFF'
              : 'GPS_ERROR';
            resolve(this.createError(this.getErrorMessage(error.code), type));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: CONFIG.gpsTimeout + 5000,
          maximumAge: 0,
        }
      );
    });
  }

  static createError(message, type) {
    return {
      error: message,
      errorType: type,
      latitude: null,
      longitude: null,
      address: '',
      isMock: false,
    };
  }

  static getErrorMessage(code) {
    const messages = {
      1: 'Location permission denied.',
      2: 'GPS is unavailable. Please enable location services.',
      3: 'Location request timed out.',
    };
    return messages[code] || 'Failed to get location. Please try again.';
  }

  static isValidCoord(lat, lng) {
    if (lat == null || lng == null) return false;
    if (lat === 0 && lng === 0) return false;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    return true;
  }

  // Request background ("Allow all the time") permission at most once per app
  // run, so the user isn't nagged on every punch. Best-effort.
  static async ensureBackgroundPermission() {
    if (this._bgRequested) return;
    this._bgRequested = true;
    try {
      await this.requestBackgroundPermission();
    } catch {}
  }

  static async requestBackgroundPermission() {
    if (Platform.OS !== 'android') return true;
    try {
      if (parseInt(Platform.Version, 10) >= 29) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          {
            title: 'Background Location Required',
            message:
              'TAS needs background location access so your route is recorded ' +
              'even when the screen is off or the app is minimised.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Deny',
            buttonPositive: 'Allow',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    } catch {
      return false;
    }
  }

  static async startTracking() {
    if (this.isTracking) {
      if (__DEV__) console.log('[Location] Already tracking');
      return { success: true };
    }

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      return { success: false, error: 'Permission denied' };
    }

    this.routePoints = [];

    try {
      this.watchId = Geolocation.watchPosition(
        (position) => {
          try {
            const { latitude, longitude, accuracy, speed } = position.coords;

            if (!this.isValidCoord(latitude, longitude)) {
              return;
            }

            // Drop junk indoor/WiFi fixes — accuracy > maxAccuracy means unreliable
            if (accuracy && accuracy > CONFIG.maxAccuracy) {
              return;
            }

            const point = {
              latitude,
              longitude,
              accuracy: accuracy || 50,
              speed: speed ? speed * 3.6 : 0,
              timestamp: position.timestamp || Date.now(),
              isMock: false,
            };

            const lastPoint = this.routePoints[this.routePoints.length - 1];
            if (lastPoint) {
              const dist = this.calcDistance(
                lastPoint.latitude, lastPoint.longitude,
                latitude, longitude
              );
              if (dist < CONFIG.distanceFilter / 1000) return;
            }

            this.routePoints.push(point);
            if (this.routePoints.length > 500) this.routePoints.shift();

            this.notifyListeners(point);
            if (__DEV__) console.log('[Location] Route point:', this.routePoints.length);
          } catch (err) {
            console.error('[Location] Point error:', err);
          }
        },
        (error) => {
          console.error('[Location] Watch error:', error.code);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: CONFIG.distanceFilter,
          interval: CONFIG.trackingInterval,
          fastestInterval: CONFIG.trackingInterval / 2,
        }
      );

      this.isTracking = true;
      if (__DEV__) console.log('[Location] Tracking started');
      return { success: true };
    } catch (err) {
      console.error('[Location] Start tracking failed:', err);
      return { success: false, error: err.message };
    }
  }

  static stopTracking() {
    try {
      if (this.watchId !== null) {
        Geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
      this.isTracking = false;
      if (__DEV__) console.log('[Location] Tracking stopped');
    } catch (err) {
      console.error('[Location] Stop tracking error:', err);
      this.watchId = null;
      this.isTracking = false;
    }
  }

  static calcDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  static toRad(deg) {
    return deg * (Math.PI / 180);
  }

  static getTotalDistance() {
    if (this.routePoints.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < this.routePoints.length; i++) {
      total += this.calcDistance(
        this.routePoints[i - 1].latitude, this.routePoints[i - 1].longitude,
        this.routePoints[i].latitude, this.routePoints[i].longitude
      );
    }
    return total;
  }

  static getRoutePoints() {
    return [...this.routePoints];
  }

  static clearRoute() {
    this.routePoints = [];
  }

  static addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  static notifyListeners(point) {
    this.listeners.forEach((cb) => {
      try { cb(point); } catch {}
    });
  }

  static async reverseGeocode(lat, lng) {
    try {
      const api = require('../api/api').default;
      const res = await api.reverseGeocode(lat, lng);
      if (res.data?.address) return res.data.address;
    } catch {}
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  static openMaps(lat, lng) {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() => {});
  }

  static getStatus() {
    return {
      isTracking: this.isTracking,
      pointsCount: this.routePoints.length,
      totalDistance: this.getTotalDistance(),
      isMock: CONFIG.mockEnabled,
    };
  }
}

export default LocationService;
