import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

// Shared picker options for evidence photos — the exact values every screen
// passed inline before (kept identical so compression/quality behaviour does
// not change for any existing photo field).
export const STANDARD_PHOTO_OPTIONS = {
  mediaType: 'photo',
  quality: 0.7,
  maxWidth: 1600,
  maxHeight: 1600,
  saveToPhotos: false,
};

const openSettings = () => {
  Linking.openSettings().catch(() => {});
};

/**
 * Request the Android CAMERA runtime permission before launchCamera().
 *
 * Why this exists: our AndroidManifest declares android.permission.CAMERA,
 * and react-native-image-picker refuses to start the camera intent in that
 * case until the permission is actually granted (Utils
 * .isCameraPermissionFulfilled → error `others`, "…if you add this permission
 * in manifest then you have to obtain the same"). Nothing in the app used to
 * request it, so launchCamera failed silently on every device where the user
 * hadn't manually granted Camera in Settings.
 *
 * Returns true when the camera may be launched, false when it must not be
 * (denied / permanently blocked — each with a clear message, and an Open
 * Settings action when the OS will never show the prompt again).
 */
export const ensureCameraPermission = async () => {
  // iOS has no CAMERA runtime-permission API — the system prompt is driven
  // by NSCameraUsageDescription in Info.plist on first camera use.
  if (Platform.OS !== 'android') return true;

  try {
    const alreadyGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    if (alreadyGranted) return true;

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message:
          'TAS needs camera access to take photos as proof for visits, collections and punches.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );

    if (result === PermissionsAndroid.RESULTS.GRANTED) return true;

    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      // Permanently denied — the OS will never show the prompt again, so the
      // only way forward is the app's Settings page.
      Alert.alert(
        'Camera Access Blocked',
        'Camera permission is turned off for TAS and can no longer be requested. Enable it in Settings to take photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: openSettings },
        ],
      );
    } else {
      Alert.alert(
        'Camera Permission Needed',
        'Camera access is required to take a photo. Please allow the camera permission and try again.',
      );
    }
    return false;
  } catch (e) {
    console.warn('[PhotoCapture] camera permission request failed:', e?.message || e);
    Alert.alert('Camera Unavailable', 'Could not request camera permission. Please try again.');
    return false;
  }
};

// Surface picker failures instead of swallowing them: console.warn lands in
// logcat as W/ReactNativeJS (the field-diagnosis path for "camera did
// nothing"), and the user gets a readable alert instead of silence.
const surfaceError = (result, source) => {
  console.warn(
    `[PhotoCapture] ${source} failed:`,
    result?.errorCode,
    result?.errorMessage || '',
  );
  Alert.alert(
    source === 'camera' ? 'Camera Error' : 'Gallery Error',
    result?.errorMessage ||
      (source === 'camera'
        ? 'Could not open the camera. Please try again, or choose a photo from the Gallery instead.'
        : 'Could not open the photo gallery. Please try again.'),
  );
};

// Shared response handling for both sources: cancelled → silent null;
// errorCode → log + alert + null; success → the asset (same shape the
// screens already consumed: uri/fileName/type/…).
const normalizeResult = (result, source) => {
  if (result?.didCancel) return null;
  if (result?.errorCode) {
    surfaceError(result, source);
    return null;
  }
  const asset = result?.assets?.[0];
  if (!asset?.uri) return null; // nothing captured/picked — stay quiet
  return asset;
};

/**
 * Open the device camera after ensuring the runtime permission, and return
 * the captured asset ({ uri, fileName, type, … }) or null.
 */
export const capturePhotoFromCamera = async (options = {}) => {
  const granted = await ensureCameraPermission();
  if (!granted) return null;
  try {
    const result = await launchCamera(options);
    return normalizeResult(result, 'camera');
  } catch (e) {
    console.warn('[PhotoCapture] launchCamera threw:', e?.message || e);
    Alert.alert(
      'Camera Error',
      'Could not open the camera. Please try again, or choose a photo from the Gallery instead.',
    );
    return null;
  }
};

/**
 * Open the gallery/photo picker (no runtime permission needed — Android
 * Photo Picker / iOS PHPicker) and return the picked asset or null.
 */
export const pickPhotoFromGallery = async (options = {}) => {
  try {
    const result = await launchImageLibrary(options);
    return normalizeResult(result, 'gallery');
  } catch (e) {
    console.warn('[PhotoCapture] launchImageLibrary threw:', e?.message || e);
    Alert.alert('Gallery Error', 'Could not open the photo gallery. Please try again.');
    return null;
  }
};
