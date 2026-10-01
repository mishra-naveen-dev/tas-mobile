/**
 * Unit coverage for LiveTrackingService._sync()'s connectivity gate — added
 * so a known-offline device doesn't burn battery/cycles on upload attempts
 * already known to fail. Before this, _sync() had no connectivity awareness
 * at all and always tried, relying purely on the request itself failing.
 *
 * Only the gate is under test here (not GPS capture/AsyncStorage queueing,
 * which need native modules this harness doesn't provide) — api.js and
 * react-native-geolocation-service are mocked so _sync() can run in
 * isolation against the module-level serverStatus singleton.
 */

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { sendLivePoints: jest.fn().mockResolvedValue({ data: {} }) },
  getBaseURL: () => 'https://example.test/api/v1',
}));
jest.mock('react-native-geolocation-service', () => ({}));
jest.mock('../src/utils/secureStorage', () => ({ secureGetItem: jest.fn() }));

const api = require('../src/api/api').default;
const { serverStatus } = require('../src/utils/serverStatus');
const LiveTrackingService = require('../src/services/LiveTrackingService').default;

function primeQueue() {
  LiveTrackingService.sessionId = 101;
  LiveTrackingService.queue = [{
    client_point_id: 'cp-1', sequence: 1, latitude: 23.0, longitude: 72.0,
    timestamp: new Date().toISOString(),
  }];
}

describe('LiveTrackingService._sync connectivity gate', () => {
  beforeEach(() => {
    api.sendLivePoints.mockClear();
    serverStatus._online = true;
    serverStatus._cachedAt = null;
  });

  test('known offline: skips the upload attempt and keeps the queue intact', async () => {
    primeQueue();
    serverStatus.setOffline(Date.now());

    await LiveTrackingService._sync();

    expect(api.sendLivePoints).not.toHaveBeenCalled();
    expect(LiveTrackingService.queue).toHaveLength(1);
  });

  test('online: attempts the upload as before', async () => {
    primeQueue();
    serverStatus.setOnline();

    await LiveTrackingService._sync();

    expect(api.sendLivePoints).toHaveBeenCalledTimes(1);
  });

  test('final sync (session end) still attempts even when known offline', async () => {
    primeQueue();
    serverStatus.setOffline(Date.now());

    await LiveTrackingService._sync(true);

    expect(api.sendLivePoints).toHaveBeenCalledTimes(1);
  });
});
