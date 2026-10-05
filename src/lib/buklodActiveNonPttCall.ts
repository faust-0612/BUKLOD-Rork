import type { Call } from '@stream-io/video-client';

/*
 * BUKLOD_CALL_ACTIVE_RESOLVER_R1
 *
 * Canonical source of truth for normal (non-PTT) call liveness.
 * Keep launcher guards and global call surfaces on the same lifecycle rules.
 */

export type BuklodCallSurfaceMode =
  | 'visible'
  | 'minimized';

const LIVE_STATES = new Set([
  'ringing',
  'joining',
  'joined',
  'reconnecting',
  'migrating',
]);

const TERMINAL_STATES = new Set([
  'idle',
  'left',
  'offline',
  'reconnecting-failed',
  'reconnecting_failed',
]);

let surfaceMode: BuklodCallSurfaceMode =
  'visible';

const surfaceListeners =
  new Set<
    (
      mode: BuklodCallSurfaceMode
    ) => void
  >();

function normalizeCallingState(
  value: unknown
) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function getBuklodCallingStateText(
  call:
    | Call
    | null
    | undefined
) {
  return normalizeCallingState(
    call?.state?.callingState
  );
}

export function isBuklodActiveNonPttCall(
  call:
    | Call
    | null
    | undefined
) {
  if (
    !call ||
    call.type === 'buklod_ptt'
  ) {
    return false;
  }

  const state =
    getBuklodCallingStateText(
      call
    );

  if (
    TERMINAL_STATES.has(state)
  ) {
    return false;
  }

  if (
    LIVE_STATES.has(state)
  ) {
    return true;
  }

  /*
   * Older SDK snapshots can expose ringing
   * before callingState has fully propagated.
   * This fallback is intentionally narrow.
   */
  return call.ringing === true;
}

export function isBuklodAcceptedNonPttCall(
  call:
    | Call
    | null
    | undefined
) {
  if (
    !isBuklodActiveNonPttCall(
      call
    )
  ) {
    return false;
  }

  const state =
    getBuklodCallingStateText(
      call
    );

  return (
    state === 'joined' ||
    state === 'reconnecting' ||
    state === 'migrating'
  );
}

export function findActiveNonPttCall(
  calls:
    | Call[]
    | readonly Call[]
    | null
    | undefined
) {
  return (
    calls?.find(
      isBuklodActiveNonPttCall
    ) ??
    null
  );
}

function emitSurfaceMode() {
  surfaceListeners.forEach(
    listener => {
      listener(surfaceMode);
    }
  );
}

export function getBuklodCallSurfaceMode() {
  return surfaceMode;
}

export function revealBuklodCallSurface() {
  if (
    surfaceMode === 'visible'
  ) {
    return;
  }

  surfaceMode = 'visible';
  emitSurfaceMode();
}

export function minimizeBuklodCallSurface() {
  if (
    surfaceMode === 'minimized'
  ) {
    return;
  }

  surfaceMode = 'minimized';
  emitSurfaceMode();
}

export function resetBuklodCallSurface() {
  revealBuklodCallSurface();
}

export function subscribeBuklodCallSurface(
  listener: (
    mode: BuklodCallSurfaceMode
  ) => void
) {
  surfaceListeners.add(listener);

  return () => {
    surfaceListeners.delete(
      listener
    );
  };
}

export function restoreActiveNonPttCallIfAny(
  calls:
    | Call[]
    | readonly Call[]
    | null
    | undefined
) {
  const active =
    findActiveNonPttCall(
      calls
    );

  if (active) {
    revealBuklodCallSurface();
  }

  return active;
}
