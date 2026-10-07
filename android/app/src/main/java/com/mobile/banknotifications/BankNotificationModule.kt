package com.mobile.banknotifications

import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import org.json.JSONArray
import org.json.JSONObject

class BankNotificationModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "BankNotificationReader"

  @ReactMethod
  fun isNotificationAccessGranted(promise: Promise) {
    val enabledListeners = Settings.Secure.getString(
      reactContext.contentResolver,
      "enabled_notification_listeners",
    ).orEmpty()
    val component = ComponentName(reactContext, BankNotificationListenerService::class.java)
    promise.resolve(enabledListeners.split(":").any { it.equals(component.flattenToString(), true) })
  }

  @ReactMethod
  fun openNotificationAccessSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("NOTIFICATION_SETTINGS_UNAVAILABLE", error.message, error)
    }
  }

  @ReactMethod
  fun getLaunchableAppsJson(promise: Promise) {
    try {
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val resolveInfos = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        reactContext.packageManager.queryIntentActivities(
          intent,
          android.content.pm.PackageManager.ResolveInfoFlags.of(0),
        )
      } else {
        @Suppress("DEPRECATION")
        reactContext.packageManager.queryIntentActivities(intent, 0)
      }
      val apps = resolveInfos
        .map { info ->
          val packageName = info.activityInfo.packageName
          JSONObject()
            .put("packageName", packageName)
            .put("appName", info.loadLabel(reactContext.packageManager).toString())
        }
        .filter { it.optString("packageName") != reactContext.packageName }
        .distinctBy { it.optString("packageName") }
        .sortedBy { it.optString("appName").lowercase() }

      promise.resolve(JSONArray(apps).toString())
    } catch (error: Exception) {
      promise.reject("APP_LIST_UNAVAILABLE", error.message, error)
    }
  }

  @ReactMethod
  fun getPendingEventsJson(activeUser: String, promise: Promise) {
    promise.resolve(
      BankNotificationStore.getPendingEvents(reactContext, activeUser).toString(),
    )
  }

  @ReactMethod
  fun setConfiguration(
    activeUser: String?,
    packages: ReadableArray,
    promise: Promise,
  ) {
    val values = mutableSetOf<String>()
    for (index in 0 until packages.size()) {
      packages.getString(index)?.trim()?.takeIf { it.isNotBlank() }?.let(values::add)
    }
    BankNotificationStore.setConfiguration(reactContext, activeUser, values)
    promise.resolve(true)
  }

  @ReactMethod
  fun markProcessed(activeUser: String, eventId: String, promise: Promise) {
    BankNotificationStore.remove(reactContext, eventId, activeUser)
    promise.resolve(true)
  }

  @ReactMethod
  fun dismissEvent(activeUser: String, eventId: String, promise: Promise) {
    BankNotificationStore.remove(reactContext, eventId, activeUser)
    promise.resolve(true)
  }
}
