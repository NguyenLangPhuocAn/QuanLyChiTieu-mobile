package com.mobile.widgets

import android.app.KeyguardManager
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/** A separate translucent task. Closing it returns to the launcher, never MainActivity. */
class NovaWidgetEntryActivity : ReactActivity() {
  override fun getMainComponentName() = "NovaWidgetEntry"
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    if ((getSystemService(KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked ||
      !NovaWidgetProvider.validEntry(this, intent.dataString ?: "")) finish()
    window.setBackgroundDrawableResource(android.R.color.transparent)
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
