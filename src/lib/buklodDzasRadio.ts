import {
  createAudioPlayer,
  setAudioModeAsync,
  setIsAudioActiveAsync,
  type AudioPlayer,
} from 'expo-audio';
import { requestBuklodAudioFocus, subscribeBuklodAudioFocus } from '@/lib/buklodAudioFocus';

/*
 * BUKLOD_DZAS_STARTUP_R2
 *
 * Keep one process-wide player so playback survives route changes. A start
 * request is serialized, waits for the source to load AND for playback to
 * become active, and performs one bounded source reload if startup stalls.
 */
const DZAS_STREAM_URL = 'https://stream.zeno.fm/rrw3tw8yheruv';
const LOAD_TIMEOUT_MS = 12000;
const PLAY_TIMEOUT_MS = 12000;
const POLL_INTERVAL_MS = 100;

let player: AudioPlayer | null = null;
let loadedUrl = '';
let playRequest: Promise<void> | null = null;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function getDzasPlayer() {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 250 });
  }
  return player;
}

async function waitUntilLoaded(audio: AudioPlayer) {
  const startedAt = Date.now();

  while (!audio.isLoaded && Date.now() - startedAt < LOAD_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
  }

  if (!audio.isLoaded) {
    throw new Error('Hindi matapos i-load ang DZAS stream. Awtomatikong susubukang kumonekta muli.');
  }
}

async function waitUntilPlaying(audio: AudioPlayer) {
  const startedAt = Date.now();

  while (!audio.playing && Date.now() - startedAt < PLAY_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
  }

  if (!audio.playing) {
    throw new Error('Nakakonekta ngunit hindi nagsimula ang DZAS audio. Subukang muli.');
  }
}

function activateMediaControls(audio: AudioPlayer) {
  try {
    audio.setActiveForLockScreen(
      true,
      {
        title: '702 DZAS',
        artist: 'FEBC Philippines',
        albumTitle: 'BUKLOD Radio Live',
      },
      {
        showSeekBackward: false,
        showSeekForward: false,
      },
    );
  } catch {
    // Lock-screen controls are optional and must not block playback.
  }
}

async function startAttempt(audio: AudioPlayer, reloadSource: boolean) {
  if (reloadSource || loadedUrl !== DZAS_STREAM_URL || !audio.isLoaded) {
    try {
      audio.pause();
    } catch {
      // Player may not have a loaded source yet.
    }

    audio.replace(DZAS_STREAM_URL);
    loadedUrl = DZAS_STREAM_URL;
    await waitUntilLoaded(audio);
  }

  audio.volume = 1;
  activateMediaControls(audio);
  audio.play();
  await waitUntilPlaying(audio);
}

async function startDzasRadio(forceReload: boolean) {
  if (!DZAS_STREAM_URL) {
    throw new Error('Walang configured DZAS stream URL.');
  }

  const audio = getDzasPlayer();

  // Re-activate the audio session on every explicit user start. Other BUKLOD
  // audio features may have changed the global audio mode while this route
  // was not mounted.
  await setIsAudioActiveAsync(true);
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'mixWithOthers',
    shouldRouteThroughEarpiece: false,
  });

  requestBuklodAudioFocus('dzas');
  try {
    await startAttempt(
      audio,
      forceReload || loadedUrl !== DZAS_STREAM_URL || !audio.isLoaded,
    );
  } catch (firstError) {
    // One bounded recovery: replace the stream source and wait for real
    // playback before reporting success. Do not leave the UI in false LIVE.
    try {
      await startAttempt(audio, true);
    } catch (retryError) {
      const reason = String(
        (retryError as any)?.message ??
          (firstError as any)?.message ??
          '',
      ).trim();

      throw new Error(
        reason || 'Hindi mabuksan ang DZAS stream. Tingnan ang internet at subukan muli.',
      );
    }
  }
}

/** Starts once per tap; concurrent taps share the same in-flight operation. */
export function playDzasRadio(forceReload = false): Promise<void> {
  if (playRequest) return playRequest;

  const request = startDzasRadio(forceReload).finally(() => {
    if (playRequest === request) playRequest = null;
  });

  playRequest = request;
  return request;
}

export function pauseDzasRadio() {
  try {
    getDzasPlayer().pause();
  } catch {
    // no-op
  }
}

/** Read-only. Does not create a player or change DZAS playback. */
export function peekDzasPlaying(): boolean {
  try {
    const active = player as { playing?: boolean } | null;
    return Boolean(active?.playing);
  } catch {
    return false;
  }
}

// A voluntary music Play action releases DZAS before opening another track.
subscribeBuklodAudioFocus(owner => {
  if (owner !== 'dzas') pauseDzasRadio();
});
