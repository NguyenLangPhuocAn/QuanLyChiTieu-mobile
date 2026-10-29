package com.mobile.widgets

import android.app.Activity
import android.app.AlertDialog
import android.app.KeyguardManager
import android.appwidget.AppWidgetManager
import android.os.Bundle

/** Selects a cached category only; never creates a transaction or starts a request. */
class NovaWidgetCategoryActivity : Activity() {
  private var scope: String? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val prefs = NovaWidgetProvider.prefs(this)
    scope = intent.getStringExtra("scope")
    val widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1)
    val type = intent.getStringExtra("type") ?: "EXPENSE"
    if (scope == null || scope != prefs.getString("scope", null) || widgetId < 0 ||
      type !in listOf("INCOME", "EXPENSE") ||
      (getSystemService(KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked) {
      finish()
      return
    }
    val categories = NovaWidgetProvider.categories(this, type)
    val selected = prefs.getLong("category_${widgetId}_$type", -1)
    val builder = AlertDialog.Builder(this)
      .setTitle(if (type == "INCOME") "Danh mục thu" else "Danh mục chi")
      .setNegativeButton("Hủy") { _, _ -> finish() }
      .setNeutralButton("Chọn trong app") { _, _ ->
        if (scope == prefs.getString("scope", null))
          startActivity(NovaWidgetProvider.entryIntent(this, widgetId, type, "FORM", null))
        finish()
      }
    if (categories.isEmpty()) builder.setMessage("Chưa có danh mục đã tải. Mở app có mạng để cập nhật.")
    else builder.setSingleChoiceItems(categories.map { it.name }.toTypedArray(), categories.indexOfFirst { it.id == selected }) { _, which ->
      if (scope == prefs.getString("scope", null)) {
        prefs.edit().putLong("category_${widgetId}_$type", categories[which].id).commit()
        NovaWidgetProvider.render(this)
      }
      finish()
    }
    builder.create().apply {
      setOnDismissListener { finish() }
      show()
      window?.setBackgroundDrawableResource(com.mobile.R.drawable.nova_widget_background)
    }
  }

  override fun onResume() {
    super.onResume()
    if (scope != NovaWidgetProvider.prefs(this).getString("scope", null)) finish()
  }
}
