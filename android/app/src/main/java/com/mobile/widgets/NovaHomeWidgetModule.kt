package com.mobile.widgets

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject

class NovaHomeWidgetModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
  private var registered = false
  private val callback = object : ConnectivityManager.NetworkCallback() {
    override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
      if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) && context.hasActiveReactInstance())
        context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("NovaNetworkAvailable", null)
    }
  }
  override fun getName() = "NovaHomeWidget"
  override fun initialize() {
    super.initialize()
    if (Build.VERSION.SDK_INT >= 24) { connectivity.registerDefaultNetworkCallback(callback); registered = true }
  }
  override fun invalidate() { if (registered) connectivity.unregisterNetworkCallback(callback); registered=false; super.invalidate() }
  @ReactMethod fun addListener(name: String) { }
  @ReactMethod fun removeListeners(count: Double) { }
  @ReactMethod fun isConnected(promise: Promise) {
    val caps = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
    promise.resolve(caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true)
  }
  @ReactMethod fun activate(scope: String?, promise: Promise) {
    val p = NovaWidgetProvider.prefs(context)
    if (scope != p.getString("scope", null)) p.edit().clear().putString("scope", scope).commit()
    NovaWidgetProvider.render(context); promise.resolve(null)
  }
  @ReactMethod fun update(scope: String, json: String, promise: Promise) {
    try {
      val p = NovaWidgetProvider.prefs(context)
      if (scope == p.getString("scope", null)) {
        val value = JSONObject(json)
        // Deliberately mirror only display summaries. Never tokens, notes or names.
        val safe = JSONObject().put("day", value.getString("day")).put("expense", value.getString("expense").take(80))
          .put("income", value.getString("income").take(80)).put("pending", value.getInt("pending"))
          .put("hasData", value.optBoolean("hasData"))
        p.edit().putString("snapshot", safe.toString()).commit(); NovaWidgetProvider.render(context)
      }
      promise.resolve(null)
    } catch (_: Exception) { promise.reject("WIDGET", "Chưa cập nhật được widget.") }
  }
  @ReactMethod fun requestPin(promise: Promise) {
    val manager = AppWidgetManager.getInstance(context)
    promise.resolve(Build.VERSION.SDK_INT >= 26 && manager.isRequestPinAppWidgetSupported &&
      manager.requestPinAppWidget(ComponentName(context,NovaWidgetProvider::class.java),null,null))
  }
}
