package com.tasmobile

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Boots a headless JS context to run 'OfflineSyncTask' (registered in JS via
 * AppRegistry.registerHeadlessTask, see src/services/BackgroundSyncTask.js) —
 * drains OfflineQueue.js's outbox using the exact same processQueue() the
 * in-app auto-sync triggers already use, even when the app's own UI/JS
 * engine isn't otherwise running. Started by OfflineSyncWorker.
 */
class OfflineSyncTaskService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
        return HeadlessJsTaskConfig(
            "OfflineSyncTask",
            Arguments.createMap(), // no params — the JS task just drains whatever's already queued
            30000, // ms — generous for a modest offline backlog, bounded so a stuck run can't hang forever
            true,  // allowedInForeground — must still run when the app isn't in the foreground
        )
    }
}
