/**
 * Cosmetic online presence for Season 2. A single shared Realtime subscription
 * per authenticated device, never a websocket or polling request per avatar.
 * A missing/disconnected presence state is UNKNOWN (no blue marker).
 */
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';

const listeners = new Set<() => void>();
let online = new Set<string>();
let viewer = '';
let channel: ReturnType<typeof supabase.channel> | null = null;
let count = 0;
let appStateSubscription: { remove(): void } | null = null;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

function notify(state: Set<string>) {
  if (state.size === online.size && [...state].every(id => online.has(id))) return;
  online = state;
  for (const listener of listeners) listener();
}

function disconnect() {
  if (disconnectTimer) clearTimeout(disconnectTimer);
  disconnectTimer = null;
  const old = channel;
  channel = null;
  viewer = '';
  appStateSubscription?.remove();
  appStateSubscription = null;
  notify(new Set());
  if (old) void old.untrack().catch(() => undefined).finally(() => {
    void supabase.removeChannel(old).catch(() => undefined);
  });
}

function start(userId: string) {
  if (channel && viewer === userId) return;
  disconnect();
  viewer = userId;
  const current = supabase.channel('buklod:season2:online-v1', {
    config: { presence: { key: userId } },
  });
  channel = current;
  current.on('presence', { event: 'sync' }, () => {
    if (channel !== current) return;
    const state = current.presenceState();
    const next = new Set<string>();
    for (const [key, values] of Object.entries(state)) {
      if (Array.isArray(values) && values.length && /^[a-f0-9-]{36}$/i.test(key)) {
        next.add(key.toLowerCase());
      }
    }
    notify(next);
  }).subscribe(status => {
    if (status === 'SUBSCRIBED' && channel === current && AppState.currentState === 'active') {
      void current.track({ online: true }).catch(() => undefined);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      notify(new Set());
    }
  });
  appStateSubscription = AppState.addEventListener('change', state => {
    if (channel !== current) return;
    if (state === 'active') void current.track({ online: true }).catch(() => undefined);
    else void current.untrack().catch(() => undefined);
  });
}

export function isBuklodUserOnline(userId?: string | null): boolean {
  return !!userId && online.has(userId.toLowerCase());
}

export function subscribeBuklodOnlinePresence(userId: string, listener: () => void) {
  if (!userId) return () => undefined;
  if (disconnectTimer) clearTimeout(disconnectTimer);
  disconnectTimer = null;
  start(userId.toLowerCase());
  count++;
  listeners.add(listener);
  listener();
  return () => {
    listeners.delete(listener);
    count = Math.max(0, count - 1);
    if (count === 0) {
      disconnectTimer = setTimeout(() => { if (count === 0) disconnect(); }, 2000);
    }
  };
}
