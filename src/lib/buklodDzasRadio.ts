import {
  createAudioPlayer,
  setAudioModeAsync,
  setIsAudioActiveAsync,
  type AudioPlayer,
} from 'expo-audio';

/*
 * BUKLOD_DZAS_KEEP_ALIVE_R1
 *
 * The live player lives outside the radio screen. Back navigation unmounts
 * that screen, and expo-audio would otherwise release the player and stop
 * the stream. Playback ends only when the listener pauses.
 */
const DZAS_STREAM_URL = 'https://stream.zeno.fm/rrw3tw8yheruv';

let player: AudioPlayer | null = null;
let loadedUrl = '';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export function getDzasPlayer() {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 500 });
  }

  return player;
}

async function waitUntilLoaded(audio: AudioPlayer) {
  const startedAt = Date.now();

  while (!audio.isLoaded && Date.now() - startedAt < 7000) {
    await sleep(120);
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
    // Lock-screen controls are optional.
  }
}

export async function playDzasRadio(forceReload = false) {
  if (!DZAS_STREAM_URL) {
    throw new Error('Walang configured DZAS stream URL.');
  }

  const audio = getDzasPlayer();

  await setIsAudioActiveAsync(true);
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'mixWithOthers',
    shouldRouteThroughEarpiece: false,
  });

  if (forceReload || loadedUrl !== DZAS_STREAM_URL || !audio.isLoaded) {
    try {
      audio.pause();
    } catch {
      // no-op
    }

    audio.replace(DZAS_STREAM_URL);
    loadedUrl = DZAS_STREAM_URL;
    await waitUntilLoaded(audio);
  }

  audio.volume = 1;
  activateMediaControls(audio);
  audio.play();
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
