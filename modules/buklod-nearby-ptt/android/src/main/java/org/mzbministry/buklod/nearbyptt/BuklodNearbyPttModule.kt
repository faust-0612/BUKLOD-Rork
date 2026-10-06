package org.mzbministry.buklod.nearbyptt

import android.Manifest
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max

class BuklodNearbyPttModule : Module() {

  companion object {
    private const val SERVICE_ID =
      "org.mzbministry.buklod.ptt.nearby.v1"

    private const val PROTOCOL_PREFIX =
      "BPTT1"

    private const val AUDIO_MARKER: Byte =
      0x41

    private const val SAMPLE_RATE =
      16000
  }

  private val connectedPeers =
    ConcurrentHashMap<String, String>()

  private val discoveredPeers =
    ConcurrentHashMap<String, String>()

  private val requestedPeers =
    ConcurrentHashMap.newKeySet<String>()

  private val playbackExecutor =
    Executors.newSingleThreadExecutor()

  private val transmitting =
    AtomicBoolean(false)

  @Volatile
  private var configuredScopeHash =
    ""

  @Volatile
  private var configuredChannel =
    1

  @Volatile
  private var configuredDisplayName =
    "BUKLOD Member"

  @Volatile
  private var advertising =
    false

  @Volatile
  private var discovering =
    false

  @Volatile
  private var audioRecord:
    AudioRecord? =
    null

  @Volatile
  private var audioTrack:
    AudioTrack? =
    null

  @Volatile
  private var recordThread:
    Thread? =
    null

  @Volatile
  private var previousAudioMode:
    Int? =
    null

  @Volatile
  private var previousSpeakerphoneOn:
    Boolean? =
    null

  private val reactContext: Context
    get() =
      requireNotNull(
        appContext.reactContext
      )

  private val connections:
    ConnectionsClient by lazy {
      Nearby.getConnectionsClient(
        reactContext
      )
    }

  private fun scopeHash(
    scopeId: String
  ): String {
    val bytes =
      MessageDigest
        .getInstance("SHA-256")
        .digest(
          scopeId
            .trim()
            .toByteArray(
              Charsets.UTF_8
            )
        )

    return bytes
      .take(6)
      .joinToString("") {
        "%02x".format(it)
      }
  }

  private fun cleanName(
    value: String
  ): String =
    value
      .replace("|", " ")
      .replace(
        Regex("\\s+"),
        " "
      )
      .trim()
      .ifBlank {
        "BUKLOD Member"
      }
      .take(42)

  private fun endpointName():
    String =
    listOf(
      PROTOCOL_PREFIX,
      configuredScopeHash,
      configuredChannel
        .toString()
        .padStart(
          2,
          '0'
        ),
      cleanName(
        configuredDisplayName
      )
    ).joinToString("|")

  private data class EndpointMeta(
    val scopeHash: String,
    val channel: Int,
    val displayName: String
  )

  private fun parseEndpointName(
    value: String
  ): EndpointMeta? {
    val parts =
      value.split("|")

    if (
      parts.size < 4 ||
      parts[0] != PROTOCOL_PREFIX
    ) {
      return null
    }

    val channel =
      parts[2].toIntOrNull()
        ?: return null

    return EndpointMeta(
      scopeHash =
        parts[1],
      channel =
        channel,
      displayName =
        cleanName(
          parts
            .drop(3)
            .joinToString(" ")
        )
    )
  }

  private fun sameChannel(
    meta: EndpointMeta
  ): Boolean =
    meta.scopeHash ==
      configuredScopeHash &&
      meta.channel ==
        configuredChannel

  private fun peerRows():
    List<Map<String, Any>> =
    connectedPeers
      .entries
      .sortedBy {
        it.value.lowercase()
      }
      .map {
        mapOf(
          "id" to it.key,
          "name" to it.value,
          "signal" to "Ready"
        )
      }

  private fun emitPeers() {
    sendEvent(
      "onPeersChanged",
      mapOf(
        "peers" to
          peerRows()
      )
    )
  }

  private fun emitState(
    state: String
  ) {
    sendEvent(
      "onState",
      mapOf(
        "state" to state,
        "advertising" to
          advertising,
        "discovering" to
          discovering,
        "transmitting" to
          transmitting.get(),
        "peerCount" to
          connectedPeers.size
      )
    )
  }

  private fun emitError(
    code: String,
    error: Throwable?
  ) {
    sendEvent(
      "onError",
      mapOf(
        "code" to code,
        "message" to (
          error?.message
            ?: code
          )
      )
    )
  }

  private val payloadCallback =
    object :
      PayloadCallback() {

      override fun onPayloadReceived(
        endpointId: String,
        payload: Payload
      ) {
        if (
          payload.type !=
            Payload.Type.BYTES
        ) {
          return
        }

        val bytes =
          payload.asBytes()
            ?: return

        if (
          bytes.size < 2 ||
          bytes[0] !=
            AUDIO_MARKER
        ) {
          return
        }

        val pcm =
          bytes.copyOfRange(
            1,
            bytes.size
          )

        playbackExecutor.execute {
          playPcm(pcm)
        }
      }

      override fun onPayloadTransferUpdate(
        endpointId: String,
        update:
          PayloadTransferUpdate
      ) {
      }
    }

  private val connectionLifecycleCallback =
    object :
      ConnectionLifecycleCallback() {

      override fun onConnectionInitiated(
        endpointId: String,
        connectionInfo:
          ConnectionInfo
      ) {
        val meta =
          parseEndpointName(
            connectionInfo.endpointName
          )

        if (
          meta == null ||
          !sameChannel(meta)
        ) {
          connections.rejectConnection(
            endpointId
          )
          return
        }

        discoveredPeers[
          endpointId
        ] =
          meta.displayName

        connections
          .acceptConnection(
            endpointId,
            payloadCallback
          )
          .addOnFailureListener {
            emitError(
              "E_NEARBY_ACCEPT",
              it
            )
          }
      }

      override fun onConnectionResult(
        endpointId: String,
        resolution:
          ConnectionResolution
      ) {
        requestedPeers.remove(
          endpointId
        )

        if (
          resolution.status.statusCode ==
            ConnectionsStatusCodes.STATUS_OK
        ) {
          connectedPeers[
            endpointId
          ] =
            discoveredPeers[
              endpointId
            ] ?: "BUKLOD Member"

          emitPeers()
          emitState(
            "connected"
          )
          return
        }

        discoveredPeers.remove(
          endpointId
        )

        emitPeers()
      }

      override fun onDisconnected(
        endpointId: String
      ) {
        connectedPeers.remove(
          endpointId
        )
        discoveredPeers.remove(
          endpointId
        )
        requestedPeers.remove(
          endpointId
        )

        emitPeers()
        emitState(
          "disconnected"
        )
      }
    }

  private val endpointDiscoveryCallback =
    object :
      EndpointDiscoveryCallback() {

      override fun onEndpointFound(
        endpointId: String,
        info:
          DiscoveredEndpointInfo
      ) {
        val meta =
          parseEndpointName(
            info.endpointName
          ) ?: return

        if (!sameChannel(meta)) {
          return
        }

        discoveredPeers[
          endpointId
        ] =
          meta.displayName

        if (
          connectedPeers.containsKey(
            endpointId
          ) ||
          !requestedPeers.add(
            endpointId
          )
        ) {
          return
        }

        connections
          .requestConnection(
            endpointName(),
            endpointId,
            connectionLifecycleCallback
          )
          .addOnFailureListener {
            requestedPeers.remove(
              endpointId
            )

            emitError(
              "E_NEARBY_CONNECT",
              it
            )
          }
      }

      override fun onEndpointLost(
        endpointId: String
      ) {
        if (
          !connectedPeers
            .containsKey(
              endpointId
            )
        ) {
          discoveredPeers.remove(
            endpointId
          )
          requestedPeers.remove(
            endpointId
          )
        }
      }
    }

  private fun hasAudioPermission():
    Boolean =
    ContextCompat
      .checkSelfPermission(
        reactContext,
        Manifest.permission.RECORD_AUDIO
      ) ==
      PackageManager.PERMISSION_GRANTED

  private fun audioManager():
    AudioManager =
    reactContext.getSystemService(
      Context.AUDIO_SERVICE
    ) as AudioManager

  private fun enableRadioAudioRoute() {
    try {
      val manager =
        audioManager()

      if (previousAudioMode == null) {
        previousAudioMode =
          manager.mode
      }

      if (previousSpeakerphoneOn == null) {
        previousSpeakerphoneOn =
          manager.isSpeakerphoneOn
      }

      manager.mode =
        AudioManager.MODE_IN_COMMUNICATION

      if (
        Build.VERSION.SDK_INT >=
          Build.VERSION_CODES.S
      ) {
        val speaker =
          manager
            .availableCommunicationDevices
            .firstOrNull {
              it.type ==
                AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
            }

        if (speaker != null) {
          manager.setCommunicationDevice(
            speaker
          )
        }
      } else {
        @Suppress("DEPRECATION")
        manager.isSpeakerphoneOn =
          true
      }
    } catch (
      error: Throwable
    ) {
      emitError(
        "E_NEARBY_AUDIO_ROUTE",
        error
      )
    }
  }

  private fun restoreRadioAudioRoute() {
    try {
      val manager =
        audioManager()

      if (
        Build.VERSION.SDK_INT >=
          Build.VERSION_CODES.S
      ) {
        manager.clearCommunicationDevice()
      } else {
        previousSpeakerphoneOn
          ?.let {
            @Suppress("DEPRECATION")
            manager.isSpeakerphoneOn =
              it
          }
      }

      previousAudioMode
        ?.let {
          manager.mode =
            it
        }
    } catch (_: Throwable) {
    } finally {
      previousAudioMode =
        null
      previousSpeakerphoneOn =
        null
    }
  }

  private fun startNearbyInternal() {
    stopDiscoveryOnly()

    connectedPeers.clear()
    discoveredPeers.clear()
    requestedPeers.clear()
    emitPeers()

    BuklodNearbyPttService
      .startListening(
        reactContext
      )

    enableRadioAudioRoute()

    val strategy =
      Strategy.P2P_CLUSTER

    val advertisingOptions =
      AdvertisingOptions
        .Builder()
        .setStrategy(
          strategy
        )
        .build()

    val discoveryOptions =
      DiscoveryOptions
        .Builder()
        .setStrategy(
          strategy
        )
        .build()

    connections
      .startAdvertising(
        endpointName(),
        SERVICE_ID,
        connectionLifecycleCallback,
        advertisingOptions
      )
      .addOnSuccessListener {
        advertising = true
        emitState(
          "advertising"
        )
      }
      .addOnFailureListener {
        advertising = false
        emitError(
          "E_NEARBY_ADVERTISE",
          it
        )
      }

    connections
      .startDiscovery(
        SERVICE_ID,
        endpointDiscoveryCallback,
        discoveryOptions
      )
      .addOnSuccessListener {
        discovering = true
        emitState(
          "discovering"
        )
      }
      .addOnFailureListener {
        discovering = false
        emitError(
          "E_NEARBY_DISCOVERY",
          it
        )
      }
  }

  private fun stopDiscoveryOnly() {
    try {
      connections.stopAdvertising()
    } catch (_: Throwable) {
    }

    try {
      connections.stopDiscovery()
    } catch (_: Throwable) {
    }

    advertising = false
    discovering = false
  }

  private fun stopNearbyInternal() {
    stopTransmitInternal()
    stopDiscoveryOnly()

    try {
      connections.stopAllEndpoints()
    } catch (_: Throwable) {
    }

    connectedPeers.clear()
    discoveredPeers.clear()
    requestedPeers.clear()

    emitPeers()
    emitState(
      "stopped"
    )

    BuklodNearbyPttService
      .stop(
        reactContext
      )

    restoreRadioAudioRoute()
  }

  private fun audioTrack():
    AudioTrack {
    audioTrack?.let {
      return it
    }

    val format =
      AudioFormat
        .Builder()
        .setEncoding(
          AudioFormat.ENCODING_PCM_16BIT
        )
        .setSampleRate(
          SAMPLE_RATE
        )
        .setChannelMask(
          AudioFormat.CHANNEL_OUT_MONO
        )
        .build()

    val minBuffer =
      max(
        AudioTrack
          .getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat
              .CHANNEL_OUT_MONO,
            AudioFormat
              .ENCODING_PCM_16BIT
          ),
        4096
      )

    val track =
      AudioTrack
        .Builder()
        .setAudioAttributes(
          AudioAttributes
            .Builder()
            .setUsage(
              AudioAttributes
                .USAGE_VOICE_COMMUNICATION
            )
            .setContentType(
              AudioAttributes
                .CONTENT_TYPE_SPEECH
            )
            .build()
        )
        .setAudioFormat(
          format
        )
        .setBufferSizeInBytes(
          minBuffer
        )
        .setTransferMode(
          AudioTrack.MODE_STREAM
        )
        .build()

    track.play()
    audioTrack = track
    return track
  }

  private fun playPcm(
    pcm: ByteArray
  ) {
    if (
      transmitting.get() ||
      pcm.isEmpty()
    ) {
      return
    }

    try {
      val track =
        audioTrack()

      track.write(
        pcm,
        0,
        pcm.size,
        AudioTrack.WRITE_BLOCKING
      )
    } catch (
      error: Throwable
    ) {
      emitError(
        "E_NEARBY_PLAYBACK",
        error
      )
    }
  }

  private fun startTransmitInternal() {
    if (
      transmitting.getAndSet(
        true
      )
    ) {
      return
    }

    if (!hasAudioPermission()) {
      transmitting.set(false)
      throw SecurityException(
        "Microphone permission is required for Offline Nearby PTT."
      )
    }

    if (
      connectedPeers.isEmpty()
    ) {
      transmitting.set(false)
      throw IllegalStateException(
        "No nearby BUKLOD peer is connected."
      )
    }

    BuklodNearbyPttService
      .setTransmitting(
        reactContext,
        true
      )

    val channelConfig =
      AudioFormat.CHANNEL_IN_MONO

    val encoding =
      AudioFormat.ENCODING_PCM_16BIT

    val minBuffer =
      max(
        AudioRecord
          .getMinBufferSize(
            SAMPLE_RATE,
            channelConfig,
            encoding
          ),
        4096
      )

    val recorder =
      AudioRecord(
        MediaRecorder
          .AudioSource
          .VOICE_COMMUNICATION,
        SAMPLE_RATE,
        channelConfig,
        encoding,
        minBuffer * 2
      )

    if (
      recorder.state !=
        AudioRecord.STATE_INITIALIZED
    ) {
      transmitting.set(false)
      recorder.release()
      throw IllegalStateException(
        "Offline Nearby microphone could not initialize."
      )
    }

    audioRecord = recorder
    recorder.startRecording()

    emitState(
      "transmitting"
    )

    recordThread =
      Thread {
        val chunk =
          ByteArray(
            1280
          )

        try {
          while (
            transmitting.get()
          ) {
            val count =
              recorder.read(
                chunk,
                0,
                chunk.size
              )

            if (count <= 0) {
              continue
            }

            val packet =
              ByteArray(
                count + 1
              )

            packet[0] =
              AUDIO_MARKER

            System.arraycopy(
              chunk,
              0,
              packet,
              1,
              count
            )

            val targets =
              connectedPeers
                .keys
                .toList()

            if (
              targets.isNotEmpty()
            ) {
              connections
                .sendPayload(
                  targets,
                  Payload.fromBytes(
                    packet
                  )
                )
                .addOnFailureListener {
                  emitError(
                    "E_NEARBY_SEND",
                    it
                  )
                }
            }
          }
        } catch (
          error: Throwable
        ) {
          emitError(
            "E_NEARBY_RECORD",
            error
          )
        } finally {
          try {
            recorder.stop()
          } catch (_: Throwable) {
          }

          recorder.release()

          if (
            audioRecord ===
              recorder
          ) {
            audioRecord = null
          }
        }
      }.apply {
        name =
          "BuklodNearbyPttRecord"
        isDaemon = true
        start()
      }
  }

  private fun stopTransmitInternal() {
    if (
      !transmitting
        .getAndSet(
          false
        )
    ) {
      return
    }

    try {
      audioRecord?.stop()
    } catch (_: Throwable) {
    }

    try {
      recordThread?.join(
        500
      )
    } catch (_: Throwable) {
    }

    recordThread = null
    audioRecord = null

    BuklodNearbyPttService
      .setTransmitting(
        reactContext,
        false
      )

    emitState(
      "listening"
    )
  }

  override fun definition() =
    ModuleDefinition {

      Name(
        "BuklodNearbyPtt"
      )

      Events(
        "onPeersChanged",
        "onState",
        "onError"
      )

      Function(
        "isAvailable"
      ) {
        true
      }

      Function(
        "getPeers"
      ) {
        peerRows()
      }

      Function(
        "isBluetoothEnabled"
      ) {
        try {
          val manager =
            reactContext
              .getSystemService(
                Context.BLUETOOTH_SERVICE
              ) as BluetoothManager

          manager.adapter
            ?.isEnabled
            ?: false
        } catch (_: Throwable) {
          false
        }
      }

      AsyncFunction(
        "start"
      ) {
          scopeId: String,
          channel: Int,
          displayName: String ->

        require(
          scopeId
            .isNotBlank()
        ) {
          "scopeId is required."
        }

        require(
          channel in 1..10
        ) {
          "PTT channel must be between 1 and 10."
        }

        configuredScopeHash =
          scopeHash(
            scopeId
          )

        configuredChannel =
          channel

        configuredDisplayName =
          cleanName(
            displayName
          )

        startNearbyInternal()

        true
      }

      AsyncFunction(
        "stop"
      ) {
        stopNearbyInternal()
        true
      }

      AsyncFunction(
        "startTransmit"
      ) {
        startTransmitInternal()
        true
      }

      AsyncFunction(
        "stopTransmit"
      ) {
        stopTransmitInternal()
        true
      }

      OnDestroy {
        try {
          stopNearbyInternal()
        } catch (_: Throwable) {
        }

        try {
          audioTrack?.stop()
        } catch (_: Throwable) {
        }

        try {
          audioTrack?.release()
        } catch (_: Throwable) {
        }

        audioTrack = null

        playbackExecutor
          .shutdownNow()
      }
    }
}
