package com.mobile.widgets

import android.app.PendingIntent
import android.app.KeyguardManager
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.mobile.MainActivity
import com.mobile.R
import org.json.JSONObject
import java.time.LocalDate

class NovaWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) = render(context)
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == "com.mobile.widget.TOGGLE") {
      val p = prefs(context)
      if (!(context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked)
        p.edit().putBoolean("visible", !p.getBoolean("visible", false)).commit()
      render(context)
    }
  }
  companion object {
    fun prefs(context: Context) = context.getSharedPreferences("nova_home_widget_v1", Context.MODE_PRIVATE)
    fun render(context: Context) {
      val p = prefs(context)
      val scope = p.getString("scope", null)
      val json = runCatching { JSONObject(p.getString("snapshot", "{}") ?: "{}") }.getOrDefault(JSONObject())
      val manager = AppWidgetManager.getInstance(context)
      val locked = (context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked
      val visible = scope != null && p.getBoolean("visible", false) && !locked
      val fresh = json.optString("day") == LocalDate.now().toString() && json.optBoolean("hasData")
      for (id in manager.getAppWidgetIds(ComponentName(context, NovaWidgetProvider::class.java))) {
        val views = RemoteViews(context.packageName, R.layout.nova_home_widget)
        views.setTextViewText(R.id.widget_expense, if (!visible) "*****" else if (fresh) json.optString("expense", "—") else "Chưa cập nhật")
        views.setTextViewText(R.id.widget_income, if (!visible) "*****" else if (fresh) json.optString("income", "—") else "Chưa cập nhật")
        views.setTextViewText(R.id.widget_status, if (scope == null) "Mở app để đăng nhập" else "Dữ liệu đã lưu · ${json.optInt("pending")} chờ đồng bộ")
        views.setTextViewText(R.id.widget_toggle, if (visible) "Ẩn tiền" else "Hiện tiền")
        val toggle = Intent(context, NovaWidgetProvider::class.java).setAction("com.mobile.widget.TOGGLE")
        views.setOnClickPendingIntent(R.id.widget_toggle, PendingIntent.getBroadcast(context, id, toggle, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        for ((viewId, type) in listOf(R.id.widget_expense_button to "EXPENSE", R.id.widget_income_button to "INCOME")) {
          val uri = Uri.Builder().scheme("quanlychitieu").authority("quick-entry").appendQueryParameter("scope", scope ?: "")
            .appendQueryParameter("type", type).appendQueryParameter("event", "$id-${System.currentTimeMillis()}-$type").build()
          val open = Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
          views.setOnClickPendingIntent(viewId, PendingIntent.getActivity(context, id * 10 + if (type == "EXPENSE") 1 else 2, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        }
        manager.updateAppWidget(id, views)
      }
    }
  }
}
