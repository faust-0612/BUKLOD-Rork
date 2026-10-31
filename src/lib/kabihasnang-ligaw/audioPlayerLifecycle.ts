/** Safe, idempotent-at-call-site lifecycle for an explicitly owned Expo audio player. */
export type KlAudioHandle = { pause(): void; release(): void };

export function closeKlAudioPlayer(player: KlAudioHandle | null | undefined): void {
  if (!player) return;
  // Never invoke methods after release; preserve release even if the native pause fails.
  try { player.pause(); } catch { /* Already released or interrupted native object. */ }
  try { player.release(); } catch { /* Native already released; do not crash navigator. */ }
}

export function runKlAudioCommand(action: () => void): boolean {
  try { action(); return true; } catch { return false; }
}
