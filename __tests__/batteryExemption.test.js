/**
 * Battery-optimisation exemption (Fix Plan Part 2, A1): asked once per
 * install, plus a settings guide on makers known to kill background apps.
 */
const mockBrand = { value: 'realme' };
jest.mock('react-native-device-info', () => ({ getBrand: () => mockBrand.value }));

const RN = require('react-native');
const AsyncStorage = require('@react-native-async-storage/async-storage');
const { ensureBatteryExemption } = require('../src/utils/batteryExemption');

beforeEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.clear();
    RN.Platform.OS = 'android';
    RN.NativeModules.TrackingBridge = { requestBatteryExemption: jest.fn(async () => false) };
    jest.spyOn(RN.Alert, 'alert').mockImplementation(() => {});
});

test('asks once, and shows the background-activity guide on a Realme phone', async () => {
    await ensureBatteryExemption();
    await ensureBatteryExemption();
    expect(RN.NativeModules.TrackingBridge.requestBatteryExemption).toHaveBeenCalledTimes(1);
    expect(RN.Alert.alert).toHaveBeenCalledTimes(1);
});

test('no extra guide on makers without their own battery killer', async () => {
    mockBrand.value = 'google';
    await ensureBatteryExemption();
    expect(RN.NativeModules.TrackingBridge.requestBatteryExemption).toHaveBeenCalledTimes(1);
    expect(RN.Alert.alert).not.toHaveBeenCalled();
});
