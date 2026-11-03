package com.tasmobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/**
 * Restarts route tracking after the phone reboots mid-shift. Without it the
 * route stayed off until the officer happened to open the app again (Fix
 * Plan Part 2, A2). Starting a foreground service from BOOT_COMPLETED is
 * allowed on every Android version this app supports, for type location.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED
            && intent.action != "android.intent.action.QUICKBOOT_POWERON") return
        if (!TrackingService.hasResumableSession(context)) return
        ContextCompat.startForegroundService(
            context,
            Intent(context, TrackingService::class.java).setAction(TrackingService.ACTION_RESUME_AFTER_BOOT),
        )
    }
}
