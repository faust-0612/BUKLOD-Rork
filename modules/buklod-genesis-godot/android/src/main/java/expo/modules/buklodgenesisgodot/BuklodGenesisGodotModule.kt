package expo.modules.buklodgenesisgodot

import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest

/**
 * Build-time native Godot AAR; lazy user-approved 3D scene activation via OTA.
 * The native launcher accepts only a SHA-256 verified private PCK in a bounded
 * app sandbox, never remote URLs, arbitrary file providers or external intents.
 */
class BuklodGenesisGodotModule : Module() {
  private val maxPackBytes = 128L * 1024 * 1024
  private val digestPattern = Regex("^[0-9a-f]{64}$")
  private fun stageApprovedPack(sourceUri: String, digest: String): File {
    val activity = appContext.currentActivity ?: error("No foreground Activity")
    if (!digestPattern.matches(digest)) error("Invalid pack checksum")
    val uri = Uri.parse(sourceUri)
    if (uri.scheme != "file") error("Only private file packs are supported")
    val input = File(uri.path ?: error("No private path")).canonicalFile
    val roots = listOf(activity.cacheDir.canonicalFile, activity.filesDir.canonicalFile)
    if (!input.isFile || roots.none { input.path.startsWith(it.path + File.separator) }) {
      error("Pack must be an existing app-private file")
    }
    if (input.length() <= 0L || input.length() > maxPackBytes) error("Pack size outside bounds")
    val targetDir = File(activity.filesDir, "buklod-genesis-approved-packs")
    if (!targetDir.exists() && !targetDir.mkdirs()) error("Could not create pack storage")
    val final = File(targetDir, "$digest.pck")
    if (final.isFile && final.length() <= maxPackBytes && hash(final) == digest) return final
    final.delete()
    val tmp = File.createTempFile("godot-", ".tmp", targetDir)
    try {
      val md = MessageDigest.getInstance("SHA-256")
      var count = 0L
      FileInputStream(input).use { stream ->
        FileOutputStream(tmp).use { output ->
          val buf = ByteArray(32768)
          while (true) {
            val n = stream.read(buf)
            if (n < 0) break
            count += n
            if (count > maxPackBytes) error("Pack too large")
            md.update(buf, 0, n)
            output.write(buf, 0, n)
          }
          output.fd.sync()
        }
      }
      val actual = md.digest().joinToString("") { "%02x".format(it) }
      if (actual != digest || count <= 0L) error("Pack hash did not match approved manifest")
      if (!tmp.renameTo(final)) error("Could not finalize approved pack")
      return final
    } finally {
      tmp.delete()
    }
  }
  private fun hash(file: File): String {
    val md = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).use { s ->
      val buf = ByteArray(32768)
      while (true) {
        val n = s.read(buf)
        if (n < 0) break
        md.update(buf, 0, n)
      }
    }
    return md.digest().joinToString("") { "%02x".format(it) }
  }
  override fun definition() = ModuleDefinition {
    Name("BuklodGenesisGodot")
    AsyncFunction("openApprovedPack") { privateFileUri: String, expectedSha256: String,
      promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null || activity.isFinishing || activity.isDestroyed ||
          activity.packageName != "org.mzbministry.buklod.staging") {
        promise.resolve(false)
      } else {
        try {
          // Expo AsyncFunction executes off the UI thread; no 128MB copy in a touch handler.
          val approved = stageApprovedPack(privateFileUri, expectedSha256)
          activity.runOnUiThread {
            try {
              if (activity.isFinishing || activity.isDestroyed) {
                promise.resolve(false)
              } else {
                activity.startActivity(Intent(activity, GenesisGodotActivity::class.java)
                  .putExtra(GenesisGodotActivity.EXTRA_APPROVED_PACK, approved.absolutePath))
                promise.resolve(true)
              }
            } catch (_: Exception) {
              promise.resolve(false)
            }
          }
        } catch (_: Exception) {
          promise.resolve(false)
        }
      }
    }
  }
}
