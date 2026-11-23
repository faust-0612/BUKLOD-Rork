package org.mzbministry.buklod.genesis.nativeapp

import org.godotengine.godot.GodotActivity

/** Non-exported native Godot host. No external scenes, packs, or arbitrary arguments. */
class GenesisGameActivity : GodotActivity() {
    override fun getCommandLine(): MutableList<String> =
        super.getCommandLine().toMutableList().apply {
            // The launcher accepts only four constant values, and this second
            // process rejects anything else without using an untrusted path.
            val world = GenesisNativeContract.validWorld(
                intent?.getStringExtra(GenesisNativeContract.WORLD_EXTRA)
            ) ?: "arena"
            addAll(GenesisNativeContract.gameArguments(world))
        }
}
