/**
 * BUKLOD Android Wall: original image promotion gate.
 * An Expo load is only a decode acknowledgement, never proof of display.
 * Reject stale callbacks after URL and renderer changes.
 * Native fallback has no onDisplay event; its positive-dimension load is
 * retained as the only available signal while the preview remains underneath.
 */
export type WallOriginalDisplayInput = {
  expectedUrl: string;
  decodedUrl: string;
  width: number;
  height: number;
  activeRenderer: 'expo' | 'native';
  renderedBy: 'expo' | 'native';
  displayed: boolean;
};

/** Network capacity ends at decode; display acknowledgement is a separate gate. */
export function releaseWallOriginalTransferOnDecode(
  input: WallOriginalDisplayInput,
  release: () => void,
): boolean {
  if (!shouldRevealWallOriginal({ ...input, displayed: true })) return false;
  release();
  return true;
}

export function isCurrentWallOriginalEvent(
  expectedUrl: string, eventUrl: string,
  activeRenderer: 'expo' | 'native', eventRenderer: 'expo' | 'native',
): boolean {
  return Boolean(expectedUrl && expectedUrl === eventUrl && activeRenderer === eventRenderer);
}

export function shouldRevealWallOriginal(input: WallOriginalDisplayInput): boolean {
  return Boolean(
    input.expectedUrl &&
      input.decodedUrl === input.expectedUrl &&
      input.activeRenderer === input.renderedBy &&
      Number.isFinite(input.width) &&
      Number.isFinite(input.height) &&
      input.width > 0 &&
      input.height > 0 &&
      (input.renderedBy === 'native' || input.displayed),
  );
}

/** Progress extends an active download without restarting it by wall-clock age. */
export function shouldKeepWallOriginalTransfer(input: {
  expectedUrl: string;
  progressUrl: string;
  lastProgressAt: number;
  now: number;
  stallMs: number;
}): boolean {
  return Boolean(
    input.expectedUrl &&
      input.expectedUrl === input.progressUrl &&
      Number.isFinite(input.lastProgressAt) &&
      input.lastProgressAt > 0 &&
      Number.isFinite(input.now) &&
      Number.isFinite(input.stallMs) &&
      input.stallMs > 0 &&
      input.now >= input.lastProgressAt &&
      input.now - input.lastProgressAt < input.stallMs,
  );
}

/**
 * Single Wall original selection contract.
 * A previously cached original must NEVER queue behind fresh downloads,
 * request another signed URL, or depend on a preview's paint callback.
 */
export type WallOriginalSourcePlan = 'cached' | 'network' | 'defer';

export function planWallOriginalSource(cachedOriginal: boolean, canRequest: boolean): WallOriginalSourcePlan {
  return cachedOriginal ? 'cached' : canRequest ? 'network' : 'defer';
}

// Keep the full-resolution transparent image ABOVE the thumbnail. An opaque
// preview over the original can suppress Android onDisplay indefinitely.
// Transparent image views draw only decoded pixels, so previews stay visible
// during loading; confirmation and bounded recovery still work independently.
export const WALL_PREVIEW_LAYER_Z_INDEX = 1;
export function wallOriginalLayerZIndex(_ready: boolean): number {
  return 2;
}

export function shouldMountWallOriginalUpgrade(input: {
  originalPath: string;
  usingPreview: boolean;
}): boolean {
  // A failed or white preview MUST NOT unmount the original download.
  return Boolean(input.originalPath && input.usingPreview);
}
