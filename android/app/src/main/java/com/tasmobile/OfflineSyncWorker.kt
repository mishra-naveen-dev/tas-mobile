package com.tasmobile

import android.content.Context
import android.content.Intent
import androidx.work.Worker
import androidx.work.WorkerParameters

/**
 * WorkManager worker — fires once the device has internet connectivity
 * (NetworkType.CONNECTED constraint, see TrackingModule.scheduleBackgroundSync).
 * WorkManager persists this request across app/process death and device
 * reboot, so it runs even if the app was fully killed when connectivity
 * returned — unlike every JS-side sync trigger (OfflineQueue.js's own
 * NetInfo/serverStatus listeners), which only exist while the JS engine is
 * alive. Just boots the headless JS task that does the actual draining —
 * see OfflineSyncTaskService.
 */
class OfflineSyncWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        applicationContext.startService(Intent(applicationContext, OfflineSyncTaskService::class.java))
        return Result.success()
    }
}
