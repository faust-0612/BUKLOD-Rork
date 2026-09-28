package org.mzbministry.buklod.imavideo

import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout

import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.ima.ImaAdsLoader
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView

import com.google.ads.interactivemedia.v3.api.AdEvent
import com.google.ads.interactivemedia.v3.api.CompanionAdSlot
import com.google.ads.interactivemedia.v3.api.ImaSdkFactory
import com.google.ads.interactivemedia.v3.api.ImaSdkSettings

import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

@UnstableApi
class BuklodImaVideoView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {

  private val onAdEvent by EventDispatcher()
  private val onPlaybackError by EventDispatcher()
  private val onPlaybackState by EventDispatcher()

  private val root =
    LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.BLACK)
      layoutParams = LayoutParams(
        LayoutParams.MATCH_PARENT,
        LayoutParams.MATCH_PARENT
      )
    }

  private val playerView =
    PlayerView(context).apply {
      useController = true
      setBackgroundColor(Color.BLACK)
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        0,
        1f
      )
    }

  private val companionContainer =
    FrameLayout(context).apply {
      setBackgroundColor(Color.WHITE)
      visibility = View.GONE
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dp(90)
      )
    }

  private var player: ExoPlayer? = null
  private var adsLoader: ImaAdsLoader? = null
  private var contentUrl: String? = null
  private var adTagUrl: String? = null
  private var autoPlay: Boolean = false
  private var active: Boolean = true
  private var showCompanion: Boolean = true
  private var contentFit: String = "cover"
  private var lastPreparedKey: String? = null
  private var rebuildPosted = false

  init {
    root.addView(playerView)
    root.addView(companionContainer)
    addView(root)

    try {
      ImaSdkFactory.getInstance().initialize(
        context.applicationContext,
        createImaSettings()
      )
    } catch (_: Throwable) {
      // Player remains capable of content-only fallback if IMA init fails.
    }
  }

  fun setContentUrl(value: String?) {
    val clean = value?.trim()?.takeIf { it.isNotEmpty() }
    if (contentUrl == clean) return
    contentUrl = clean
    scheduleRebuild()
  }

  fun setAdTagUrl(value: String?) {
    val clean = value?.trim()?.takeIf { it.isNotEmpty() }
    if (adTagUrl == clean) return
    adTagUrl = clean
    scheduleRebuild()
  }

  fun setAutoPlay(value: Boolean) {
    autoPlay = value
    applyPlaybackIntent()
  }

  fun setActive(value: Boolean) {
    active = value
    applyPlaybackIntent()
  }

  fun setContentFit(value: String?) {
    contentFit = value?.trim()?.lowercase() ?: "cover"
    playerView.resizeMode =
      if (contentFit == "contain") {
        AspectRatioFrameLayout.RESIZE_MODE_FIT
      } else {
        AspectRatioFrameLayout.RESIZE_MODE_ZOOM
      }
  }

  fun setShowCompanion(value: Boolean) {
    showCompanion = value
    updateCompanionVisibility()
    scheduleRebuild()
  }

  private fun scheduleRebuild() {
    if (rebuildPosted) return
    rebuildPosted = true
    post {
      rebuildPosted = false
      rebuildIfReady()
    }
  }

  private fun rebuildIfReady() {
    val source = contentUrl ?: return
    val key = listOf(
      source,
      adTagUrl.orEmpty(),
      showCompanion.toString()
    ).joinToString("|")

    if (lastPreparedKey == key && player != null) {
      applyPlaybackIntent()
      return
    }

    releasePlayer()
    lastPreparedKey = key

    try {
      val dataSourceFactory =
        DefaultDataSource.Factory(context)

      val ima =
        adTagUrl?.let {
          buildAdsLoader()
        }

      val mediaSourceFactory =
        DefaultMediaSourceFactory(dataSourceFactory).apply {
          if (ima != null) {
            setLocalAdInsertionComponents(
              { ima },
              playerView
            )
          }
        }

      val nextPlayer =
        ExoPlayer.Builder(context)
          .setMediaSourceFactory(mediaSourceFactory)
          .build()

      player = nextPlayer
      playerView.player = nextPlayer

      if (ima != null) {
        ima.setPlayer(nextPlayer)
      }

      nextPlayer.addListener(
        object : Player.Listener {
          override fun onPlayerError(error: PlaybackException) {
            onPlaybackError(
              mapOf(
                "code" to error.errorCodeName,
                "message" to (error.message ?: "Playback failed")
              )
            )
          }

          override fun onPlaybackStateChanged(playbackState: Int) {
            onPlaybackState(
              mapOf(
                "state" to when (playbackState) {
                  Player.STATE_IDLE -> "idle"
                  Player.STATE_BUFFERING -> "buffering"
                  Player.STATE_READY -> "ready"
                  Player.STATE_ENDED -> "ended"
                  else -> "unknown"
                },
                "isPlayingAd" to nextPlayer.isPlayingAd
              )
            )
          }
        }
      )

      val itemBuilder =
        MediaItem.Builder()
          .setUri(Uri.parse(source))

      adTagUrl?.let {
        itemBuilder.setAdsConfiguration(
          MediaItem.AdsConfiguration
            .Builder(Uri.parse(it))
            .build()
        )
      }

      nextPlayer.setMediaItem(
        itemBuilder.build()
      )
      nextPlayer.prepare()
      applyPlaybackIntent()
    } catch (error: Throwable) {
      onPlaybackError(
        mapOf(
          "code" to "E_IMA_PLAYER_SETUP",
          "message" to (error.message ?: "IMA video player setup failed")
        )
      )
      releasePlayer()
    }
  }

  private fun buildAdsLoader(): ImaAdsLoader {
    val builder =
      ImaAdsLoader.Builder(context)
        .setImaSdkSettings(createImaSettings())
        .setAdEventListener { event ->
          if (event.type != AdEvent.AdEventType.AD_PROGRESS) {
            onAdEvent(
              mapOf(
                "type" to event.type.name
              )
            )
          }
        }
        .setAdErrorListener { event ->
          onAdEvent(
            mapOf(
              "type" to "AD_ERROR",
              "message" to (
                event.error?.message
                  ?: "IMA ad error"
              )
            )
          )
        }

    if (showCompanion) {
      companionContainer.visibility = View.VISIBLE
      val slot =
        ImaSdkFactory
          .getInstance()
          .createCompanionAdSlot(
            companionContainer
          )

      slot.setSize(
        CompanionAdSlot.FLUID_SIZE,
        CompanionAdSlot.FLUID_SIZE
      )

      builder.setCompanionAdSlots(
        listOf(slot)
      )
    } else {
      companionContainer.visibility = View.GONE
    }

    return builder.build().also {
      adsLoader = it
    }
  }

  private fun createImaSettings(): ImaSdkSettings {
    return ImaSdkFactory
      .getInstance()
      .createImaSdkSettings()
  }

  private fun updateCompanionVisibility() {
    companionContainer.visibility =
      if (showCompanion && !adTagUrl.isNullOrBlank()) {
        View.VISIBLE
      } else {
        View.GONE
      }
  }

  private fun applyPlaybackIntent() {
    val current = player ?: return
    current.playWhenReady = active && autoPlay
    if (!active) {
      current.pause()
    }
  }

  private fun releasePlayer() {
    try {
      adsLoader?.setPlayer(null)
    } catch (_: Throwable) {}

    try {
      playerView.player = null
      player?.release()
    } catch (_: Throwable) {}

    try {
      adsLoader?.release()
    } catch (_: Throwable) {}

    player = null
    adsLoader = null
  }

  override fun onDetachedFromWindow() {
    releasePlayer()
    super.onDetachedFromWindow()
  }

  private fun dp(value: Int): Int {
    return (
      value * resources.displayMetrics.density
    ).toInt()
  }
}
