/**
 * PhotoCapture — the shared camera/gallery gate every photo field uses
 * (Customer Photo, Receipt Photo, Document, House Photo, UPI Screenshot,
 * Supporting Document).
 *
 * The regression these tests lock down: the app's AndroidManifest declares
 * android.permission.CAMERA, and react-native-image-picker refuses to start
 * the camera intent until that permission is runtime-granted — previously
 * nothing requested it and every call site swallowed the resulting error, so
 * tapping Camera did nothing at all.
 */
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import {
  capturePhotoFromCamera,
  pickPhotoFromGallery,
  ensureCameraPermission,
  STANDARD_PHOTO_OPTIONS,
} from '../src/services/PhotoCapture';

const CAPTURED_ASSET = {
  uri: 'file:///cache/photo_1.jpg',
  fileName: 'photo_1.jpg',
  type: 'image/jpeg',
};

// Force the Android code path (the RN jest preset resolves the iOS Platform
// module, whose OS is a plain property).
const setPlatform = (os) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  // Default Android permission spies — individual tests override the value;
  // having them everywhere lets every test assert "was NOT called" too.
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');
  setPlatform('android');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ensureCameraPermission (Android)', () => {
  it('returns true without prompting when CAMERA is already granted', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);

    await expect(ensureCameraPermission()).resolves.toBe(true);
    expect(PermissionsAndroid.check).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('requests the permission and returns true when the user allows', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted');

    await expect(ensureCameraPermission()).resolves.toBe(true);
    expect(PermissionsAndroid.request).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      expect.objectContaining({ title: 'Camera Permission' }),
    );
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('denied → clear message, returns false', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');

    await expect(ensureCameraPermission()).resolves.toBe(false);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert.mock.calls[0][0]).toBe('Camera Permission Needed');
  });

  it('permanently denied (never_ask_again) → blocked message with Open Settings', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('never_ask_again');
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

    await expect(ensureCameraPermission()).resolves.toBe(false);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = Alert.alert.mock.calls[0];
    expect(title).toBe('Camera Access Blocked');
    expect(message).toMatch(/Settings/);
    const settingsBtn = buttons.find((b) => b.text === 'Open Settings');
    expect(settingsBtn).toBeDefined();

    // The Settings action actually opens the app's Settings page.
    settingsBtn.onPress();
    expect(openSettings).toHaveBeenCalled();
  });

  it('logs and fails closed when the permission API throws', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockRejectedValue(new Error('bridge down'));

    await expect(ensureCameraPermission()).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalled();
  });
});

describe('capturePhotoFromCamera', () => {
  it('does NOT launch the camera when permission is denied', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');

    const asset = await capturePhotoFromCamera(STANDARD_PHOTO_OPTIONS);

    expect(asset).toBeNull();
    expect(launchCamera).not.toHaveBeenCalled();
  });

  it('launches the camera and returns the captured asset when granted', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    launchCamera.mockResolvedValue({ assets: [CAPTURED_ASSET] });

    const asset = await capturePhotoFromCamera(STANDARD_PHOTO_OPTIONS);

    expect(launchCamera).toHaveBeenCalledWith(STANDARD_PHOTO_OPTIONS);
    expect(asset).toEqual(CAPTURED_ASSET);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('passes picker errors through as log + alert + null (no silent failure)', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    launchCamera.mockResolvedValue({
      errorCode: 'others',
      errorMessage:
        'This library does not require Manifest.permission.CAMERA, if you add this permission in manifest then you have to obtain the same.',
    });

    const asset = await capturePhotoFromCamera({});

    expect(asset).toBeNull();
    expect(console.warn).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert.mock.calls[0][0]).toBe('Camera Error');
  });

  it('returns null silently when the user cancels', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    launchCamera.mockResolvedValue({ didCancel: true });

    await expect(capturePhotoFromCamera({})).resolves.toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('surfaces a synchronous launch failure instead of throwing', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    launchCamera.mockRejectedValue(new Error('No activity found to handle intent'));

    await expect(capturePhotoFromCamera({})).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });
});

describe('pickPhotoFromGallery', () => {
  it('picks without ever requesting CAMERA permission', async () => {
    launchImageLibrary.mockResolvedValue({ assets: [CAPTURED_ASSET] });

    const asset = await pickPhotoFromGallery(STANDARD_PHOTO_OPTIONS);

    expect(launchImageLibrary).toHaveBeenCalledWith(STANDARD_PHOTO_OPTIONS);
    expect(asset).toEqual(CAPTURED_ASSET);
    expect(PermissionsAndroid.check).not.toHaveBeenCalled();
    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  });

  it('shows a gallery-specific alert on picker error', async () => {
    launchImageLibrary.mockResolvedValue({ errorCode: 'others', errorMessage: 'boom' });

    await expect(pickPhotoFromGallery({})).resolves.toBeNull();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert.mock.calls[0][0]).toBe('Gallery Error');
  });
});

describe('iOS', () => {
  it('launches the camera without a runtime permission request', async () => {
    setPlatform('ios');
    launchCamera.mockResolvedValue({ assets: [CAPTURED_ASSET] });

    const asset = await capturePhotoFromCamera({});

    expect(launchCamera).toHaveBeenCalled();
    expect(asset).toEqual(CAPTURED_ASSET);
    expect(PermissionsAndroid.check).not.toHaveBeenCalled();
    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  });
});
