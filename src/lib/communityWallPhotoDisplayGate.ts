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
