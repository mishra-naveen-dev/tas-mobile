import { AppRegistry } from 'react-native';
import { processQueue } from './OfflineQueue';

/**
 * Registered as a React Native headless JS task, booted by
 * OfflineSyncTaskService (native Android) whenever OfflineSyncWorker
 * (WorkManager, NetworkType.CONNECTED) fires — including when the app
 * process was fully killed at the moment connectivity returned. Drains the
 * exact same OfflineQueue outbox the in-app auto-sync triggers already use
 * (see OfflineQueue.js's startAutoSync) — no duplicated sync logic, no
 * separate upload path to keep correct.
 *
 * Must be registered unconditionally at JS bundle load (imported from
 * index.js), not lazily inside a component — a headless boot runs the whole
 * bundle from scratch and needs this name already registered by the time
 * the native side looks it up.
 */
const OfflineSyncTask = async () => {
    await processQueue();
};

AppRegistry.registerHeadlessTask('OfflineSyncTask', () => OfflineSyncTask);

export default OfflineSyncTask;
