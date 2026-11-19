package expo.modules.buklodgenesisime

import android.app.Activity
import android.content.Intent
import android.content.IntentSender
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import android.content.ContentResolver
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID

/**
 * Native ABI permanently baked into Genesis preview APK, not injected by EAS OTA.
 * Modules are opt-in via explicit user action; no background Drive, GPU or Play prompts.
 * This is isolated from existing production runtime and app identity.
 */
class BuklodGenesisNativeFoundationModule : Module() {
  private val ui = Handler(Looper.getMainLooper())
  private val driveRequestCode = 0x4721
  private val driveFileScope = "https://www.googleapis.com/auth/drive.file"
  private val emailScope = "https://www.googleapis.com/auth/userinfo.email"
  private val openIdScope = "openid"
  private var drivePending: Promise? = null
  private var lastDriveToken: String? = null
  private val driveTimeout = Runnable { rejectDrive("Google authorization expired; no notes were changed.") }
  private var activeTranscode: Transformer? = null
  private var activeTranscodePromise: Promise? = null
  private var activeOutput: File? = null

  private fun rejectDrive(message: String) {
    ui.removeCallbacks(driveTimeout)
    val promise = drivePending ?: return
    drivePending = null
    promise.reject("E_GENESIS_DRIVE", message, null)
  }

  private fun completeDrive(result: AuthorizationResult) {
    val token = result.accessToken
    if (token.isNullOrBlank() ||
      !result.grantedScopes.contains(driveFileScope) ||
      !result.grantedScopes.contains(emailScope) ||
      !result.grantedScopes.contains(openIdScope)) {
      rejectDrive("Required Drive and account identity scopes were not granted.")
      return
    }
    val promise = drivePending ?: return
    ui.removeCallbacks(driveTimeout)
    drivePending = null
    // Token is memory-only; JS must verify Google's stable subject for current BUKLOD user.
    lastDriveToken = token
    promise.resolve(mapOf("accessToken" to token, "scope" to driveFileScope))
  }

  private fun finishExport() {
    activeTranscode = null
    activeTranscodePromise = null
    activeOutput = null
  }

  private fun rejectExport(message: String) {
    val promise = activeTranscodePromise
    activeOutput?.delete()
    finishExport()
    promise?.reject("E_GENESIS_MEDIA3", message, null)
  }

  override fun definition() = ModuleDefinition {
    Name("BuklodGenesisNativeFoundation")

    AsyncFunction("openGodotWorld") { promise: Promise ->
      ui.post {
        val activity = appContext.currentActivity
        if (activity == null || activity.isFinishing || activity.isDestroyed) {
          promise.reject("E_GENESIS_GODOT", "Open BUKLOD before entering Kingdom.", null)
        } else {
          try {
            activity.startActivity(Intent(activity, GodotGenesisActivity::class.java))
            promise.resolve(true)
          } catch (_: Exception) {
            promise.reject("E_GENESIS_GODOT", "Godot engine could not open on this phone.", null)
          }
        }
      }
    }

    AsyncFunction("transcodeVideo") { input: String, promise: Promise ->
      ui.post {
        val context = appContext.reactContext
        if (context == null) {
          promise.reject("E_GENESIS_MEDIA3", "Android is not ready.", null)
          return@post
        }
        if (activeTranscode != null) {
          promise.reject("E_GENESIS_MEDIA3_BUSY", "Another video is processing.", null)
          return@post
        }
        val uri = try { Uri.parse(input) } catch (_: Exception) { null }
        if (uri == null || (uri.scheme != ContentResolver.SCHEME_CONTENT && uri.scheme != "file")) {
          promise.reject("E_GENESIS_MEDIA3_URI", "Only user-selected local video is supported.", null)
          return@post
        }
        if (uri.scheme == "file") {
          val inputFile = try { File(uri.path ?: "").canonicalFile } catch (_: Exception) { null }
          val files = listOf(context.cacheDir.canonicalFile, context.filesDir.canonicalFile,
            context.externalCacheDir?.canonicalFile).filterNotNull()
          if (inputFile == null || !files.any { inputFile.path.startsWith(it.path + File.separator) }) {
            promise.reject("E_GENESIS_MEDIA3_URI", "A private app video file is required.", null)
            return@post
          }
        } else {
          try {
            context.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { c ->
              if (c.moveToFirst() && !c.isNull(0) && c.getLong(0) > 400L * 1024L * 1024L) {
                promise.reject("E_GENESIS_MEDIA3_SIZE", "Video is too large for safe on-device processing.", null)
                return@post
              }
            }
          } catch (_: SecurityException) {
            promise.reject("E_GENESIS_MEDIA3_URI", "The video provider did not grant read access.", null)
            return@post
          }
        }
        val dir = File(context.cacheDir, "genesis-video-transcodes")
        if (!dir.exists() && !dir.mkdirs()) {
          promise.reject("E_GENESIS_MEDIA3_STORAGE", "Temporary storage is unavailable.", null)
          return@post
        }
        dir.listFiles()?.filter { it.isFile && System.currentTimeMillis() - it.lastModified() > 3600000L }
          ?.forEach { it.delete() }
        val output = File(dir, UUID.randomUUID().toString() + ".mp4")
        try {
          val transformer = Transformer.Builder(context)
            .setVideoMimeType(MimeTypes.VIDEO_H264)
            .setAudioMimeType(MimeTypes.AUDIO_AAC)
            .addListener(object : Transformer.Listener {
              override fun onCompleted(composition: Composition, result: ExportResult) {
                val resultPromise = activeTranscodePromise
                if (activeOutput != output || resultPromise == null) return
                finishExport()
                if (output.length() <= 0L) {
                  output.delete()
                  resultPromise.reject("E_GENESIS_MEDIA3", "The processed video was empty.", null)
                } else {
                  resultPromise.resolve(mapOf("uri" to Uri.fromFile(output).toString(),
                    "bytes" to output.length(), "mimeType" to "video/mp4"))
                }
              }
              override fun onError(composition: Composition, result: ExportResult, exception: ExportException) {
                if (activeOutput == output) rejectExport("Video codec unsupported; original video remains available.")
              }
            }).build()
          activeTranscode = transformer
          activeTranscodePromise = promise
          activeOutput = output
          transformer.start(EditedMediaItem.Builder(MediaItem.fromUri(uri)).build(), output.absolutePath)
        } catch (_: Exception) {
          rejectExport("Video processing cannot start; keep the original video.")
        }
      }
    }

    AsyncFunction("cancelTranscode") { promise: Promise ->
      ui.post {
        try { activeTranscode?.cancel() } catch (_: Exception) {}
        rejectExport("Video processing canceled; original video preserved.")
        promise.resolve(true)
      }
    }

    AsyncFunction("getPlayUpdateState") { promise: Promise ->
      ui.post {
        val context = appContext.reactContext
        if (context == null) {
          promise.resolve(mapOf("available" to false, "immediateAllowed" to false))
          return@post
        }
        try {
          AppUpdateManagerFactory.create(context).appUpdateInfo
            .addOnSuccessListener { info ->
              promise.resolve(mapOf(
                "available" to (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE),
                "immediateAllowed" to info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE),
                "availableVersionCode" to info.availableVersionCode()))
            }
            .addOnFailureListener {
              // Side-loaded Genesis staging APK has no Play release; never block it.
              promise.resolve(mapOf("available" to false, "immediateAllowed" to false))
            }
        } catch (_: Exception) {
          promise.resolve(mapOf("available" to false, "immediateAllowed" to false))
        }
      }
    }

    AsyncFunction("startImmediatePlayUpdate") { promise: Promise ->
      ui.post {
        val activity = appContext.currentActivity
        if (activity == null || activity.isFinishing || activity.isDestroyed) {
          promise.reject("E_GENESIS_PLAY", "No foreground Play update activity.", null)
          return@post
        }
        val manager = AppUpdateManagerFactory.create(activity)
        manager.appUpdateInfo
          .addOnSuccessListener { info ->
            if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE ||
              !info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
              promise.resolve(false) // Release not available to this device: no forced lock.
              return@addOnSuccessListener
            }
            try {
              promise.resolve(manager.startUpdateFlowForResult(
                info, AppUpdateType.IMMEDIATE, activity, 0x4711))
            } catch (_: Exception) {
              promise.reject("E_GENESIS_PLAY", "Google Play could not start the update.", null)
            }
          }
          .addOnFailureListener {
            promise.resolve(false) // Test APK / unavailable Play, fail open for staging.
          }
      }
    }

    AsyncFunction("authorizeDrive") { chooseAccount: Boolean, promise: Promise ->
      ui.post {
        if (drivePending != null) {
          promise.reject("E_GENESIS_DRIVE_BUSY", "Google authorization is already open.", null)
          return@post
        }
        val activity = appContext.currentActivity
        if (activity == null || activity.isFinishing || activity.isDestroyed) {
          promise.reject("E_GENESIS_DRIVE", "A foreground BUKLOD screen is required.", null)
          return@post
        }
        drivePending = promise
        ui.postDelayed(driveTimeout, 90000)
        try {
          val builder = AuthorizationRequest.builder()
            .setRequestedScopes(listOf(Scope(driveFileScope), Scope(emailScope), Scope(openIdScope)))
          if (chooseAccount) builder.setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT)
          Identity.getAuthorizationClient(activity).authorize(builder.build())
            .addOnSuccessListener(activity) { result ->
              if (drivePending == null) return@addOnSuccessListener
              try {
                if (result.hasResolution()) {
                  val p = result.pendingIntent ?: throw IllegalStateException()
                  activity.startIntentSenderForResult(p.intentSender, driveRequestCode, null, 0, 0, 0)
                } else completeDrive(result)
              } catch (_: IntentSender.SendIntentException) {
                rejectDrive("Cannot open Google account consent.")
              } catch (_: Exception) {
                rejectDrive("Google consent could not be completed.")
              }
            }.addOnFailureListener(activity) {
              rejectDrive("Google Drive access was canceled or unavailable.")
            }
        } catch (_: Exception) {
          rejectDrive("Google Drive authorization cannot start on this device.")
        }
      }
    }

    AsyncFunction("clearDriveToken") { promise: Promise ->
      ui.post {
        rejectDrive("Google Drive connection closed.")
        val token = lastDriveToken
        lastDriveToken = null
        val activity = appContext.currentActivity
        if (activity == null || token.isNullOrBlank()) {
          promise.resolve(true)
        } else {
          Identity.getAuthorizationClient(activity).clearToken(
            ClearTokenRequest.builder().setToken(token).build())
            .addOnSuccessListener { promise.resolve(true) }
            .addOnFailureListener {
              promise.reject("E_GENESIS_DRIVE_CLEAR", "Google cached authorization could not be cleared.", null)
            }
        }
      }
    }

    OnActivityResult { activity, payload ->
      if (payload.requestCode == driveRequestCode && drivePending != null) {
        if (payload.resultCode != Activity.RESULT_OK || payload.data == null) {
          rejectDrive("Google Drive authorization canceled.")
        } else {
          try {
            completeDrive(Identity.getAuthorizationClient(activity)
              .getAuthorizationResultFromIntent(payload.data!!))
          } catch (_: Exception) {
            rejectDrive("Google authorization response was invalid.")
          }
        }
      }
    }

    OnActivityDestroys {
      rejectDrive("Screen closed before Google authorization completed.")
      lastDriveToken = null
      try { activeTranscode?.cancel() } catch (_: Exception) {}
      rejectExport("Video processing interrupted; original video remains unchanged.")
    }
  }
}
