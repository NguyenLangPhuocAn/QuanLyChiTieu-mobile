package com.mobile.banknotifications

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.*
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.Executors

class BankScreenCaptureModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), ActivityEventListener, LifecycleEventListener {
  private var permission: Promise? = null
  private val executor = Executors.newSingleThreadExecutor()
  private val requestCode = 7432
  private val main = Handler(Looper.getMainLooper())
  init {
    context.addActivityEventListener(this)
    context.addLifecycleEventListener(this)
    // Remove leftovers from a killed process, without touching any other cache.
    if (BankScreenCaptureService.instance == null)
      BankScreenCaptureService.directory(context).listFiles()?.forEach { it.delete() }
  }
  override fun getName() = "BankScreenCapture"

  @ReactMethod fun isReady(promise: Promise) {
    promise.resolve(BankScreenCaptureService.instance?.ready == true)
  }

  @ReactMethod fun prepare(promise: Promise) {
    val activity = context.currentActivity
    if (activity == null || permission != null) {
      promise.reject("CAPTURE_BUSY", "Không thể mở quyền chụp lúc này.")
      return
    }
    if (BankScreenCaptureService.instance?.ready == true) { promise.resolve(true); return }
    permission = promise
    activity.runOnUiThread {
      try {
        val manager = context.getSystemService(MediaProjectionManager::class.java)
        val intent = if (Build.VERSION.SDK_INT >= 34)
          manager.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay())
        else manager.createScreenCaptureIntent()
        @Suppress("DEPRECATION")
        activity.startActivityForResult(intent, requestCode)
      } catch (error: Throwable) {
        permission = null
        promise.reject("CAPTURE_PERMISSION", error.message)
      }
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != this.requestCode) return
    val promise = permission ?: return
    if (resultCode != Activity.RESULT_OK || data == null) {
      permission = null
      promise.resolve(false)
      return
    }
    val timeout = Runnable {
      if (permission === promise) {
        permission = null
        BankScreenCaptureService.onPrepared = null
        stopSession()
        promise.reject("CAPTURE_TIMEOUT", "Chưa mở được phiên chụp. Vui lòng thử lại.")
      }
    }
    main.postDelayed(timeout, 15000)
    BankScreenCaptureService.onPrepared = { error ->
      main.removeCallbacks(timeout)
      permission = null
      if (error == null) promise.resolve(true)
      else promise.reject("CAPTURE_PREPARE", error.message)
    }
    try {
      val intent = Intent(context, BankScreenCaptureService::class.java)
        .putExtra("resultCode", resultCode).putExtra("data", data)
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent)
      else context.startService(intent)
    } catch (error: Throwable) {
      main.removeCallbacks(timeout)
      permission = null
      BankScreenCaptureService.onPrepared = null
      promise.reject("CAPTURE_PREPARE", error.message)
    }
  }
  override fun onNewIntent(intent: Intent) = Unit

  @ReactMethod fun capture(promise: Promise) {
    val service = BankScreenCaptureService.instance
    if (service?.ready != true) { promise.reject("CAPTURE_NOT_READY", "Cần cấp quyền chụp màn hình trước."); return }
    service.capture { file, width, height, error ->
      if (error != null || file == null) promise.reject("CAPTURE_FAILED", error?.message)
      else promise.resolve(Arguments.createMap().apply {
        putString("uri", "file://${file.absolutePath}")
        putInt("width", width); putInt("height", height)
        putDouble("capturedAt", System.currentTimeMillis().toDouble())
      })
    }
  }

  private fun safeFile(uri: String): File {
    val folder = BankScreenCaptureService.directory(context).canonicalFile
    val file = File(android.net.Uri.parse(uri).path ?: "").canonicalFile
    require(file.parentFile == folder && file.isFile) { "Ảnh chụp không còn khả dụng." }
    return file
  }

  @ReactMethod fun recognize(uri: String, left: Double, top: Double, right: Double, bottom: Double, promise: Promise) {
    executor.execute {
      var bitmap: Bitmap? = null
      var cropped: Bitmap? = null
      try {
        require(listOf(left, top, right, bottom).all { it.isFinite() && it in 0.0..1.0 })
        require(right - left >= 0.05 && bottom - top >= 0.02) { "Vùng chọn quá nhỏ." }
        bitmap = BitmapFactory.decodeFile(safeFile(uri).absolutePath) ?: error("Không mở được ảnh chụp.")
        val x = (left * bitmap.width).toInt()
        val y = (top * bitmap.height).toInt()
        val width = ((right - left) * bitmap.width).toInt().coerceAtMost(bitmap.width - x)
        val height = ((bottom - top) * bitmap.height).toInt().coerceAtMost(bitmap.height - y)
        cropped = Bitmap.createBitmap(bitmap, x, y, width, height)
        if (cropped !== bitmap) bitmap.recycle()
        val selected = cropped
        val file = File(BankScreenCaptureService.directory(context), "${UUID.randomUUID()}.png")
        file.outputStream().use { selected.compress(Bitmap.CompressFormat.PNG, 100, it) }
        val digest = MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString("") { "%02x".format(it) }
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        recognizer.process(InputImage.fromBitmap(selected, 0))
          .addOnSuccessListener { result ->
            promise.resolve(Arguments.createMap().apply {
              putString("uri", "file://${file.absolutePath}")
              putString("text", result.text)
              putString("sourceRef", digest)
              putInt("width", width); putInt("height", height)
            })
          }
          .addOnFailureListener { error -> promise.reject("CAPTURE_OCR", error.message) }
          .addOnCompleteListener { selected.recycle(); recognizer.close() }
      } catch (error: Throwable) {
        cropped?.let { if (!it.isRecycled) it.recycle() }
        bitmap?.let { if (!it.isRecycled) it.recycle() }
        promise.reject("CAPTURE_OCR", error.message)
      }
    }
  }

  @ReactMethod fun deleteCapture(uri: String, promise: Promise) {
    try { safeFile(uri).delete(); promise.resolve(true) }
    catch (_: Throwable) { promise.resolve(false) }
  }
  @ReactMethod fun stop(promise: Promise) { stopSession(); promise.resolve(true) }
  private fun stopSession() {
    BankScreenCaptureService.instance?.requestStop()
      ?: context.stopService(Intent(context, BankScreenCaptureService::class.java))
  }
  override fun onHostResume() = Unit
  override fun onHostPause() { if (permission == null) stopSession() }
  override fun onHostDestroy() {
    permission?.reject("CAPTURE_CLOSED", "Màn hình đã đóng.")
    permission = null
    stopSession()
  }
  override fun invalidate() {
    onHostDestroy()
    context.removeActivityEventListener(this)
    context.removeLifecycleEventListener(this)
    executor.shutdown()
    super.invalidate()
  }
}
