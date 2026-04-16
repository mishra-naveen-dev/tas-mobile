import { PermissionsAndroid, Platform, Linking } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../core/monitoring/Logger';

const LOCATION_CACHE_KEY = '@location_cache';
const LOCATION_CACHE_DURATION = 5 * 60 * 1000;

const MOCK_CONFIG = {
  enabled: __DEV__ || true,
  fallback: {
    latitude: 28.6139,
    longitude: 77.2090,
    address: 'New Delhi (Mock Location)',
    accuracy: null,
    speed: null,
  },
  devLabel: 'Using mock location (Dev Mode)',
};

class LocationService {
  static isTracking = false;
  static listeners = new Set();
  static routePoints = [];
  static watchId = null;
  static lastLocation = null;
  static lastLocationTime = 0;

  static isEmulator() {
    if (Platform.OS === 'ios') {
      return __DEV__;
    }
    return false;
  }

  static isValidCoordinate(lat, lng) {
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      return false;
    }
    if (lat === 0 && lng === 0) {
      return false;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return false;
    }
    return true;
  }

  static async requestPermission() {
    try {
      if (Platform.OS === 'ios') {
        const auth = await Geolocation.requestAuthorization('whenInUse');
        return auth === 'granted';
      }

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'TAS needs your location to record punch and track routes.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return false;
    } catch (err) {
      logger.error('Permission request failed', { error: err.message });
      return false;
    }
  }

  static async checkPermission() {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    }

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted;
    }
    return false;
  }

  static getMockLocation() {
    const mock = MOCK_CONFIG.fallback;
    logger.info(MOCK_CONFIG.devLabel);
    return {
      latitude: mock.latitude,
      longitude: mock.longitude,
      address: mock.address,
      accuracy: mock.accuracy,
      speed: mock.speed,
      timestamp: Date.now(),
      isMock: true,
      fromCache: false,
      mockMessage: MOCK_CONFIG.devLabel,
    };
  }

  static getMockLocationAsync() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.getMockLocation());
      }, 500);
    });
  }

  static getMockConfig() {
    return MOCK_CONFIG;
  }

  static async reverseGeocode(lat, lng) {
    try {
      const apiKey = 'AIzaSyDM0WAR3vYxXNqSklb868wEmtDftQvYDkQ';
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
      const response = await fetch(url, { timeout: 10000 });
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      }
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (err) {
      logger.error('Reverse geocode failed', { error: err.message });
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  static async getCurrentLocationInfo(options = {}) {
    const {
      enableHighAccuracy = false,
      timeout = 10000,
      maximumAge = 0,
      useCache = false,
      forceRefresh = true,
    } = options;

    logger.info('LocationService: Getting location', { useCache, forceRefresh, timeout, mockEnabled: MOCK_CONFIG.enabled });

    if (MOCK_CONFIG.enabled) {
      logger.info('MOCK MODE: Returning mock location');
      return this.getMockLocationAsync();
    }

    if (useCache && !forceRefresh) {
      const cached = await this.getCachedLocation();
      if (cached && Date.now() - cached.timestamp < LOCATION_CACHE_DURATION) {
        logger.info('Using cached location', cached);
        return { ...cached, fromCache: true };
      }
    }

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      logger.warn('Location permission denied');
      return {
        error: 'Location permission denied',
        errorType: 'PERMISSION_DENIED',
        latitude: null,
        longitude: null,
        address: '',
        isMock: false,
      };
    }

    return new Promise((resolve) => {
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          logger.warn('Location timeout - using mock');
          resolve(this.getMockLocation());
        }
      }, timeout);

      Geolocation.getCurrentPosition(
        async (pos) => {
          if (resolved) return;
          clearTimeout(timeoutId);
          resolved = true;

          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy;
          const speed = pos.coords.speed ? pos.coords.speed * 3.6 : null;

          logger.info('GPS received', { lat, lng, accuracy });

          if (!this.isValidCoordinate(lat, lng)) {
            logger.warn('Invalid GPS coordinates (0,0) - using mock');
            resolve(this.getMockLocation());
            return;
          }

          let address = '';
          try {
            address = await this.reverseGeocode(lat, lng);
          } catch (err) {
            logger.warn('Reverse geocode failed, using coordinates');
          }

          const locationData = {
            latitude: lat,
            longitude: lng,
            address,
            accuracy,
            speed,
            timestamp: Date.now(),
            isMock: false,
            fromCache: false,
          };

          this.cacheLocation(locationData);
          this.lastLocation = locationData;
          this.lastLocationTime = Date.now();
          logger.info('Location captured successfully', locationData);
          resolve(locationData);
        },
        (error) => {
          if (resolved) return;
          clearTimeout(timeoutId);
          resolved = true;

          logger.error('GPS error', { code: error.code, message: error.message });

          if (MOCK_CONFIG.enabled && (error.code === 2 || error.code === 3)) {
            logger.info('GPS failed - using mock location');
            resolve(this.getMockLocation());
          } else {
            resolve({
              error: this.getErrorMessage(error),
              errorType: this.getErrorType(error.code),
              latitude: null,
              longitude: null,
              address: '',
              isMock: false,
            });
          }
        },
        {
          enableHighAccuracy,
          timeout: timeout + 2000,
          maximumAge,
        }
      );
    });
  }

  static getErrorMessage(error) {
    switch (error.code) {
      case 1:
        return 'Location permission denied';
      case 2:
        return 'Location unavailable. Please enable GPS.';
      case 3:
        return 'Location request timed out. Try again.';
      default:
        return 'Failed to get location';
    }
  }

  static getErrorType(code) {
    switch (code) {
      case 1:
        return 'PERMISSION_DENIED';
      case 2:
        return 'POSITION_UNAVAILABLE';
      case 3:
        return 'TIMEOUT';
      default:
        return 'UNKNOWN';
    }
  }

  static async startWatching(options = {}) {
    const { interval = 30000, distanceFilter = 20 } = options;

    if (this.watchId !== null) {
      logger.info('Already watching location');
      return { success: true };
    }

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      return { success: false, error: 'Permission denied', errorType: 'PERMISSION_DENIED' };
    }

    try {
      this.watchId = Geolocation.watchPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed ? position.coords.speed * 3.6 : null,
            timestamp: position.timestamp,
            isMock: false,
          };

          if (this.isValidCoordinate(location.latitude, location.longitude)) {
            this.addRoutePoint(location);
            this.notifyListeners(location);
          }
        },
        (error) => {
          logger.error('Watch position error', { code: error.code, message: error.message });
        },
        {
          enableHighAccuracy: true,
          distanceFilter,
          interval,
          fastestInterval: interval / 2,
        }
      );

      this.isTracking = true;
      logger.info('Started watching location');
      return { success: true };
    } catch (err) {
      logger.error('Start watching failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  static stopWatching() {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isTracking = false;
      logger.info('Stopped watching location');
    }
  }

  static addRoutePoint(point) {
    this.routePoints.push(point);
    if (this.routePoints.length > 1000) {
      this.routePoints.shift();
    }
  }

  static getRoutePoints() {
    return [...this.routePoints];
  }

  static clearRoutePoints() {
    this.routePoints = [];
  }

  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  static addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  static notifyListeners(location) {
    this.listeners.forEach((callback) => {
      try {
        callback(location);
      } catch (err) {
        logger.error('Listener error', { error: err.message });
      }
    });
  }

  static async getCachedLocation() {
    try {
      const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  static async cacheLocation(location) {
    try {
      await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(location));
    } catch (err) {
      logger.error('Cache failed', { error: err.message });
    }
  }

  static isValidLocation(location) {
    if (!location) return false;
    if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') return false;
    if (location.latitude < -90 || location.latitude > 90) return false;
    if (location.longitude < -180 || location.longitude > 180) return false;
    return true;
  }

  static openInGoogleMaps(lat, lng) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      logger.error('Failed to open Google Maps');
    });
  }

  static getStatus() {
    return {
      isTracking: this.isTracking,
      routePointsCount: this.routePoints.length,
      lastLocation: this.lastLocation,
      isMockEnabled: MOCK_CONFIG.enabled,
    };
  }
}

export default LocationService;
