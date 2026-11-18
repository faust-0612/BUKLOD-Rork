/**
 * Bounded account-scoped rank lookup. All Wall/Connect/Profile avatars share
 * one 32-person RPC batch instead of issuing one network request per avatar.
 * Missing and inaccessible ranks never masquerade as verified ranks.
 */
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

type RankValue = string | null | undefined;
type Pending = { viewer: string; user: string; resolve: (rank: RankValue) => void };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const cache = new Map<string, { rank: string | null; expires: number }>();
const requests = new Map<string, Promise<RankValue>>();
const queue = new Map<string, Pending>();
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
const key = (viewer: string, user: string) => viewer + ':' + user;

export function peekBuklodCircleRank(viewerId: string, userId: string): RankValue {
  const found = cache.get(key(viewerId.toLowerCase(), userId.toLowerCase()));
  return found && found.expires > Date.now() ? found.rank : undefined;
}

function remember(k: string, rank: string | null) {
  cache.delete(k);
  cache.set(k, { rank, expires: Date.now() + (rank ? 90_000 : 45_000) });
  while (cache.size > 600) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    while (queue.size) {
      const first = queue.values().next().value as Pending;
      const group: Array<[string, Pending]> = [];
      for (const item of queue) {
        if (group.length >= 32) break;
        if (item[1].viewer === first.viewer) group.push(item);
      }
      for (const [k] of group) queue.delete(k);
      let byUser: Map<string, string> | null = null;
      try {
        const { data, error } = await withBuklodTimeout<any>(
          (supabase as any).rpc('get_member_circle_ranks_v1', {
            p_user_ids: group.map(([, task]) => task.user),
          }),
          5_000,
          'Circle Rank avatar batch',
        );
        if (error) throw error;
        if (!Array.isArray(data)) throw Error('Invalid rank response');
        byUser = new Map<string, string>(
          data.filter(row => row?.user_id && typeof row.rank_name === 'string')
            .map(row => [String(row.user_id).toLowerCase(), String(row.rank_name)]),
        );
      } catch {
        // Offline, missing permissions or RPC error: keep caller's last safe rank.
      }
      for (const [k, task] of group) {
        const rank = byUser ? (byUser.get(task.user) ?? null) : undefined;
        if (rank !== undefined) remember(k, rank);
        requests.delete(k);
        task.resolve(rank);
      }
    }
  } finally {
    flushing = false;
    if (queue.size) schedule();
  }
}
function schedule() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; void flush(); }, 35);
}

export function resolveBuklodCircleRank(viewerId: string, userId: string): Promise<RankValue> {
  const viewer = String(viewerId ?? '').trim().toLowerCase();
  const user = String(userId ?? '').trim().toLowerCase();
  if (!UUID.test(viewer) || !UUID.test(user)) return Promise.resolve(undefined);
  const cached = peekBuklodCircleRank(viewer, user);
  if (cached !== undefined) return Promise.resolve(cached);
  const k = key(viewer, user);
  const current = requests.get(k);
  if (current) return current;
  let settle!: (rank: RankValue) => void;
  const task = new Promise<RankValue>(resolve => { settle = resolve; });
  requests.set(k, task);
  queue.set(k, { viewer, user, resolve: settle });
  schedule();
  return task;
}
