package com.mobile.reminders

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.mobile.R

class FinancialReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    when (intent?.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      -> FinancialReminderScheduler.scheduleFromStored(context)

      actionShowReminder -> {
        val settings = FinancialReminderScheduler.read(context)
        if (settings.enabled) {
          showNotification(context, settings.message)
          FinancialReminderScheduler.scheduleFromStored(context)
        }
      }
    }
  }

  companion object {
    const val actionShowReminder = "com.mobile.action.SHOW_FINANCIAL_REMINDER"
    private const val channelId = "financial_reminders"
    private const val notificationId = 31028

    fun showNotification(context: Context, message: String): Boolean {
      if (
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
          PackageManager.PERMISSION_GRANTED
      ) return false

      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        manager.createNotificationChannel(
          NotificationChannel(
            channelId,
            "Nhắc kiểm tra tài chính",
            NotificationManager.IMPORTANCE_DEFAULT,
          ).apply {
            description = "Lời nhắc ghi chép và kiểm tra ngân sách do bạn bật"
          },
        )
      }

      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      val contentIntent = launchIntent?.let {
        PendingIntent.getActivity(
          context,
          notificationId,
          it.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
      }
      val notification = NotificationCompat.Builder(context, channelId)
        .setSmallIcon(R.drawable.ic_stat_nova)
        .setContentTitle("Sổ Thu Chi Nova")
        .setContentText(message)
        .setStyle(NotificationCompat.BigTextStyle().bigText(message))
        .setContentIntent(contentIntent)
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        .setCategory(NotificationCompat.CATEGORY_REMINDER)
        .build()
      manager.notify(notificationId, notification)
      return true
    }
  }
}
