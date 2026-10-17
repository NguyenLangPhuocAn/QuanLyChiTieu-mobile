package com.mobile.banknotifications

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.math.sqrt
import org.json.JSONArray
import org.json.JSONObject

class BankNotificationModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), SensorEventListener, LifecycleEventListener {
  private val sensorManager =
    reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private var shakeDetectionRequested = false
  private var firstShakeAt = 0L
  private var lastPeakAt = 0L
  private var lastEmittedAt = 0L
  private var shakePeakCount = 0

  init {
    reactContext.addLifecycleEventListener(this)
  }

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

  @ReactMethod
  fun startShakeDetection(promise: Promise) {
    shakeDetectionRequested = true
    promise.resolve(registerShakeSensor())
  }

  @ReactMethod
  fun stopShakeDetection(promise: Promise) {
    shakeDetectionRequested = false
    resetShakeSequence()
    sensorManager.unregisterListener(this)
    promise.resolve(true)
  }

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  override fun onSensorChanged(event: SensorEvent?) {
    val values = event?.values ?: return
    if (event.sensor.type != Sensor.TYPE_ACCELEROMETER || values.size < 3) return

    val gravity = SensorManager.GRAVITY_EARTH
    val x = values[0] / gravity
    val y = values[1] / gravity
    val z = values[2] / gravity
    val force = sqrt(x * x + y * y + z * z)
    if (force < shakeThreshold) return

    val now = System.currentTimeMillis()
    if (now - lastPeakAt < minimumPeakGapMs || now - lastEmittedAt < eventCooldownMs) return
    lastPeakAt = now

    if (firstShakeAt == 0L || now - firstShakeAt > shakeWindowMs) {
      firstShakeAt = now
      shakePeakCount = 1
      return
    }

    shakePeakCount += 1
    if (shakePeakCount < requiredPeakCount) return

    lastEmittedAt = now
    resetShakeSequence()
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(shakeEventName, null)
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  override fun onHostResume() {
    if (shakeDetectionRequested) registerShakeSensor()
  }

  override fun onHostPause() {
    sensorManager.unregisterListener(this)
    resetShakeSequence()
  }

  override fun onHostDestroy() {
    sensorManager.unregisterListener(this)
    resetShakeSequence()
  }

  override fun invalidate() {
    shakeDetectionRequested = false
    sensorManager.unregisterListener(this)
    reactContext.removeLifecycleEventListener(this)
    super.invalidate()
  }

  private fun registerShakeSensor(): Boolean {
    val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: return false
    return sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME)
  }

  private fun resetShakeSequence() {
    firstShakeAt = 0L
    lastPeakAt = 0L
    shakePeakCount = 0
  }

  companion object {
    private const val shakeEventName = "BankNotificationShake"
    private const val shakeThreshold = 2.7f
    private const val requiredPeakCount = 2
    private const val minimumPeakGapMs = 220L
    private const val shakeWindowMs = 1_000L
    private const val eventCooldownMs = 2_500L
  }
}
