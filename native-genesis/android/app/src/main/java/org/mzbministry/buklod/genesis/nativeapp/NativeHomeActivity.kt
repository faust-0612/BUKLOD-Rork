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
import android.widget.ScrollView
import android.widget.TextView
import java.io.File

/** DEV-only native lab; never claim login, payouts, full Kingdom or app parity. */
class NativeHomeActivity : Activity() {
    private val prefs by lazy { getSharedPreferences("genesis-native-launch-lab", MODE_PRIVATE) }
    private var localPackVerified = false
    private var worldButtons: List<Button> = emptyList()
    private var resetAttemptButton: Button? = null
    private var statusView: TextView? = null
    private var gifAnimation: AnimatedImageDrawable? = null

    private fun label(text: String, size: Float): TextView = TextView(this).apply {
        this.text = text
        textSize = size
        setTextColor(Color.WHITE)
    }

    private fun hasUnconfirmedLaunch(): Boolean = prefs.getBoolean("pending_unconfirmed_launch", false)

    private fun refreshLaunchButtons() {
        val canLaunch = localPackVerified && !hasUnconfirmedLaunch()
        worldButtons.forEach { it.isEnabled = canLaunch }
        resetAttemptButton?.isEnabled = hasUnconfirmedLaunch()
        if (hasUnconfirmedLaunch()) {
            val lastWorld = prefs.getString("last_world", "unknown") ?: "unknown"
            statusView?.text = "Previous $lastWorld attempt NOT verified. Manual reset required before retry."
        } else if (!localPackVerified) {
            statusView?.text = "Godot pack missing or SHA-256 mismatch; entry disabled"
        } else {
            statusView?.text = "Pack integrity checked; gameplay/device functionality NOT verified"
        }
    }

    override fun onResume() {
        super.onResume()
        gifAnimation?.start()
        refreshLaunchButtons()
    }

    override fun onStop() {
        gifAnimation?.stop()
        super.onStop()
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
        panel.addView(label("DEV only · No full app parity or premium gameplay verification", 14f))
        val status = label("Checking APK-bundled Godot pack…", 14f)
        statusView = status
        panel.addView(status)
        val options = listOf(
            "arena" to "Offline Arena (DEV gameplay)",
            "kingdom" to "Kingdom (visual preview ONLY)",
            "community" to "Personal Community (visual preview ONLY)",
            "house" to "Personal House/Lot (visual preview ONLY)"
        )
        worldButtons = options.map { (id, title) ->
            Button(this).apply {
                text = title
                isEnabled = false
                setOnClickListener { launchWorld(id) }
                panel.addView(this)
            }
        }
        resetAttemptButton = Button(this).apply {
            text = "Manually clear unconfirmed game entry (retry DEV)"
            isEnabled = false
            setOnClickListener {
                prefs.edit().remove("pending_unconfirmed_launch").remove("last_world").apply()
                refreshLaunchButtons()
            }
            panel.addView(this)
        }
        panel.addView(label("GIF keyboard preview · private/offline · does NOT send a message", 14f))
        val composer = GifAwareEditText(this).apply {
            hint = "Type or insert GIF from keyboard"
            setTextColor(Color.WHITE)
            setHintTextColor(Color.LTGRAY)
            minLines = 2
        }
        panel.addView(composer, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT))
        val gifPreview = ImageView(this).apply { adjustViewBounds = true }
        panel.addView(gifPreview, LinearLayout.LayoutParams(260, 260))
        composer.onGifReceived = { file: File ->
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                try {
                    gifAnimation?.stop()
                    val drawable = ImageDecoder.decodeDrawable(ImageDecoder.createSource(file))
                    gifPreview.setImageDrawable(drawable)
                    gifAnimation = drawable as? AnimatedImageDrawable
                    gifAnimation?.start()
                    statusView?.text = "GIF saved locally; no message uploaded"
                } catch (_: Exception) {
                    statusView?.text = "GIF decoding failed; no message uploaded"
                }
            }
        }
        setContentView(ScrollView(this).apply { addView(panel) })
        Thread {
            val validPack = GenesisNativeContract.verifyBundledPack { assets.open(it) }
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                localPackVerified = validPack
                refreshLaunchButtons()
            }
        }.start()
        refreshLaunchButtons()
    }

    private fun launchWorld(world: String) {
        if (!localPackVerified || hasUnconfirmedLaunch() || GenesisNativeContract.validWorld(world) == null) return
        // Persist before launching separate Godot process; a crash/reopen must not auto-reenter.
        if (!prefs.edit().putBoolean("pending_unconfirmed_launch", true)
                .putString("last_world", world).commit()) {
            statusView?.text = "Unable to persist launch safety marker"
            return
        }
        refreshLaunchButtons()
        try {
            startActivity(Intent(this, GenesisGameActivity::class.java).apply {
                putExtra(GenesisNativeContract.WORLD_EXTRA, world)
            })
        } catch (_: RuntimeException) {
            statusView?.text = "Android could not open Godot; manual reset required"
        }
    }
}
