import { AppState } from 'react-native';

import {
  claimBuklodPttFloor,
  connectBuklodPtt,
  disconnectBuklodPtt,
  refreshBuklodPttFloor,
  releaseBuklodPttFloor,
  type BuklodPttConnection,
  type BuklodPttKind,
  type BuklodPttScope,
} from './buklodPttCore';

export type BuklodPttRuntimeState = {
  connection: BuklodPttConnection | null;
  transmitting: boolean;
  txKind: BuklodPttKind | null;
  transmissionId: string | null;
  priorityReceiving: boolean;
  priorityTransmissionId: string | null;
  priorityValue: number;
  bootstrapped: boolean;
};

const listeners = new Set<(state: BuklodPttRuntimeState) => void>();
let state: BuklodPttRuntimeState = {
  connection: null,
  transmitting: false,
  txKind: null,
  transmissionId: null,
  priorityReceiving: false,
  priorityTransmissionId: null,
  priorityValue: 0,
  bootstrapped: false,
};
let target: { scope: BuklodPttScope; channel: number } | null = null;
let holdToken = 0;
let starting: Promise<void> | null = null;
let stopping: Promise<void> = Promise.resolve();
let heartbeat: ReturnType<typeof setInterval> | null = null;
let appSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

function emit() {
  listeners.forEach(listener => {
    try { listener({ ...state }); } catch {}
  });
}

export function getBuklodPttRuntimeState() {
  return { ...state };
}

export function subscribeBuklodPttRuntime(
  listener: (next: BuklodPttRuntimeState) => void,
) {
  listeners.add(listener);
  listener(getBuklodPttRuntimeState());
  return () => { listeners.delete(listener); };
}

/** Selecting a channel never opens a call or persists a monitor. */
export async function connectBuklodPttRuntime(scope: BuklodPttScope, channel: number) {
  if (!Number.isInteger(channel) || channel < 1 || channel > 10) {
    throw new Error('PTT channel must be between CH01 and CH10.');
  }
  if (target?.scope.id !== scope.id || target.channel !== channel) {
    await pttUp();
  }
  target = { scope, channel };
}

export async function selectBuklodPttTarget(scope: BuklodPttScope, channel: number) {
  await connectBuklodPttRuntime(scope, channel);
}

export async function disconnectBuklodPttRuntime() {
  target = null;
  await pttUp();
}

async function dropFloor(id: string | null | undefined) {
  if (id) await releaseBuklodPttFloor(id).catch(() => undefined);
}

/** The only call-join path. Release invalidates every await in this operation. */
export async function pttDown(kind: BuklodPttKind = 'NORMAL') {
  if (state.transmitting || starting) return;
  const selected = target;
  if (!selected) throw new Error('Choose a BUKLOD PTT channel first.');
  const token = ++holdToken;
  const held = () => token === holdToken;
  const operation = (async () => {
    await stopping;
    if (!held()) return;
    const connection = await connectBuklodPtt(selected.scope, selected.channel, held);
    let floorId: string | null = null;
    let keep = false;
    try {
      if (!held()) return;
      // Expose the muted joined call immediately so release can leave even
      // while the floor request is still waiting for the network.
      state = { ...state, connection };
      emit();
      const floor = await claimBuklodPttFloor(
        selected.scope.id, selected.channel, kind, connection.callId,
      );
      floorId = floor.transmission_id ?? null;
      if (!held()) return;
      if (!floor.granted || !floorId) {
        throw new Error(floor.reason === 'BUSY'
          ? 'CHANNEL BUSY — another member is transmitting.'
          : floor.reason || 'PTT floor was not granted.');
      }
      await connection.call.microphone.enable();
      if (!held()) return;
      state = {
        ...state, connection, transmitting: true, txKind: kind,
        transmissionId: floorId,
      };
      keep = true;
      emit();
      let refreshing = false;
      heartbeat = setInterval(() => {
        if (refreshing || !held()) return;
        refreshing = true;
        void refreshBuklodPttFloor(floorId!)
          .then(ok => { if (!ok && held()) void pttUp(); })
          .catch(() => { if (held()) void pttUp(); })
          .finally(() => { refreshing = false; });
      }, 5000);
    } finally {
      // A late join/floor/microphone completion must never survive release.
      if (!keep) {
        if (state.connection === connection) {
          state = { ...state, connection: null, transmitting: false, txKind: null, transmissionId: null };
          emit();
        }
        await disconnectBuklodPtt(connection);
        await dropFloor(floorId);
      }
    }
  })();
  starting = operation;
  try { await operation; }
  finally { if (starting === operation) starting = null; }
}

export async function pttUp() {
  ++holdToken;
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  const connection = state.connection;
  const floorId = state.transmissionId;
  state = {
    ...state, connection: null, transmitting: false, txKind: null,
    transmissionId: null, priorityReceiving: false,
    priorityTransmissionId: null, priorityValue: 0,
  };
  emit();
  const previous = stopping;
  stopping = (async () => {
    await previous;
    // End device audio before waiting for the server floor release.
    await disconnectBuklodPtt(connection);
    await dropFloor(floorId);
  })();
  await stopping;
}

/** Startup and push notifications may not open an audio call. */
export async function bootstrapBuklodPttRuntime() {
  if (!appSubscription) {
    appSubscription = AppState.addEventListener('change', next => {
      if (next !== 'active') void pttUp();
    });
  }
  state = { ...state, bootstrapped: true };
  emit();
}

export async function shutdownBuklodPttRuntime() {
  await disconnectBuklodPttRuntime();
  appSubscription?.remove();
  appSubscription = null;
  state = { ...state, bootstrapped: false };
  emit();
}

export async function handleBuklodPttPush(_data: unknown) {
  // Incoming notifications are informational; only a held button may join.
}
