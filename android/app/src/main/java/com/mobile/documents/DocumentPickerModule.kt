package com.mobile.documents

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
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
  private var pendingRequestCode: Int? = null
  private var pendingSave: PendingSave? = null

  private val activityListener: ActivityEventListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
      ) {
        if (requestCode != pendingRequestCode) return
        val promise = pendingPromise ?: return
        val saveRequest = pendingSave
        pendingPromise = null
        pendingRequestCode = null
        pendingSave = null

        if (resultCode != Activity.RESULT_OK || data?.data == null) {
          promise.resolve(null)
          return
        }

        try {
          if (requestCode == SAVE_FILE_REQUEST && saveRequest != null) {
            promise.resolve(writeSavedFile(data.data!!, saveRequest))
          } else {
            promise.resolve(copyToCache(data.data!!, requestCode))
          }
        } catch (error: Exception) {
          promise.reject(
            if (requestCode == SAVE_FILE_REQUEST) "DOCUMENT_WRITE_FAILED" else "DOCUMENT_READ_FAILED",
            if (requestCode == SAVE_FILE_REQUEST) "Không lưu được file đã chọn." else "Không đọc được file đã chọn.",
            error,
          )
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
    pendingRequestCode = PICK_EXCEL_REQUEST
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

  @ReactMethod
  fun pickBackupFile(promise: Promise) {
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
    pendingRequestCode = PICK_BACKUP_REQUEST
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "application/octet-stream"
      putExtra(
        Intent.EXTRA_MIME_TYPES,
        arrayOf(
          "application/vnd.sothuchinova.backup+json",
          "application/json",
          "application/octet-stream",
          "*/*",
        ),
      )
    }
    activity.startActivityForResult(intent, PICK_BACKUP_REQUEST)
  }

  @ReactMethod
  fun saveBase64File(
    filename: String,
    mimeType: String,
    base64: String,
    promise: Promise,
  ) {
    if (pendingPromise != null) {
      promise.reject("PICKER_BUSY", "Trình chọn file đang mở.")
      return
    }
    val activity = context.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Không mở được trình lưu file.")
      return
    }
    if (base64.isBlank()) {
      promise.reject("EMPTY_FILE", "File không có dữ liệu.")
      return
    }

    val safeFilename = filename
      .replace(Regex("[\\\\/:*?\"<>|]"), "-")
      .trim()
      .take(120)
      .ifEmpty { "so-thu-chi-nova.dat" }
    val safeMimeType = mimeType.trim().takeIf { it.contains('/') }
      ?: "application/octet-stream"
    pendingPromise = promise
    pendingRequestCode = SAVE_FILE_REQUEST
    pendingSave = PendingSave(safeFilename, safeMimeType, base64)
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = safeMimeType
      putExtra(Intent.EXTRA_TITLE, safeFilename)
    }
    activity.startActivityForResult(intent, SAVE_FILE_REQUEST)
  }

  private fun copyToCache(uri: Uri, requestCode: Int): WritableNativeMap {
    val resolver = context.contentResolver
    val isBackup = requestCode == PICK_BACKUP_REQUEST
    var displayName = if (isBackup) "du-lieu.stcn-backup" else "du-lieu-cu.xlsx"
    val cursor: Cursor? = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
    cursor?.use {
      if (it.moveToFirst()) {
        displayName = it.getString(0)?.takeIf { name -> name.isNotBlank() } ?: displayName
      }
    }
    val safeName = displayName.replace(Regex("[^A-Za-z0-9._-]"), "-")
    val directory = File(
      context.cacheDir,
      if (isBackup) "personal-backups" else "excel-imports",
    ).apply { mkdirs() }
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
        if (isBackup) {
          "application/vnd.sothuchinova.backup+json"
        } else {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        },
      )
    }
  }

  private fun writeSavedFile(uri: Uri, request: PendingSave): WritableNativeMap {
    val bytes = Base64.decode(request.base64, Base64.DEFAULT)
    context.contentResolver.openOutputStream(uri, "w").use { output ->
      requireNotNull(output) { "Không mở được nơi lưu file." }
      output.write(bytes)
      output.flush()
    }
    return WritableNativeMap().apply {
      putString("uri", uri.toString())
      putString("name", request.filename)
      putString("type", request.mimeType)
    }
  }

  companion object {
    private const val PICK_EXCEL_REQUEST = 7311
    private const val PICK_BACKUP_REQUEST = 7312
    private const val SAVE_FILE_REQUEST = 7313
  }
}

private data class PendingSave(
  val filename: String,
  val mimeType: String,
  val base64: String,
)
