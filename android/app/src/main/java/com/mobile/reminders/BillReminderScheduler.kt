package com.mobile.reminders

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.mobile.R
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

object BillReminderScheduler {
  const val action = "com.mobile.action.BILL_REMINDER"
  private const val preferencesName = "bill_reminders_v1"
  private const val requestCode = 31029
  private const val notificationId = 31029
  private const val channelId = "bill_due_reminders_v1"
  private fun prefs(context: Context) = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
  fun owner(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

  private fun alarmIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
    context, requestCode,
    Intent(context, BillReminderReceiver::class.java).setAction(action),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )
  private fun cancelAlarm(context: Context) =
    (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(alarmIntent(context))
  private fun cancelNotification(context: Context) =
    (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(notificationId)
  private fun commit(context: Context, edit: android.content.SharedPreferences.Editor.() -> Unit) {
    val editor = prefs(context).edit()
    editor.edit()
    check(editor.commit()) { "Không lưu được lịch nhắc. Vui lòng thử lại." }
  }

  @Synchronized fun activate(context: Context, scope: String?) {
    val next = scope?.let(::owner) ?: ""
    if (prefs(context).getString("active", "") == next) return
    cancelAlarm(context)
    cancelNotification(context)
    commit(context) {
      putString("active", next)
      remove("book")
      remove("postedDay")
    }
  }

  private fun requireActive(context: Context, scope: String): String = owner(scope).also {
    check(prefs(context).getString("active", "") == it) { "Tài khoản đã thay đổi." }
  }

  @Synchronized fun invalidate(context: Context, scope: String) {
    requireActive(context, scope)
    cancelAlarm(context)
    cancelNotification(context)
    commit(context) { remove("book") }
  }

  @Synchronized fun sync(context: Context, scope: String, json: String) {
    requireActive(context, scope)
    // Validate before persisting, but fail closed (cancel any old alarm) on invalid input.
    try {
      parseBook(json)
      commit(context) { putString("book", json) }
      rebuild(context)
    } catch (error: Exception) {
      cancelAlarm(context)
      cancelNotification(context)
      commit(context) { remove("book") }
      throw error
    }
  }

  private fun parseBook(json: String): Pair<List<ReminderBill>, Set<String>> {
    val book = JSONObject(json)
    check(book.getInt("version") == 1)
    val rows = book.getJSONArray("bills")
    val bills = mutableListOf<ReminderBill>()
    val ids = mutableSetOf<String>()
    for (index in 0 until rows.length()) {
      val row = rows.getJSONObject(index)
      val id = row.getString("id")
      check(id.matches(Regex("[A-Za-z0-9_-]{1,160}")) && ids.add(id))
      val anchor = LocalDate.parse(row.getString("anchorDate"))
      check(anchor.year in 2000..2199)
      val cycle = row.getString("cycle")
      check(cycle in listOf("WEEKLY", "MONTHLY", "YEARLY"))
      if (!row.getBoolean("paused") && !row.getBoolean("archived") && row.getBoolean("reminderEnabled")) {
        bills.add(ReminderBill(id, anchor, cycle))
      }
    }
    val handled = mutableSetOf<String>()
    val periods = book.getJSONArray("periods")
    for (index in 0 until periods.length()) {
      val row = periods.getJSONObject(index)
      check(row.getString("billId") in ids)
      check(row.getString("status") in listOf("PAID", "SKIPPED"))
      handled.add("${row.getString("billId")}|${LocalDate.parse(row.getString("dueDate"))}")
    }
    return bills to handled
  }

  fun permission(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (!manager.areNotificationsEnabled()) return false
    if (Build.VERSION.SDK_INT >= 26 && manager.getNotificationChannel(channelId)?.importance == NotificationManager.IMPORTANCE_NONE) return false
    return true
  }

  @Synchronized fun save(context: Context, scope: String, enabled: Boolean, hour: Int, minute: Int) {
    val id = requireActive(context, scope)
    require(hour in 0..23 && minute in 0..59)
    check(!enabled || permission(context)) { "Hãy cho phép thông báo trong Cài đặt Android." }
    commit(context) { putBoolean("$id:enabled", enabled); putInt("$id:hour", hour); putInt("$id:minute", minute) }
    cancelNotification(context)
    commit(context) { remove("postedDay") }
    rebuild(context)
  }

  private fun next(context: Context, now: Long): ReminderBatch? {
    val store = prefs(context)
    val id = store.getString("active", "").orEmpty()
    val json = store.getString("book", null)
    if (id.isEmpty() || !store.getBoolean("$id:enabled", false) || json == null) return null
    val (bills, handled) = parseBook(json)
    val sent = store.getStringSet("$id:sent", emptySet()).orEmpty()
    return BillReminderPlanner.next(bills, handled, sent, now, ZoneId.systemDefault(), store.getInt("$id:hour", 20), store.getInt("$id:minute", 0))
  }

  @Synchronized fun state(context: Context, scope: String): JSONObject {
    val id = owner(scope)
    val store = prefs(context)
    return JSONObject().apply {
      put("enabled", store.getBoolean("$id:enabled", false))
      put("hour", store.getInt("$id:hour", 20))
      put("minute", store.getInt("$id:minute", 0))
      put("permissionGranted", permission(context))
      put("synced", store.getString("active", "") == id && store.contains("book"))
      val batch = if (store.getString("active", "") == id) next(context, System.currentTimeMillis()) else null
      put("nextAt", batch?.at ?: JSONObject.NULL)
    }
  }

  @Synchronized fun rebuild(context: Context) {
    cancelAlarm(context)
    try {
      updatePosted(context)
      if (!permission(context)) return
      val batch = next(context, System.currentTimeMillis()) ?: return
      (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).setAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP, batch.at, alarmIntent(context),
      )
    } catch (_: Exception) {
      cancelNotification(context)
      // Corrupt native mirror must not produce notifications; JS will resync from validated storage.
      commit(context) { remove("book") }
    }
  }

  @Synchronized fun receive(context: Context) {
    val now = System.currentTimeMillis()
    val batch = try { next(context, now) } catch (_: Exception) { null }
    // Re-check current settings/account/book instead of trusting the stale PendingIntent.
    if (batch != null && permission(context)) {
      val store = prefs(context)
      val id = store.getString("active", "").orEmpty()
      val scheduled = batch.day.atTime(store.getInt("$id:hour", 20), store.getInt("$id:minute", 0))
        .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
      if (scheduled <= now) {
        val sent = store.getStringSet("$id:sent", emptySet()).orEmpty().toMutableSet()
        val cutoff = batch.day.minusDays(400)
        sent.removeAll { key -> runCatching { LocalDate.parse(key.split('|')[1]).isBefore(cutoff) }.getOrDefault(true) }
        sent.addAll(batch.entries.map { it.key })
        if (store.getString("postedDay", "") != batch.day.toString()) cancelNotification(context)
        // Durable claim BEFORE notify: process death cannot send this batch twice.
        commit(context) { putStringSet("$id:sent", sent); putString("postedDay", batch.day.toString()) }
        show(context, id, batch.day, batch.entries.size, false)
      }
    }
    rebuild(context)
  }

  private fun updatePosted(context: Context) {
    val store = prefs(context)
    val id = store.getString("active", "").orEmpty()
    val day = store.getString("postedDay", null) ?: return
    val json = store.getString("book", null)
    if (id.isEmpty() || !store.getBoolean("$id:enabled", false) || json == null || !permission(context)) {
      cancelNotification(context)
      return
    }
    val (bills, handled) = parseBook(json)
    val sent = store.getStringSet("$id:sent", emptySet()).orEmpty()
    val date = LocalDate.parse(day)
    val entries = BillReminderPlanner.entries(bills, handled, date, date).filter { it.key in sent }
    if (entries.isEmpty()) cancelNotification(context)
    else {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      // Never resurrect a notification the user has dismissed.
      if (manager.activeNotifications.any { it.id == notificationId }) show(context, id, date, entries.size, true)
    }
  }

  private fun show(context: Context, id: String, day: LocalDate, count: Int, silent: Boolean) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(NotificationChannel(channelId, "Hóa đơn đến hạn", NotificationManager.IMPORTANCE_DEFAULT))
    val uri = Uri.Builder().scheme("quanlychitieu").authority("bills").appendQueryParameter("scope", id)
      .appendQueryParameter("reminderDate", day.toString()).build()
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    launch.removeCategory(Intent.CATEGORY_LAUNCHER)
    launch.addCategory(Intent.CATEGORY_BROWSABLE)
    launch.action = Intent.ACTION_VIEW
    launch.data = uri
    launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val open = PendingIntent.getActivity(context, requestCode, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(R.drawable.ic_stat_nova).setContentTitle("Hóa đơn cần kiểm tra")
      .setContentText("Bạn có $count khoản đến hạn hoặc sắp đến hạn. Mở để xem.")
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setPublicVersion(NotificationCompat.Builder(context, channelId).setSmallIcon(R.drawable.ic_stat_nova)
        .setContentTitle("Sổ Thu Chi Nova").setContentText("Bạn có lời nhắc hóa đơn.").build())
      .setContentIntent(open).setAutoCancel(true).setOnlyAlertOnce(true).setSilent(silent)
      .setCategory(NotificationCompat.CATEGORY_REMINDER).build()
    manager.notify(notificationId, notification)
  }

  fun validatedLink(scope: String, url: String): String? = runCatching {
    val uri = Uri.parse(url)
    if (uri.scheme != "quanlychitieu" || uri.host != "bills" || uri.getQueryParameter("scope") != owner(scope)) return null
    val date = LocalDate.parse(uri.getQueryParameter("reminderDate"))
    "quanlychitieu://bills?reminderDate=$date"
  }.getOrNull()
}
