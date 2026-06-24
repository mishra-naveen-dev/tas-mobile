package com.tasmobile

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

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
     * Start the native live-tracking capture loop: the service records a GPS fix
     * every 10s and POSTs it to the livetracking backend itself, so tracking
     * continues when the app is backgrounded, the screen is off, or the app has
     * been closed. baseUrl is the API root (e.g. ".../api/v1").
     */
    @ReactMethod
    fun startLiveTracking(baseUrl: String, token: String, sessionId: Int) {
        val intent = Intent(reactContext, TrackingService::class.java).apply {
            action = TrackingService.ACTION_START_LIVE
            putExtra(TrackingService.EXTRA_BASE_URL, baseUrl)
            putExtra(TrackingService.EXTRA_TOKEN, token)
            putExtra(TrackingService.EXTRA_SESSION_ID, sessionId)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    @ReactMethod
    fun stopForeground() {
        val intent = Intent(reactContext, TrackingService::class.java).apply {
            action = TrackingService.ACTION_STOP
        }
        reactContext.startService(intent)
    }
}
