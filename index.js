/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
// Registers the 'OfflineSyncTask' headless task (see BackgroundSyncTask.js)
// — must happen unconditionally at bundle load, since OfflineSyncTaskService
// (native) can boot a headless JS context without ever rendering <App/>.
import './src/services/BackgroundSyncTask';

// Disable all console output in production builds.
// The babel-plugin-transform-remove-console already strips console calls
// at compile time; this guard silences anything that slips through
// (e.g. third-party libraries or cached bundles).
if (!__DEV__) {
  console.log   = () => {};
  console.info  = () => {};
  console.warn  = () => {};
  console.error = () => {};
  console.debug = () => {};
}

AppRegistry.registerComponent(appName, () => App);
