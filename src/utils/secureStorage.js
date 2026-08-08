import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Auth tokens (access/refresh/session) are stored in the OS-level secure
// credential store (Android Keystore-backed EncryptedSharedPreferences / iOS
// Keychain) instead of AsyncStorage, which persists as plaintext on disk.
// Keychain's generic-password API holds one username/password pair per
// "service" slot, so each logical key gets its own service name.

const SERVICE_PREFIX = 'tas_auth_';

export const secureGetItem = async (key) => {
    try {
        const creds = await Keychain.getGenericPassword({ service: SERVICE_PREFIX + key });
        if (creds) return creds.password;
    } catch (e) {
        if (__DEV__) console.error(`[secureStorage] getItem(${key}) error:`, e);
    }
    // One-time migration path: an app upgraded from a version that stored
    // this key in plaintext AsyncStorage. Move it into Keychain and remove
    // the plaintext copy so the user isn't silently logged out on upgrade.
    try {
        const legacy = await AsyncStorage.getItem(key);
        if (legacy) {
            await secureSetItem(key, legacy);
            await AsyncStorage.removeItem(key);
            return legacy;
        }
    } catch (e) {
        if (__DEV__) console.error(`[secureStorage] migration(${key}) error:`, e);
    }
    return null;
};

export const secureSetItem = async (key, value) => {
    await Keychain.setGenericPassword(key, value, { service: SERVICE_PREFIX + key });
};

export const secureRemoveItem = async (key) => {
    try {
        await Keychain.resetGenericPassword({ service: SERVICE_PREFIX + key });
    } catch (e) {
        if (__DEV__) console.error(`[secureStorage] removeItem(${key}) error:`, e);
    }
    // Clear any leftover legacy plaintext copy too.
    await AsyncStorage.removeItem(key);
};

export const secureMultiRemove = async (keys) => {
    await Promise.all(keys.map(secureRemoveItem));
};
