/**
 * Covers getFallbackAddress()'s null-propagation on a failed/empty
 * reverse-geocode result - this used to put a coordinate string
 * ("23.042559, 72.566681") in `fullAddress`, which every caller checks
 * first, so a failed lookup was permanently stored and displayed as if it
 * were a real address (the backend's punch records, and the admin table
 * reading them, showed exactly this - confirmed in production: ~30% of
 * recent punches had a coordinate string where an address should be).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import GeocodingService from '../src/services/GeocodingService';

const okResponse = (body) => ({ ok: true, json: () => Promise.resolve(body) });

describe('GeocodingService.reverseGeocode fallback', () => {
  // reverseGeocode() caches successful results in AsyncStorage keyed by
  // rounded coordinates - without clearing it, an earlier test's result for
  // the same lat/lng leaks into a later test regardless of that test's own
  // mocked fetch response.
  beforeEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.clear();
  });

  test('API returns a real result -> fullAddress is the real address', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse({
      status: 'OK',
      results: [{
        formatted_address: '106 Rajpur Chora faliyu, Rajpur, Zalod',
        address_components: [],
      }],
    }));

    const result = await GeocodingService.reverseGeocode(23.042559, 72.566681);
    expect(result.fullAddress).toBe('106 Rajpur Chora faliyu, Rajpur, Zalod');
  });

  test('API returns zero results -> fullAddress/shortAddress are null, never coordinates', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse({ status: 'ZERO_RESULTS', results: [] }));

    const result = await GeocodingService.reverseGeocode(23.042559, 72.566681);
    expect(result.fullAddress).toBeNull();
    expect(result.shortAddress).toBeNull();
  });

  test('API request fails (non-ok response) -> fullAddress/shortAddress are null, never coordinates', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    const result = await GeocodingService.reverseGeocode(23.042559, 72.566681);
    expect(result.fullAddress).toBeNull();
    expect(result.shortAddress).toBeNull();
  });

  test('network error (fetch throws) -> fullAddress/shortAddress are null, never coordinates', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

    const result = await GeocodingService.reverseGeocode(23.042559, 72.566681);
    expect(result.fullAddress).toBeNull();
    expect(result.shortAddress).toBeNull();
  });
});
