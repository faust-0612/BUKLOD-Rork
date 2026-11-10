import type { RealtimeChannel } from '@supabase/supabase-js';
import { hasBuklodPttCaptionConsent, persistOwnBuklodPttCaption } from './buklodPttConversation';

import {
  claimBuklodPttFloor,
  connectBuklodPtt,
  disconnectBuklodPtt,
  loadBuklodPttScopes,
  refreshBuklodPttFloor,
  releaseBuklodPttFloor,
  setBuklodPttMonitor,
  supabase,
  type BuklodPttConnection,
  type BuklodPttKind,
  type BuklodPttScope,
} from './buklodPttCore';

export type BuklodPttRuntimeState = {
  connection: BuklodPttConnection | null;
  transmitting: boolean;
  requestingFloor: boolean;
  txKind: BuklodPttKind | null;
  transmissionId: string | null;
  priorityReceiving: boolean;
  priorityTransmissionId: string | null;
  priorityValue: number;
  bootstrapped: boolean;
};

type PttSignal = {
  transmission_id?: string;
  scope_id?: string;
  scope_name?: string;
  scope_type?: string;
  channel?: number;
  sender_user_id?: string;
  kind?: string;
  priority?: number;
  call_id?: string;
  lease_expires_at?: string;
};

type ActiveTransmission = {
  id: string;
  scope_id: string;
  channel: number;
  sender_user_id: string;
  kind: BuklodPttKind;
  priority: number;
  call_id: string;
  status: string;
  lease_expires_at: string;
};

const listeners = new Set<(state: BuklodPttRuntimeState) => void>();
const signalChannels = new Map<string, RealtimeChannel>();

let state: BuklodPttRuntimeState = {
  connection: null,
  transmitting: false,
  requestingFloor: false,
  txKind: null,
  transmissionId: null,
  priorityReceiving: false,
  priorityTransmissionId: null,
  priorityValue: 0,
  bootstrapped: false,
};

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let priorityGuardTimer: ReturnType<typeof setInterval> | null = null;
let previousTarget: { scope: BuklodPttScope; channel: number } | null = null;
let bootPromise: Promise<void> | null = null;
let holdToken = 0;
// Serialize overlapping holds/releases so a late floor grant cannot revoke a
// subsequent transmission on the same channel.
let floorRequestPromise: Promise<void> | null = null;
let floorReleasePromise: Promise<void> | null = null;
let captionUnsubscribe: (() => void) | null = null;
let recentlyReleased: { id: string; scopeId: string; channel: number; at: number } | null = null;

function detachCaptionListener() {
  try { captionUnsubscribe?.(); } catch {}
  captionUnsubscribe = null;
}

function attachCaptionListener(connection: BuklodPttConnection) {
  detachCaptionListener();
  // The existing Stream call emits speech-to-text. No new native capture.
  captionUnsubscribe = connection.call.on('call.closed_caption', (event: any) => {
    if (state.connection !== connection) return;
    const caption = event?.closed_caption;
    if (!caption || caption.translated) return;
    const currentId = state.transmissionId;
    const recent = recentlyReleased;
    const id = currentId || (
      recent && recent.scopeId === connection.scope.id &&
      recent.channel === connection.channel && Date.now() - recent.at < 60000
        ? recent.id : null
    );
    if (!id) return;
    // Only store the signed-in user's own speech; never impersonate a peer.
    const speakerId = String(caption.speaker_id || caption.user?.id || '');
    if (speakerId !== connection.userId) return;
    void hasBuklodPttCaptionConsent(connection.userId, connection.scope.id, connection.channel)
      .then((consented) => {
        if (!consented) return;
        return persistOwnBuklodPttCaption(connection, caption, id);
      })
      .catch((error) => console.warn('PTT caption persistence failed', error));
  });
}

function emit() {
  const copy = { ...state };
  listeners.forEach((listener) => {
    try {
      listener(copy);
    } catch {}
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
  return () => {
    listeners.delete(listener);
  };
}

async function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function stopPriorityGuard() {
  if (priorityGuardTimer) {
    clearInterval(priorityGuardTimer);
    priorityGuardTimer = null;
  }
}

async function getActiveTransmission(
  transmissionId: string,
): Promise<ActiveTransmission | null> {
  if (!transmissionId) return null;

  const { data, error } = await supabase
    .from('buklod_ptt_transmissions')
    .select(
      'id,scope_id,channel,sender_user_id,kind,priority,call_id,status,lease_expires_at',
    )
    .eq('id', transmissionId)
    .maybeSingle();

  if (error || !data) return null;
  if (String(data.status) !== 'ACTIVE') return null;

  const leaseMs = new Date(String(data.lease_expires_at)).getTime();
  if (!Number.isFinite(leaseMs) || leaseMs <= Date.now()) return null;

  return {
    id: String(data.id),
    scope_id: String(data.scope_id),
    channel: Number(data.channel),
    sender_user_id: String(data.sender_user_id),
    kind: String(data.kind) as BuklodPttKind,
    priority: Number(data.priority || 0),
    call_id: String(data.call_id),
    status: String(data.status),
    lease_expires_at: String(data.lease_expires_at),
  };
}

async function disconnectCurrent(options?: { disableMonitor?: boolean }) {
  const current = state.connection;
  if (!current) return;

  if (options?.disableMonitor) {
    try {
      await setBuklodPttMonitor(current.scope.id, current.channel, false);
    } catch {}
  }

  detachCaptionListener();
  recentlyReleased = null;
  await disconnectBuklodPtt(current);
  state = {
    ...state,
    connection: null,
    transmitting: false,
    requestingFloor: false,
    txKind: null,
    transmissionId: null,
  };
  emit();
}

async function connectTarget(
  scope: BuklodPttScope,
  channel: number,
  options?: { monitor?: boolean },
) {
  const current = state.connection;

  if (
    current &&
    current.scope.id === scope.id &&
    current.channel === channel
  ) {
    if (options?.monitor) {
      await setBuklodPttMonitor(scope.id, channel, true);
    }
    return current;
  }

  await pttUp().catch(() => undefined);

  if (current) {
    detachCaptionListener();
    recentlyReleased = null;
    await disconnectBuklodPtt(current);
  }

  const next = await connectBuklodPtt(scope, channel);

  if (options?.monitor) {
    await setBuklodPttMonitor(scope.id, channel, true);
  }

  state = {
    ...state,
    connection: next,
    transmitting: false,
    requestingFloor: false,
    txKind: null,
    transmissionId: null,
  };
  attachCaptionListener(next);
  emit();
  return next;
}

export async function connectBuklodPttRuntime(
  scope: BuklodPttScope,
  channel: number,
) {
  const old = state.connection;

  if (
    old &&
    (old.scope.id !== scope.id || old.channel !== channel) &&
    !state.priorityReceiving
  ) {
    try {
      await setBuklodPttMonitor(old.scope.id, old.channel, false);
    } catch {}
  }

  return connectTarget(scope, channel, { monitor: true });
}

export async function selectBuklodPttTarget(
  scope: BuklodPttScope,
  channel: number,
) {
  if (state.priorityReceiving) {
    stopPriorityGuard();
    previousTarget = null;
    state = {
      ...state,
      priorityReceiving: false,
      priorityTransmissionId: null,
      priorityValue: 0,
    };
    emit();
  }

  return connectBuklodPttRuntime(scope, channel);
}

export async function disconnectBuklodPttRuntime() {
  await pttUp().catch(() => undefined);
  stopPriorityGuard();
  await disconnectCurrent({ disableMonitor: true });
  previousTarget = null;
  state = {
    ...state,
    priorityReceiving: false,
    priorityTransmissionId: null,
    priorityValue: 0,
  };
  emit();
}

async function dropFloor(transmissionId: string | null | undefined) {
  if (!transmissionId) return;
  await releaseBuklodPttFloor(transmissionId).catch(() => undefined);
}

export async function pttDown(kind: BuklodPttKind = 'NORMAL') {
  const current = state.connection;
  if (!current) {
    throw new Error('Connect to a BUKLOD PTT channel first.');
  }
  if (state.transmitting || state.requestingFloor) return;

  const token = ++holdToken;
  const stillHeld = () => token === holdToken && state.connection === current;
  const previousRequest = floorRequestPromise;
  const previousRelease = floorReleasePromise;

  state = { ...state, requestingFloor: true };
  emit();

  const acquisition = (async () => {
    // Old short taps can finish their RPC after the finger was released.
    // Clean those grants up before claiming again to avoid same-holder reuse.
    await previousRequest?.catch(() => undefined);
    await previousRelease?.catch(() => undefined);
    if (!stillHeld()) return;

    const floor = await claimBuklodPttFloor(
      current.scope.id,
      current.channel,
      kind,
      current.callId,
    );

    if (!stillHeld()) {
      await dropFloor(floor.transmission_id);
      return;
    }
    if (!floor.granted || !floor.transmission_id) {
      if (floor.reason === 'BUSY') {
        throw new Error('CHANNEL BUSY — another member is transmitting.');
      }
      throw new Error(floor.reason || 'PTT floor was not granted.');
    }

    try {
      await current.call.microphone.enable();
    } catch (error) {
      await dropFloor(floor.transmission_id);
      throw error;
    }

    if (!stillHeld()) {
      try {
        await current.call.microphone.disable();
      } catch {}
      await dropFloor(floor.transmission_id);
      return;
    }

    recentlyReleased = null;
    state = {
      ...state,
      requestingFloor: false,
      transmitting: true,
      txKind: kind,
      transmissionId: floor.transmission_id,
    };
    emit();

    await stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      const tx = state.transmissionId;
      if (!tx) return;
      void refreshBuklodPttFloor(tx)
        .then((refreshed) => {
          // A preempted or expired lease must never leave the mic transmitting.
          if (!refreshed && state.transmissionId === tx) {
            void pttUp().catch(() => undefined);
          }
        })
        .catch(() => undefined);
    }, 5000);
  })();

  floorRequestPromise = acquisition;
  try {
    await acquisition;
  } finally {
    if (floorRequestPromise === acquisition) floorRequestPromise = null;
    if (token === holdToken && state.requestingFloor) {
      state = { ...state, requestingFloor: false };
      emit();
    }
  }
}

export async function pttUp() {
  holdToken += 1;
  const current = state.connection;
  const tx = state.transmissionId;
  if (tx && current) recentlyReleased = { id: tx, scopeId: current.scope.id, channel: current.channel, at: Date.now() };
  const previousRelease = floorReleasePromise;

  await stopHeartbeat();

  // React immediately to the finger lifting; transport cleanup follows.
  if (state.transmitting || state.requestingFloor || state.transmissionId) {
    state = {
      ...state,
      requestingFloor: false,
      transmitting: false,
      txKind: null,
      transmissionId: null,
    };
    emit();
  }

  const release = (async () => {
    await previousRelease?.catch(() => undefined);
    if (current) {
      try {
        await current.call.microphone.disable();
      } catch {}
    }
    if (tx) await dropFloor(tx);
  })();

  floorReleasePromise = release;
  try {
    await release;
  } finally {
    if (floorReleasePromise === release) floorReleasePromise = null;
  }
}

async function handlePriorityEnd(signal: PttSignal) {
  const txId = String(signal.transmission_id || '');

  if (
    !state.priorityReceiving ||
    !txId ||
    txId !== state.priorityTransmissionId
  ) {
    return;
  }

  stopPriorityGuard();

  const restore = previousTarget;
  previousTarget = null;

  await disconnectCurrent({ disableMonitor: false });

  state = {
    ...state,
    priorityReceiving: false,
    priorityTransmissionId: null,
    priorityValue: 0,
  };
  emit();

  if (restore) {
    await connectTarget(restore.scope, restore.channel, { monitor: true });
  }
}

function startPriorityGuard(transmissionId: string) {
  stopPriorityGuard();

  priorityGuardTimer = setInterval(() => {
    void (async () => {
      const active = await getActiveTransmission(transmissionId);
      if (!active) {
        await handlePriorityEnd({ transmission_id: transmissionId });
      }
    })().catch(() => undefined);
  }, 4000);
}

async function handlePriorityStart(signal: PttSignal) {
  const txId = String(signal.transmission_id || '');
  if (!txId) return;

  const active = await getActiveTransmission(txId);
  if (!active) return;

  const kind = String(active.kind || '').toUpperCase();
  if (!['PRIORITY', 'SOS'].includes(kind)) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) return;
  if (active.sender_user_id === session.user.id) return;

  if (
    signal.scope_id &&
    String(signal.scope_id) !== active.scope_id
  ) return;

  if (
    signal.channel &&
    Number(signal.channel) !== active.channel
  ) return;

  if (
    state.priorityReceiving &&
    state.priorityTransmissionId === txId
  ) {
    startPriorityGuard(txId);
    return;
  }

  if (
    state.priorityReceiving &&
    state.priorityTransmissionId !== txId &&
    state.priorityValue >= active.priority
  ) {
    return;
  }

  const scopes = await loadBuklodPttScopes();
  const authorizedScope = scopes.find((item) => item.id === active.scope_id);
  if (!authorizedScope) return;

  const current = state.connection;
  if (current && !state.priorityReceiving) {
    previousTarget = {
      scope: current.scope,
      channel: current.channel,
    };
  }

  await connectTarget(authorizedScope, active.channel, { monitor: false });

  state = {
    ...state,
    priorityReceiving: true,
    priorityTransmissionId: txId,
    priorityValue: active.priority,
  };
  emit();

  startPriorityGuard(txId);
}

function attachScopeSignalChannel(scope: BuklodPttScope) {
  if (signalChannels.has(scope.id)) return;

  const channel = supabase
    .channel(`buklod-ptt:${scope.id}`, {
      config: { private: true },
    })
    .on('broadcast', { event: 'PTT_START' }, (message: any) => {
      const payload = (message?.payload ?? message) as PttSignal;
      const kind = String(payload?.kind || '').toUpperCase();

      if (kind === 'PRIORITY' || kind === 'SOS') {
        void handlePriorityStart(payload).catch(() => undefined);
      }
    })
    .on('broadcast', { event: 'PTT_END' }, (message: any) => {
      void handlePriorityEnd(
        (message?.payload ?? message) as PttSignal,
      ).catch(() => undefined);
    })
    .subscribe();

  signalChannels.set(scope.id, channel);
}

async function restoreLastMonitoredChannel(scopes: BuklodPttScope[]) {
  if (state.connection || state.priorityReceiving) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) return;

  const { data, error } = await supabase
    .from('buklod_ptt_monitors')
    .select('scope_id,channel,enabled,updated_at')
    .eq('user_id', session.user.id)
    .eq('enabled', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.scope_id || !data?.channel) return;

  const scope = scopes.find((item) => item.id === String(data.scope_id));
  const channel = Number(data.channel);

  if (!scope || channel < 1 || channel > 10) return;

  await connectTarget(scope, channel, { monitor: true });
}

export async function bootstrapBuklodPttRuntime() {
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      state = { ...state, bootstrapped: false };
      emit();
      return;
    }

    try {
      await (supabase.realtime as any).setAuth?.(session.access_token);
    } catch {}

    const scopes = await loadBuklodPttScopes();
    scopes.forEach(attachScopeSignalChannel);

    state = { ...state, bootstrapped: true };
    emit();

    await restoreLastMonitoredChannel(scopes).catch(() => undefined);
  })().finally(() => {
    bootPromise = null;
  });

  return bootPromise;
}

export async function shutdownBuklodPttRuntime() {
  stopPriorityGuard();
  await disconnectBuklodPttRuntime().catch(() => undefined);

  for (const channel of signalChannels.values()) {
    try {
      await supabase.removeChannel(channel);
    } catch {}
  }
  signalChannels.clear();

  state = { ...state, bootstrapped: false };
  emit();
}

async function listenForIncomingPtt(data: any) {
  if (state.priorityReceiving || state.transmitting) return;

  const channel = Number(data?.channel || 0);
  const scopeId = String(data?.scope_id || '');
  if (!scopeId || channel < 1 || channel > 10) return;

  const current = state.connection;
  if (
    current &&
    current.scope.id === scopeId &&
    current.channel === channel
  ) {
    return;
  }

  const scopes = await loadBuklodPttScopes();
  const scope = scopes.find((item) => item.id === scopeId);
  if (!scope) return;

  await connectBuklodPttRuntime(scope, channel);
}

export async function handleBuklodPttPush(data: any) {
  const kind = String(data?.kind || '').toLowerCase();
  if (!['ptt_incoming', 'ptt_priority', 'ptt_sos'].includes(kind)) return;

  await bootstrapBuklodPttRuntime();

  if (kind === 'ptt_incoming') {
    await listenForIncomingPtt(data);
    return;
  }

  await handlePriorityStart({
    transmission_id: data?.transmission_id,
    scope_id: data?.scope_id,
    scope_name: data?.scope_name,
    scope_type: data?.scope_type,
    channel: Number(data?.channel || 0),
    sender_user_id: data?.sender_user_id,
    kind: kind === 'ptt_sos' ? 'SOS' : 'PRIORITY',
    priority: Number(data?.priority || 0),
    call_id: data?.call_id,
  });
}