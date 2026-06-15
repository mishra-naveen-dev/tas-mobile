# TASmobile - Punch Feature Overview

## Overview

Production-ready location tracking system using free React Native libraries only. No paid SDK dependencies.

---

## Technology Stack

| Package | Purpose |
|---------|---------|
| `react-native-geolocation-service` | GPS location |
| `react-native-maps` | Map display |
| `react-native-background-fetch` | Background tracking |

**Removed:** Transistorsoft Background Geolocation (paid license)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PunchContext                          │
│  States: IDLE → FETCHING → FORM_OPEN → TRACKING        │
└─────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Location   │   │  Employee  │   │    API     │
│  Service    │   │  Punch     │   │  Service   │
│             │   │  Screen    │   │            │
└─────────────┘   └─────────────┘   └─────────────┘
```

---

## LocationService

**File:** `src/services/LocationService.js`

### Features
- ✅ Real GPS first, mock as dev fallback
- ✅ Haversine distance calculation
- ✅ Route point tracking
- ✅ 10-second intervals, 20m distance filter
- ✅ Crash-safe with try/catch everywhere

### Key Methods

```javascript
// Get current location
await LocationService.getCurrentLocation()
// Returns: { latitude, longitude, accuracy, speed, isMock, address }

// Start continuous tracking
await LocationService.startTracking()

// Stop tracking & get distance
LocationService.stopTracking()
LocationService.getTotalDistance() // km
LocationService.getRoutePoints() // [{ lat, lng, timestamp }]

// Calculate distance between points
LocationService.calcDistance(lat1, lon1, lat2, lon2)
```

### GPS Behavior

| Mode | GPS Status | Fallback |
|------|------------|----------|
| **Dev** | Try first | Mock location |
| **Production** | Required | Error message |

### Mock Location (Dev)
- Latitude: 28.6139 (New Delhi)
- Longitude: 77.2090
- Shows "Dev Mode" badge in UI

---

## Punch States

```javascript
STATES = {
  IDLE: 'IDLE',           // Ready to punch
  FETCHING: 'FETCHING',   // Getting GPS
  FORM_OPEN: 'FORM_OPEN', // Modal visible
  SUBMITTING: 'SUBMITTING', // API call
  TRACKING: 'TRACKING',   // Active tracking
  PUNCHING_OUT: 'PUNCHING_OUT', // Ending
  COMPLETED: 'COMPLETED', // Done
  ERROR: 'ERROR'          // Failed
}
```

---

## Punch Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. User taps PUNCH button                               │
└──────────────────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Request GPS permission                                │
└──────────────────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Get current location (10s timeout)                    │
│    - Success: Show form modal                           │
│    - Fail + Dev: Use mock location                      │
│    - Fail + Prod: Show error                            │
└──────────────────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 4. User fills form & submits                             │
└──────────────────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 5. POST /attendance/punches/                            │
│    Payload: { lat, lng, visit_type, ... }               │
└──────────────────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 6. Start route tracking                                 │
│    - watchPosition every 10s                             │
│    - Store points (max 500)                             │
│    - Calculate distance live                             │
└──────────────────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 7. User taps END PUNCH                                   │
└──────────────────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 8. POST /attendance/punches/punch_out/                  │
│    Payload: {                                            │
│      punch_id,                                           │
│      end_latitude,                                       │
│      end_longitude,                                       │
│      route_points: [{ lat, lng, timestamp }],           │
│      total_distance,                                     │
│      total_duration_minutes                              │
│    }                                                      │
└──────────────────────────────────────────────────────────┘
```

---

## Data Structures

### Punch Record
```javascript
{
  id: 123,
  latitude: 28.6139,
  longitude: 77.2090,
  current_address: "New Delhi, India",
  visit_type: "CLIENT",
  reason: "Client meeting",
  accuracy: 10,
  is_mock: false,
  punched_at: "2026-04-17T10:30:00Z"
}
```

### Route Point
```javascript
{
  latitude: 28.6140,
  longitude: 77.2095,
  accuracy: 15,
  speed: 30,
  timestamp: 1713343200000,
  isMock: false
}
```

### Punch Out Payload
```javascript
{
  punch_id: "123",
  end_latitude: 28.6200,
  end_longitude: 77.2150,
  end_address: "Gurugram, India",
  end_time: "2026-04-17T14:30:00Z",
  route_points: [
    { latitude: 28.6139, longitude: 77.2090, timestamp: 1713343200000 },
    { latitude: 28.6145, longitude: 77.2100, timestamp: 1713343300000 },
    // ...
  ],
  total_distance: 5.7,  // kilometers
  total_duration_minutes: 240
}
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/attendance/punches/` | POST | Punch In |
| `/attendance/punches/punch_out/` | POST | Punch Out |
| `/attendance/punches/today_punches/` | GET | Today's punches |
| `/attendance/punches/daily_summary/` | GET | Daily summary |

---

## Distance Calculation

Uses Haversine formula:

```javascript
calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = sin(dLat/2)² + cos(lat1) * cos(lat2) * sin(dLon/2)²;
  const c = 2 * atan2(√a, √(1−a));
  return R * c;
}
```

---

## Error Handling

All GPS and API calls wrapped in try/catch:

| Error | Action |
|-------|--------|
| Permission denied | Show settings prompt |
| GPS timeout | Dev: use mock / Prod: show error |
| Invalid coordinates | Dev: use mock / Prod: show error |
| API failure | Show error banner, auto-dismiss 5s |

---

## Files Modified

| File | Changes |
|------|---------|
| `package.json` | Removed `react-native-background-geolocation` |
| `LocationService.js` | Complete rewrite with free libraries |
| `PunchContext.js` | Safe state management |
| `EmployeePunchScreen.js` | Clean UI with all features |
| `tokens.js` | Added missing color tokens |

---

## Testing Checklist

### Emulator/Dev Mode
- [ ] Tap punch → Mock location used
- [ ] "Dev Mode" badge shown
- [ ] Form opens with address
- [ ] Submit → Tracking starts
- [ ] Route polyline on map
- [ ] End punch → Data sent

### Real Device/Production
- [ ] GPS permission prompt
- [ ] Real coordinates captured
- [ ] "GPS Locked" badge shown
- [ ] Live tracking works
- [ ] Distance calculated accurately

---

## Performance

- GPS fetch: 20s timeout
- Tracking interval: 10s
- Distance filter: 20m (minimum movement to save point)
- Max route points: 500 (FIFO)
- Debounce clicks: 2s

---

## Future Upgrade Path

LocationService is modular. To upgrade:
1. Create new tracking provider
2. Update LocationService methods
3. No UI changes needed

---

*Last Updated: April 2026*
