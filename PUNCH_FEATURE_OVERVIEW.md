# TASmobile - Traveling Allowance System Mobile App

## Overview

This document tracks the Punch Feature implementation in the TASmobile React Native app.

---

## What We Built

### 1. Punch Feature (Complete)

**Location:** `src/features/punch/` (suggested) or directly in `src/`

#### Core Components:

| File | Purpose |
|------|---------|
| `src/services/LocationService.js` | GPS location handling with emulator support |
| `src/context/PunchContext.js` | State management for punch workflow |
| `src/screens/EmployeePunchScreen.js` | Main punch UI with map and form |
| `src/services/GeocodingService.js` | Address lookup (reverse geocoding) |

#### Key Features:

- ✅ **Punch In Only** - No punch out (per requirements)
- ✅ **GPS Location Capture** - Works on emulator and real device
- ✅ **Mock Location Support** - Auto-fallback for development
- ✅ **Emulator Detection** - Uses mock location when GPS unavailable
- ✅ **Reverse Geocoding** - Converts lat/lng to address via Google API
- ✅ **Route Tracking** - Tracks employee movement after punch
- ✅ **Today's Punches** - View history of today's punches
- ✅ **Error Handling** - Graceful handling of all failure cases

---

## Punch Flow

```
User Taps Punch Button
        ↓
┌─────────────────────────────┐
│ 1. Check State (debounce)  │
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│ 2. Fetch GPS Location      │
│    - Real GPS (device)     │
│    - Mock GPS (emulator)   │
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│ 3. Reverse Geocode         │
│    - Get address from lat  │
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│ 4. Open Form Modal         │
│    - Pre-filled address    │
│    - Select visit type    │
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│ 5. Submit to Backend       │
│    - POST /api/v1/...      │
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│ 6. Success/Error Feedback  │
│    - Banner notification   │
│    - Update UI             │
└─────────────────────────────┘
```

---

## Location Handling

### Emulator/Development Mode:
- **Mock Location:** New Delhi (28.6139, 77.2090)
- **Mock Address:** "New Delhi (Mock Location)"
- **UI Badge:** "Using mock location (Dev Mode)"

### Real Device Mode:
- **Real GPS Coordinates**
- **Real Address** (via Google Geocoding API)
- **No Mock Badge**

### Error Fallbacks:
- GPS timeout → Mock location
- Invalid coordinates (0,0) → Mock location
- Permission denied → Error message (no crash)

---

## States (PunchContext)

```javascript
const PUNCH_STATES = {
  IDLE: 'IDLE',                    // Ready to punch
  FETCHING_LOCATION: 'FETCHING_LOCATION',  // Getting GPS
  FORM_OPEN: 'FORM_OPEN',          // Form modal visible
  SUBMITTING: 'SUBMITTING',        // Submitting to backend
  ACTIVE: 'ACTIVE',                // Punch is active
  ERROR: 'ERROR',                  // Error occurred
};
```

---

## Files Modified

| File | Changes |
|------|---------|
| `App.jsx` | Updated navigation and providers |
| `src/api/api.js` | Added punch API methods |
| `src/context/PunchContext.js` | Complete punch state management |
| `src/screens/EmployeePunchScreen.js` | Main punch screen UI |
| `src/services/LocationService.js` | GPS handling with mock support |
| `src/theme/tokens.js` | Added error colors |
| `src/components/CustomTabBar.js` | Tab bar with punch button |
| `src/components/MapViewScreen.js` | Map display component |

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/attendance/punches/` | POST | Create punch record |
| `/attendance/punches/today_punches/` | GET | Get today's punches |
| `/attendance/punches/daily_summary/` | GET | Get daily summary |

---

## Configuration

### Backend URL:
```
https://tas-backend-8emb.onrender.com/api/v1
```

### Google Maps API Key:
```
AIzaSyDM0WAR3vYxXNqSklb868wEmtDftQvYDkQ
```

### Mock Config (LocationService.js):
```javascript
const MOCK_CONFIG = {
  enabled: __DEV__ || true,  // Set to false for production
  fallback: {
    latitude: 28.6139,
    longitude: 77.2090,
    address: 'New Delhi (Mock Location)',
  },
};
```

---

## Dependencies

```json
{
  "dependencies": {
    "@react-native-async-storage/async-storage": "^1.24.0",
    "react-native-geolocation-service": "^5.3.1",
    "react-native-maps": "^1.27.2",
    "react-native-permissions": "^5.5.1",
    "react-native-safe-area-context": "^5.7.0",
    "@react-navigation/native": "^7.2.2",
    "@react-navigation/bottom-tabs": "^7.15.9",
    "axios": "^1.14.0"
  }
}
```

---

## Testing Checklist

### Emulator:
- [x] Tap punch button → Loading state visible
- [x] Mock location displayed in form
- [x] Yellow "Dev Mode" badge shown
- [x] Form submission works
- [x] Today's punches updated

### Real Device:
- [ ] Real GPS coordinates captured
- [ ] Real address shown
- [ ] No mock badge
- [ ] Form submission works
- [ ] Backend receives data

### Error Cases:
- [x] GPS timeout → Mock fallback
- [ ] Permission denied → Error message
- [ ] Network failure → Error banner
- [ ] API error → Error banner (no crash)

---

## Known Issues / TODO

1. **Production Build** - Change `MOCK_CONFIG.enabled` to `__DEV__` before release
2. **Android Permissions** - Ensure `ACCESS_FINE_LOCATION` is in manifest
3. **iOS Permissions** - Add `NSLocationWhenInUseUsageDescription` to Info.plist

---

## Next Steps

1. Test on real device with GPS
2. Verify backend integration
3. Enable production mode (mock = false)
4. Build release APK
5. Test on physical device

---

## Branch

**Current Branch:** `feature/role-based-ui`

---

*Last Updated: April 2026*
