package com.pocketpal.download

import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import android.app.NotificationChannel
import android.app.NotificationManager
import com.pocketpal.R
import android.util.Log
import androidx.work.*

class DownloadWorker @JvmOverloads constructor(
    context: Context,
    params: WorkerParameters,
    private val engine: DownloadEngine = DownloadEngine.get(context),
    private val runs: DownloadRuns = DownloadRuns.process,
    private val foregroundOverride: (suspend (ForegroundInfo) -> Unit)? = null,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val downloadId = inputData.getString(KEY_DOWNLOAD_ID) ?: return Result.failure()
        val progressInterval = inputData.getLong(KEY_PROGRESS_INTERVAL, DEFAULT_PROGRESS_INTERVAL)
        Log.d(TAG, "Running download $downloadId (attempt $runAttemptCount)")
        val foreground = foregroundInfo(downloadId)
        try {
            if (foregroundOverride != null) foregroundOverride.invoke(foreground) else setForeground(foreground)
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: IllegalStateException) {
            Log.w(TAG, "Foreground start deferred for $downloadId", e)
            return Result.retry()
        }
        val signal = runs.register(downloadId)
        return try {
            when (engine.run(downloadId, signal, progressInterval)) {
                DownloadEngine.Outcome.RESCHEDULE -> Result.retry()
                DownloadEngine.Outcome.DONE -> Result.success()
            }
        } finally {
            runs.unregister(downloadId, signal)
        }
    }

    private fun foregroundInfo(id: String): ForegroundInfo {
        val channel = "model_downloads"
        if (Build.VERSION.SDK_INT >= 26) {
            applicationContext.getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(channel, applicationContext.getString(R.string.download_channel_name), NotificationManager.IMPORTANCE_LOW)
            )
        }
        val notification = NotificationCompat.Builder(applicationContext, channel)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(applicationContext.getString(R.string.download_channel_name))
            .setOngoing(true).setOnlyAlertOnce(true).setProgress(0, 0, true).build()
        return if (Build.VERSION.SDK_INT >= 29) ForegroundInfo(id.hashCode(), notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        else ForegroundInfo(id.hashCode(), notification)
    }

    companion object {
        private const val TAG = "DownloadWorker"
        const val KEY_DOWNLOAD_ID = "download_id"
        const val KEY_PROGRESS_INTERVAL = "progress_interval"
        const val DEFAULT_PROGRESS_INTERVAL = 1000L // 1 second default

        fun createWorkRequest(downloadId: String, progressInterval: Long = DEFAULT_PROGRESS_INTERVAL): OneTimeWorkRequest {
            Log.d(TAG, "Creating work request for download ID: $downloadId with progress interval: $progressInterval ms")
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                .build()

            return OneTimeWorkRequestBuilder<DownloadWorker>()
                .setConstraints(constraints)
                .setInputData(workDataOf(
                    KEY_DOWNLOAD_ID to downloadId,
                    KEY_PROGRESS_INTERVAL to progressInterval
                ))
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    java.util.concurrent.TimeUnit.MILLISECONDS
                )
                .build()
        }
    }
}
