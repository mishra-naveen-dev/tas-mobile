/**
 * Tapping an APP_UPDATE_AVAILABLE notification (in-app list or OS push)
 * opens the newest release's download link, or says the app is up to date.
 */
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Linking: { openURL: jest.fn().mockResolvedValue(true) },
}));
jest.mock('react-native-device-info', () => ({ getBuildNumber: () => '60' }));
jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { checkMobileRelease: jest.fn(), getMobileReleaseDownloadUrl: jest.fn() },
}));

const { Alert, Linking } = require('react-native');
const api = require('../src/api/api').default;
const { openLatestRelease, navigateForNotification } = require('../src/utils/notificationNavigation');

beforeEach(() => jest.clearAllMocks());

test('opens the newest release download link', async () => {
  api.checkMobileRelease.mockResolvedValue({ data: { update_available: true, latest: { version_code: 61 } } });
  api.getMobileReleaseDownloadUrl.mockResolvedValue({ data: { download_url: 'https://s3/apk' } });

  await openLatestRelease();

  expect(api.checkMobileRelease).toHaveBeenCalledWith(60);
  expect(api.getMobileReleaseDownloadUrl).toHaveBeenCalledWith(61);
  expect(Linking.openURL).toHaveBeenCalledWith('https://s3/apk');
});

test('already on the latest version: tells the user instead of opening anything', async () => {
  api.checkMobileRelease.mockResolvedValue({ data: { update_available: false, latest: null } });

  await openLatestRelease();

  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('Up to date', expect.any(String));
});

test('network failure shows a retry message', async () => {
  api.checkMobileRelease.mockRejectedValue(new Error('offline'));

  await openLatestRelease();

  expect(Alert.alert).toHaveBeenCalledWith('Update', expect.any(String));
});

test('a tapped OS push for an update opens it even before navigation is ready', async () => {
  api.checkMobileRelease.mockResolvedValue({ data: { update_available: false } });
  navigateForNotification({ current: null }, { notification_type: 'APP_UPDATE_AVAILABLE' });
  await new Promise((r) => setImmediate(r));
  expect(api.checkMobileRelease).toHaveBeenCalled();
});
