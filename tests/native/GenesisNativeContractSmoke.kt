package org.mzbministry.buklod.genesis.nativeapp

import java.io.ByteArrayInputStream
import java.security.MessageDigest

fun main() {
    check(GenesisNativeContract.worlds.size == 4)
    check(GenesisNativeContract.validWorld("house") == "house")
    check(GenesisNativeContract.validWorld("house/../../settings") == null)
    check(GenesisNativeContract.validWorld(null) == null)
    check(GenesisNativeContract.gameArguments("arena") == listOf(
        "--main-pack", "res://godot/empire-arena.pck"
    ))
    for (world in listOf("kingdom", "community", "house")) {
        val args = GenesisNativeContract.gameArguments(world)
        check(args == listOf("--main-pack", "res://godot/empire-arena.pck", "--scene",
            "res://scenes/WorldPreview.tscn", "--", "--buklod-world=$world"))
    }
    check(runCatching { GenesisNativeContract.gameArguments("../../outside") }.isFailure)
    val bytes = "real-dev-pack-bytes".toByteArray()
    val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    fun verify(payload: ByteArray, hash: String) = GenesisNativeContract.verifyBundledPack { name ->
        ByteArrayInputStream(if (name == GenesisNativeContract.PACK_ASSET) payload else hash.toByteArray())
    }
    check(verify(bytes, sha))
    check(!verify(bytes, "0".repeat(64)))
    check(!verify(byteArrayOf(), sha))
    check(!verify(bytes, "../../not-a-hash"))
    check(!verify(bytes, sha + "x"))
    check(!GenesisNativeContract.verifyBundledPack { throw java.io.FileNotFoundException() })
    println("KOTLIN_NATIVE_CONTRACT_PASS")
}
