package com.tasmobile

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.location.Location
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationAvailability
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
import java.util.UUID
import kotlin.concurrent.thread

/**
 * Android foreground service that records the employee's route while punched in.
 *
 * Two modes (selected by the start action):
 *  - ACTION_START      : notification only (legacy BackgroundTrackingService path).
 *  - ACTION_START_LIVE : notification + native GPS capture, POSTing each fix
 *                        straight to the livetracking backend.
 *
 * The native capture path is what makes tracking continue when the app is in the
 * background, the screen is off, or the app has been swiped away — JS timers stop
 * in those states, but this service (and its fused-location callback) keep running.
 *
 * Milestone 1 (server-orchestrated tracking engine): the capture interval is no
 * longer a fixed constant — it's driven by backend config (GET /livetracking/config/,
 * fetched in JS and pushed down via ACTION_UPDATE_CONFIG) and adapts per-fix based on
 * reported speed (moving/walking/stationary) and battery level, exactly mirroring
 * apps.livetracking.models.TrackingConfiguration on the server. Every point also
 * carries a client-generated `client_point_id` so a resent batch (e.g. after a lost
 * HTTP response) can never create duplicate LivePoint rows server-side. GPS/network
 * lost-restored and service-restart events are reported to the new
 * /livetracking/heartbeat/ endpoint so they show up in the server's audit trail.
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
        const val ACTION_UPDATE_CONFIG = "com.tasmobile.TRACKING_UPDATE_CONFIG"

        const val EXTRA_BASE_URL = "base_url"
        const val EXTRA_TOKEN = "token"
        const val EXTRA_SESSION_ID = "session_id"

        // Config extras (seconds unless noted) — defaults match
        // apps.livetracking.models.TrackingConfiguration's own defaults, so
        // behavior is identical even if the app never successfully fetches
        // /livetracking/config/ before starting (e.g. first launch, offline).
        const val EXTRA_INTERVAL_MOVING_S = "interval_moving_s"
        const val EXTRA_INTERVAL_WALKING_S = "interval_walking_s"
        const val EXTRA_INTERVAL_STATIONARY_S = "interval_stationary_s"
        const val EXTRA_INTERVAL_LOW_BATTERY_S = "interval_low_battery_s"
        const val EXTRA_LOW_BATTERY_THRESHOLD_PCT = "low_battery_threshold_pct"

        const val DEFAULT_INTERVAL_MOVING_S = 10
        const val DEFAULT_INTERVAL_WALKING_S = 15
        const val DEFAULT_INTERVAL_STATIONARY_S = 30
        const val DEFAULT_INTERVAL_LOW_BATTERY_S = 60
        const val DEFAULT_LOW_BATTERY_THRESHOLD_PCT = 20

        // Movement classification thresholds (km/h), derived from the fix's own
        // reported speed — a heuristic, not a dedicated activity-recognition
        // classifier (that's an explicitly deferred follow-up phase).
        private const val MOVING_SPEED_KMH = 15.0
        private const val WALKING_SPEED_KMH = 3.0

        const val BATCH_INTERVAL_MS = 60_000L   // upload batched points once a minute
        const val BATCH_MAX = 6                 // ...or sooner once this many are buffered
        const val BUFFER_CAP = 600              // drop oldest beyond this if server is down

        private const val PREFS = "tas_tracking_prefs"
    }

    private var fused: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    private var baseUrl: String = ""
    private var token: String = ""
    private var sessionId: Int = -1

    // Config-driven intervals (seconds) — see companion defaults above.
    private var intervalMovingS = DEFAULT_INTERVAL_MOVING_S
    private var intervalWalkingS = DEFAULT_INTERVAL_WALKING_S
    private var intervalStationaryS = DEFAULT_INTERVAL_STATIONARY_S
    private var intervalLowBatteryS = DEFAULT_INTERVAL_LOW_BATTERY_S
    private var lowBatteryThresholdPct = DEFAULT_LOW_BATTERY_THRESHOLD_PCT
    private var currentIntervalMs = DEFAULT_INTERVAL_STATIONARY_S * 1000L

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
        connectivityManager = getSystemService(ConnectivityManager::class.java)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startForegroundTracking()

            ACTION_START_LIVE -> {
                baseUrl = intent.getStringExtra(EXTRA_BASE_URL) ?: ""
                token = intent.getStringExtra(EXTRA_TOKEN) ?: ""
                sessionId = intent.getIntExtra(EXTRA_SESSION_ID, -1)
                applyConfigExtras(intent)
                persistParams()
                startForegroundTracking()
                startLocationUpdates()
                registerNetworkCallback()
            }

            ACTION_UPDATE_CONFIG -> {
                applyConfigExtras(intent)
                persistParams()
                // Re-evaluate immediately against the last-known movement state
                // rather than waiting for the next fix to (maybe) reschedule.
                if (locationCallback != null) startLocationUpdates(forceRestart = true)
            }

            ACTION_STOP -> {
                stopLocationUpdates()
                unregisterNetworkCallback()
                clearParams()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }

            // Null intent => the OS restarted us after the process was killed
            // (START_STICKY). Restore the saved session/config and resume
            // capturing, and let the server know this happened.
            else -> {
                if (restoreParams() && sessionId >= 0) {
                    startForegroundTracking()
                    startLocationUpdates()
                    registerNetworkCallback()
                    postHeartbeat("SERVICE_RESTARTED", "TrackingService resumed after process restart (START_STICKY)")
                } else {
                    stopSelf()
                    return START_NOT_STICKY
                }
            }
        }
        return START_STICKY
    }

    private fun applyConfigExtras(intent: Intent) {
        intervalMovingS = intent.getIntExtra(EXTRA_INTERVAL_MOVING_S, intervalMovingS)
        intervalWalkingS = intent.getIntExtra(EXTRA_INTERVAL_WALKING_S, intervalWalkingS)
        intervalStationaryS = intent.getIntExtra(EXTRA_INTERVAL_STATIONARY_S, intervalStationaryS)
        intervalLowBatteryS = intent.getIntExtra(EXTRA_INTERVAL_LOW_BATTERY_S, intervalLowBatteryS)
        lowBatteryThresholdPct = intent.getIntExtra(EXTRA_LOW_BATTERY_THRESHOLD_PCT, lowBatteryThresholdPct)
    }

    private fun batteryPercent(): Int {
        val bm = getSystemService(BATTERY_SERVICE) as? BatteryManager ?: return 100
        return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    }

    /** Config-driven, speed-adaptive interval (ms) for the NEXT location request —
     * classification happens after each fix in enqueue()/classifyAndReschedule(). */
    private fun intervalForState(speedKmh: Double?): Long {
        val battery = batteryPercent()
        val seconds = when {
            battery in 1..lowBatteryThresholdPct -> intervalLowBatteryS
            speedKmh != null && speedKmh > MOVING_SPEED_KMH -> intervalMovingS
            speedKmh != null && speedKmh > WALKING_SPEED_KMH -> intervalWalkingS
            else -> intervalStationaryS
        }
        return seconds * 1000L
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates(forceRestart: Boolean = false, speedKmh: Double? = null) {
        val client = fused ?: return
        val desiredIntervalMs = intervalForState(speedKmh)

        if (locationCallback != null) {
            if (!forceRestart && desiredIntervalMs == currentIntervalMs) return // already running at this cadence
            locationCallback?.let { client.removeLocationUpdates(it) }
            locationCallback = null
        }

        currentIntervalMs = desiredIntervalMs

        // Legacy LocationRequest API — compatible with the pinned
        // play-services-location:20.0.0 (Builder/Priority are 21.0.0+).
        @Suppress("DEPRECATION")
        val request = LocationRequest.create().apply {
            priority = LocationRequest.PRIORITY_HIGH_ACCURACY
            interval = currentIntervalMs
            fastestInterval = currentIntervalMs
            smallestDisplacement = 0f   // report even when stationary
        }

        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { loc ->
                    enqueue(loc)
                    val speedKmhNow = if (loc.hasSpeed()) (loc.speed * 3.6).toDouble() else null
                    startLocationUpdates(speedKmh = speedKmhNow)  // reschedule if the state changed
                }
            }

            override fun onLocationAvailability(availability: LocationAvailability) {
                if (!availability.isLocationAvailable) {
                    postHeartbeat("GPS_LOST", "FusedLocationProvider reports location unavailable")
                } else {
                    postHeartbeat("GPS_RESTORED", "FusedLocationProvider reports location available again")
                }
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

    private fun registerNetworkCallback() {
        if (networkCallback != null) return
        val cm = connectivityManager ?: return
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                postHeartbeat("NETWORK_RESTORED", "Connectivity restored")
                flush()  // don't wait for the next scheduled flush once we're back online
            }
            override fun onLost(network: Network) {
                postHeartbeat("NETWORK_LOST", "Connectivity lost")
            }
        }
        try {
            cm.registerNetworkCallback(request, callback)
            networkCallback = callback
        } catch (e: Exception) {
            // Best-effort only — buffering/retry in flush() already handles the
            // actual data-loss-prevention half regardless of this callback.
        }
    }

    private fun unregisterNetworkCallback() {
        networkCallback?.let {
            try { connectivityManager?.unregisterNetworkCallback(it) } catch (e: Exception) { }
        }
        networkCallback = null
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
            put("battery_level", batteryPercent())
            put("timestamp", iso.format(Date(loc.time)))
            // Idempotency key (Milestone 1) — lets the server dedup a batch
            // that gets resent after its HTTP response was lost in transit.
            put("client_point_id", UUID.randomUUID().toString())
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
        // A batch whose oldest point is well older than one normal flush
        // interval accumulated while offline — flag it for the server's
        // sync audit trail (see IngestPointsView's `source` handling).
        val oldestAgeMs = System.currentTimeMillis() - (batch.firstOrNull()?.let {
            try { iso.parse(it.getString("timestamp"))?.time } catch (e: Exception) { null }
        } ?: System.currentTimeMillis())
        val source = if (oldestAgeMs > BATCH_INTERVAL_MS * 2) "offline_sync" else "live"

        val body = JSONObject().apply {
            put("session_id", sessionId)
            put("points", points)
            put("source", source)
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
                // Re-queue the batch (oldest first) so it retries on the next
                // flush. Each point kept its client_point_id, so if the earlier
                // POST actually succeeded server-side before this exception
                // (e.g. the response itself was lost), the retry is a safe
                // no-op for those points instead of creating duplicates.
                synchronized(bufferLock) {
                    buffer.addAll(0, batch)
                    while (buffer.size > BUFFER_CAP) buffer.removeAt(0)
                }
            } finally {
                conn?.disconnect()
            }
        }
    }

    /** Fire-and-forget POST to /livetracking/heartbeat/ — never blocks tracking. */
    private fun postHeartbeat(eventType: String, detail: String) {
        if (baseUrl.isEmpty() || token.isEmpty()) return
        val url = baseUrl.trimEnd('/') + "/livetracking/heartbeat/"
        val authToken = token
        val sid = sessionId
        val battery = batteryPercent()
        val body = JSONObject().apply {
            if (sid >= 0) put("session_id", sid)
            put("event_type", eventType)
            put("battery_level", battery)
            put("detail", detail)
        }.toString()

        thread {
            var conn: HttpURLConnection? = null
            try {
                conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 10000
                    readTimeout = 10000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer $authToken")
                }
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                conn.responseCode  // drain — not otherwise interested in the result
            } catch (e: Exception) {
                // Best-effort telemetry only — never retried, never blocks tracking.
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
            .putInt(EXTRA_INTERVAL_MOVING_S, intervalMovingS)
            .putInt(EXTRA_INTERVAL_WALKING_S, intervalWalkingS)
            .putInt(EXTRA_INTERVAL_STATIONARY_S, intervalStationaryS)
            .putInt(EXTRA_INTERVAL_LOW_BATTERY_S, intervalLowBatteryS)
            .putInt(EXTRA_LOW_BATTERY_THRESHOLD_PCT, lowBatteryThresholdPct)
            .apply()
    }

    private fun restoreParams(): Boolean {
        val p = getSharedPreferences(PREFS, MODE_PRIVATE)
        baseUrl = p.getString(EXTRA_BASE_URL, "") ?: ""
        token = p.getString(EXTRA_TOKEN, "") ?: ""
        sessionId = p.getInt(EXTRA_SESSION_ID, -1)
        intervalMovingS = p.getInt(EXTRA_INTERVAL_MOVING_S, DEFAULT_INTERVAL_MOVING_S)
        intervalWalkingS = p.getInt(EXTRA_INTERVAL_WALKING_S, DEFAULT_INTERVAL_WALKING_S)
        intervalStationaryS = p.getInt(EXTRA_INTERVAL_STATIONARY_S, DEFAULT_INTERVAL_STATIONARY_S)
        intervalLowBatteryS = p.getInt(EXTRA_INTERVAL_LOW_BATTERY_S, DEFAULT_INTERVAL_LOW_BATTERY_S)
        lowBatteryThresholdPct = p.getInt(EXTRA_LOW_BATTERY_THRESHOLD_PCT, DEFAULT_LOW_BATTERY_THRESHOLD_PCT)
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
        unregisterNetworkCallback()
        super.onDestroy()
    }
}
