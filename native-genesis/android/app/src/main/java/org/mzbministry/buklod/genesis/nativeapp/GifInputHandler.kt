package org.mzbministry.buklod.genesis.nativeapp

import android.content.Context
import android.util.AttributeSet
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.widget.EditText
import androidx.core.view.inputmethod.EditorInfoCompat
import androidx.core.view.inputmethod.InputConnectionCompat
import androidx.core.view.inputmethod.InputContentInfoCompat
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/** Receives keyboard GIF content; bounded workers prevent UI/IME jank and unbounded queued uploads. */
internal class GifInputHandler(context: Context) {
    private val appContext = context.applicationContext
    private val maxGifBytes = 8L * 1024L * 1024L
    private val workers = ThreadPoolExecutor(
        1, 1, 0L, TimeUnit.MILLISECONDS, ArrayBlockingQueue(2),
        { task -> Thread(task, "genesis-gif-import").apply { isDaemon = true } },
        ThreadPoolExecutor.AbortPolicy()
    )

    fun accept(info: InputContentInfoCompat, flags: Int, onSaved: (File) -> Unit): Boolean {
        if (!info.description.hasMimeType("image/gif")) return false
        var granted = false
        try {
            if ((flags and InputConnectionCompat.INPUT_CONTENT_GRANT_READ_URI_PERMISSION) != 0) {
                info.requestPermission()
                granted = true
            }
            val releasePermission = granted
            workers.execute {
                try {
                    val saved = storeGif(info)
                    if (saved != null && !workers.isShutdown) onSaved(saved)
                } catch (_: Exception) {
                    // No false acknowledgement, message upload, or process-wide refresh.
                } finally {
                    if (releasePermission) try { info.releasePermission() } catch (_: Exception) { }
                }
            }
            return true
        } catch (_: RejectedExecutionException) {
            if (granted) try { info.releasePermission() } catch (_: Exception) { }
            return false
        } catch (_: Exception) {
            if (granted) try { info.releasePermission() } catch (_: Exception) { }
            return false
        }
    }

    private fun storeGif(info: InputContentInfoCompat): File? {
        val directory = File(appContext.cacheDir, "keyboard-gifs")
        if (!directory.isDirectory && !directory.mkdirs()) return null
        val temp = File.createTempFile("gif-input-", ".tmp", directory)
        try {
            val stream = appContext.contentResolver.openInputStream(info.contentUri) ?: return null
            stream.use { input ->
                FileOutputStream(temp).use { output ->
                    val buffer = ByteArray(32 * 1024)
                    var total = 0L
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        if (total > maxGifBytes) return null
                        output.write(buffer, 0, count)
                    }
                }
            }
            if (temp.length() < 14) return null
            val header = ByteArray(6)
            if (FileInputStream(temp).use { it.read(header) } != 6) return null
            val magic = String(header, Charsets.US_ASCII)
            if (magic != "GIF87a" && magic != "GIF89a") return null
            val saved = File(directory, "gif-${UUID.randomUUID()}.gif")
            if (!temp.renameTo(saved)) return null
            // Keep cached local previews bounded; never delete unrelated app cache.
            directory.listFiles { file -> file.name.startsWith("gif-") && file.extension == "gif" }
                ?.sortedByDescending { it.lastModified() }?.drop(10)?.forEach { it.delete() }
            return saved
        } finally {
            temp.delete()
        }
    }

    fun close() {
        // Drain queued work so revoked keyboard URI permissions do not remain referenced.
        workers.shutdown()
    }
}

/** Android IME rich-content bridge. The outer app must implement authenticated sending separately. */
class GifAwareEditText @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null
) : EditText(context, attrs) {
    var onGifReceived: ((File) -> Unit)? = null
    private val receiver = GifInputHandler(context)

    override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
        val base = super.onCreateInputConnection(outAttrs) ?: return null
        EditorInfoCompat.setContentMimeTypes(outAttrs, arrayOf("image/gif"))
        val listener = InputConnectionCompat.OnCommitContentListener { info, flags, _ ->
            receiver.accept(info, flags) { onGifReceived?.invoke(it) }
        }
        return InputConnectionCompat.createWrapper(base, outAttrs, listener)
    }

    override fun onDetachedFromWindow() {
        receiver.close()
        super.onDetachedFromWindow()
    }
}
