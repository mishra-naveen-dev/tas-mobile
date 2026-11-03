// Asked once, when route tracking first starts: Doze and the phone maker's
// battery manager otherwise stop the tracker during long idle stretches,
// and the route ends silently (Fix Plan Part 2, A1).
import { Alert, Linking, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

const ASKED_KEY = 'battery_exemption_asked';
// Makers whose own battery managers kill background apps beyond Android's.
const AGGRESSIVE_BRANDS = ['xiaomi', 'redmi', 'poco', 'vivo', 'iqoo', 'oppo', 'realme', 'oneplus', 'samsung'];

export async function ensureBatteryExemption() {
    if (Platform.OS !== 'android') return;
    try {
        if (await AsyncStorage.getItem(ASKED_KEY)) return;
        await AsyncStorage.setItem(ASKED_KEY, '1');
    } catch {
        return;
    }
    await NativeModules.TrackingBridge?.requestBatteryExemption?.();

    const brand = String(DeviceInfo.getBrand?.() || '').toLowerCase();
    if (!AGGRESSIVE_BRANDS.some((b) => brand.includes(b))) return;
    Alert.alert(
        'Keep route tracking on',
        'This phone can stop TAS in the background. Please allow it once:\n\n'
            + 'Settings → Apps → TAS → Battery → Allow background activity '
            + '(and turn on Auto-launch / Autostart if you see it).',
        [
            { text: 'Later', style: 'cancel' },
            { text: 'Open settings', onPress: () => Linking.openSettings() },
        ],
    );
}
