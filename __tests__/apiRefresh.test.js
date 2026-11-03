/**
 * api.js token refresh + reconnect behaviour.
 * - Requests that 401 together share ONE refresh call: refresh tokens are
 *   single-use, and a second refresh with the same token was rejected and
 *   logged the user out.
 * - After a network drop comes back, the server is re-checked so the
 *   "Server unreachable" banner clears even if no other request runs.
 */
import axios from 'axios';

const store = {};
jest.mock('../src/utils/secureStorage', () => ({
    secureGetItem: jest.fn(async (k) => store[k] ?? null),
    secureSetItem: jest.fn(async (k, v) => { store[k] = v; }),
    secureMultiRemove: jest.fn(async (keys) => keys.forEach((k) => delete store[k])),
}));
jest.mock('../src/utils/dataCache', () => ({
    cacheWrite: jest.fn(), cacheRead: jest.fn(async () => null), makeCacheKey: jest.fn(() => 'k'),
}));
jest.mock('react-native-device-info', () => ({
    getUniqueId: jest.fn(async () => 'dev'), getModel: () => 'm', getBrand: () => 'b',
    getSystemVersion: () => '15', getManufacturer: async () => 'x', getVersion: () => '1.62', getBuildNumber: () => '63',
}), { virtual: true });

const api = require('../src/api/api').default;
const { serverStatus } = require('../src/utils/serverStatus');

beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    jest.restoreAllMocks();
});

test('concurrent 401s refresh the token once and both requests succeed', async () => {
    store.access = 'old';
    store.refresh = 'r1';
    api.defaults.adapter = async (config) => {
        if (config.headers.Authorization === 'Bearer new') return { data: 'ok', status: 200, headers: {}, config };
        return Promise.reject({ config, response: { status: 401, data: {} } });
    };
    const post = jest.spyOn(axios, 'post').mockImplementation(
        () => new Promise((r) => setTimeout(() => r({ data: { access: 'new', refresh: 'r2' } }), 10)),
    );

    const [a, b] = await Promise.all([api.get('/a/'), api.get('/b/')]);

    expect(a.data).toBe('ok');
    expect(b.data).toBe('ok');
    expect(post).toHaveBeenCalledTimes(1);
    expect(store.refresh).toBe('r2');
});

test('network coming back re-checks the server and clears the offline banner', async () => {
    jest.useFakeTimers();
    const get = jest.spyOn(axios, 'get').mockResolvedValue({ data: { status: 'alive' } });
    serverStatus.setOnline();

    serverStatus.setNetworkAvailable(false);
    serverStatus.setNetworkAvailable(true);
    expect(serverStatus._online).toBe(false);

    await jest.advanceTimersByTimeAsync(6000);

    expect(get).toHaveBeenCalledWith(expect.stringContaining('/health/live/'), expect.anything());
    expect(serverStatus._online).toBe(true);
    jest.useRealTimers();
});
