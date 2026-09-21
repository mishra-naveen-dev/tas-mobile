import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import LocationService from '../services/LocationService';

/**
 * Single shared GPS-payload builder for every field activity (Punch,
 * Collection visit, and any future type) — the one place that assembles
 * the rich payload the backend's Field Activity engine expects, so Punch
 * and Collection never again build two independent "get GPS and send it"
 * implementations.
 *
 * Not a stateful React hook (no internal state to subscribe to) — it's a
 * plain async function, named to match the shared-capture concept it
 * represents. Call it directly from an event handler (punch, save, ...).
 *
 * Returns the same shape LocationService.getCurrentLocation() already
 * returns (latitude/longitude/accuracy/speed/address/isMock/error...),
 * plus: altitude, heading, battery_level, is_mock_location,
 * mock_detection_method, gps_provider, network_status, device_timestamp.
 */
export async function captureFieldActivityLocation() {
  const location = await LocationService.getCurrentLocation();

  if (location.error) {
    return location;
  }

  // Validate location quality: latitude/longitude/timestamp/accuracy must be
  // present and sane. A reading failing this is never passed off as current —
  // the caller surfaces the error (retry UI) instead of silently saving a
  // bad fix. Same coordinates as the previous activity are valid — only the
  // shape/freshness is checked here, never movement.
  if (
    typeof location.latitude !== 'number' || typeof location.longitude !== 'number'
    || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)
    || !location.timestamp || typeof location.accuracy !== 'number'
  ) {
    return {
      error: 'GPS returned an invalid location — please retry in an open area.',
      errorType: 'GPS_ERROR',
      latitude: null,
      longitude: null,
      address: '',
      isMock: false,
    };
  }

  let batteryLevel = null;
  try {
    const level = await DeviceInfo.getBatteryLevel();
    if (level != null && level >= 0) batteryLevel = Math.round(level * 100);
  } catch {
    // Battery read is best-effort — never blocks GPS capture.
  }

  let isEmulator = false;
  try {
    isEmulator = await DeviceInfo.isEmulator();
  } catch {
    // Emulator check is best-effort too.
  }

  let isMockLocation = false;
  let mockDetectionMethod = 'NONE';
  if (location.coordsMocked) {
    isMockLocation = true;
    mockDetectionMethod = Platform.OS === 'android' ? 'ANDROID_COORDS_MOCKED' : 'IOS_NOT_SUPPORTED';
  } else if (isEmulator) {
    isMockLocation = true;
    mockDetectionMethod = 'DEVICE_INFO_EMULATOR';
  } else if (Platform.OS === 'ios') {
    // iOS exposes no OS-level mock-location signal via any installed
    // library — send an explicit "not supported" marker rather than
    // silently omitting the field, so it's never mistaken for "checked
    // and clean."
    mockDetectionMethod = 'IOS_NOT_SUPPORTED';
  }

  let networkStatus = 'UNKNOWN';
  try {
    const netState = await NetInfo.fetch();
    networkStatus = netState.isConnected && netState.isInternetReachable !== false ? 'ONLINE' : 'OFFLINE';
  } catch {
    // Best-effort — never blocks GPS capture over a network-status read.
  }

  return {
    ...location,
    altitude: location.altitude ?? null,
    heading: location.heading ?? null,
    battery_level: batteryLevel,
    is_mock_location: isMockLocation,
    mock_detection_method: mockDetectionMethod,
    // Backend audit columns: provider is free-text ('gps' for a live fix,
    // 'cached' preserved from the fallback row). Never send a blank provider
    // for a live fix — an empty string is indistinguishable from "unknown".
    gps_provider: location.gps_provider || location.provider || (location.locationSource === 'CACHED' ? 'cached' : 'gps'),
    provider: location.provider || (location.locationSource === 'CACHED' ? 'cached' : 'gps'),
    network_status: networkStatus,
    device_timestamp: new Date(location.timestamp || Date.now()).toISOString(),
    // Explicit audit trail per activity: own capture time + age in seconds,
    // so each of several same-spot activities carries its own timestamp even
    // when coordinates are almost identical — never reused from Activity 1.
    captured_at: new Date(location.timestamp || Date.now()).toISOString(),
    location_age_seconds: location.locationAgeSeconds
      ?? Math.max(0, Math.round((Date.now() - (location.timestamp || Date.now())) / 1000)),
    // 'LIVE' (fresh GPS fix) or 'CACHED' (LocationService fell back to the
    // device's last known-good fix only after all live retries failed — see
    // LocationService.getCurrentLocation). The backend/admin uses this to
    // distinguish a live-verified point from a stand-in.
    location_source: location.locationSource || 'LIVE',
  };
}
