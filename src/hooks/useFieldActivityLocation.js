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
    gps_provider: '',
    network_status: networkStatus,
    device_timestamp: new Date(location.timestamp || Date.now()).toISOString(),
    // 'LIVE' (fresh GPS fix) or 'CACHED' (LocationService fell back to the
    // device's last known-good fix — see LocationService.getCachedLocation)
    // — lets the backend/admin distinguish a live-verified point from a
    // stand-in used because live acquisition genuinely failed.
    location_source: location.locationSource || 'LIVE',
  };
}
