import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GOOGLE_MAPS_API_KEY } from '@env';
import { logger } from '../core/monitoring/Logger';

// Sourced from .env (gitignored) at build time — see .env.example for setup.
const GOOGLE_API_KEY = GOOGLE_MAPS_API_KEY;
export { GOOGLE_API_KEY };
if (!GOOGLE_API_KEY) {
  logger.warn('[GeocodingService] GOOGLE_MAPS_API_KEY is not set — copy .env.example to .env and add it.');
}
const GEOCODE_CACHE_PREFIX = '@geocode_cache_';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

class GeocodingService {
  static async reverseGeocode(latitude, longitude) {
    try {
      const cacheKey = `${GEOCODE_CACHE_PREFIX}${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
      const cached = await this.getFromCache(cacheKey);
      
      if (cached) {
        logger.debug('Using cached geocode result');
        return cached;
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}&result_type=street_address|premise|establishment`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Geocoding API request failed');
      }

      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        logger.warn('Geocoding returned no results', { status: data.status });
        return this.getFallbackAddress(latitude, longitude);
      }

      const result = this.parseGeocodeResult(data.results[0], latitude, longitude);
      
      await this.saveToCache(cacheKey, result);
      
      logger.info('Reverse geocoding successful', { address: result.shortAddress });
      return result;
    } catch (error) {
      logger.error('Reverse geocode error', { error });
      return this.getFallbackAddress(latitude, longitude);
    }
  }

  static async forwardGeocode(address) {
    try {
      const cacheKey = `${GEOCODE_CACHE_PREFIX}addr_${encodeURIComponent(address)}`;
      const cached = await this.getFromCache(cacheKey);
      
      if (cached) {
        return cached;
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Geocoding API request failed');
      }

      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        return null;
      }

      const result = {
        latitude: data.results[0].geometry.location.lat,
        longitude: data.results[0].geometry.location.lng,
        formattedAddress: data.results[0].formatted_address,
      };

      await this.saveToCache(cacheKey, result);
      
      return result;
    } catch (error) {
      logger.error('Forward geocode error', { error });
      return null;
    }
  }

  static async calculateDrivingDistance(fromAddress, toAddress) {
    try {
      // Geocode both addresses
      const [fromResult, toResult] = await Promise.all([
        this.forwardGeocode(fromAddress),
        this.forwardGeocode(toAddress)
      ]);

      if (!fromResult?.latitude || !toResult?.latitude) {
        if (__DEV__) console.log('[DistanceCalc] Could not geocode addresses');
        return 0;
      }

      // Use Google Distance Matrix API
      const fromLoc = `${fromResult.latitude},${fromResult.longitude}`;
      const toLoc = `${toResult.latitude},${toResult.longitude}`;

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${fromLoc}&destinations=${toLoc}&mode=driving&key=${GOOGLE_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.rows?.length > 0 && data.rows[0].elements?.length > 0) {
        const element = data.rows[0].elements[0];
        if (element.status === 'OK') {
          // Distance in meters, convert to km
          const distanceKm = element.distance.value / 1000;
          if (__DEV__) console.log('[DistanceCalc] Google API:', distanceKm, 'km');
          return Math.round(distanceKm * 100) / 100;
        }
      }

      // Fallback: Haversine formula
      const haversineDistance = this.calculateHaversine(
        fromResult.latitude, fromResult.longitude,
        toResult.latitude, toResult.longitude
      );
      if (__DEV__) console.log('[DistanceCalc] Haversine fallback:', haversineDistance, 'km');
      return haversineDistance;

    } catch (error) {
      if (__DEV__) console.log('[DistanceCalc] Error:', error.message);
      return 0;
    }
  }

  // Total driving distance across an ordered list of address strings
  // (A -> a.1 -> a.2 -> B): sums the distance of each consecutive leg.
  // Returns { total, legs: [{ from, to, km }] }.
  static async calculateMultiLegDistance(addresses) {
    const clean = (addresses || []).filter((a) => a && a.trim().length > 0);
    if (clean.length < 2) {
      return { total: 0, legs: [] };
    }

    let total = 0;
    const legs = [];
    for (let i = 0; i < clean.length - 1; i++) {
      // Reuse the single-leg driving distance (Google Distance Matrix with
      // Haversine fallback), which also caches geocoding.
      const km = await this.calculateDrivingDistance(clean[i], clean[i + 1]);
      legs.push({ from: clean[i], to: clean[i + 1], km });
      total += km || 0;
    }
    return { total: Math.round(total * 100) / 100, legs };
  }

  static calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  static parseGeocodeResult(result, latitude, longitude) {
    const components = this.extractAddressComponents(result.address_components);

    return {
      latitude,
      longitude,
      formattedAddress: result.formatted_address,
      shortAddress: this.formatShortAddress(components),
      fullAddress: result.formatted_address,
      street: components.street || '',
      city: components.city || components.sublocality || '',
      state: components.state || '',
      country: components.country || '',
      pincode: components.pincode || '',
      landmark: components.landmark || '',
      building: components.building || '',
      area: components.area || components.sublocality || '',
    };
  }

  static extractAddressComponents(components) {
    const result = {};

    components.forEach((component) => {
      const types = component.types;

      if (types.includes('street_number')) {
        result.streetNumber = component.long_name;
      }
      if (types.includes('route')) {
        result.street = component.long_name;
      }
      if (types.includes('sublocality_level_1')) {
        result.area = component.long_name;
      }
      if (types.includes('sublocality_level_2')) {
        result.sublocality = component.long_name;
      }
      if (types.includes('locality')) {
        result.city = component.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        result.state = component.long_name;
      }
      if (types.includes('postal_code')) {
        result.pincode = component.long_name;
      }
      if (types.includes('country')) {
        result.country = component.long_name;
      }
      if (types.includes('premise')) {
        result.building = component.long_name;
      }
      if (types.includes('landmark')) {
        result.landmark = component.long_name;
      }
    });

    return result;
  }

  static formatShortAddress(components) {
    const parts = [];

    if (components.building) {
      parts.push(components.building);
    }
    if (components.street) {
      parts.push(components.street);
    }
    if (parts.length === 0 && components.area) {
      parts.push(components.area);
    }
    if (components.city) {
      parts.push(components.city);
    }

    return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
  }

  static getFallbackAddress(latitude, longitude) {
    return {
      latitude,
      longitude,
      formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      shortAddress: 'Unknown Location',
      fullAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      street: '',
      city: '',
      state: '',
      country: '',
      pincode: '',
      landmark: '',
      building: '',
      area: '',
    };
  }

  // ==================== CACHE ====================

  static async getFromCache(key) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        }
        await AsyncStorage.removeItem(key);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  static async saveToCache(key, data) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      logger.error('Failed to save geocode cache', { error });
    }
  }

  static async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const geocodeKeys = keys.filter((key) => key.startsWith(GEOCODE_CACHE_PREFIX));
      await AsyncStorage.multiRemove(geocodeKeys);
      logger.info('Geocode cache cleared');
    } catch (error) {
      logger.error('Failed to clear geocode cache', { error });
    }
  }

  // ==================== GOOGLE MAPS ====================

  static openInGoogleMaps(latitude, longitude, label = '') {
    const params = new URLSearchParams({
      api: '1',
      destination: `${latitude},${longitude}`,
    });

    if (label) {
      params.set('destination', label);
    }

    const url = `https://www.google.com/maps/dir/?${params.toString()}`;
    logger.info('Opening Google Maps', { url });
    Linking.openURL(url);
  }

  static openDirections(fromLat, fromLng, toLat, toLng) {
    const url = `https://www.google.com/maps/dir/${fromLat},${fromLng}/${toLat},${toLng}`;
    Linking.openURL(url);
  }

  static shareLocation(latitude, longitude) {
    const url = `https://maps.google.com/?q=${latitude},${longitude}`;
    return url;
  }

  static isGoogleMapsInstalled() {
    return Linking.canOpenURL('comgooglemaps://');
  }

  static openInGoogleMapsApp(latitude, longitude) {
    const url = `comgooglemaps://?center=${latitude},${longitude}&zoom=14&views=traffic`;
    
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        this.openInGoogleMaps(latitude, longitude);
      }
    });
  }

  // ==================== DISTANCE CALCULATIONS ====================

  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  static formatDistance(km) {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(2)} km`;
  }
}

export default GeocodingService;
