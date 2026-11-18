/**
 * Small Android-only lease for the *currently opened* Wall video.
 * Expo SDK 57 cannot attach a player to two Android VideoViews simultaneously:
 * the Wall detaches before the fullscreen Modal appears. We keep the same
 * player through the short detach/attach gap, then release it promptly.
 *
 * Same signed URI is required. Signed URL rotation never bypasses access.
 * IMA/ad video playback is deliberately excluded from this registry.
 */
import { createVideoPlayer, type VideoPlayer, type VideoSource } from 'expo-video';

type Lease = {
  key: string;
  player: VideoPlayer;
  users: number;
  timer: ReturnType<typeof setTimeout> | null;
};

const leases = new Map<string, Lease>();
const ORPHAN_RELEASE_MS = 3000;
const HANDOFF_RELEASE_MS = 500;

function leaseKey(identity: string, uri: string) {
  return `${identity}\u0000${uri}`;
}

function scheduleRelease(lease: Lease, milliseconds: number) {
  if (lease.timer) clearTimeout(lease.timer);
  lease.timer = setTimeout(() => {
    lease.timer = null;
    if (lease.users || leases.get(lease.key) !== lease) return;
    leases.delete(lease.key);
    try { lease.player.pause(); } catch { /* already released */ }
    try { lease.player.release(); } catch { /* release is best effort */ }
  }, milliseconds);
}

export function getCommunityVideoHandoffPlayer(
  identity: string,
  uri: string,
  source: VideoSource,
): VideoPlayer {
  const key = leaseKey(identity, uri);
  const existing = leases.get(key);
  if (existing) return existing.player;
  const lease: Lease = {
    key,
    player: createVideoPlayer(source),
    users: 0,
    timer: null,
  };
  leases.set(key, lease);
  // React may abandon a render before effects run. Even that cannot leak.
  scheduleRelease(lease, ORPHAN_RELEASE_MS);
  return lease.player;
}

export function retainCommunityVideoHandoffPlayer(
  identity: string,
  uri: string,
  player: VideoPlayer,
): () => void {
  const lease = leases.get(leaseKey(identity, uri));
  if (!lease || lease.player !== player) return () => undefined;
  lease.users += 1;
  if (lease.timer) clearTimeout(lease.timer);
  lease.timer = null;
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    lease.users = Math.max(0, lease.users - 1);
    if (lease.users === 0) {
      try { lease.player.pause(); } catch { /* may already be released */ }
      scheduleRelease(lease, HANDOFF_RELEASE_MS);
    }
  };
}
