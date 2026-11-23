package org.mzbministry.buklod.genesis.nativeapp

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.ImageDecoder
import android.graphics.drawable.AnimatedImageDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.io.File
import java.security.MessageDigest

/** Engineering host only. Not the migrated BUKLOD application. */
class NativeHomeActivity : Activity() {
    private var localPackVerified: Boolean = false
    private var launchButton: Button? = null
    override fun onResume() {
        super.onResume()
        if (localPackVerified) launchButton?.isEnabled = true
    }
    private fun label(text: String, size: Float): TextView = TextView(this).apply {
        this.text = text
        textSize = size
        setTextColor(Color.WHITE)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(32, 50, 32, 32)
            setBackgroundColor(Color.rgb(5, 10, 25))
        }
        panel.addView(label("BUKLOD GENESIS · NATIVE ENGINE LAB", 22f))
        panel.addView(label("DEV only · App parity and premium gameplay NOT verified", 14f))
        val launch = Button(this).apply { text = "Check local Godot pack"; isEnabled = false }
        launchButton = launch
        panel.addView(launch)
        val feedback = label("Checking APK-bundled assets…", 14f)
        panel.addView(feedback)
        panel.addView(label("Keyboard GIF local input test (no message sent)", 14f))
        val composer = GifAwareEditText(this).apply {
            hint = "Type or insert GIF from keyboard"
            setTextColor(Color.WHITE)
            setHintTextColor(Color.LTGRAY)
            setSingleLine(false)
            minLines = 2
        }
        panel.addView(composer, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT))
        val gifPreview = ImageView(this).apply { adjustViewBounds = true }
        panel.addView(gifPreview, LinearLayout.LayoutParams(260, 260))
        composer.onGifReceived = { file: File ->
            runOnUiThread {
                try {
                    val drawable = ImageDecoder.decodeDrawable(ImageDecoder.createSource(file))
                    gifPreview.setImageDrawable(drawable)
                    if (drawable is AnimatedImageDrawable) drawable.start()
                    feedback.text = "GIF received locally (not uploaded)"
                } catch (_: Exception) {
                    feedback.text = "GIF decoding failed"
                }
            }
        }
        setContentView(panel)
        Thread {
            val hasValidPack = verifyEmbeddedPack()
            runOnUiThread {
                localPackVerified = hasValidPack
                launch.isEnabled = hasValidPack
                launch.text = if (hasValidPack) "Open offline Arena (DEV)" else "Godot pack unavailable"
                feedback.text = if (hasValidPack) "Verified local pack SHA-256" else "Missing or invalid embedded pack"
            }
        }.start()
        launch.setOnClickListener {
            launch.isEnabled = false
            startActivity(Intent(this, GenesisGameActivity::class.java))
        }
    }

    private fun verifyEmbeddedPack(): Boolean {
      return try {
        val expected = assets.open("godot/empire-arena.sha256")
            .bufferedReader().use { it.readText().trim().lowercase() }
        if (!Regex("^[0-9a-f]{64}$").matches(expected)) return false
        val md = MessageDigest.getInstance("SHA-256")
        assets.open("godot/empire-arena.pck").use { input ->
            val buf = ByteArray(64 * 1024)
            while (true) {
                val n = input.read(buf)
                if (n < 0) break
                md.update(buf, 0, n)
            }
        }
        md.digest().joinToString("") { "%02x".format(it) } == expected
      } catch (_: Exception) { false }
    }
}
