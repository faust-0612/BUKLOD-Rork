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

/** Copies one keyboard GIF into app-private cache; never uploads on receipt. */
internal class GifInputHandler(context: Context) {
    private val appContext = context.applicationContext
    private val maxGifBytes = 8L * 1024L * 1024L

    fun accept(info: InputContentInfoCompat, flags: Int, onSaved: (File) -> Unit): Boolean {
        if (!info.description.hasMimeType("image/gif")) return false
        var permissionGranted = false
        try {
            if ((flags and InputConnectionCompat.INPUT_CONTENT_GRANT_READ_URI_PERMISSION) != 0) {
                info.requestPermission()
                permissionGranted = true
            }
            val input = appContext.contentResolver.openInputStream(info.contentUri) ?: return false
            val directory = File(appContext.cacheDir, "keyboard-gifs").apply { mkdirs() }
            val temp = File.createTempFile("gif-input-", ".tmp", directory)
            try {
                input.use { stream ->
                    FileOutputStream(temp).use { sink ->
                        val buffer = ByteArray(32 * 1024)
                        var total = 0L
                        while (true) {
                            val count = stream.read(buffer)
                            if (count < 0) break
                            total += count
                            if (total > maxGifBytes) throw IllegalArgumentException("GIF too large")
                            sink.write(buffer, 0, count)
                        }
                    }
                }
                val header = ByteArray(6)
                val read = FileInputStream(temp).use { it.read(header) }
                val magic = if (read == 6) String(header, Charsets.US_ASCII) else ""
                if (magic != "GIF87a" && magic != "GIF89a") return false
                val saved = File(directory, "gif-${UUID.randomUUID()}.gif")
                if (!temp.renameTo(saved)) throw IllegalStateException("Cannot store GIF")
                onSaved(saved)
                return true
            } finally {
                temp.delete()
            }
        } catch (_: Exception) {
            return false
        } finally {
            if (permissionGranted) {
                try { info.releasePermission() } catch (_: Exception) { /* already revoked */ }
            }
        }
    }
}

/** Receives actual IME rich content via AndroidX OnCommitContentListener. */
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
}
