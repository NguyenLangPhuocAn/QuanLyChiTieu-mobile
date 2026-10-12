package com.mobile.documents

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import java.io.File

class DocumentPickerModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {
  private var pendingPromise: Promise? = null

  private val activityListener: ActivityEventListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
      ) {
        if (requestCode != PICK_EXCEL_REQUEST) return
        val promise = pendingPromise ?: return
        pendingPromise = null

        if (resultCode != Activity.RESULT_OK || data?.data == null) {
          promise.resolve(null)
          return
        }

        try {
          promise.resolve(copyToCache(data.data!!))
        } catch (error: Exception) {
          promise.reject("DOCUMENT_READ_FAILED", "Không đọc được file đã chọn.", error)
        }
      }
    }

  init {
    context.addActivityEventListener(activityListener)
  }

  override fun getName() = "LocalDocumentPicker"

  @ReactMethod
  fun pickExcelFile(promise: Promise) {
    if (pendingPromise != null) {
      promise.reject("PICKER_BUSY", "Trình chọn file đang mở.")
      return
    }
    val activity = context.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Không mở được trình chọn file.")
      return
    }

    pendingPromise = promise
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      putExtra(
        Intent.EXTRA_MIME_TYPES,
        arrayOf(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/octet-stream",
        ),
      )
    }
    activity.startActivityForResult(intent, PICK_EXCEL_REQUEST)
  }

  private fun copyToCache(uri: Uri): WritableNativeMap {
    val resolver = context.contentResolver
    var displayName = "du-lieu-cu.xlsx"
    val cursor: Cursor? = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
    cursor?.use {
      if (it.moveToFirst()) {
        displayName = it.getString(0)?.takeIf { name -> name.isNotBlank() } ?: displayName
      }
    }
    val safeName = displayName.replace(Regex("[^A-Za-z0-9._-]"), "-")
    val directory = File(context.cacheDir, "excel-imports").apply { mkdirs() }
    val target = File(directory, "${System.currentTimeMillis()}-$safeName")
    resolver.openInputStream(uri).use { input ->
      requireNotNull(input) { "Không mở được file." }
      target.outputStream().use { output -> input.copyTo(output) }
    }

    return WritableNativeMap().apply {
      putString("uri", "file://${target.absolutePath}")
      putString("name", displayName)
      putString(
        "type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      )
    }
  }

  companion object {
    private const val PICK_EXCEL_REQUEST = 7311
  }
}
