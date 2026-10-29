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
import org.json.JSONArray
import android.net.Uri
import android.widget.Toast
import android.content.Intent
import com.mobile.MainActivity

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
        // Display totals and category choices only, never tokens, notes or wallet names.
        val categories = JSONArray()
        val input = value.optJSONArray("categories") ?: JSONArray()
        for (i in 0 until input.length()) {
          val category = input.optJSONObject(i) ?: continue
          val id = category.optLong("id")
          val name = category.optString("name").trim().take(80)
          val type = category.optString("type")
          if (id > 0 && name.isNotEmpty() && type in listOf("EXPENSE", "INCOME"))
            categories.put(JSONObject().put("id", id).put("name", name).put("type", type))
        }
        val safe = JSONObject().put("day", value.getString("day")).put("expense", value.getString("expense").take(80))
          .put("income", value.getString("income").take(80)).put("pending", value.getInt("pending"))
          .put("hasData", value.optBoolean("hasData")).put("categories", categories)
        p.edit().putString("snapshot", safe.toString()).commit(); NovaWidgetProvider.render(context)
      }
      promise.resolve(null)
    } catch (_: Exception) { promise.reject("WIDGET", "Chưa cập nhật được widget.") }
  }
  @ReactMethod fun requestPin(kind: String, promise: Promise) {
    val manager = AppWidgetManager.getInstance(context)
    promise.resolve(Build.VERSION.SDK_INT >= 26 && manager.isRequestPinAppWidgetSupported &&
      manager.requestPinAppWidget(ComponentName(context,
        if (kind == "mini") NovaMiniWidgetProvider::class.java else NovaWidgetProvider::class.java),null,null))
  }
  @ReactMethod fun validateLink(scope: String, url: String, promise: Promise) {
    promise.resolve(scope == NovaWidgetProvider.prefs(context).getString("scope", null) && NovaWidgetProvider.validEntry(context, url))
  }
  @ReactMethod fun closeQuickEntry(result: String, promise: Promise) {
    val activity = context.currentActivity
    if (activity !is NovaWidgetEntryActivity) { promise.resolve(false); return }
    activity.runOnUiThread {
      val message = when (result) { "SAVED" -> "Đã lưu giao dịch"; "PENDING" -> "Đã giữ trên máy, chờ đồng bộ"; else -> null }
      if (message != null) Toast.makeText(activity, message, Toast.LENGTH_LONG).show()
      if (result == "OPEN") activity.startActivity(Intent(activity, MainActivity::class.java))
      activity.finish()
      promise.resolve(true)
    }
  }
}
