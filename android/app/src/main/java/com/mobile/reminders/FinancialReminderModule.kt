package com.mobile.reminders

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FinancialReminderModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "FinancialReminder"

  @ReactMethod
  fun getSettings(promise: Promise) {
    promise.resolve(toMap(FinancialReminderScheduler.read(reactContext)))
  }

  @ReactMethod
  fun saveSettings(
    enabled: Boolean,
    frequency: String,
    hour: Double,
    minute: Double,
    message: String,
    promise: Promise,
  ) {
    val safeFrequency = if (frequency in listOf("DAILY", "WEEKLY", "MONTHLY")) {
      frequency
    } else {
      "WEEKLY"
    }
    val settings = FinancialReminderSettings(
      enabled = enabled,
      frequency = safeFrequency,
      hour = hour.toInt().coerceIn(0, 23),
      minute = minute.toInt().coerceIn(0, 59),
      message = message.trim().take(180).ifEmpty {
        "Bạn đã kiểm tra ngân sách tuần này chưa?"
      },
    )
    FinancialReminderScheduler.save(reactContext, settings)
    promise.resolve(toMap(settings))
  }

  @ReactMethod
  fun showPreview(message: String, promise: Promise) {
    promise.resolve(
      FinancialReminderReceiver.showNotification(
        reactContext,
        message.trim().take(180),
      ),
    )
  }

  private fun toMap(settings: FinancialReminderSettings) = Arguments.createMap().apply {
    putBoolean("enabled", settings.enabled)
    putString("frequency", settings.frequency)
    putInt("hour", settings.hour)
    putInt("minute", settings.minute)
    putString("message", settings.message)
  }
}
