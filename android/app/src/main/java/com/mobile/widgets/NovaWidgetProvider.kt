package com.mobile.widgets

import android.app.PendingIntent
import android.app.KeyguardManager
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.RemoteViews
import com.mobile.MainActivity
import com.mobile.R
import org.json.JSONObject
import java.time.LocalDate
import java.util.UUID
import java.security.MessageDigest

open class NovaWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) = render(context)
  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) = render(context)
  override fun onDeleted(context: Context, ids: IntArray) {
    val edit = prefs(context).edit()
    ids.forEach { id -> edit.remove("type_$id").remove("category_${id}_EXPENSE").remove("category_${id}_INCOME").remove("link_nonce_$id") }
    edit.apply()
  }
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    val p = prefs(context)
    val locked = (context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked
    if (intent.action == "com.mobile.widget.TOGGLE" && !locked) {
      p.edit().putBoolean("visible", !p.getBoolean("visible", false)).commit()
      render(context)
    } else if (intent.action == "com.mobile.widget.TYPE" && !locked) {
      val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1)
      val type = intent.getStringExtra("type")
      val ids = AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, NovaWidgetProvider::class.java))
      if (id in ids && type in listOf("EXPENSE", "INCOME", "LOAN_DEBT")) {
        p.edit().putString("type_$id", type).commit()
        render(context)
      }
    }
  }
  data class Choice(val id: Long, val name: String)
  companion object {
    fun prefs(context: Context) = context.getSharedPreferences("nova_home_widget_v1", Context.MODE_PRIVATE)
    // Both variants use the same guarded entry flow, with a nonce per live widget.
    fun liveWidgetIds(context: Context): IntArray {
      val manager = AppWidgetManager.getInstance(context)
      return manager.getAppWidgetIds(ComponentName(context, NovaWidgetProvider::class.java)) +
        manager.getAppWidgetIds(ComponentName(context, NovaMiniWidgetProvider::class.java))
    }
    fun snapshot(context: Context): JSONObject = runCatching {
      JSONObject(prefs(context).getString("snapshot", "{}") ?: "{}")
    }.getOrDefault(JSONObject())

    fun categories(context: Context, type: String): List<Choice> {
      val array = snapshot(context).optJSONArray("categories") ?: return emptyList()
      return (0 until array.length()).mapNotNull { index ->
        val value = array.optJSONObject(index)
        if (value != null && value.optString("type") == type && value.optLong("id") > 0)
          Choice(value.optLong("id"), value.optString("name")) else null
      }.distinctBy { it.id }
    }

    fun entryIntent(context: Context, widgetId: Int, type: String, action: String, categoryId: Long?): Intent {
      val p = prefs(context)
      if (p.getString("scope", null) == null) return Intent(context, MainActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      val nonce = p.getString("link_nonce_$widgetId", null) ?: UUID.randomUUID().toString().also {
        p.edit().putString("link_nonce_$widgetId", it).commit()
      }
      val uri = Uri.Builder().scheme("quanlychitieu").authority("quick-entry")
        .appendQueryParameter("scope", prefs(context).getString("scope", ""))
        .appendQueryParameter("type", type).appendQueryParameter("action", action)
        .appendQueryParameter("widget", widgetId.toString()).appendQueryParameter("nonce", nonce)
        // Stable identity lets Android replace PendingIntents on repaint rather
        // than allocating a new activity token for every cache refresh.
        .appendQueryParameter("event", "$widgetId-$action")
      if (categoryId != null) uri.appendQueryParameter("category", categoryId.toString())
      return Intent(context, NovaWidgetEntryActivity::class.java).setAction(Intent.ACTION_VIEW).setData(uri.build())
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }

    fun validEntry(context: Context, url: String): Boolean = runCatching {
      val uri = Uri.parse(url)
      val p = prefs(context)
      val id = uri.getQueryParameter("widget")?.toIntOrNull() ?: -1
      val expected = p.getString("link_nonce_$id", null)
      val received = uri.getQueryParameter("nonce")
      val ids = liveWidgetIds(context)
      uri.scheme == "quanlychitieu" && uri.host == "quick-entry" && id in ids &&
        p.getString("scope", null) != null && p.getString("scope", null) == uri.getQueryParameter("scope") &&
        expected != null && received != null &&
        MessageDigest.isEqual(expected.toByteArray(Charsets.UTF_8), received.toByteArray(Charsets.UTF_8))
    }.getOrDefault(false)

    fun render(context: Context) {
      val p = prefs(context)
      val scope = p.getString("scope", null)
      val json = snapshot(context)
      val manager = AppWidgetManager.getInstance(context)
      val locked = (context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked
      val visible = scope != null && p.getBoolean("visible", false) && !locked
      val fresh = json.optString("day") == LocalDate.now().toString() && json.optBoolean("hasData")
      for (id in manager.getAppWidgetIds(ComponentName(context, NovaWidgetProvider::class.java))) {
        val views = RemoteViews(context.packageName, R.layout.nova_home_widget)
        views.setTextViewText(R.id.widget_expense, if (!visible) "*****" else if (fresh) json.optString("expense", "—") else "Chưa cập nhật")
        views.setTextViewText(R.id.widget_income, if (!visible) "*****" else if (fresh) json.optString("income", "—") else "Chưa cập nhật")
        views.setTextViewText(R.id.widget_status, if (scope == null) "Mở app để đăng nhập" else "${json.optInt("pending")} chờ đồng bộ")
        views.setViewVisibility(R.id.widget_status, if (scope != null && json.optInt("pending") == 0) android.view.View.GONE else android.view.View.VISIBLE)
        views.setTextViewText(R.id.widget_toggle, if (visible) "Ẩn tiền" else "Hiện tiền")
        val toggle = Intent(context, NovaWidgetProvider::class.java).setAction("com.mobile.widget.TOGGLE")
        views.setOnClickPendingIntent(R.id.widget_toggle, PendingIntent.getBroadcast(context, id, toggle, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        val type = p.getString("type_$id", "EXPENSE") ?: "EXPENSE"
        val category = if (scope == null) null else categories(context, type).find { it.id == p.getLong("category_${id}_$type", -1) }
        views.setTextViewText(R.id.widget_category, if (type == "LOAN_DEBT") "Vay hoặc cho vay · chọn khi nhập" else (category?.name ?: "Chọn danh mục") + "  ▾")
        views.setContentDescription(R.id.widget_category, if (type == "LOAN_DEBT") "Nhập khoản vay nợ" else if (type == "INCOME") "Chọn danh mục thu" else "Chọn danh mục chi")
        for ((viewId, choiceType) in listOf(R.id.widget_expense_button to "EXPENSE", R.id.widget_income_button to "INCOME", R.id.widget_loan_button to "LOAN_DEBT")) {
          val selected = type == choiceType
          views.setInt(viewId, "setBackgroundResource", if (selected) R.drawable.nova_widget_button else R.drawable.nova_widget_secondary)
          views.setTextColor(viewId, if (selected) android.graphics.Color.WHITE else android.graphics.Color.rgb(122,74,40))
          views.setContentDescription(viewId, (if (choiceType == "LOAN_DEBT") "Vay/Nợ" else if (choiceType == "INCOME") "Thu" else "Chi") + if (selected) ", đang chọn" else "")
          val select = Intent(context, NovaWidgetProvider::class.java).setAction("com.mobile.widget.TYPE")
            .setData(Uri.parse("nova-widget://type/$id/$choiceType")).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id).putExtra("type", choiceType)
          views.setOnClickPendingIntent(viewId, PendingIntent.getBroadcast(context, id, select, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        }
        val choose = Intent(context, NovaWidgetCategoryActivity::class.java)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
          .setData(Uri.parse("nova-widget://category/$id/$type")).putExtra("scope", scope)
          .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id).putExtra("type", type)
        views.setOnClickPendingIntent(R.id.widget_category, if (scope == null || type == "LOAN_DEBT")
          PendingIntent.getActivity(context, id, entryIntent(context,id,type,"FORM",null), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
          else PendingIntent.getActivity(context, id, choose, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        for ((viewId, action) in listOf(R.id.widget_add to "FORM", R.id.widget_voice to "VOICE", R.id.widget_camera to "CAMERA")) {
          views.setOnClickPendingIntent(viewId, PendingIntent.getActivity(context, id, entryIntent(context,id,type,action,category?.id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        }
        manager.updateAppWidget(id, views)
      }
      for (id in manager.getAppWidgetIds(ComponentName(context, NovaMiniWidgetProvider::class.java))) {
        val views = RemoteViews(context.packageName, R.layout.nova_mini_widget)
        views.setOnClickPendingIntent(R.id.widget_mini_add, PendingIntent.getActivity(
          context, id, entryIntent(context, id, "EXPENSE", "FORM", null),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        manager.updateAppWidget(id, views)
      }
    }
  }
}
