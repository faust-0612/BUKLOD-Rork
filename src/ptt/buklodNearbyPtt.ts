import {
  requireOptionalNativeModule,
} from 'expo-modules-core';

export type BuklodNearbyPttPeer = {
  id: string;
  name: string;
  signal: 'Ready' | 'Weak signal';
};

type BuklodNearbyPttNative = {
  isAvailable(): boolean;
  getPeers(): BuklodNearbyPttPeer[];
  start(
    scopeId: string,
    channel: number,
    displayName: string,
  ): Promise<boolean>;
  stop(): Promise<boolean>;
  startTransmit(): Promise<boolean>;
  stopTransmit(): Promise<boolean>;
};

const native =
  requireOptionalNativeModule<
    BuklodNearbyPttNative
  >(
    'BuklodNearbyPtt',
  );

export function
isBuklodNearbyPttAvailable() {
  return Boolean(
    native?.isAvailable?.(),
  );
}

function moduleOrThrow() {
  if (!native) {
    throw new Error(
      'Offline Nearby PTT is not available in this native build. Install the latest BUKLOD Android build.',
    );
  }

  return native;
}

export function getBuklodNearbyPttPeers():
  BuklodNearbyPttPeer[] {
  try {
    return native?.getPeers?.() ?? [];
  } catch {
    return [];
  }
}

export async function startBuklodNearbyPtt(
  scopeId: string,
  channel: number,
  displayName: string,
) {
  return moduleOrThrow().start(
    scopeId,
    channel,
    displayName,
  );
}

export async function stopBuklodNearbyPtt() {
  if (!native) return false;
  return native.stop();
}

export async function startBuklodNearbyPttTransmit() {
  return moduleOrThrow().startTransmit();
}

export async function stopBuklodNearbyPttTransmit() {
  if (!native) return false;
  return native.stopTransmit();
}
