package expo.modules.buklodlab

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.text.Editable
import android.text.InputFilter
import android.text.TextWatcher
import android.text.InputType
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputMethodManager
import androidx.appcompat.widget.AppCompatEditText
import androidx.core.view.ViewCompat
import androidx.core.view.OnReceiveContentListener
import androidx.core.view.inputmethod.EditorInfoCompat
import androidx.core.view.inputmethod.InputConnectionCompat
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.BufferedInputStream
import java.io.DataInputStream
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/** Lab-only inline comment field. Receives Gboard GIFs through the focused
 * editor's IME commitContent; never routes through Android ACTION_SEND. */
class KeyboardGifView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onChange by EventDispatcher()
  private val onSelectionChange by EventDispatcher()
  private val onGif by EventDispatcher()
  private val onGifError by EventDispatcher()
  private var syncingText = false
  private val maxGifBytes: Long = 25L * 1024 * 1024

  private val input = object : AppCompatEditText(context) {
    override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
      val original = super.onCreateInputConnection(outAttrs) ?: return null
      EditorInfoCompat.setContentMimeTypes(outAttrs, arrayOf("image/gif"))
      return InputConnectionCompat.createWrapper(this, original, outAttrs)
    }
    override fun onSelectionChanged(start: Int, end: Int) {
      super.onSelectionChanged(start, end)
      if (!syncingText) onSelectionChange(mapOf("start" to start, "end" to end))
    }
  }

  init {
    input.inputType = InputType.TYPE_CLASS_TEXT or
      InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
    input.imeOptions = EditorInfo.IME_FLAG_NO_EXTRACT_UI
    input.setSingleLine(false)
    input.setTextColor(Color.rgb(24, 52, 38))
    input.setHintTextColor(Color.rgb(123, 140, 130))
    input.setBackgroundColor(Color.TRANSPARENT)
    input.setPadding(0, 0, 0, 0)
    input.textSize = 16f
    input.addTextChangedListener(object : TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
        if (!syncingText) onChange(mapOf("text" to (s?.toString() ?: "")))
      }
      override fun afterTextChanged(s: Editable?) {}
    })
    ViewCompat.setOnReceiveContentListener(
      input, arrayOf("image/gif"),
      OnReceiveContentListener { _, payload ->
        if (payload.clip.itemCount != 1) return@OnReceiveContentListener payload
        val uri: Uri = payload.clip.getItemAt(0).uri ?: return@OnReceiveContentListener payload
        if (uri.scheme != "content") return@OnReceiveContentListener payload
        try {
          val saved = stageVerifiedGif(uri)
          onGif(mapOf("uri" to Uri.fromFile(saved).toString(), "mimeType" to "image/gif"))
          null // Consumed. Manual comment Send remains in React Native.
        } catch (error: Exception) {
          onGifError(mapOf("message" to "Unable to read keyboard GIF. Try the GIF picker."))
          null // Do not insert untrusted URI/text or redirect the Activity.
        }
      }
    )
    addView(input, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  private fun stageVerifiedGif(uri: Uri): File {
    val folder = File(context.cacheDir, "buklod-lab-ime-gifs")
    if (!folder.exists() && !folder.mkdirs()) error("Cache unavailable")
    // Prevent a growing cache across comments/sessions, including failed attempts.
    folder.listFiles()?.forEach {
      if (it.isFile && System.currentTimeMillis() - it.lastModified() > 60 * 60 * 1000) {
        it.delete()
      }
    }
    val target = File(folder, UUID.randomUUID().toString() + ".gif")
    try {
      context.contentResolver.openInputStream(uri).use { raw ->
        if (raw == null) error("Cannot open URI")
        val stream = DataInputStream(BufferedInputStream(raw))
        val signature = ByteArray(6)
        stream.readFully(signature)
        val magic = String(signature, Charsets.US_ASCII)
        if (magic != "GIF87a" && magic != "GIF89a") error("Not a GIF")
        FileOutputStream(target).use { output ->
          output.write(signature)
          var total: Long = 6
          val buffer = ByteArray(16 * 1024)
          while (true) {
            val count = stream.read(buffer)
            if (count < 0) break
            total += count
            if (total > maxGifBytes) error("GIF too large")
            output.write(buffer, 0, count)
          }
          output.fd.sync()
        }
      }
      return target
    } catch (error: Exception) {
      target.delete()
      throw error
    }
  }

  fun setValue(value: String) {
    if (input.text?.toString() == value) return
    syncingText = true
    val previousCursor = input.selectionStart.coerceAtLeast(0)
    input.setText(value)
    input.setSelection(previousCursor.coerceAtMost(value.length))
    syncingText = false
  }

  fun setTextLimit(limit: Int) {
    input.filters = if (limit in 1..5000) arrayOf(InputFilter.LengthFilter(limit)) else emptyArray()
  }

  fun setEditable(enabled: Boolean) {
    input.isEnabled = enabled
  }

  fun setPlaceholder(value: String) {
    input.hint = value
  }

  fun setFontSize(value: Float) {
    input.textSize = value.coerceIn(12f, 32f)
  }

  fun select(start: Int, end: Int) {
    val length = input.text?.length ?: 0
    val left = start.coerceIn(0, length)
    val right = end.coerceIn(left, length)
    input.setSelection(left, right)
  }

  fun focusInput() {
    input.requestFocus()
    input.post {
      (context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)
        ?.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT)
    }
  }

  fun blurInput() {
    (context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)
      ?.hideSoftInputFromWindow(input.windowToken, 0)
    input.clearFocus()
  }
}

class BuklodLabNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BuklodLabNative")
    AsyncFunction("openGodotWorld") {
      val activity = appContext.currentActivity
        ?: throw IllegalStateException("BUKLOD Kingdom Lab requires a foreground Activity.")
      activity.runOnUiThread {
        if (!activity.isFinishing && !activity.isDestroyed) {
          activity.startActivity(Intent(activity, GodotLabActivity::class.java))
        }
      }
    }
    View(KeyboardGifView::class) {
      Events("onChange", "onSelectionChange", "onGif", "onGifError")
      Prop("value") { view: KeyboardGifView, text: String -> view.setValue(text) }
      Prop("placeholder") { view: KeyboardGifView, text: String -> view.setPlaceholder(text) }
      Prop("maxLength") { view: KeyboardGifView, limit: Int -> view.setTextLimit(limit) }
      Prop("editable") { view: KeyboardGifView, enabled: Boolean -> view.setEditable(enabled) }
      Prop("fontSize") { view: KeyboardGifView, size: Float -> view.setFontSize(size) }
      AsyncFunction("focus") { view: KeyboardGifView -> view.focusInput() }
      AsyncFunction("blur") { view: KeyboardGifView -> view.blurInput() }
      AsyncFunction("setSelection") { view: KeyboardGifView, start: Int, end: Int ->
        view.select(start, end)
      }
    }
  }
}
