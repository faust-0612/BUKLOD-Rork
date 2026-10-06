package org.mzbministry.buklod.nearbyptt

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

class BuklodNearbyPttService : Service() {

  companion object {
    private const val CHANNEL_ID = "buklod-nearby-ptt-v1"
    private const val NOTIFICATION_ID = 24021
    private const val ACTION_LISTEN = "org.mzbministry.buklod.nearbyptt.LISTEN"
    private const val ACTION_TRANSMIT = "org.mzbministry.buklod.nearbyptt.TRANSMIT"
    private const val ACTION_STOP = "org.mzbministry.buklod.nearbyptt.STOP"

    fun startListening(context: Context) {
      val intent =
        Intent(
          context,
          BuklodNearbyPttService::class.java
        ).setAction(ACTION_LISTEN)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun setTransmitting(
      context: Context,
      transmitting: Boolean
    ) {
      val intent =
        Intent(
          context,
          BuklodNearbyPttService::class.java
        ).setAction(
          if (transmitting) {
            ACTION_TRANSMIT
          } else {
            ACTION_LISTEN
          }
        )

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      val intent =
        Intent(
          context,
          BuklodNearbyPttService::class.java
        ).setAction(ACTION_STOP)

      context.startService(intent)
    }
  }

  override fun onCreate() {
    super.onCreate()
    ensureChannel()
  }

  override fun onStartCommand(
    intent: Intent?,
    flags: Int,
    startId: Int
  ): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        return START_NOT_STICKY
      }

      ACTION_TRANSMIT -> {
        promote(transmitting = true)
      }

      else -> {
        promote(transmitting = false)
      }
    }

    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager =
      getSystemService(
        NotificationManager::class.java
      )

    val channel =
      NotificationChannel(
        CHANNEL_ID,
        "BUKLOD Offline Nearby PTT",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description =
          "Keeps Offline Nearby PTT ready while connected to nearby BUKLOD devices."
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
      }

    manager.createNotificationChannel(channel)
  }

  private fun notification(
    transmitting: Boolean
  ): Notification {
    val launchIntent =
      packageManager
        .getLaunchIntentForPackage(packageName)
        ?.apply {
          flags =
            Intent.FLAG_ACTIVITY_CLEAR_TOP or
              Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

    val pendingIntent =
      launchIntent?.let {
        PendingIntent.getActivity(
          this,
          24021,
          it,
          PendingIntent.FLAG_UPDATE_CURRENT or
            PendingIntent.FLAG_IMMUTABLE
        )
      }

    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(
          this,
          CHANNEL_ID
        )
      } else {
        Notification.Builder(this)
      }

    builder
      .setSmallIcon(
        applicationInfo.icon
          .takeIf { it != 0 }
          ?: android.R.drawable.stat_sys_data_bluetooth
      )
      .setContentTitle(
        if (transmitting) {
          "BUKLOD Offline PTT · Transmitting"
        } else {
          "BUKLOD Offline PTT · Listening"
        }
      )
      .setContentText(
        if (transmitting) {
          "Release PTT to return to listening."
        } else {
          "Nearby Bluetooth/Wi-Fi radio is ready."
        }
      )
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setVisibility(Notification.VISIBILITY_PUBLIC)

    if (pendingIntent != null) {
      builder.setContentIntent(pendingIntent)
    }

    return builder.build()
  }

  private fun promote(
    transmitting: Boolean
  ) {
    val note =
      notification(transmitting)

    if (
      Build.VERSION.SDK_INT >=
        Build.VERSION_CODES.Q
    ) {
      var types =
        ServiceInfo
          .FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE

      if (transmitting) {
        types =
          types or
            ServiceInfo
              .FOREGROUND_SERVICE_TYPE_MICROPHONE
      }

      startForeground(
        NOTIFICATION_ID,
        note,
        types
      )
    } else {
      startForeground(
        NOTIFICATION_ID,
        note
      )
    }
  }
}
