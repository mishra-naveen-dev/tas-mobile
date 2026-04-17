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
  trackingInterval: 10000,
  distanceFilter: 20,
  maxAccuracy: 100,
};

class LocationService {
  static watchId = null;
  static routePoints = [];
  static listeners = new Set();
  static isTracking = false;

  static async requestPermission() {
    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        Geolocation.requestAuthorization('whenInUse')
          .then((result) => resolve(result === 'granted'))
          .catch(() => resolve(false));
      });
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
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch {
        return false;
      }
    }

    return false;
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

  static getMockLocation() {
    console.log('[Location] Using mock location (Dev mode)');
    return {
      latitude: CONFIG.mockLocation.latitude,
      longitude: CONFIG.mockLocation.longitude,
      address: CONFIG.mockLocation.address,
      accuracy: CONFIG.mockLocation.accuracy,
      speed: CONFIG.mockLocation.speed,
      timestamp: Date.now(),
      isMock: true,
    };
  }

  static async getCurrentLocation() {
    console.log('[Location] Fetching current location...');

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      console.warn('[Location] No permission');
      return this.createError('Location permission denied. Please enable in Settings.', 'PERMISSION_DENIED');
    }

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

          const { latitude, longitude, accuracy, speed } = position.coords;

          if (!this.isValidCoord(latitude, longitude)) {
            console.warn('[Location] Invalid coordinates');
            if (CONFIG.mockEnabled) {
              resolve(this.getMockLocation());
            } else {
              resolve(this.createError('Invalid GPS coordinates detected.', 'INVALID'));
            }
            return;
          }

          console.log('[Location] GPS success:', latitude.toFixed(4), longitude.toFixed(4));
          
          resolve({
            latitude,
            longitude,
            accuracy: accuracy || 50,
            speed: speed ? speed * 3.6 : 0,
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
            console.log('[Location] Falling back to mock');
            resolve(this.getMockLocation());
          } else {
            resolve(this.createError(this.getErrorMessage(error.code), 'GPS_ERROR'));
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

  static async startTracking() {
    if (this.isTracking) {
      console.log('[Location] Already tracking');
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
            console.log('[Location] Route point:', this.routePoints.length);
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
      console.log('[Location] Tracking started');
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
      console.log('[Location] Tracking stopped');
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
      const apiKey = 'AIzaSyDM0WAR3vYxXNqSklb868wEmtDftQvYDkQ';
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.results?.[0]?.formatted_address) {
        return data.results[0].formatted_address;
      }
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
