/**
 * MPIN storage: bound to one user, 5 wrong attempts (counted across app
 * restarts, i.e. persisted) before the caller forces a password login, and
 * trivially guessable PINs refused at setup.
 */
const store = {};
jest.mock('../src/utils/secureStorage', () => ({
    secureGetItem: jest.fn(async (k) => store[k] ?? null),
    secureSetItem: jest.fn(async (k, v) => { store[k] = v; }),
    secureMultiRemove: jest.fn(async (keys) => keys.forEach((k) => delete store[k])),
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');
const { hasMpin, saveMpin, checkMpin, clearMpin, isWeakMpin, MAX_MPIN_ATTEMPTS } = require('../src/utils/mpin');

beforeEach(async () => {
    Object.keys(store).forEach((k) => delete store[k]);
    await AsyncStorage.clear();
});

test('an MPIN belongs to the user who set it', async () => {
    await saveMpin(7, '482916');
    expect(await hasMpin(7)).toBe(true);
    expect(await hasMpin(8)).toBe(false);
    expect(await hasMpin(null)).toBe(false);
});

test('correct MPIN unlocks and resets the wrong-attempt count', async () => {
    await saveMpin(7, '482916');
    expect(await checkMpin('000001')).toEqual({ ok: false, attemptsLeft: MAX_MPIN_ATTEMPTS - 1 });
    expect(await checkMpin('482916')).toEqual({ ok: true });
    expect(await checkMpin('000001')).toEqual({ ok: false, attemptsLeft: MAX_MPIN_ATTEMPTS - 1 });
});

test('attempts run out after 5 wrong tries', async () => {
    await saveMpin(7, '482916');
    let res;
    for (let i = 0; i < MAX_MPIN_ATTEMPTS; i++) res = await checkMpin('111112');
    expect(res).toEqual({ ok: false, attemptsLeft: 0 });
});

test('clearMpin forgets the MPIN', async () => {
    await saveMpin(7, '482916');
    await clearMpin();
    expect(await hasMpin(7)).toBe(false);
});

test('weak MPINs are refused', () => {
    ['000000', '111111', '123456', '987654', '456789'].forEach((p) => expect(isWeakMpin(p)).toBe(true));
    ['482916', '112233', '135790', '121212'].forEach((p) => expect(isWeakMpin(p)).toBe(false));
});
