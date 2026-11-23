package org.mzbministry.buklod.genesis.nativeapp

import java.io.InputStream
import java.security.MessageDigest

/** Pure Android-independent engine contract. Tests run locally on a plain JVM. */
internal object GenesisNativeContract {
    const val PACK_ASSET = "godot/empire-arena.zip"
    const val HASH_ASSET = "godot/empire-arena.sha256"
    const val MAIN_PACK_ARG = "res://godot/empire-arena.zip"
    const val WORLD_EXTRA = "org.mzbministry.buklod.genesis.WORLD"
    val worlds: Set<String> = setOf("arena", "kingdom", "community", "house")
    private const val MAX_PACK_BYTES = 2_000_000_000L

    fun validWorld(value: String?): String? = value?.takeIf { it in worlds }

    fun gameArguments(world: String): List<String> {
        require(validWorld(world) != null) { "Unapproved Genesis world" }
        val args = mutableListOf("--main-pack", MAIN_PACK_ARG)
        if (world != "arena") {
            args.addAll(listOf("--scene", "res://scenes/WorldPreview.tscn", "--", "--buklod-world=$world"))
        }
        return args
    }

    /** Streaming verification: no remote packs, no full-archive allocation. */
    fun verifyBundledPack(openAsset: (String) -> InputStream): Boolean {
        return try {
        val expected = openAsset(HASH_ASSET).bufferedReader(Charsets.US_ASCII).use { reader ->
            (reader.readLine() ?: "").trim().lowercase()
        }
        if (!Regex("^[a-f0-9]{64}$").matches(expected)) return false
        val digest = MessageDigest.getInstance("SHA-256")
        var bytes = 0L
        openAsset(PACK_ASSET).use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                if (count == 0) continue
                bytes += count
                if (bytes > MAX_PACK_BYTES) return false
                digest.update(buffer, 0, count)
            }
        }
        if (bytes <= 0L) return false
        val actual = digest.digest().joinToString("") { "%02x".format(it) }
        MessageDigest.isEqual(actual.toByteArray(Charsets.US_ASCII), expected.toByteArray(Charsets.US_ASCII))
        } catch (_: Exception) {
            false
        }
    }
}
