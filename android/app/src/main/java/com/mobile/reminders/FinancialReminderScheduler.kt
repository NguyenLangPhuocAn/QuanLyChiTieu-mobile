package com.mobile.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters

object FinancialReminderScheduler {
  private const val preferencesName = "financial_reminders"
  private const val requestCode = 31028
  private const val monthlyDay = 25

  fun read(context: Context): FinancialReminderSettings {
    val preferences = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
    return FinancialReminderSettings(
      enabled = preferences.getBoolean("enabled", false),
      frequency = preferences.getString("frequency", "WEEKLY") ?: "WEEKLY",
      hour = preferences.getInt("hour", 20).coerceIn(0, 23),
      minute = preferences.getInt("minute", 0).coerceIn(0, 59),
      message = preferences.getString(
        "message",
        "Bạn đã kiểm tra ngân sách tuần này chưa?",
      ) ?: "Bạn đã kiểm tra ngân sách tuần này chưa?",
    )
  }

  fun save(context: Context, settings: FinancialReminderSettings) {
    context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
      .edit()
      .putBoolean("enabled", settings.enabled)
      .putString("frequency", settings.frequency)
      .putInt("hour", settings.hour)
      .putInt("minute", settings.minute)
      .putString("message", settings.message)
      .apply()
    schedule(context, settings)
  }

  fun scheduleFromStored(context: Context) {
    schedule(context, read(context))
  }

  fun cancel(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(pendingIntent(context))
  }

  private fun schedule(context: Context, settings: FinancialReminderSettings) {
    cancel(context)
    if (!settings.enabled) return

    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val triggerAt = nextTriggerAt(settings)
    alarmManager.setAndAllowWhileIdle(
      AlarmManager.RTC_WAKEUP,
      triggerAt,
      pendingIntent(context),
    )
  }

  private fun pendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, FinancialReminderReceiver::class.java)
      .setAction(FinancialReminderReceiver.actionShowReminder)
    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun nextTriggerAt(
    settings: FinancialReminderSettings,
    nowMillis: Long = System.currentTimeMillis(),
  ): Long {
    val zone = ZoneId.systemDefault()
    val now = Instant.ofEpochMilli(nowMillis).atZone(zone)
    val reminderTime = LocalTime.of(settings.hour, settings.minute)
    val candidate = when (settings.frequency) {
      "DAILY" -> nextDaily(now.toLocalDateTime(), reminderTime)
      "MONTHLY" -> nextMonthly(now.toLocalDateTime(), reminderTime)
      else -> nextWeekly(now.toLocalDateTime(), reminderTime)
    }
    return candidate.atZone(zone).toInstant().toEpochMilli()
  }

  private fun nextDaily(now: LocalDateTime, time: LocalTime): LocalDateTime {
    val today = LocalDateTime.of(now.toLocalDate(), time)
    return if (today.isAfter(now)) today else today.plusDays(1)
  }

  private fun nextWeekly(now: LocalDateTime, time: LocalTime): LocalDateTime {
    val sunday = now.toLocalDate().with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY))
    val candidate = LocalDateTime.of(sunday, time)
    return if (candidate.isAfter(now)) candidate else candidate.plusWeeks(1)
  }

  private fun nextMonthly(now: LocalDateTime, time: LocalTime): LocalDateTime {
    val currentMonth = LocalDate.of(now.year, now.month, monthlyDay)
    val candidate = LocalDateTime.of(currentMonth, time)
    return if (candidate.isAfter(now)) candidate else candidate.plusMonths(1)
  }
}

data class FinancialReminderSettings(
  val enabled: Boolean,
  val frequency: String,
  val hour: Int,
  val minute: Int,
  val message: String,
)
