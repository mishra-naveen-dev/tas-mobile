package com.tasmobile

import android.content.Intent
import android.os.Build
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject

/**
 * React Native bridge module exposing startForeground() / stopForeground()
 * so JavaScript can control the TrackingService lifecycle.
 *
 * Accessed from JS as: NativeModules.TrackingBridge
 */
class TrackingModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TrackingBridge"

    @ReactMethod
    fun startForeground() {
        val intent = Intent(reactContext, TrackingService::class.java).apply {
            action = TrackingService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    /**
     * Start the native live-tracking capture loop: the service records GPS fixes
     * at a config-driven, movement-adaptive interval and POSTs them to the
     * livetracking backend itself, so tracking continues when the app is
     * backgrounded, the screen is off, or the app has been closed. baseUrl is
     * the API root (e.g. ".../api/v1").
     *
     * `configJson` is the JSON body already returned by GET /livetracking/config/
     * (see LiveTrackingService.js's fetchAndApplyConfig) — optional; omitted or
     * malformed JSON just falls back to the service's own defaults (which match
     * TrackingConfiguration's server-side defaults).
     */
    @ReactMethod
    fun startLiveTracking(baseUrl: String, token: String, sessionId: Int, configJson: String?) {
        val intent = Intent(reactContext, TrackingService::class.java).apply {
            action = TrackingService.ACTION_START_LIVE
            putExtra(TrackingService.EXTRA_BASE_URL, baseUrl)
            putExtra(TrackingService.EXTRA_TOKEN, token)
            putExtra(TrackingService.EXTRA_SESSION_ID, sessionId)
            applyConfigExtras(this, configJson)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    /**
     * Push an updated TrackingConfiguration down to an already-running service —
     * e.g. after the app re-fetches /livetracking/config/ following a
     * START_STICKY service restart, or if an admin changes the config mid-shift.
     */
    @ReactMethod
    fun updateConfig(configJson: String) {
        val intent = Intent(reactContext, TrackingService::class.java).apply {
            action = TrackingService.ACTION_UPDATE_CONFIG
            applyConfigExtras(this, configJson)
        }
        reactContext.startService(intent)
    }

    private fun applyConfigExtras(intent: Intent, configJson: String?) {
        if (configJson.isNullOrEmpty()) return
        try {
            val json = JSONObject(configJson)
            if (json.has("interval_moving_s"))
                intent.putExtra(TrackingService.EXTRA_INTERVAL_MOVING_S, json.getInt("interval_moving_s"))
            if (json.has("interval_walking_s"))
                intent.putExtra(TrackingService.EXTRA_INTERVAL_WALKING_S, json.getInt("interval_walking_s"))
            if (json.has("interval_stationary_s"))
                intent.putExtra(TrackingService.EXTRA_INTERVAL_STATIONARY_S, json.getInt("interval_stationary_s"))
            if (json.has("interval_low_battery_s"))
                intent.putExtra(TrackingService.EXTRA_INTERVAL_LOW_BATTERY_S, json.getInt("interval_low_battery_s"))
            if (json.has("low_battery_threshold_pct"))
                intent.putExtra(TrackingService.EXTRA_LOW_BATTERY_THRESHOLD_PCT, json.getInt("low_battery_threshold_pct"))
            if (json.has("batch_max_points"))
                intent.putExtra(TrackingService.EXTRA_BATCH_MAX_POINTS, json.getInt("batch_max_points"))
            if (json.has("batch_upload_interval_s"))
                intent.putExtra(TrackingService.EXTRA_BATCH_UPLOAD_INTERVAL_S, json.getInt("batch_upload_interval_s"))
            if (json.has("offline_max_batch_size"))
                intent.putExtra(TrackingService.EXTRA_OFFLINE_MAX_BATCH_SIZE, json.getInt("offline_max_batch_size"))
        } catch (e: Exception) {
            // Malformed config JSON — service keeps its current/default intervals.
        }
    }

    @ReactMethod
    fun stopForeground() {
        val intent = Intent(reactContext, TrackingService::class.java).apply {
            action = TrackingService.ACTION_STOP
        }
        reactContext.startService(intent)
    }

    /**
     * Call whenever something is added to OfflineQueue.js's outbox (see its
     * enqueue()) — ensures a WorkManager job is pending that will drain the
     * queue the next time the device has internet, even if the app process
     * is fully killed before that happens. enqueueUniqueWork + REPLACE means
     * calling this repeatedly (once per queued item) never stacks up
     * duplicate pending jobs; it just keeps one job pending against
     * whatever is currently in the queue. See OfflineSyncWorker.
     */
    @ReactMethod
    fun scheduleBackgroundSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val request = OneTimeWorkRequestBuilder<OfflineSyncWorker>()
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(reactContext)
            .enqueueUniqueWork("offline_sync", ExistingWorkPolicy.REPLACE, request)
    }
}
