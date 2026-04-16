# TASmobile - Enterprise Mobile Application

A production-ready React Native mobile application for the Traveling Allowance System.

## Architecture Overview

```
src/
├── common/              # Shared utilities, components, constants
├── core/                 # Infrastructure layer
├── features/             # Feature-based modules
├── modules/             # Role-based screens
├── navigation/          # Navigation configuration
├── services/            # External services
├── hooks/               # Custom hooks
├── context/             # Context providers
├── theme/               # Theming and styling
└── store/               # State management
```

## Folder Structure

### 📁 `common/` - Shared Resources

Shared utilities, components, constants used across the entire app.

```
common/
├── components/          # Reusable UI components
│   ├── SkeletonLoader.js
│   ├── NotificationProvider.js
│   ├── ErrorBoundary.js
│   ├── LoadingOverlay.js
│   └── ...
├── constants/           # App constants
│   └── index.js        # API endpoints, roles, status
├── helpers/             # Utility functions
│   ├── dateHelpers.js
│   ├── formatHelpers.js
│   └── validationHelpers.js
├── utils/               # General utilities
├── types/               # TypeScript interfaces
└── assets/              # Images, fonts, etc.
```

**Usage:**
```javascript
import { API_ENDPOINTS, USER_ROLES } from '@common/constants';
import { formatCurrency, formatDate } from '@common/helpers';
import { SkeletonLoader } from '@common/components';
```

### 📁 `core/` - Infrastructure Layer

Core infrastructure for error handling, offline support, API, and events.

```
core/
├── api/                 # API client and interceptors
├── error/               # Error types and handlers
├── offline/             # Offline manager and sync queue
├── storage/             # Local storage utilities
├── events/              # SSE and event handling
└── monitoring/          # Logging and analytics
```

**Key Files:**
- `ErrorHandler.js` - Global error handling with retry logic
- `OfflineManager.js` - Offline support with sync queue
- `SSEService.js` - Real-time updates via SSE
- `Logger.js` - Application logging

### 📁 `features/` - Feature Modules

Feature-based organization for specific business domains.

```
features/
├── punch/               # Punch in/out functionality
├── attendance/          # Attendance tracking
├── allowance/           # Allowance requests
├── corrections/         # Punch corrections
├── tracking/            # GPS tracking
├── notifications/       # Notification system
└── settings/            # User settings
```

Each feature contains:
- `components/` - Feature-specific components
- `hooks/` - Feature-specific hooks
- `services/` - Feature-specific API calls

### 📁 `modules/` - Role-Based Screens

Screens organized by user role.

```
modules/
├── auth/                # Authentication screens
│   └── screens/
│       ├── LoginScreen.js
│       ├── ForgotPasswordScreen.js
│       └── OtpVerificationScreen.js
├── employee/           # Employee screens
│   └── screens/
│       ├── EmployeeHomeScreen.js
│       ├── EmployeePunchScreen.js
│       └── ...
├── admin/               # Admin screens
│   └── screens/
│       ├── AdminDashboardScreen.js
│       └── ...
└── superadmin/          # Super Admin screens
    └── screens/
        ├── SuperAdminDashboardScreen.js
        ├── HealthMonitorScreen.js
        └── ...
```

### 📁 `navigation/` - Navigation

Navigation configuration and stack definitions.

```
navigation/
├── RootNavigator.js    # Main navigation tree
├── EmployeeNavigator.js
├── AdminNavigator.js
├── SuperAdminNavigator.js
└── types.js           # Navigation types
```

### 📁 `context/` - Context Providers

Global state management via React Context.

```
context/
├── AuthContext.js      # Authentication state
├── PunchContext.js     # Punch tracking state
└── ThemeContext.js    # Theme state
```

### 📁 `hooks/` - Custom Hooks

Reusable custom hooks.

```
hooks/
├── useAuth.js
├── usePunch.js
├── useOffline.js
├── useNetwork.js
└── useNotifications.js
```

### 📁 `services/` - External Services

Integration with external services.

```
services/
├── LocationService.js  # GPS location tracking
└── NotificationService.js
```

### 📁 `theme/` - Theming

Design tokens and global styles.

```
theme/
├── tokens.js          # Colors, typography, spacing
└── GlobalStyles.js
```

## Core Infrastructure

### Error Handling

```javascript
import { errorHandler } from '@core/error/ErrorHandler';

// Add listener
const unsubscribe = errorHandler.addListener((error) => {
  // Handle error
});

// Handle error
errorHandler.handle(error, { context: 'login' });
```

### Offline Support

```javascript
import { offlineManager } from '@core/offline/OfflineManager';

// Add to sync queue
await offlineManager.addToQueue({
  type: 'CREATE_PUNCH',
  payload: punchData,
});

// Check status
const status = await offlineManager.getQueueStatus();
```

### SSE Events

```javascript
import { sseService } from '@core/events/SSEService';

// Listen for events
const unsubscribe = sseService.addEventListener(
  sseService.Events.PUNCH_CREATED,
  (punch) => {
    // Handle punch
  }
);

// Connect
sseService.connect();

// Disconnect
sseService.disconnect();
```

## Naming Conventions

### Files
- Components: `PascalCase.js` (e.g., `SkeletonLoader.js`)
- Hooks: `camelCase.js` with `use` prefix (e.g., `useAuth.js`)
- Utils: `camelCase.js` (e.g., `formatHelpers.js`)
- Constants: `camelCase.js` or `PascalCase.js` (e.g., `apiEndpoints.js`)

### Components
```javascript
export const ComponentName = ({ prop1, prop2 }) => {
  return <View>...</View>;
};

export default ComponentName;
```

### Hooks
```javascript
export const useHookName = (params) => {
  // Hook logic
  return { data, loading, error };
};
```

## Best Practices

### 1. Error Handling
Always wrap async operations in try/catch:
```javascript
try {
  const response = await api.getData();
  return response.data;
} catch (error) {
  errorHandler.handle(error, { context: 'getData' });
  throw error;
}
```

### 2. Offline-First
Always check network before API calls:
```javascript
if (offlineManager.isOnline) {
  const response = await api.getData();
  // Update cache
} else {
  // Use cached data
  return offlineManager.getCache('data');
}
```

### 3. Performance
- Use `useMemo` for expensive calculations
- Use `useCallback` for callbacks passed to child components
- Use `FlatList` instead of `ScrollView` for long lists

### 4. Security
- Never store sensitive data in AsyncStorage
- Clear tokens on logout
- Validate all user inputs

## API Integration

```javascript
import api from '@api/api';

// GET request
const data = await api.get('/users/');

// POST request
const response = await api.post('/punches/', punchData);

// With params
const users = await api.get('/users/', { role: 'EMPLOYEE' });
```

## State Management

```javascript
// Using Context
const { user, login, logout } = useAuth();

// Using local state
const [data, setData] = useState(null);
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Building

```bash
# Android
npm run android

# iOS
npm run ios

# Production build
npm run build:android
npm run build:ios
```

## License

MIT
