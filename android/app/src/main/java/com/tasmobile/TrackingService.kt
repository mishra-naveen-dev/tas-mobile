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
import android.util.Log
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

        const val BUFFER_CAP = 600              // drop oldest beyond this if server is down

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

    // Buffer of captured fixes, uploaded in batches to keep server load low.
    private val buffer = ArrayList<JSONObject>()
    private val bufferLock = Any()
    // flush() no longer clears `buffer` upfront (see flush() doc), which
    // removed the implicit mutex that used to make a second concurrent call
    // (periodic timer, network-restored callback, and the threshold check in
    // addPoint() can all fire close together) harmlessly see an empty buffer
    // and return. Without this, two overlapping flush() calls could both
    // snapshot the same unconfirmed chunk and race each other removing it.
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
        restoreBuffer()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startForegroundTracking()

            ACTION_START_LIVE -> {
                baseUrl = intent.getStringExtra(EXTRA_BASE_URL) ?: ""
                token = intent.getStringExtra(EXTRA_TOKEN) ?: ""
                val newSessionId = intent.getIntExtra(EXTRA_SESSION_ID, -1)
                if (newSessionId != sessionId) {
                    // A different tracking session. The sequence counter is
                    // scoped to (session, sequence_no) on the server, so it
                    // restarts; anything still buffered belongs to the previous
                    // session and is dropped rather than replayed into this one
                    // (which would splice two journeys into one route).
                    synchronized(bufferLock) { if (buffer.isNotEmpty()) {
                        Log.w(TAG, "Dropping ${buffer.size} buffered fix(es) from the previous session.")
                        buffer.clear()
                        persistBufferLocked()
                    } }
                    synchronized(sequenceLock) { sequenceNo = 1 }
                    prefs().edit().putInt(KEY_SEQUENCE, 1).apply()
                }
                sessionId = newSessionId
                applyConfigExtras(intent)
                persistParams()
                if (startForegroundTracking()) {
                    startLocationUpdates()
                    registerNetworkCallback()
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
                clearParams()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }

            // Null intent => the OS restarted us after the process was killed
            // (START_STICKY). Restore the saved session/config and resume
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
                        postHeartbeat("SERVICE_RESTARTED", "TrackingService resumed after process restart (START_STICKY)")
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
        val shouldFlush: Boolean
        synchronized(bufferLock) {
            buffer.add(point)
            // Overflow drops the OLDEST buffered fix, but never silently: the
            // first fix of a new upload window has to start where the previous
            // upload left off, or the route is drawn as if the employee jumped
            // from the end of the last flush straight to here - a line across
            // road nobody observed. See flush() for the boundary marker.
            if (buffer.size > BUFFER_CAP) {
                buffer.removeAt(0)
                Log.w(TAG, "GPS buffer full (${BUFFER_CAP}); dropped the oldest unsent fix - " +
                    "the route will show a gap there, which is honest: those fixes were never uploaded.")
            }
            persistBufferLocked()
            shouldFlush = buffer.size >= batchMaxPoints
        }
        if (shouldFlush) flush()
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

    /** POST all buffered fixes as one batch. Nothing is removed from `buffer`
     * (or its persisted copy) until the server actually confirms it. */
    private fun flush() {
        if (baseUrl.isEmpty() || token.isEmpty() || sessionId < 0) return
        // Another flush() is already draining the buffer - let it finish
        // rather than racing it for the same unconfirmed chunk. It will pick
        // up whatever arrived since on its own next call.
        if (!isFlushing.compareAndSet(false, true)) return

        val fullBatch: List<JSONObject>
        synchronized(bufferLock) {
            if (buffer.isEmpty()) {
                isFlushing.set(false)
                return
            }
            // Snapshot only - buffer is NOT cleared/removed from here. A
            // point only leaves `buffer` (and its persisted copy) once a 2xx
            // response confirms the server actually has it; treating
            // "handed to the network" the same as "confirmed stored" was
            // exactly the gap that let a process death mid-send lose data
            // that looked like it had already been sent.
            fullBatch = ArrayList(buffer)
        }

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
        // was (same idempotency guarantee as before either way -
        // client_point_id + sequence_no make a resend a safe no-op
        // server-side, so re-attempting a chunk whose success/failure was
        // ambiguous, e.g. a timeout after the server actually wrote it, is
        // always safe).
        thread {
            try {
                var remaining: List<JSONObject> = fullBatch
                var chunkSize = offlineMaxBatchSize.coerceAtLeast(1)

                while (remaining.isNotEmpty()) {
                    val chunk = remaining.take(chunkSize)
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
                            remaining = remaining.drop(chunk.size)
                            // Confirmed stored server-side - now safe to drop from
                            // the real buffer and its persisted copy. Removing by
                            // count off the front is correct because
                            // addPoint()'s own overflow-drop is the only other
                            // thing that touches buffer's front, and it runs
                            // under the same lock.
                            synchronized(bufferLock) {
                                repeat(chunk.size) { if (buffer.isNotEmpty()) buffer.removeAt(0) }
                                persistBufferLocked()
                            }
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
                        // sent was never removed from `buffer` in the first
                        // place. Only new points that arrived from addPoint()
                        // during this attempt could have pushed it over
                        // BUFFER_CAP, so just re-check that and stop here; it
                        // retries on the next scheduled flush.
                        synchronized(bufferLock) {
                            if (buffer.size > BUFFER_CAP) {
                                val overflow = buffer.size - BUFFER_CAP
                                repeat(overflow) { if (buffer.isNotEmpty()) buffer.removeAt(0) }
                                Log.w(TAG, "GPS buffer overflowed during flush; dropped $overflow oldest unsent fix(es).")
                                persistBufferLocked()
                            }
                        }
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

    // ---- GPS buffer persistence (survive process death while offline) ----
    //
    // `buffer` used to be purely in-memory: if the OS killed this service's
    // process (battery optimization, memory pressure, the
    // ForegroundServiceStartNotAllowedException crash fixed elsewhere) while
    // fixes were sitting unsent, every one of them was gone with no trace -
    // not even a gap marker, since the points were never persisted anywhere
    // to begin with. Writing the buffer to SharedPreferences on every
    // mutation (same mechanism already used for params/sequence below) means
    // a process restart reloads whatever was pending and resumes from there
    // instead of silently losing it. Must be called while already holding
    // bufferLock.
    private fun persistBufferLocked() {
        val arr = JSONArray()
        for (p in buffer) arr.put(p)
        // Also refreshes KEY_PERSISTED_AT (see STALE_SESSION_MS) on every real
        // GPS fix, not just at session start - a long but genuinely active
        // shift (12+ hours is common for field employees) must never be
        // mistaken for an abandoned one just because persistParams() itself
        // was only called once, at punch-in.
        prefs().edit()
            .putString(KEY_BUFFER, arr.toString())
            .putLong(KEY_PERSISTED_AT, System.currentTimeMillis())
            .apply()
    }

    private fun restoreBuffer() {
        val raw = prefs().getString(KEY_BUFFER, null) ?: return
        try {
            val arr = JSONArray(raw)
            synchronized(bufferLock) {
                for (i in 0 until arr.length()) {
                    buffer.add(arr.getJSONObject(i))
                }
            }
            if (arr.length() > 0) {
                Log.i(TAG, "Restored ${arr.length()} unsent GPS fix(es) buffered before the process died.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to restore persisted GPS buffer - starting empty.", e)
        }
    }

    // ---- params persistence (survive process death / START_STICKY restart) ----

    private fun prefs() = getSharedPreferences(PREFS, MODE_PRIVATE)

    private fun persistParams() {
        prefs().edit()
            .putString(EXTRA_BASE_URL, baseUrl)
            .putString(EXTRA_TOKEN, token)
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
        baseUrl = ""; token = ""; sessionId = -1; persistedAt = 0L
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
        super.onDestroy()
    }
}
