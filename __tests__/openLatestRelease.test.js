/**
 * Tapping an APP_UPDATE_AVAILABLE notification (in-app list or OS push), or
 * "Update Now", downloads and installs the newest release - natively with a
 * signature check on Android, via the browser otherwise.
 */
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Linking: { openURL: jest.fn().mockResolvedValue(true) },
  Platform: { OS: 'android' },
  NativeModules: { ApkUpdate: { downloadAndInstall: jest.fn() } },
}));
jest.mock('react-native-device-info', () => ({ getBuildNumber: () => '60' }));
jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { checkMobileRelease: jest.fn(), getMobileReleaseDownloadUrl: jest.fn() },
}));

const { Alert, Linking, NativeModules } = require('react-native');
const api = require('../src/api/api').default;
const { openLatestRelease, navigateForNotification } = require('../src/utils/notificationNavigation');

const native = NativeModules.ApkUpdate;

beforeEach(() => {
  jest.clearAllMocks();
  NativeModules.ApkUpdate = native;
  api.checkMobileRelease.mockResolvedValue({
    data: { update_available: true, latest: { version_code: 61, version_name: '1.60' } },
  });
  api.getMobileReleaseDownloadUrl.mockResolvedValue({ data: { download_url: 'https://s3/apk' } });
});

test('downloads the newest release natively and opens the installer', async () => {
  native.downloadAndInstall.mockResolvedValue('INSTALLER_OPENED');

  await openLatestRelease();

  expect(api.checkMobileRelease).toHaveBeenCalledWith(60);
  expect(api.getMobileReleaseDownloadUrl).toHaveBeenCalledWith(61);
  expect(native.downloadAndInstall).toHaveBeenCalledWith('https://s3/apk', 'NamraCred TAS 1.60', 'tas-1.60-61.apk');
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('an incomplete download asks the user to retry instead of opening a broken installer', async () => {
  native.downloadAndInstall.mockRejectedValue(Object.assign(new Error('bad'), { code: 'CORRUPT' }));

  await openLatestRelease();

  expect(Alert.alert).toHaveBeenCalledWith('Update', expect.stringContaining('incomplete'));
});

test('falls back to the browser when the native module is missing', async () => {
  NativeModules.ApkUpdate = undefined;

  await openLatestRelease();

  expect(Linking.openURL).toHaveBeenCalledWith('https://s3/apk');
});

test('already on the latest version: tells the user instead of downloading', async () => {
  api.checkMobileRelease.mockResolvedValue({ data: { update_available: false, latest: null } });

  await openLatestRelease();

  expect(native.downloadAndInstall).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('Up to date', expect.any(String));
});

test('network failure shows a retry message', async () => {
  api.checkMobileRelease.mockRejectedValue(new Error('offline'));

  await openLatestRelease();

  expect(Alert.alert).toHaveBeenCalledWith('Update', expect.any(String));
});

test('a tapped OS push for an update starts it even before navigation is ready', async () => {
  api.checkMobileRelease.mockResolvedValue({ data: { update_available: false } });
  navigateForNotification({ current: null }, { notification_type: 'APP_UPDATE_AVAILABLE' });
  await new Promise((r) => setImmediate(r));
  expect(api.checkMobileRelease).toHaveBeenCalled();
});
