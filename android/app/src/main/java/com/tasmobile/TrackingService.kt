package com.tasmobile

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
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
        private const val ALERT_CHANNEL_ID = "tas_tracking_alerts"
        private const val LOCATION_OFF_NOTIFICATION_ID = 1002
        const val ACTION_START = "com.tasmobile.TRACKING_START"
        const val ACTION_START_LIVE = "com.tasmobile.TRACKING_START_LIVE"
        const val ACTION_STOP = "com.tasmobile.TRACKING_STOP"
        const val ACTION_UPDATE_CONFIG = "com.tasmobile.TRACKING_UPDATE_CONFIG"
        // Sent by BootReceiver; handled like the OS's own START_STICKY restart.
        const val ACTION_RESUME_AFTER_BOOT = "com.tasmobile.TRACKING_RESUME_AFTER_BOOT"

        /** A punched-in session was saved and hasn't gone stale, so a reboot should resume it. */
        fun hasResumableSession(context: Context): Boolean {
            val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            return p.getInt(EXTRA_SESSION_ID, -1) >= 0
                && !p.getString(EXTRA_TOKEN, "").isNullOrEmpty()
                && System.currentTimeMillis() - p.getLong(KEY_PERSISTED_AT, 0L) <= STALE_SESSION_MS
        }

        const val EXTRA_BASE_URL = "base_url"
        const val EXTRA_TOKEN = "token"
        const val EXTRA_SESSION_ID = "session_id"
        // The tracking token is bound to this device (X-DEVICE-ID).
        const val EXTRA_DEVICE_ID = "device_id"

        // Config extras (seconds unless noted) — defaults match
        // apps.livetracking.models.TrackingConfiguration's own defaults, so
        // behavior is identical even if the app never successfully fetches
        // /livetracking/config/ before starting (e.g. first launch, offline).
        const val EXTRA_INTERVAL_MOVING_S = "interval_moving_s"
        const val EXTRA_INTERVAL_WALKING_S = "interval_walking_s"
        const val EXTRA_INTERVAL_STATIONARY_S = "interval_stationary_s"
        const val EXTRA_INTERVAL_LOW_BATTERY_S = "interval_low_battery_s"
        const val EXTRA_LOW_BATTERY_THRESHOLD_PCT = "low_battery_threshold_pct"
        // Batch upload cadence — previously hardcoded compile-time constants
        // here while the JS capture path (LiveTrackingService.js) already
        // honored config.batch_max_points/batch_upload_interval_s, so an
        // admin-tuned upload cadence silently never applied to Android's
        // native capture path (the one actually authoritative per spec —
        // see TrackingService's class doc). Now wired the same way as the
        // interval_* extras above.
        const val EXTRA_BATCH_MAX_POINTS = "batch_max_points"
        const val EXTRA_BATCH_UPLOAD_INTERVAL_S = "batch_upload_interval_s"
        // Hard cap per offline-sync POST (mirrors TrackingConfiguration.
        // offline_max_batch_size) - flush() chunks the buffer to this size
        // instead of sending it all in one request, so a long offline
        // backlog can't permanently deadlock against the server's own
        // ceiling (every retry re-sending the same too-large batch forever).
        const val EXTRA_OFFLINE_MAX_BATCH_SIZE = "offline_max_batch_size"

        const val DEFAULT_INTERVAL_MOVING_S = 10
        const val DEFAULT_INTERVAL_WALKING_S = 15
        const val DEFAULT_INTERVAL_STATIONARY_S = 30
        const val DEFAULT_INTERVAL_LOW_BATTERY_S = 60
        const val DEFAULT_LOW_BATTERY_THRESHOLD_PCT = 20
        const val DEFAULT_BATCH_MAX_POINTS = 6
        const val DEFAULT_BATCH_UPLOAD_INTERVAL_S = 60
        const val DEFAULT_OFFLINE_MAX_BATCH_SIZE = 200

        // Movement classification thresholds (km/h), derived from the fix's own
        // reported speed — a heuristic, not a dedicated activity-recognition
        // classifier (that's an explicitly deferred follow-up phase).
        private const val MOVING_SPEED_KMH = 15.0
        private const val WALKING_SPEED_KMH = 3.0

        const val BUFFER_CAP = 20_000           // ~2 days offline; drop oldest beyond this

        private const val PREFS = "tas_tracking_prefs"
        private const val KEY_SEQUENCE = "sequence_no"
        private const val KEY_BUFFER = "gps_buffer_json"
        private const val KEY_PERSISTED_AT = "persisted_at_ms"

        // Same threshold DailyPunchPrompt.js (mobile JS) already uses to nudge
        // "you've been punched in over 11 hours, don't forget to punch out" -
        // reused here as the ceiling for how old a persisted session is
        // allowed to be before a null-intent OS restart (see onStartCommand's
        // START_STICKY branch) is still trusted to resume it. Without this, an
        // employee who swiped the app away mid-shift instead of punching out
        // (or whose process got killed before clearParams() ever ran) could
        // have tracking silently resume - and the persistent "Route Tracking
        // Active" notification reappear - hours or days later with no punch
        // of theirs behind it, triggered purely by the OS restarting a killed
        // service. A stale restart now clears params and stops instead.
        private const val STALE_SESSION_HOURS = 11
        private const val STALE_SESSION_MS = STALE_SESSION_HOURS * 60 * 60 * 1000L

        private const val TAG = "TasTracking"
    }

    private var fused: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    private var baseUrl: String = ""
    private var token: String = ""
    private var lastGpsAvailable: Boolean? = null
    private var deviceId: String = ""
    private var sessionId: Int = -1
    private var persistedAt: Long = 0L

    // Config-driven intervals (seconds) — see companion defaults above.
    private var intervalMovingS = DEFAULT_INTERVAL_MOVING_S
    private var intervalWalkingS = DEFAULT_INTERVAL_WALKING_S
    private var intervalStationaryS = DEFAULT_INTERVAL_STATIONARY_S
    private var intervalLowBatteryS = DEFAULT_INTERVAL_LOW_BATTERY_S
    private var lowBatteryThresholdPct = DEFAULT_LOW_BATTERY_THRESHOLD_PCT
    private var currentIntervalMs = DEFAULT_INTERVAL_STATIONARY_S * 1000L
    private var batchMaxPoints = DEFAULT_BATCH_MAX_POINTS
    private var batchIntervalMs = DEFAULT_BATCH_UPLOAD_INTERVAL_S * 1000L
    private var offlineMaxBatchSize = DEFAULT_OFFLINE_MAX_BATCH_SIZE

    // Captured fixes waiting for upload, persisted in SQLite (see GpsBuffer)
    // so they survive the process being killed while offline.
    private lateinit var buffer: GpsBuffer
    // The periodic timer, network-restored callback and the threshold check
    // in enqueue() can all fire close together; without this, two
    // overlapping flush() calls could send the same unconfirmed chunk twice.
    private val isFlushing = java.util.concurrent.atomic.AtomicBoolean(false)

    // Per-session sequence counter for the (session, sequence_no) idempotency
    // key. -1 means "not loaded yet"; it is persisted so it survives the OS
    // killing the service, and reset whenever a new session is attached.
    private val sequenceLock = Any()
    @Volatile private var sequenceNo: Int = -1
    private val flushHandler = Handler(Looper.getMainLooper())
    private val flushRunnable = object : Runnable {
        override fun run() {
            flush()
            flushHandler.postDelayed(this, batchIntervalMs)
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
        buffer = GpsBuffer(this)
        migrateLegacyBuffer()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startForegroundTracking()

            ACTION_START_LIVE -> {
                baseUrl = intent.getStringExtra(EXTRA_BASE_URL) ?: ""
                token = intent.getStringExtra(EXTRA_TOKEN) ?: ""
                deviceId = intent.getStringExtra(EXTRA_DEVICE_ID) ?: ""
                val newSessionId = intent.getIntExtra(EXTRA_SESSION_ID, -1)
                // A fresh process has sessionId -1; the app re-attaching to the
                // same session after the OS killed us must keep its backlog.
                val previousSessionId = if (sessionId >= 0) sessionId else prefs().getInt(EXTRA_SESSION_ID, -1)
                if (newSessionId != previousSessionId) {
                    // A different tracking session. The sequence counter is
                    // scoped to (session, sequence_no) on the server, so it
                    // restarts; anything still buffered belongs to the previous
                    // session and is dropped rather than replayed into this one
                    // (which would splice two journeys into one route).
                    val dropped = buffer.clear()
                    if (dropped > 0) Log.w(TAG, "Dropping $dropped buffered fix(es) from the previous session.")
                    synchronized(sequenceLock) { sequenceNo = 1 }
                    prefs().edit().putInt(KEY_SEQUENCE, 1).apply()
                }
                sessionId = newSessionId
                applyConfigExtras(intent)
                persistParams()
                if (startForegroundTracking()) {
                    startLocationUpdates()
                    registerNetworkCallback()
                    watchLocationSwitch()
                }
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
                unwatchLocationSwitch()
                // clearParams() forgets the session id, so a leftover backlog
                // could no longer be told apart from the next session's.
                buffer.clear()
                clearParams()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }

            // Null intent => the OS restarted us after the process was killed
            // (START_STICKY); ACTION_RESUME_AFTER_BOOT => BootReceiver after a
            // reboot (Fix Plan Part 2, A2). Restore the saved session/config and resume
            // capturing, and let the server know this happened - but only if
            // that session is recent. Without the staleness check, an
            // abandoned session (app swiped away mid-shift instead of a
            // proper punch-out, or the process died before clearParams() ran)
            // could have the OS silently resume it - and the persistent
            // notification reappear - long after, with no punch behind it.
            else -> {
                val hasSession = restoreParams() && sessionId >= 0
                val stale = hasSession && (System.currentTimeMillis() - persistedAt) > STALE_SESSION_MS

                if (stale) {
                    Log.w(TAG, "Discarding stale session $sessionId on restart - " +
                        "persisted ${(System.currentTimeMillis() - persistedAt) / 60000} min ago.")
                    postHeartbeat("SERVICE_RESTART_STALE", "Discarded a stale persisted session instead of resuming it")
                    clearParams()
                }

                if (hasSession && !stale) {
                    if (startForegroundTracking()) {
                        startLocationUpdates()
                        registerNetworkCallback()
                        watchLocationSwitch()
                        if (intent?.action == ACTION_RESUME_AFTER_BOOT) {
                            postHeartbeat("SERVICE_RESTARTED_AFTER_BOOT", "TrackingService resumed after the phone restarted")
                        } else {
                            postHeartbeat("SERVICE_RESTARTED", "TrackingService resumed after process restart (START_STICKY)")
                        }
                    } else {
                        // The OS refused to let this restart reach the foreground -
                        // tracking is genuinely stopped until the app itself is
                        // reopened (PunchContext re-attaches LiveTrackingService on
                        // app start whenever the employee is still punched in). Tell
                        // the server so this gap is visible instead of silent.
                        postHeartbeat("SERVICE_RESTART_REFUSED", "OS refused startForeground() on auto-restart - tracking stopped until app reopened")
                    }
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
        batchMaxPoints = intent.getIntExtra(EXTRA_BATCH_MAX_POINTS, batchMaxPoints)
        batchIntervalMs = intent.getIntExtra(
            EXTRA_BATCH_UPLOAD_INTERVAL_S, (batchIntervalMs / 1000L).toInt(),
        ).toLong() * 1000L
        offlineMaxBatchSize = intent.getIntExtra(EXTRA_OFFLINE_MAX_BATCH_SIZE, offlineMaxBatchSize)
    }

    private fun batteryPercent(): Int {
        val bm = getSystemService(BATTERY_SERVICE) as? BatteryManager ?: return 100
        return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    }

    /** Config-driven, speed-adaptive interval (ms) for the NEXT location request —
     * classification happens after each fix in enqueue()/classifyAndReschedule(). */
    // Battery saver throttles GPS and network anyway; asking for the normal
    // rate only drains the battery for fixes Android won't deliver, so use
    // the low-battery interval and tell the server why (Part 2, A5).
    private var lastPowerSave: Boolean? = null

    private fun isPowerSave(): Boolean {
        val on = getSystemService(PowerManager::class.java)?.isPowerSaveMode == true
        if (on != lastPowerSave) {
            if (lastPowerSave != null || on) {
                postHeartbeat(if (on) "POWER_SAVE_ON" else "POWER_SAVE_OFF",
                    if (on) "Battery saver on - tracking at the low-battery interval" else "Battery saver off")
            }
            lastPowerSave = on
        }
        return on
    }

    private fun intervalForState(speedKmh: Double?): Long {
        val battery = batteryPercent()
        val seconds = when {
            battery in 1..lowBatteryThresholdPct || isPowerSave() -> intervalLowBatteryS
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
                // Re-registering after every fix re-fires this callback with the
                // same state; report only real changes (was ~1 heartbeat / 12 s).
                if (availability.isLocationAvailable == lastGpsAvailable) return
                lastGpsAvailable = availability.isLocationAvailable
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
            flushHandler.postDelayed(flushRunnable, batchIntervalMs)
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

    // ---- location switched off by the officer (Fix Plan Part 2, A4) ----
    //
    // GPS_LOST above also fires indoors; this is the explicit "location
    // services are off" state, which only the officer can fix - so tell
    // them, and tell the server why the route has a hole.

    private var locationSwitchReceiver: BroadcastReceiver? = null
    private var locationWasOn: Boolean? = null

    private fun watchLocationSwitch() {
        if (locationSwitchReceiver != null) return
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) = onLocationSwitch()
        }
        ContextCompat.registerReceiver(
            this, receiver, IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION),
            ContextCompat.RECEIVER_NOT_EXPORTED,  // system broadcasts still arrive
        )
        locationSwitchReceiver = receiver
        onLocationSwitch()  // already off at punch-in counts too
    }

    private fun unwatchLocationSwitch() {
        locationSwitchReceiver?.let { try { unregisterReceiver(it) } catch (e: Exception) { } }
        locationSwitchReceiver = null
        locationWasOn = null
        getSystemService(NotificationManager::class.java)?.cancel(LOCATION_OFF_NOTIFICATION_ID)
    }

    private fun onLocationSwitch() {
        val lm = getSystemService(LocationManager::class.java) ?: return
        val on = LocationManagerCompat.isLocationEnabled(lm)
        if (on == locationWasOn) return
        locationWasOn = on
        val nm = getSystemService(NotificationManager::class.java) ?: return
        if (on) {
            postHeartbeat("LOCATION_ON", "Location services switched back on")
            nm.cancel(LOCATION_OFF_NOTIFICATION_ID)
            return
        }
        postHeartbeat("LOCATION_OFF", "Location services switched off on the phone")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(NotificationChannel(
                ALERT_CHANNEL_ID, "Tracking alerts", NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = "When your route cannot be recorded" })
        }
        val openSettings = PendingIntent.getActivity(
            this, 1, Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, ALERT_CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        nm.notify(LOCATION_OFF_NOTIFICATION_ID, builder
            .setContentTitle("Location is off")
            .setContentText("Your travel is not being recorded. Tap to turn location on.")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentIntent(openSettings)
            .setAutoCancel(true)
            .build())
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
            // Mock-location fraud detection (GPSValidator.validate step 0,
            // apps.livetracking.services.py) was previously fed only by the
            // JS-driven single-fix capture path (LocationService.js, for
            // punch/visit/collection) - this continuous native stream never
            // populated it, so a mocked fix here always validated as real.
            put("is_mock_location", loc.isFromMockProvider)
            put("battery_level", batteryPercent())
            put("timestamp", iso.format(Date(loc.time)))
            // Idempotency key (Milestone 1) — lets the server dedup a batch
            // that gets resent after its HTTP response was lost in transit.
            put("client_point_id", UUID.randomUUID().toString())
            // Per-session monotonic counter: the server's second idempotency
            // axis, (session, sequence_no) is unique. A retry whose
            // client_point_ids were lost or mangled still cannot double-insert,
            // so an offline backlog replayed after a crash cannot double a
            // stretch of the route and distort its distance.
            put("sequence", nextSequence())
        }
        // Overflow drops the OLDEST buffered fix, but never silently: the
        // route will show a gap there, which is honest - those fixes were
        // never uploaded.
        if (buffer.add(point.toString(), BUFFER_CAP) > 0) {
            Log.w(TAG, "GPS buffer full ($BUFFER_CAP); dropped the oldest unsent fix.")
        }
        // Refreshed on every real fix, not just at punch-in, so a long but
        // genuinely active shift (12+ hours is common for field employees) is
        // never mistaken for an abandoned one (see STALE_SESSION_MS).
        prefs().edit().putLong(KEY_PERSISTED_AT, System.currentTimeMillis()).apply()
        if (buffer.count() >= batchMaxPoints) flush()
    }

    /**
     * The next per-session sequence number, persisted so it survives the
     * service being killed. Resume from the value the server reports after a
     * successful upload, so a client that lost its counter (clear-data, restore
     * to a new device) steps past what is already stored instead of having its
     * next fixes silently deduped away.
     */
    private fun nextSequence(): Int {
        synchronized(sequenceLock) {
            if (sequenceNo < 0) {
                sequenceNo = prefs().getInt(KEY_SEQUENCE, 1)
                if (sequenceNo < 1) sequenceNo = 1
            }
            val value = sequenceNo
            sequenceNo += 1
            return value
        }
    }

    /** Called with the server's `max_sequence` after each successful upload. */
    private fun noteServerMaxSequence(serverMax: Int) {
        if (serverMax < 1) return
        synchronized(sequenceLock) {
            if (serverMax >= sequenceNo) sequenceNo = serverMax + 1
            prefs().edit().putInt(KEY_SEQUENCE, sequenceNo).apply()
        }
    }

    /** POST all buffered fixes, oldest first. A fix only leaves `buffer` once
     * a 2xx response confirms the server has it; treating "handed to the
     * network" as "stored" let a process death mid-send lose data. */
    private fun flush() {
        if (baseUrl.isEmpty() || token.isEmpty() || sessionId < 0) return
        // Another flush() is already draining the buffer - let it finish
        // rather than racing it for the same unconfirmed chunk. It will pick
        // up whatever arrived since on its own next call.
        if (!isFlushing.compareAndSet(false, true)) return

        val url = baseUrl.trimEnd('/') + "/livetracking/points/"
        val authToken = token
        val sid = sessionId
        val interval = batchIntervalMs

        // Send in chunks no larger than the server's own cap (an offline
        // backlog can grow past it) — oldest first, one chunk at a time, on
        // this same background thread so a long backlog drains in one pass
        // instead of waiting one flush cycle per chunk. A chunk is only
        // removed from `buffer` after the server accepts it; on any failure
        // the untried remainder simply stays in `buffer` where it already
        // was (client_point_id + sequence_no make a resend a safe no-op
        // server-side, so re-attempting a chunk whose success/failure was
        // ambiguous, e.g. a timeout after the server actually wrote it, is
        // always safe).
        thread {
            try {
                var chunkSize = offlineMaxBatchSize.coerceAtLeast(1)

                while (true) {
                    val rows = buffer.oldest(chunkSize)
                    if (rows.isEmpty()) break
                    val chunk = rows.map { JSONObject(it.second) }
                    val points = JSONArray()
                    for (p in chunk) points.put(p)
                    // A batch whose oldest point is well older than one normal
                    // flush interval accumulated while offline — flag it for the
                    // server's sync audit trail (see IngestPointsView's `source`
                    // handling).
                    val oldestAgeMs = System.currentTimeMillis() - (chunk.firstOrNull()?.let {
                        try { iso.parse(it.getString("timestamp"))?.time } catch (e: Exception) { null }
                    } ?: System.currentTimeMillis())
                    val source = if (oldestAgeMs > interval * 2) "offline_sync" else "live"

                    val body = JSONObject().apply {
                        put("session_id", sid)
                        put("points", points)
                        put("source", source)
                    }.toString()

                    var conn: HttpURLConnection? = null
                    try {
                        conn = (URL(url).openConnection() as HttpURLConnection).apply {
                            requestMethod = "POST"
                            connectTimeout = 15000
                            readTimeout = 15000
                            doOutput = true
                            setRequestProperty("Content-Type", "application/json")
                            setRequestProperty("Authorization", "Bearer $authToken")
                            if (deviceId.isNotEmpty()) setRequestProperty("X-DEVICE-ID", deviceId)
                        }
                        conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                        val code = conn.responseCode
                        if (code in 200..299) {
                            // Step the local counter past whatever the server now
                            // holds, so a counter lost with the process cannot
                            // make every subsequent fix look like a duplicate of
                            // one already stored.
                            (conn.inputStream.bufferedReader().use { it.readText() }).let { response ->
                                try { noteServerMaxSequence(JSONObject(response).optInt("max_sequence", 0)) }
                                catch (e: Exception) { /* response shape changed; keep local counter */ }
                            }
                            // Confirmed stored server-side - now safe to drop.
                            buffer.deleteUpTo(rows.last().first)
                        } else if (code == 400 && chunkSize > 1) {
                            // Even our configured chunk size is too large for this
                            // batch (e.g. a stale offline_max_batch_size) — halve
                            // it and retry the SAME remaining data immediately.
                            chunkSize = (chunkSize / 2).coerceAtLeast(1)
                            Log.w(TAG, "flush() got HTTP 400, halving chunk size to $chunkSize")
                        } else {
                            throw RuntimeException("HTTP $code")
                        }
                    } catch (e: Exception) {
                        // Network error / 5xx / a 400 even at chunk size 1
                        // (malformed data, not a size problem) — stop this pass.
                        // Nothing to re-queue: whatever hasn't been confirmed
                        // sent is still in `buffer`; retry on the next flush.
                        return@thread
                    } finally {
                        conn?.disconnect()
                    }
                }
            } finally {
                isFlushing.set(false)
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
                    if (deviceId.isNotEmpty()) setRequestProperty("X-DEVICE-ID", deviceId)
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

    // ---- one-time move of the old SharedPreferences buffer ----

    /** Builds up to 1.62 kept unsent fixes as one JSON string in prefs; move
     * them into `buffer` once so an update installed while offline loses none. */
    private fun migrateLegacyBuffer() {
        val raw = prefs().getString(KEY_BUFFER, null) ?: return
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) buffer.add(arr.getJSONObject(i).toString(), BUFFER_CAP)
            if (arr.length() > 0) Log.i(TAG, "Moved ${arr.length()} unsent GPS fix(es) into the SQLite buffer.")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read the old GPS buffer - dropping it.", e)
        }
        prefs().edit().remove(KEY_BUFFER).apply()
    }

    // ---- params persistence (survive process death / START_STICKY restart) ----

    private fun prefs() = getSharedPreferences(PREFS, MODE_PRIVATE)

    private fun persistParams() {
        prefs().edit()
            .putString(EXTRA_BASE_URL, baseUrl)
            .putString(EXTRA_TOKEN, token)
            .putString(EXTRA_DEVICE_ID, deviceId)
            .putInt(EXTRA_SESSION_ID, sessionId)
            .putLong(KEY_PERSISTED_AT, System.currentTimeMillis())
            .putInt(EXTRA_INTERVAL_MOVING_S, intervalMovingS)
            .putInt(EXTRA_INTERVAL_WALKING_S, intervalWalkingS)
            .putInt(EXTRA_INTERVAL_STATIONARY_S, intervalStationaryS)
            .putInt(EXTRA_INTERVAL_LOW_BATTERY_S, intervalLowBatteryS)
            .putInt(EXTRA_LOW_BATTERY_THRESHOLD_PCT, lowBatteryThresholdPct)
            .putInt(EXTRA_BATCH_MAX_POINTS, batchMaxPoints)
            .putInt(EXTRA_BATCH_UPLOAD_INTERVAL_S, (batchIntervalMs / 1000L).toInt())
            .putInt(EXTRA_OFFLINE_MAX_BATCH_SIZE, offlineMaxBatchSize)
            .apply()
    }

    private fun restoreParams(): Boolean {
        val p = getSharedPreferences(PREFS, MODE_PRIVATE)
        baseUrl = p.getString(EXTRA_BASE_URL, "") ?: ""
        token = p.getString(EXTRA_TOKEN, "") ?: ""
        deviceId = p.getString(EXTRA_DEVICE_ID, "") ?: ""
        sessionId = p.getInt(EXTRA_SESSION_ID, -1)
        persistedAt = p.getLong(KEY_PERSISTED_AT, 0L)
        intervalMovingS = p.getInt(EXTRA_INTERVAL_MOVING_S, DEFAULT_INTERVAL_MOVING_S)
        intervalWalkingS = p.getInt(EXTRA_INTERVAL_WALKING_S, DEFAULT_INTERVAL_WALKING_S)
        intervalStationaryS = p.getInt(EXTRA_INTERVAL_STATIONARY_S, DEFAULT_INTERVAL_STATIONARY_S)
        intervalLowBatteryS = p.getInt(EXTRA_INTERVAL_LOW_BATTERY_S, DEFAULT_INTERVAL_LOW_BATTERY_S)
        lowBatteryThresholdPct = p.getInt(EXTRA_LOW_BATTERY_THRESHOLD_PCT, DEFAULT_LOW_BATTERY_THRESHOLD_PCT)
        batchMaxPoints = p.getInt(EXTRA_BATCH_MAX_POINTS, DEFAULT_BATCH_MAX_POINTS)
        batchIntervalMs = p.getInt(EXTRA_BATCH_UPLOAD_INTERVAL_S, DEFAULT_BATCH_UPLOAD_INTERVAL_S).toLong() * 1000L
        offlineMaxBatchSize = p.getInt(EXTRA_OFFLINE_MAX_BATCH_SIZE, DEFAULT_OFFLINE_MAX_BATCH_SIZE)
        return baseUrl.isNotEmpty() && token.isNotEmpty()
    }

    private fun clearParams() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().clear().apply()
        baseUrl = ""; token = ""; deviceId = ""; sessionId = -1; persistedAt = 0L
    }

    // ---- foreground notification ----

    /** Returns true if the service successfully promoted itself to
     * foreground. On Android 12+, the OS can refuse startForeground() when
     * it auto-restarts this service (START_STICKY, null intent) after
     * killing it - that restart isn't a user-initiated trigger, so the
     * system throws ForegroundServiceStartNotAllowedException. Previously
     * uncaught here, crashing the service outright (confirmed in
     * Crashlytics: repeated crash-loop on at least one device, versions
     * 1.34-1.47). Callers must not proceed to startLocationUpdates() on
     * false - capturing location in the background without an active
     * foreground notification is itself a violation the OS will kill for,
     * just less immediately. */
    private fun startForegroundTracking(): Boolean {
        createNotificationChannel()
        val notification = buildNotification()
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            true
        } catch (e: IllegalStateException) {
            Log.e(TAG, "startForeground() refused by the OS - stopping cleanly instead of crashing.", e)
            stopSelf()
            false
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
        unwatchLocationSwitch()
        super.onDestroy()
    }
}
