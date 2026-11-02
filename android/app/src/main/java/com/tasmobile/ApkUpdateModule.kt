package com.tasmobile

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * Downloads an update APK with Android's DownloadManager and opens the
 * installer only if the file is a complete APK signed like this app.
 *
 * The browser's parallel download could finish with zero-filled holes on a
 * flaky connection (seen with 1.61), which Android then rejects as "package
 * appears to be invalid". DownloadManager streams once and resumes properly,
 * and the signature check below catches any file that still came out broken,
 * so the user gets "download incomplete, try again" instead.
 */
class ApkUpdateModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ApkUpdate"

    @ReactMethod
    fun downloadAndInstall(url: String, title: String, fileName: String, promise: Promise) {
        try {
            val ctx = reactContext.applicationContext
            val dm = ctx.getSystemService(DownloadManager::class.java)
            val file = File(ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), fileName)
            file.delete()  // never install a leftover from an earlier, broken attempt

            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle(title)
                .setDescription("Downloading update")
                .setMimeType(APK_MIME)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setDestinationInExternalFilesDir(ctx, Environment.DIRECTORY_DOWNLOADS, fileName)
            val downloadId = dm.enqueue(request)

            val receiver = object : BroadcastReceiver() {
                override fun onReceive(c: Context, intent: Intent) {
                    if (intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) != downloadId) return
                    ctx.unregisterReceiver(this)
                    finish(ctx, dm, downloadId, file, promise)
                }
            }
            ContextCompat.registerReceiver(
                ctx, receiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                ContextCompat.RECEIVER_EXPORTED,  // sent by the system DownloadManager
            )
        } catch (e: Exception) {
            promise.reject("DOWNLOAD_FAILED", e.message, e)
        }
    }

    private fun finish(ctx: Context, dm: DownloadManager, id: Long, file: File, promise: Promise) {
        val ok = dm.query(DownloadManager.Query().setFilterById(id)).use { c ->
            c.moveToFirst() &&
                c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) == DownloadManager.STATUS_SUCCESSFUL
        }
        if (!ok || !file.exists()) {
            promise.reject("DOWNLOAD_FAILED", "Download did not finish")
            return
        }
        if (!isValidUpdate(ctx, file)) {
            file.delete()
            promise.reject("CORRUPT", "Downloaded file is incomplete or not signed like this app")
            return
        }
        try {
            val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.apkprovider", file)
            ctx.startActivity(Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, APK_MIME)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            })
            promise.resolve("INSTALLER_OPENED")
        } catch (e: Exception) {
            promise.reject("INSTALL_FAILED", e.message, e)
        }
    }

    /** Parsing the archive with signing certificates verifies every byte's
     * signature digest, so a file with holes fails here, not in the installer. */
    @Suppress("DEPRECATION")
    private fun isValidUpdate(ctx: Context, file: File): Boolean {
        val pm = ctx.packageManager
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
            PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        val archive = pm.getPackageArchiveInfo(file.absolutePath, flags) ?: return false
        if (archive.packageName != ctx.packageName) return false
        val installed = pm.getPackageInfo(ctx.packageName, flags)
        val archiveCerts = certs(archive)
        return archiveCerts.isNotEmpty() && archiveCerts == certs(installed)
    }

    @Suppress("DEPRECATION")
    private fun certs(info: PackageInfo): Set<String> {
        val sigs = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
            info.signingInfo?.apkContentsSigners else info.signatures
        return sigs.orEmpty().map { it.toCharsString() }.toSet()
    }

    companion object {
        private const val APK_MIME = "application/vnd.android.package-archive"
    }
}
