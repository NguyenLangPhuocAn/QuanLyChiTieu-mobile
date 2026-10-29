package com.mobile.widgets

import android.app.KeyguardManager
import android.content.Intent
import android.os.Bundle
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.content.res.ColorStateList
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import java.lang.ref.WeakReference
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/** A separate translucent task. Closing it returns to the launcher, never MainActivity. */
class NovaWidgetEntryActivity : ReactActivity() {
  companion object {
    private var activeEntry = WeakReference<NovaWidgetEntryActivity>(null)
    fun showContent() { activeEntry.get()?.contentReady() }
  }
  private var loading: View? = null
  override fun getMainComponentName() = "NovaWidgetEntry"
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    if ((getSystemService(KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked ||
      !NovaWidgetProvider.validEntry(this, intent.dataString ?: "")) {
      finish()
      return
    }
    window.setBackgroundDrawableResource(android.R.color.transparent)
    activeEntry = WeakReference(this)
    // A cold React runtime may still be loading. Show feedback immediately,
    // until the real panel has laid out, instead of an invisible empty activity.
    val density = resources.displayMetrics.density
    fun dp(value: Int) = (value * density).toInt()
    val overlay = FrameLayout(this).apply { setBackgroundColor(0x2E22140A); isClickable = true }
    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      minimumWidth = dp(240)
      setPadding(dp(24), dp(20), dp(24), dp(20))
      background = GradientDrawable().apply {
        setColor(Color.rgb(255, 249, 242)); cornerRadius = dp(20).toFloat()
      }
      addView(ProgressBar(this@NovaWidgetEntryActivity).apply {
        indeterminateTintList = ColorStateList.valueOf(Color.rgb(255, 136, 0))
      }, LinearLayout.LayoutParams(dp(28), dp(28)))
      addView(TextView(this@NovaWidgetEntryActivity).apply {
        text = "Đang mở giao dịch…"
        textSize = 16f
        setTextColor(Color.rgb(74, 43, 26))
        gravity = Gravity.CENTER
        maxWidth = resources.displayMetrics.widthPixels - dp(96)
        setPadding(0, dp(12), 0, 0)
      }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
      addView(TextView(this@NovaWidgetEntryActivity).apply {
        text = "Đóng"
        textSize = 15f
        gravity = Gravity.CENTER
        minHeight = dp(48)
        minWidth = dp(48)
        setTextColor(Color.rgb(167, 84, 16))
        setPadding(dp(16), dp(8), dp(16), 0)
        setOnClickListener { finish() }
      }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }
    overlay.addView(card, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,
      ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
    (window.decorView as ViewGroup).addView(overlay,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    loading = overlay
  }
  fun contentReady() = runOnUiThread {
    loading?.let { (it.parent as? ViewGroup)?.removeView(it) }
    loading = null
  }
  override fun onDestroy() {
    if (activeEntry.get() === this) activeEntry.clear()
    loading = null
    super.onDestroy()
  }
  override fun onNewIntent(intent: Intent) {
    // A second widget tap must not emit Linking into the main app or overwrite this draft.
    if (NovaWidgetProvider.validEntry(this, intent.dataString ?: ""))
      Toast.makeText(this, "Hoàn tất hoặc hủy giao dịch đang nhập trước.", Toast.LENGTH_SHORT).show()
  }
  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
      override fun getLaunchOptions() = Bundle().apply { putString("entryUrl", intent.dataString) }
    }
}
