package com.mobile.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BillReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action == BillReminderScheduler.action) BillReminderScheduler.receive(context)
    else BillReminderScheduler.rebuild(context)
  }
}
