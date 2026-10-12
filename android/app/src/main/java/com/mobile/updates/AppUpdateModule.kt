package com.mobile.updates

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.mobile.BuildConfig
import java.io.File

class AppUpdateModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {
  override fun getName() = "AppUpdate"

  @ReactMethod
  fun getVersionInfo(promise: Promise) {
    promise.resolve(
      WritableNativeMap().apply {
        putInt("versionCode", BuildConfig.VERSION_CODE)
        putString("versionName", BuildConfig.VERSION_NAME)
      },
    )
  }

  @ReactMethod
  fun canInstallPackages(promise: Promise) {
    val allowed =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
        context.packageManager.canRequestPackageInstalls()
    promise.resolve(allowed)
  }

  @ReactMethod
  fun openInstallPermission(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val intent =
          Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:${context.packageName}"),
          ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("INSTALL_PERMISSION_FAILED", "Không mở được quyền cài đặt ứng dụng.", error)
    }
  }

  @ReactMethod
  fun installApk(filePath: String, promise: Promise) {
    try {
      if (
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
          !context.packageManager.canRequestPackageInstalls()
      ) {
        promise.reject(
          "INSTALL_PERMISSION_REQUIRED",
          "Cần cho phép ứng dụng cài đặt bản cập nhật.",
        )
        return
      }

      val apk = File(filePath.removePrefix("file://")).canonicalFile
      val allowedRoots =
        listOfNotNull(context.filesDir, context.cacheDir, context.getExternalFilesDir(null))
          .map { it.canonicalFile }
      if (!apk.isFile || allowedRoots.none { root -> apk.path.startsWith(root.path + File.separator) }) {
        promise.reject("INVALID_APK_PATH", "File cập nhật không hợp lệ.")
        return
      }

      val uri =
        FileProvider.getUriForFile(
          context,
          "${context.packageName}.fileprovider",
          apk,
        )
      val intent =
        Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(uri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
      context.startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("APK_INSTALL_FAILED", "Không mở được trình cài bản cập nhật.", error)
    }
  }
}
