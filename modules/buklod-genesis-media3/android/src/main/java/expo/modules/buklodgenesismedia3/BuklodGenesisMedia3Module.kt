package expo.modules.buklodgenesismedia3

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID

/**
 * Opt-in native compression for a user-selected local video, never in feed playback.
 * No network, no media gallery permissions, no background service, no auto-upload.
 * The JS caller must choose original vs result; failures leave the original intact.
 */
@UnstableApi
class BuklodGenesisMedia3Module : Module() {
  private val handler = Handler(Looper.getMainLooper())
  private var transformer: Transformer? = null
  private var pending: Promise? = null
  private var output: File? = null
  private var watchdog: Runnable? = null
  private val maxInputBytes = 250L * 1024 * 1024

  private fun finish(error: String?, result: Map<String, Any>? = null) {
    watchdog?.let { handler.removeCallbacks(it) }
    watchdog = null
    val callback = pending ?: return
    pending = null
    transformer = null
    val staged = output
    output = null
    if (error == null && result != null) {
      callback.resolve(result)
    } else {
      staged?.delete()
      callback.reject("E_GENESIS_MEDIA3", error ?: "Video compression failed.", null)
    }
  }

  private fun incomingBytes(uri: Uri): Long {
    val activity = appContext.currentActivity ?: return -1L
    return when (uri.scheme) {
      "content" -> {
        val mime = activity.contentResolver.getType(uri) ?: ""
        if (!mime.startsWith("video/")) return -1L
        activity.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { c ->
          if (!c.moveToFirst()) return@use -1L
          val col = c.getColumnIndex(OpenableColumns.SIZE)
          if (col < 0 || c.isNull(col)) return@use -1L
          c.getLong(col)
        } ?: -1L
      }
      "file" -> {
        val target = File(uri.path ?: return -1L).canonicalFile
        val roots = listOf(activity.cacheDir.canonicalFile, activity.filesDir.canonicalFile)
        if (roots.none { target.path.startsWith(it.path + File.separator) }) return -1L
        if (!target.isFile) return -1L
        target.length()
      }
      else -> -1L // http(s), file traversal and unverified providers are forbidden
    }
  }

  override fun definition() = ModuleDefinition {
    Name("BuklodGenesisMedia3")

    AsyncFunction("transcodeLocalVideo") {
        sourceUri: String, maxHeight: Int, bitrateBitsPerSecond: Int, promise: Promise ->
      handler.post {
        if (pending != null) {
          promise.reject("E_GENESIS_MEDIA3_BUSY", "A video is already being prepared.", null)
          return@post
        }
        val activity = appContext.currentActivity
        if (activity == null || activity.isFinishing || activity.isDestroyed) {
          promise.reject("E_GENESIS_MEDIA3_ACTIVITY", "Open BUKLOD before preparing a video.", null)
          return@post
        }
        if (maxHeight !in listOf(480, 720, 1080) ||
            bitrateBitsPerSecond !in 400_000..4_000_000) {
          promise.reject("E_GENESIS_MEDIA3_CONFIG", "Unsupported output quality.", null)
          return@post
        }
        val uri = try { Uri.parse(sourceUri) } catch (_: Exception) { null }
        val inputBytes = try { if (uri != null) incomingBytes(uri) else -1L }
          catch (_: Exception) { -1L }
        if (uri == null || inputBytes <= 0 || inputBytes > maxInputBytes) {
          promise.reject("E_GENESIS_MEDIA3_INPUT", "A local video with a valid size is required.", null)
          return@post
        }
        val folder = File(activity.cacheDir, "buklod-genesis-media3")
        if (!folder.exists() && !folder.mkdirs()) {
          promise.reject("E_GENESIS_MEDIA3_CACHE", "Temporary video storage is unavailable.", null)
          return@post
        }
        folder.listFiles()?.forEach {
          if (it.isFile && System.currentTimeMillis() - it.lastModified() > 60 * 60 * 1000) it.delete()
        }
        val target = File(folder, UUID.randomUUID().toString() + ".mp4")
        output = target
        pending = promise
        try {
          val item = EditedMediaItem.Builder(MediaItem.fromUri(uri))
            .setEffects(Effects(emptyList(), listOf(Presentation.createForHeight(maxHeight))))
            .build()
          val encoder = DefaultEncoderFactory.Builder(activity)
            .setRequestedVideoEncoderSettings(
              VideoEncoderSettings.Builder().setBitrate(bitrateBitsPerSecond).build()
            ).build()
          val session = Transformer.Builder(activity)
            .setVideoMimeType(MimeTypes.VIDEO_H264)
            .setAudioMimeType(MimeTypes.AUDIO_AAC)
            .setEncoderFactory(encoder)
            .addListener(object : Transformer.Listener {
              override fun onCompleted(composition: Composition, result: ExportResult) {
                if (target.length() == 0L) {
                  finish("Video encoder returned an empty file.")
                } else {
                  finish(null, mapOf(
                    "uri" to Uri.fromFile(target).toString(),
                    "bytes" to target.length(),
                    "sourceBytes" to inputBytes,
                    "smallerThanInput" to (target.length() < inputBytes),
                    "mimeType" to "video/mp4",
                    "codec" to "video/avc"
                  ))
                }
              }
              override fun onError(composition: Composition, result: ExportResult,
                  exception: ExportException) {
                finish("This device could not compress the video. Use the original file.")
              }
            }).build()
          transformer = session
          watchdog = Runnable {
            try { transformer?.cancel() } catch (_: Exception) {}
            finish("Video processing timed out. Use the original file.")
          }.also { handler.postDelayed(it, 180_000) }
          session.start(item, target.absolutePath)
        } catch (_: Exception) {
          try { transformer?.cancel() } catch (_: Exception) {}
          finish("Video compression could not start. Use the original file.")
        }
      }
    }

    AsyncFunction("cancelTranscode") { promise: Promise ->
      handler.post {
        val active = pending != null
        if (active) {
          try { transformer?.cancel() } catch (_: Exception) {}
          finish("Video processing was canceled.")
        }
        promise.resolve(active)
      }
    }

    OnActivityDestroys {
      if (pending != null) {
        try { transformer?.cancel() } catch (_: Exception) {}
        finish("Video processing stopped when the app closed.")
      }
    }
  }
}
