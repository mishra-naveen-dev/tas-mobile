package com.tasmobile

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.concurrent.thread

/**
 * Android foreground service that records the employee's route while punched in.
 *
 * Two modes (selected by the start action):
 *  - ACTION_START      : notification only (legacy BackgroundTrackingService path).
 *  - ACTION_START_LIVE : notification + native GPS capture every 10s, POSTing each
 *                        fix straight to the livetracking backend.
 *
 * The native capture path is what makes tracking continue when the app is in the
 * background, the screen is off, or the app has been swiped away — JS timers stop
 * in those states, but this service (and its fused-location callback) keep running.
 *
 * Started/stopped from JS via the TrackingModule ("TrackingBridge") bridge.
 */
class TrackingService : Service() {

    companion object {
        const val CHANNEL_ID = "tas_tracking"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "com.tasmobile.TRACKING_START"
        const val ACTION_START_LIVE = "com.tasmobile.TRACKING_START_LIVE"
        const val ACTION_STOP = "com.tasmobile.TRACKING_STOP"

        const val EXTRA_BASE_URL = "base_url"
        const val EXTRA_TOKEN = "token"
        const val EXTRA_SESSION_ID = "session_id"

        const val INTERVAL_MS = 10_000L         // capture a fix every 10s
        const val BATCH_INTERVAL_MS = 60_000L   // upload batched points once a minute
        const val BATCH_MAX = 6                 // ...or sooner once this many are buffered
        const val BUFFER_CAP = 600              // drop oldest beyond this if server is down

        private const val PREFS = "tas_tracking_prefs"
    }

    private var fused: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null

    private var baseUrl: String = ""
    private var token: String = ""
    private var sessionId: Int = -1

    // Buffer of captured fixes, uploaded in batches to keep server load low.
    private val buffer = ArrayList<JSONObject>()
    private val bufferLock = Any()
    private val flushHandler = Handler(Looper.getMainLooper())
    private val flushRunnable = object : Runnable {
        override fun run() {
            flush()
            flushHandler.postDelayed(this, BATCH_INTERVAL_MS)
        }
    }

    private val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        fused = LocationServices.getFusedLocationProviderClient(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startForegroundTracking()

            ACTION_START_LIVE -> {
                baseUrl = intent.getStringExtra(EXTRA_BASE_URL) ?: ""
                token = intent.getStringExtra(EXTRA_TOKEN) ?: ""
                sessionId = intent.getIntExtra(EXTRA_SESSION_ID, -1)
                persistParams()
                startForegroundTracking()
                startLocationUpdates()
            }

            ACTION_STOP -> {
                stopLocationUpdates()
                clearParams()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }

            // Null intent => the OS restarted us after the process was killed
            // (START_STICKY). Restore the saved session and resume capturing.
            else -> {
                if (restoreParams() && sessionId >= 0) {
                    startForegroundTracking()
                    startLocationUpdates()
                } else {
                    stopSelf()
                    return START_NOT_STICKY
                }
            }
        }
        return START_STICKY
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        if (locationCallback != null) return  // already running
        val client = fused ?: return

        // Legacy LocationRequest API — compatible with the pinned
        // play-services-location:20.0.0 (Builder/Priority are 21.0.0+).
        @Suppress("DEPRECATION")
        val request = LocationRequest.create().apply {
            priority = LocationRequest.PRIORITY_HIGH_ACCURACY
            interval = INTERVAL_MS
            fastestInterval = INTERVAL_MS
            smallestDisplacement = 0f   // report even when stationary
        }

        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { enqueue(it) }
            }
        }
        locationCallback = callback

        try {
            client.requestLocationUpdates(request, callback, mainLooper)
            // Periodic safety flush so buffered points never sit longer than the
            // batch interval, even if fixes arrive slowly.
            flushHandler.removeCallbacks(flushRunnable)
            flushHandler.postDelayed(flushRunnable, BATCH_INTERVAL_MS)
        } catch (e: SecurityException) {
            // Location permission missing — nothing we can do from here.
        }
    }

    private fun stopLocationUpdates() {
        flushHandler.removeCallbacks(flushRunnable)
        locationCallback?.let { fused?.removeLocationUpdates(it) }
        locationCallback = null
        flush()  // upload whatever is left before we go away
    }

    /** Add a fix to the buffer; upload a batch once it's full enough. */
    private fun enqueue(loc: Location) {
        if (sessionId < 0) return
        val point = JSONObject().apply {
            put("latitude", loc.latitude)
            put("longitude", loc.longitude)
            put("accuracy", if (loc.hasAccuracy()) loc.accuracy.toDouble() else JSONObject.NULL)
            put("speed", if (loc.hasSpeed()) (loc.speed * 3.6).toDouble() else JSONObject.NULL)
            put("altitude", if (loc.hasAltitude()) loc.altitude else JSONObject.NULL)
            put("heading", if (loc.hasBearing()) loc.bearing.toDouble() else JSONObject.NULL)
            put("timestamp", iso.format(Date(loc.time)))
        }
        val shouldFlush: Boolean
        synchronized(bufferLock) {
            buffer.add(point)
            while (buffer.size > BUFFER_CAP) buffer.removeAt(0)
            shouldFlush = buffer.size >= BATCH_MAX
        }
        if (shouldFlush) flush()
    }

    /** POST all buffered fixes as one batch. Re-queues them on failure. */
    private fun flush() {
        if (baseUrl.isEmpty() || token.isEmpty() || sessionId < 0) return

        val batch: List<JSONObject>
        synchronized(bufferLock) {
            if (buffer.isEmpty()) return
            batch = ArrayList(buffer)
            buffer.clear()
        }

        val points = JSONArray()
        for (p in batch) points.put(p)
        val body = JSONObject().apply {
            put("session_id", sessionId)
            put("points", points)
        }.toString()

        val url = baseUrl.trimEnd('/') + "/livetracking/points/"
        val authToken = token

        thread {
            var conn: HttpURLConnection? = null
            try {
                conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 15000
                    readTimeout = 15000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer $authToken")
                }
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                if (code !in 200..299) throw RuntimeException("HTTP $code")
            } catch (e: Exception) {
                // Re-queue the batch (oldest first) so it retries on the next flush.
                synchronized(bufferLock) {
                    buffer.addAll(0, batch)
                    while (buffer.size > BUFFER_CAP) buffer.removeAt(0)
                }
            } finally {
                conn?.disconnect()
            }
        }
    }

    // ---- params persistence (survive process death / START_STICKY restart) ----

    private fun persistParams() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putString(EXTRA_BASE_URL, baseUrl)
            .putString(EXTRA_TOKEN, token)
            .putInt(EXTRA_SESSION_ID, sessionId)
            .apply()
    }

    private fun restoreParams(): Boolean {
        val p = getSharedPreferences(PREFS, MODE_PRIVATE)
        baseUrl = p.getString(EXTRA_BASE_URL, "") ?: ""
        token = p.getString(EXTRA_TOKEN, "") ?: ""
        sessionId = p.getInt(EXTRA_SESSION_ID, -1)
        return baseUrl.isNotEmpty() && token.isNotEmpty()
    }

    private fun clearParams() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().clear().apply()
        baseUrl = ""; token = ""; sessionId = -1
    }

    // ---- foreground notification ----

    private fun startForegroundTracking() {
        createNotificationChannel()
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Route Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Active while your route is being recorded"
                setShowBadge(false)
                enableVibration(false)
                enableLights(false)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setContentTitle("Route Tracking Active")
            .setContentText("Your route is being recorded in the background")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(openApp)
            .setOngoing(true)
            .setShowWhen(false)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .build()
    }

    override fun onDestroy() {
        stopLocationUpdates()
        super.onDestroy()
    }
}
