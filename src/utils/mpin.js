// App MPIN: 6 digits kept in the Keychain (Android Keystore-encrypted, see
// secureStorage) and bound to the user it was set for. Checked on the device
// so unlocking works offline in the field; the server still forces a password
// login 30 days after the last one (MOBILE_REFRESH_TOKEN_LIFETIME).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureGetItem, secureSetItem, secureMultiRemove } from './secureStorage';

export const MPIN_LENGTH = 6;
export const MAX_MPIN_ATTEMPTS = 5;
export const LOCK_AFTER_BACKGROUND_MS = 5 * 60 * 1000;

const MPIN_KEY = 'mpin';
// AsyncStorage, not memory: killing the app must not reset the count.
const ATTEMPTS_KEY = 'mpin_attempts';

const readStored = async () => {
    try { return JSON.parse((await secureGetItem(MPIN_KEY)) || 'null'); } catch { return null; }
};

export const hasMpin = async (userId) => {
    const stored = await readStored();
    return !!stored && userId != null && String(stored.user) === String(userId);
};

/** Same digit repeated, or a straight run up/down (123456, 987654). */
export const isWeakMpin = (pin) => {
    if (/^(\d)\1+$/.test(pin)) return true;
    const steps = new Set();
    for (let i = 1; i < pin.length; i++) steps.add(pin.charCodeAt(i) - pin.charCodeAt(i - 1));
    return steps.size === 1 && (steps.has(1) || steps.has(-1));
};

export const saveMpin = async (userId, pin) => {
    await secureSetItem(MPIN_KEY, JSON.stringify({ user: userId, pin }));
    await AsyncStorage.removeItem(ATTEMPTS_KEY);
};

/** @returns {{ok: true} | {ok: false, attemptsLeft: number}} */
export const checkMpin = async (pin) => {
    const stored = await readStored();
    if (stored && stored.pin === pin) {
        await AsyncStorage.removeItem(ATTEMPTS_KEY);
        return { ok: true };
    }
    const attempts = Number((await AsyncStorage.getItem(ATTEMPTS_KEY)) || 0) + 1;
    await AsyncStorage.setItem(ATTEMPTS_KEY, String(attempts));
    return { ok: false, attemptsLeft: Math.max(0, MAX_MPIN_ATTEMPTS - attempts) };
};

export const clearMpin = async () => {
    await secureMultiRemove([MPIN_KEY]);
    await AsyncStorage.removeItem(ATTEMPTS_KEY);
};
