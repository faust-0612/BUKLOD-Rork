import {
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';

import type {
  BibleAmbienceKind,
  BibleOneShotKind,
} from '@/lib/buklodBibleNarration';

type LoopPlayer = ReturnType<typeof createAudioPlayer>;

const LOOP_SOURCES: Record<
  Exclude<BibleAmbienceKind, 'none'>,
  number
> = {
  wind: require('../../assets/bible-ambience/wind.wav'),
  rain: require('../../assets/bible-ambience/rain.wav'),
  sea: require('../../assets/bible-ambience/sea.wav'),
  crowd: require('../../assets/bible-ambience/crowd.wav'),
  night: require('../../assets/bible-ambience/night.wav'),
};

const ONE_SHOT_SOURCES: Record<BibleOneShotKind, number> = {
  thunder: require('../../assets/bible-ambience/thunder.wav'),
  footsteps: require('../../assets/bible-ambience/footsteps.wav'),
};

const SCENE_GAIN: Record<
  Exclude<BibleAmbienceKind, 'none'>,
  number
> = {
  wind: 0.16,
  rain: 0.14,
  sea: 0.15,
  crowd: 0.11,
  night: 0.1,
};

const ONE_SHOT_GAIN: Record<BibleOneShotKind, number> = {
  thunder: 0.2,
  footsteps: 0.14,
};

const MAX_MIX = 0.22;

function clampVolume(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

async function ensureMixableAudio() {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
      shouldRouteThroughEarpiece: false,
    });
  } catch {
    // Keep narration even if audio mode cannot be changed.
  }
}

export class BibleAmbienceController {
  private loopPlayer: LoopPlayer | null = null;
  private shotPlayer: LoopPlayer | null = null;
  private currentKind: BibleAmbienceKind = 'none';
  private targetVolume = 0;
  private fading = false;
  private enabled = false;
  private userVolume = 0.45;
  private fadeToken = 0;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      void this.transitionTo('none');
    }
  }

  setUserVolume(volume: number) {
    this.userVolume = clampVolume(volume);
    if (
      this.loopPlayer &&
      this.currentKind !== 'none' &&
      !this.fading
    ) {
      this.loopPlayer.volume = this.mixVolume(this.currentKind);
    }
  }

  private mixVolume(kind: BibleAmbienceKind) {
    if (kind === 'none' || !this.enabled) {
      return 0;
    }
    return Math.min(
      MAX_MIX,
      this.userVolume * SCENE_GAIN[kind]
    );
  }

  private ensureLoopPlayer() {
    const player = this.loopPlayer ?? createAudioPlayer(LOOP_SOURCES.wind);
    if (!this.loopPlayer) {
      this.loopPlayer = player;
      player.loop = true;
      player.volume = 0;
    }
    return player;
  }

  private ensureShotPlayer() {
    if (!this.shotPlayer) {
      this.shotPlayer = createAudioPlayer(ONE_SHOT_SOURCES.thunder);
      this.shotPlayer.loop = false;
      this.shotPlayer.volume = 0;
    }
    return this.shotPlayer;
  }

  private async fadeLoop(to: number, ms: number) {
    const player = this.loopPlayer;
    if (!player) {
      return;
    }

    const token = ++this.fadeToken;
    const from = clampVolume(Number(player.volume ?? 0));
    const steps = Math.max(1, Math.round(ms / 40));
    this.fading = true;

    for (let i = 1; i <= steps; i += 1) {
      if (token !== this.fadeToken) {
        return;
      }
      player.volume =
        from + ((to - from) * i) / steps;
      await new Promise((resolve) =>
        setTimeout(resolve, 40)
      );
    }

    if (token === this.fadeToken) {
      player.volume = to;
      this.fading = false;
    }
  }

  async transitionTo(kind: BibleAmbienceKind) {
    await ensureMixableAudio();

    const next =
      this.enabled && kind !== 'none'
        ? kind
        : 'none';

    if (next === this.currentKind) {
      if (next !== 'none') {
        this.targetVolume = this.mixVolume(next);
        if (this.loopPlayer && !this.fading) {
          this.loopPlayer.volume = this.targetVolume;
        }
      }
      return;
    }

    if (this.currentKind !== 'none') {
      await this.fadeLoop(0, 420);
    }

    this.currentKind = next;

    if (next === 'none') {
      try {
        this.loopPlayer?.pause();
      } catch {
        // ignore
      }
      return;
    }

    const player = this.ensureLoopPlayer();
    try {
      player.replace(LOOP_SOURCES[next]);
      player.loop = true;
      player.volume = 0;
      await player.seekTo(0);
      player.play();
      this.targetVolume = this.mixVolume(next);
      await this.fadeLoop(this.targetVolume, 640);
    } catch {
      this.currentKind = 'none';
    }
  }

  async playOneShot(kind: BibleOneShotKind) {
    if (!this.enabled) {
      return;
    }

    await ensureMixableAudio();

    try {
      const player = this.ensureShotPlayer();
      player.replace(ONE_SHOT_SOURCES[kind]);
      player.loop = false;
      player.volume = Math.min(
        MAX_MIX,
        this.userVolume * ONE_SHOT_GAIN[kind]
      );
      await player.seekTo(0);
      player.play();
    } catch {
      // One-shots must never interrupt narration.
    }
  }

  pause() {
    try {
      this.loopPlayer?.pause();
      this.shotPlayer?.pause();
    } catch {
      // ignore
    }
  }

  resume() {
    if (!this.enabled || this.currentKind === 'none') {
      return;
    }
    try {
      this.loopPlayer?.play();
    } catch {
      // ignore
    }
  }

  async stop() {
    this.fadeToken += 1;
    this.fading = false;
    this.currentKind = 'none';
    try {
      if (this.loopPlayer) {
        this.loopPlayer.volume = 0;
        this.loopPlayer.pause();
      }
      this.shotPlayer?.pause();
    } catch {
      // ignore
    }
  }

  release() {
    this.fadeToken += 1;
    try {
      this.loopPlayer?.release();
    } catch {
      // ignore
    }
    try {
      this.shotPlayer?.release();
    } catch {
      // ignore
    }
    this.loopPlayer = null;
    this.shotPlayer = null;
    this.currentKind = 'none';
  }
}

export const bibleAmbienceController =
  new BibleAmbienceController();
