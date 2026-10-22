/**
 * Caller-side audio cues only (OTA / JS).
 * Incoming ringtone stays on Stream callingx / system path — untouched.
 */
import {
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';
import { Platform } from 'react-native';

type CuePlayer = ReturnType<typeof createAudioPlayer>;

const RINGBACK_SOURCE = require('../../assets/sounds/buklod-call-ringback.wav');
const BUSY_SOURCE = require('../../assets/sounds/buklod-call-busy.wav');

let ringbackPlayer: CuePlayer | null = null;
let busyPlayer: CuePlayer | null = null;
let ringbackActive = false;
let cueGeneration = 0;
let busyGeneration = 0;
let audioModeReady = false;

async function ensureCueAudioMode() {
  if (audioModeReady || Platform.OS === 'web') {
    return;
  }
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
      shouldRouteThroughEarpiece: false,
    });
    audioModeReady = true;
  } catch {
    // Cues are best-effort; never block calling.
  }
}

function safeRemove(player: CuePlayer | null) {
  if (!player) {
    return;
  }
  try {
    player.pause();
  } catch {
    // ignore
  }
  try {
    player.remove();
  } catch {
    // ignore
  }
}

export function stopRingback() {
  ringbackActive = false;
  cueGeneration += 1;
  const player = ringbackPlayer;
  ringbackPlayer = null;
  safeRemove(player);
}

export function stopAllCallAudioCues() {
  stopRingback();
  busyGeneration += 1;
  const busy = busyPlayer;
  busyPlayer = null;
  safeRemove(busy);
}

export async function startRingback() {
  if (Platform.OS === 'web') {
    return;
  }
  if (ringbackActive && ringbackPlayer) {
    return;
  }

  stopAllCallAudioCues();
  const generation = cueGeneration;
  await ensureCueAudioMode();
  if (generation !== cueGeneration) {
    return;
  }

  let player: CuePlayer | null = null;
  try {
    player = createAudioPlayer(RINGBACK_SOURCE, {
      updateInterval: 500,
    });
    player.volume = 0.55;
    player.loop = true;
    ringbackPlayer = player;
    ringbackActive = true;
    await player.seekTo(0);
    if (generation !== cueGeneration || ringbackPlayer !== player) {
      safeRemove(player);
      return;
    }
    player.play();
  } catch {
    safeRemove(player);
    if (ringbackPlayer === player) {
      ringbackActive = false;
      ringbackPlayer = null;
    }
  }
}

export async function playBusyOrFailureTone() {
  if (Platform.OS === 'web') {
    return;
  }

  stopAllCallAudioCues();
  const generation = busyGeneration;
  await ensureCueAudioMode();
  if (generation !== busyGeneration) {
    return;
  }

  safeRemove(busyPlayer);
  busyPlayer = null;

  let player: CuePlayer | null = null;
  try {
    player = createAudioPlayer(BUSY_SOURCE, {
      updateInterval: 250,
    });
    player.volume = 0.62;
    player.loop = false;
    busyPlayer = player;
    await player.seekTo(0);
    if (generation !== busyGeneration || busyPlayer !== player) {
      safeRemove(player);
      if (busyPlayer === player) busyPlayer = null;
      return;
    }
    player.play();
    setTimeout(() => {
      if (busyPlayer === player) {
        busyPlayer = null;
        safeRemove(player);
      }
    }, 1600);
  } catch {
    safeRemove(player);
    if (busyPlayer === player) busyPlayer = null;
  }
}

export function isCallerRingbackActive() {
  return ringbackActive;
}
