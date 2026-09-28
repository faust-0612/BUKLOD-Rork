package org.mzbministry.buklod.imavideo

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BuklodImaVideoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BuklodImaVideo")

    View(BuklodImaVideoView::class) {
      Events(
        "onAdEvent",
        "onPlaybackError",
        "onPlaybackState"
      )

      Prop("contentUrl") { view: BuklodImaVideoView, value: String? ->
        view.setContentUrl(value)
      }

      Prop("adTagUrl") { view: BuklodImaVideoView, value: String? ->
        view.setAdTagUrl(value)
      }

      Prop("autoPlay") { view: BuklodImaVideoView, value: Boolean ->
        view.setAutoPlay(value)
      }

      Prop("active") { view: BuklodImaVideoView, value: Boolean ->
        view.setActive(value)
      }

      Prop("contentFit") { view: BuklodImaVideoView, value: String? ->
        view.setContentFit(value)
      }

      Prop("showCompanion") { view: BuklodImaVideoView, value: Boolean ->
        view.setShowCompanion(value)
      }
    }
  }
}
