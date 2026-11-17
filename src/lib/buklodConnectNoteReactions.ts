import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { supabase } from '@/lib/supabase';

/** Status Note reactions are intentionally separate from posts and BUKLOD Points. */
export type ConnectNoteReaction = {
  total_reactions: number;
  my_reaction: string | null;
};
const EMPTY: ConnectNoteReaction = { total_reactions: 0, my_reaction: null };
const cache = new Map<string, { at: number; values: Record<string, ConnectNoteReaction> }>();
const CACHE_MS = 30_000;
const MAX_CACHE_KEYS = 12;
// A Wall/Connect tab focus and mount can coincide: share one read, not two.
const noteReadsInFlight = new Map<string, Promise<{data:any; error:any}>>();

function mutate(
  row: ConnectNoteReaction,
  previous: string | null,
  next: string | null,
): ConnectNoteReaction {
  return {
    my_reaction: next,
    total_reactions: Math.max(
      0,
      row.total_reactions - (previous ? 1 : 0) + (next ? 1 : 0),
    ),
  };
}

export function useBuklodConnectNoteReactions(
  viewerId: string,
  notes: readonly { user_id: string; quick_note: string | null }[],
) {
  // Depend on values, not an unstable contact-array identity. Changing a note
  // revalidates its count; empty/expired notes are never requested.
  const noteKey = notes
    .filter(row => !!row.user_id && !!row.quick_note?.trim())
    .map(row => `${row.user_id}:${row.quick_note}`)
    .sort()
    .join('|');
  const ownerKey = notes
    .filter(row => !!row.user_id && !!row.quick_note?.trim())
    .map(row => row.user_id)
    .sort()
    .join(',');
  const [reactions, setReactions] = useState<Record<string, ConnectNoteReaction>>({});
  const requestSequence = useRef(0);
  const pending = useRef(new Set<string>());
  const viewerRef = useRef(viewerId);
  viewerRef.current = viewerId;

  const refresh = useCallback(async (force = false) => {
    const sequence = ++requestSequence.current;
    if (!viewerId || !ownerKey) {
      setReactions({});
      return;
    }
    const key = `${viewerId}|${noteKey}`;
    const warm = cache.get(key);
    if (warm && !force && Date.now() - warm.at < CACHE_MS) {
      setReactions(warm.values);
      return;
    }

    try {
      let request = noteReadsInFlight.get(key);
      if (!request) {
        request = Promise.resolve((supabase as any).rpc(
          'get_buklod_connect_note_reactions_v1',
          { p_owner_ids: ownerKey.split(',') },
        ));
        noteReadsInFlight.set(key, request);
        void request.finally(() => {
          if (noteReadsInFlight.get(key) === request) noteReadsInFlight.delete(key);
        }).catch(() => undefined);
      }
      const { data, error } = await request;
      if (error) throw error;
      if (viewerRef.current !== viewerId || sequence !== requestSequence.current) return;
      const next: Record<string, ConnectNoteReaction> = {};
      for (const row of data ?? []) {
        const id = String(row.owner_id ?? '');
        if (!id) continue;
        next[id] = {
          total_reactions: Math.max(0, Number(row.total_reactions ?? 0)),
          my_reaction: row.my_reaction ?? null,
        };
      }
      cache.set(key, { at: Date.now(), values: next });
      while (cache.size > MAX_CACHE_KEYS) {
        const oldest = cache.keys().next().value;
        if (!oldest) break;
        cache.delete(oldest);
      }
      setReactions(next);
    } catch {
      // Existing Notes remain readable on weak networks or older backends.
    }
  }, [viewerId, ownerKey, noteKey]);

  useEffect(() => {
    void refresh();
    return () => { ++requestSequence.current; };
  }, [refresh]);

  const toggleLove = useCallback(async (ownerId: string) => {
    if (!viewerId || !ownerId || ownerId === viewerId || pending.current.has(ownerId)) return;
    pending.current.add(ownerId);
    // An older list refresh must never overwrite an optimistically updated note.
    ++requestSequence.current;
    const previous = reactions[ownerId] ?? EMPTY;
    const nextKey = previous.my_reaction === 'love' ? null : 'love';
    setReactions(rows => ({
      ...rows,
      [ownerId]: mutate(rows[ownerId] ?? EMPTY, previous.my_reaction, nextKey),
    }));
    try {
      // The RPC toggles on the selected key, exactly like post reactions.
      const { data, error } = await (supabase as any).rpc(
        'set_buklod_connect_note_reaction_v1',
        { p_owner_id: ownerId, p_reaction: 'love' },
      );
      if (error) throw error;
      const persisted = data == null ? null : String(data);
      if (viewerRef.current !== viewerId) return;
      if (persisted !== nextKey) {
        setReactions(rows => ({
          ...rows,
          [ownerId]: mutate(rows[ownerId] ?? EMPTY, nextKey, persisted),
        }));
      }
      // Refresh on return to screen; don't keep a speculative cache entry.
      for (const key of cache.keys()) {
        if (key.startsWith(`${viewerId}|`)) cache.delete(key);
      }
    } catch (error) {
      if (viewerRef.current !== viewerId) return;
      setReactions(rows => ({
        ...rows,
        [ownerId]: mutate(rows[ownerId] ?? EMPTY, nextKey, previous.my_reaction),
      }));
      Alert.alert('Note reaction', 'Could not save your reaction. Please try again.');
    } finally {
      pending.current.delete(ownerId);
    }
  }, [viewerId, reactions]);

  return { reactions, toggleLove, refresh };
}
