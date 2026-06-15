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

    @ReactMethod
    fun stopForeground() {
        val intent = Intent(reactContext, TrackingService::class.java).apply {
            action = TrackingService.ACTION_STOP
        }
        reactContext.startService(intent)
    }
}
