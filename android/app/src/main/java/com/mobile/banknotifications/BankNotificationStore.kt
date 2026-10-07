package com.mobile.banknotifications

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object BankNotificationStore {
  private const val preferencesName = "bank_notification_reader"
  private const val enabledPackagesKey = "enabled_packages"
  private const val activeUserKey = "active_user"
  private const val pendingEventsKey = "pending_events"
  private const val maximumPendingEvents = 100

  fun getEnabledPackages(context: Context): Set<String> =
    context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
      .getStringSet(enabledPackagesKey, emptySet())
      ?.toSet()
      ?: emptySet()

  fun getActiveUser(context: Context): String? =
    context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
      .getString(activeUserKey, null)

  @Synchronized
  fun setConfiguration(context: Context, activeUser: String?, packages: Set<String>) {
    context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
      .edit()
      .putStringSet(enabledPackagesKey, packages)
      .apply {
        if (activeUser.isNullOrBlank()) remove(activeUserKey)
        else putString(activeUserKey, activeUser)
      }
      .apply()
  }

  @Synchronized
  fun getPendingEvents(context: Context, activeUser: String? = null): JSONArray {
    val raw = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
      .getString(pendingEventsKey, "[]")
      ?: "[]"
    return try {
      val stored = JSONArray(raw)
      if (activeUser == null) return stored
      val filtered = JSONArray()
      for (index in 0 until stored.length()) {
        val event = stored.optJSONObject(index) ?: continue
        if (event.optString("ownerUserId") == activeUser) filtered.put(event)
      }
      filtered
    } catch (_: Exception) {
      JSONArray()
    }
  }

  @Synchronized
  fun enqueue(context: Context, event: JSONObject) {
    val current = getPendingEvents(context)
    val next = JSONArray()
    val eventId = event.optString("id")

    for (index in 0 until current.length()) {
      val existing = current.optJSONObject(index) ?: continue
      if (existing.optString("id") != eventId) {
        next.put(existing)
      }
    }
    next.put(event)

    val trimmed = JSONArray()
    val start = maxOf(0, next.length() - maximumPendingEvents)
    for (index in start until next.length()) {
      trimmed.put(next.get(index))
    }
    savePendingEvents(context, trimmed)
  }

  @Synchronized
  fun remove(context: Context, eventId: String, activeUser: String) {
    val current = getPendingEvents(context)
    val next = JSONArray()
    for (index in 0 until current.length()) {
      val existing = current.optJSONObject(index) ?: continue
      if (
        existing.optString("id") != eventId ||
        existing.optString("ownerUserId") != activeUser
      ) {
        next.put(existing)
      }
    }
    savePendingEvents(context, next)
  }

  private fun savePendingEvents(context: Context, events: JSONArray) {
    context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
      .edit()
      .putString(pendingEventsKey, events.toString())
      .apply()
  }
}
