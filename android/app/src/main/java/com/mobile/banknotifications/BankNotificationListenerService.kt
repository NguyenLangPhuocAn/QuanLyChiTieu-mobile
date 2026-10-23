package com.mobile.banknotifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.security.MessageDigest
import org.json.JSONObject

class BankNotificationListenerService : NotificationListenerService() {
  override fun onListenerConnected() {
    super.onListenerConnected()
    activeInstance = this
    try {
      captureActiveNotifications()
    } catch (_: Exception) {
      // Permission or listener connection may still be changing; the button reports this on demand.
    }
  }

  override fun onListenerDisconnected() {
    if (activeInstance === this) activeInstance = null
    super.onListenerDisconnected()
  }

  override fun onNotificationPosted(statusBarNotification: StatusBarNotification?) {
    val notification = statusBarNotification ?: return
    captureNotification(notification)
  }

  private fun captureActiveNotifications() {
    val activeUser = BankNotificationStore.getActiveUser(this) ?: return
    val notifications = (activeNotifications ?: throw IllegalStateException("Bộ đọc thông báo chưa kết nối. Hãy bật lại quyền đọc thông báo."))
      .filter { it.notification.flags and Notification.FLAG_GROUP_SUMMARY == 0 }
    val activeIds = notifications.map { fingerprintFor(activeUser, it) }.toSet()
    BankNotificationStore.retainActive(this, activeUser, activeIds)
    notifications.sortedBy { it.postTime }.forEach(::captureNotification)
  }

  private fun captureNotification(notification: StatusBarNotification) {
    if (notification.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
    if (notification.packageName == packageName) return
    val activeUser = BankNotificationStore.getActiveUser(this) ?: return
    val enabledPackages = BankNotificationStore.getEnabledPackages(this)
    if (enabledPackages.isNotEmpty() && !enabledPackages.contains(notification.packageName)) return

    val extras = notification.notification.extras
    val title = clean(extras.getCharSequence(Notification.EXTRA_TITLE)?.toString())
    val primaryText = clean(extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString())
      .ifBlank { clean(extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()) }
      .ifBlank { clean(extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.joinToString(" ")) }
    val textParts = listOf(primaryText, clean(extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()))
      .filter { it.isNotBlank() }.distinct()
    val text = textParts.joinToString(" ").take(maximumTextLength)
    val content = "$title $text".trim()

    if (!looksLikeTransaction(content) || containsSensitiveCode(content)) return

    val appName = try {
      packageManager.getApplicationLabel(
        packageManager.getApplicationInfo(notification.packageName, 0),
      ).toString()
    } catch (_: Exception) {
      notification.packageName
    }

    val fingerprint = fingerprintFor(activeUser, notification)
    val event = JSONObject()
      .put("id", fingerprint)
      .put("packageName", notification.packageName)
      .put("appName", clean(appName).take(maximumTitleLength))
      .put("title", title.take(maximumTitleLength))
      .put("text", text)
      .put("postedAt", notification.postTime)
      .put("ownerUserId", activeUser)

    BankNotificationStore.enqueue(this, event)
  }

  private fun clean(value: String?): String =
    value.orEmpty().replace(Regex("\\s+"), " ").trim()

  private fun looksLikeTransaction(content: String): Boolean {
    val normalized = content.lowercase()
    val hasAmount = amountPattern.containsMatchIn(normalized)
    val hasTransactionTerm = transactionTerms.any(normalized::contains)
    return hasAmount && hasTransactionTerm
  }

  private fun containsSensitiveCode(content: String): Boolean {
    val normalized = content.lowercase()
    return sensitiveTerms.any(normalized::contains) || otpPattern.containsMatchIn(normalized)
  }

  private fun sha256(value: String): String =
    MessageDigest.getInstance("SHA-256")
      .digest(value.toByteArray(Charsets.UTF_8))
      .joinToString("") { byte -> "%02x".format(byte) }

  private fun fingerprintFor(activeUser: String, notification: StatusBarNotification): String = sha256(
    listOf(activeUser, notification.packageName, notification.key, notification.postTime.toString()).joinToString("|")
  )

  companion object {
    @Volatile
    private var activeInstance: BankNotificationListenerService? = null

    fun refreshActiveNotifications() {
      val instance = activeInstance ?: throw IllegalStateException("Bộ đọc chưa kết nối. Hãy tắt rồi bật lại quyền đọc thông báo của Nova.")
      instance.captureActiveNotifications()
    }

    private const val maximumTitleLength = 160
    private const val maximumTextLength = 800
    private val amountPattern = Regex("(?:[+-]\\s*)?\\d[\\d.,\\s]{1,18}\\s*(?:vnd|vnđ|đ|₫|usd)|\\(?\\s*(?:vnd|vnđ|₫|usd)\\s*\\)?\\s*[+-]?\\s*\\d[\\d.,\\s]{1,18}", RegexOption.IGNORE_CASE)
    private val otpPattern = Regex("(?:otp|mã xác thực|ma xac thuc|verification code|smart otp)[^0-9]{0,20}\\d{4,8}", RegexOption.IGNORE_CASE)
    private val sensitiveTerms = listOf("mã otp", "ma otp", "mật khẩu", "mat khau", "password", "pin code")
    private val transactionTerms = listOf(
      "biến động", "bien dong", "số dư", "so du", "giao dịch", "giao dich",
      "thanh toán", "thanh toan", "chuyển tiền", "chuyen tien", "nhận tiền", "nhan tien",
      "ghi có", "ghi co", "ghi nợ", "ghi no", "credit", "debit", "tài khoản", "tai khoan",
    )
  }
}
