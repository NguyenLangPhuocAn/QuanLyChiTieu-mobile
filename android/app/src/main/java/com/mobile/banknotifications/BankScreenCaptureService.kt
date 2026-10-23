package com.mobile.banknotifications

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.*
import java.io.File
import java.util.UUID

/** A consented session drains frames; it only saves the next frame requested by the bell. */
class BankScreenCaptureService : Service() {
  companion object {
    const val STOP = "com.mobile.banknotifications.STOP_SCREEN_CAPTURE"
    @Volatile var instance: BankScreenCaptureService? = null
    var onPrepared: ((Throwable?) -> Unit)? = null
    fun directory(context: android.content.Context) = File(context.cacheDir, "bank-screen")
  }

  private val thread = HandlerThread("BankScreenCapture")
  private lateinit var worker: Handler
  private var projection: MediaProjection? = null
  private var display: VirtualDisplay? = null
  private var reader: ImageReader? = null
  private var pending: ((File?, Int, Int, Throwable?) -> Unit)? = null
  private var screenWidth = 0
  private var screenHeight = 0
  @Volatile var ready = false
    private set
  private val timeout = Runnable { finishCapture(null, IllegalStateException("Không nhận được ảnh mới. Hãy thử lại khi banner đang hiện.")) }
  private val projectionCallback = object : MediaProjection.Callback() {
    override fun onStop() { stopSelf() }
    override fun onCapturedContentResize(width: Int, height: Int) {
      // An app-only capture cannot include the notification banner. Do not silently read it.
      if (width != screenWidth || height != screenHeight) stopSelf()
    }
  }

  override fun onCreate() {
    super.onCreate()
    thread.start()
    worker = Handler(thread.looper)
    instance = this
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent == null || intent.action == STOP) {
      requestStop()
      return START_NOT_STICKY
    }
    try {
      val manager = getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= 26)
        manager.createNotificationChannel(NotificationChannel("bank-screen", "Đọc banner ngân hàng", NotificationManager.IMPORTANCE_LOW))
      val stop = PendingIntent.getService(this, 0, Intent(this, javaClass).setAction(STOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "bank-screen") else Notification.Builder(this)
      val notification = builder
        .setSmallIcon(android.R.drawable.ic_menu_view)
        .setContentTitle("Sẵn sàng đọc banner")
        .setContentText("Chỉ chụp khi bạn bấm chuông trong ứng dụng.")
        .setOngoing(true)
        .addAction(Notification.Action.Builder(null, "Dừng", stop).build())
        .build()
      if (Build.VERSION.SDK_INT >= 29) startForeground(7431, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
      else startForeground(7431, notification)
      @Suppress("DEPRECATION")
      val data = intent.getParcelableExtra<Intent>("data") ?: error("Thiếu quyền chụp màn hình.")
      val resultCode = intent.getIntExtra("resultCode", Activity.RESULT_CANCELED)
      worker.post {
        try {
          check(projection == null) { "Phiên chụp đã được dùng." }
          val metrics = resources.displayMetrics
          val windowManager = getSystemService(android.view.WindowManager::class.java)
          if (Build.VERSION.SDK_INT >= 30) {
            val bounds = windowManager.maximumWindowMetrics.bounds
            screenWidth = bounds.width()
            screenHeight = bounds.height()
          } else {
            val real = android.util.DisplayMetrics()
            @Suppress("DEPRECATION")
            windowManager.defaultDisplay.getRealMetrics(real)
            screenWidth = real.widthPixels
            screenHeight = real.heightPixels
          }
          projection = getSystemService(MediaProjectionManager::class.java).getMediaProjection(resultCode, data)
          projection!!.registerCallback(projectionCallback, worker)
          reader = ImageReader.newInstance(screenWidth, screenHeight, PixelFormat.RGBA_8888, 2)
          reader!!.setOnImageAvailableListener({ source ->
            val frame = source.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
              if (pending == null) return@setOnImageAvailableListener
              val plane = frame.planes[0]
              val paddedWidth = plane.rowStride / plane.pixelStride
              val padded = Bitmap.createBitmap(paddedWidth, screenHeight, Bitmap.Config.ARGB_8888)
              padded.copyPixelsFromBuffer(plane.buffer)
              val bitmap = Bitmap.createBitmap(padded, 0, 0, screenWidth, screenHeight)
              val folder = directory(this).apply { mkdirs() }
              val file = File(folder, "${UUID.randomUUID()}.png")
              try {
                file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                finishCapture(file, null)
              } finally {
                if (bitmap !== padded) bitmap.recycle()
                padded.recycle()
              }
            } catch (error: Throwable) { finishCapture(null, error) }
            finally { frame.close() }
          }, worker)
          // Exactly one virtual display per consent token (required on Android 14+).
          display = projection!!.createVirtualDisplay("BankBanner", screenWidth, screenHeight, metrics.densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader!!.surface, null, worker)
          ready = true
          onPrepared?.invoke(null)
          onPrepared = null
        } catch (error: Throwable) {
          onPrepared?.invoke(error)
          onPrepared = null
          stopSelf()
        }
      }
    } catch (error: Throwable) {
      onPrepared?.invoke(error)
      onPrepared = null
      stopSelf()
    }
    return START_NOT_STICKY
  }

  fun capture(callback: (File?, Int, Int, Throwable?) -> Unit) {
    worker.post {
      if (!ready || pending != null) {
        callback(null, 0, 0, IllegalStateException("Phiên chụp chưa sẵn sàng hoặc đang bận."))
        return@post
      }
      reader?.acquireLatestImage()?.close() // Never return a buffered pre-click frame.
      pending = callback
      worker.postDelayed(timeout, 6000)
    }
  }

  fun requestStop() {
    ready = false
    stopSelf()
  }

  private fun finishCapture(file: File?, error: Throwable?) {
    worker.removeCallbacks(timeout)
    val callback = pending
    pending = null
    callback?.invoke(file, screenWidth, screenHeight, error)
  }

  override fun onDestroy() {
    ready = false
    instance = null
    worker.post {
      finishCapture(null, IllegalStateException("Phiên chụp đã dừng."))
      onPrepared?.invoke(IllegalStateException("Phiên chụp đã dừng."))
      onPrepared = null
      display?.release()
      reader?.close()
      projection?.unregisterCallback(projectionCallback)
      projection?.stop()
      directory(this).listFiles()?.forEach { it.delete() }
      thread.quitSafely()
    }
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?) = null
}
