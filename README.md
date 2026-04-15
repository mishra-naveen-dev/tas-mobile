# TASMobile - Traveling Allowance System Mobile App

A React Native mobile application for the Traveling Allowance System (TAS). Allows employees to punch in/out, track location, apply for allowances, and manage their travel data.

## Features

- **Employee Features**
  - Punch In/Out with GPS location
  - Route tracking with map visualization
  - Apply for travel allowance
  - Punch corrections
  - View history (punches, allowances, daily summary)

- **Admin Features**
  - Dashboard with employee tracking
  - Approve/reject allowances
  - Approve/reject punch corrections
  - Device management

- **Super Admin Features**
  - Organization statistics
  - User management
  - Device management
  - Approval routes configuration

## Platform Support

- Android
- iOS

## Tech Stack

- React Native
- React Navigation
- Axios
- AsyncStorage
- React Native Vector Icons

## Installation

```bash
# Install dependencies
npm install

# Run on Android
npm run android

# Run on iOS
cd ios && pod install && cd ..
npm run ios
```

## API Configuration

Update the API base URL in `src/api/api.js`:
```javascript
const PROD_URL = 'https://your-backend-url.com/api/v1';
```

## License

MIT