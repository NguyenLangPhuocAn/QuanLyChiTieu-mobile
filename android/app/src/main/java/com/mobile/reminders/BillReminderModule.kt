package com.mobile.reminders

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BillReminderModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "BillReminder"
  private fun complete(promise: Promise, operation: () -> Any?) {
    try { promise.resolve(operation()) }
    catch (_: Exception) { promise.reject("BILL_REMINDER", "Chưa cập nhật được lời nhắc. Kiểm tra quyền thông báo và thử lại.") }
  }
  @ReactMethod fun activate(scope: String?, promise: Promise) = complete(promise) { BillReminderScheduler.activate(context, scope); null }
  @ReactMethod fun sync(scope: String, json: String, promise: Promise) = complete(promise) { BillReminderScheduler.sync(context, scope, json); null }
  @ReactMethod fun invalidate(scope: String, promise: Promise) = complete(promise) { BillReminderScheduler.invalidate(context, scope); null }
  @ReactMethod fun getState(scope: String, promise: Promise) = complete(promise) { BillReminderScheduler.state(context, scope).toString() }
  @ReactMethod fun save(scope: String, enabled: Boolean, hour: Double, minute: Double, promise: Promise) = complete(promise) {
    BillReminderScheduler.save(context, scope, enabled, hour.toInt(), minute.toInt())
    BillReminderScheduler.state(context, scope).toString()
  }
  @ReactMethod fun validatedLink(scope: String, url: String, promise: Promise) = complete(promise) { BillReminderScheduler.validatedLink(scope, url) }
}
