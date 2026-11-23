package org.mzbministry.buklod.genesis.nativeapp

import org.godotengine.godot.GodotActivity

/** Non-exported offline Godot host. No intents, external paths, or remote PCKs accepted. */
class GenesisGameActivity : GodotActivity() {
    override fun getCommandLine(): MutableList<String> =
        super.getCommandLine().toMutableList().apply {
            add("--main-pack")
            add("res://godot/empire-arena.pck")
        }
}
