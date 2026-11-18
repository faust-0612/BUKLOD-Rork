/**
 * One foreground-aware Supabase Realtime Presence channel per signed-in app,
 * NOT a channel or network call per avatar. Blue means server-confirmed
 * presence; unknown/disconnected/background is never represented as online.
 * Season 2 presentation only: no user rows, finance, or points writes.
 */
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';

type Listener = () => void;
const listeners = new Set<Listener>();
const onlineIds = new Set<string>();
let viewer = '';
let channel: ReturnType<typeof supabase.channel> | null = null;
let appListener: { remove: () => void } | null = null;
let ready = false;
let authSubscription: { unsubscribe: () => void } | null = null;

const normalizeId = (id?: string | null) => String(id ?? '').trim().toLowerCase();
function notify() {
  for (const listener of [...listeners]) {
    try { listener(); } catch { /* one bad view never prevents others */ }
  }
}

function disconnect() {
  const previous = channel;
  channel = null;
  ready = false;
  onlineIds.clear();
  appListener?.remove();
  appListener = null;
  if (previous) void supabase.removeChannel(previous).catch(() => undefined);
  notify();
}

function syncPresence(connected: ReturnType<typeof supabase.channel>) {
  if (connected !== channel || !ready || AppState.currentState !== 'active') {
    onlineIds.clear();
    notify();
    return;
  }
  const state = connected.presenceState() as Record<string, unknown[]>;
  const next = new Set<string>();
  for (const [key, entries] of Object.entries(state ?? {})) {
    if (Array.isArray(entries) && entries.length > 0) {
      const id = normalizeId(key);
      if (/^[a-f0-9-]{36}$/.test(id)) next.add(id);
    }
  }
  onlineIds.clear();
  for (const id of next) onlineIds.add(id);
  notify();
}

function keepAccountIsolation() {
  if (authSubscription) return;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const authenticatedId = normalizeId(session?.user?.id);
    if (viewer && authenticatedId !== viewer) {
      disconnect();
      viewer = '';
    }
  });
  authSubscription = data.subscription;
}

function connect(nextViewer: string) {
  keepAccountIsolation();
  if (viewer !== nextViewer) {
    disconnect();
    viewer = nextViewer;
  }
  if (channel || !viewer) return;
  const connected = supabase.channel('buklod-s2-avatar-presence-v1', {
    config: { presence: { key: viewer } },
  });
  channel = connected;
  const trackForeground = () => {
    if (connected !== channel) return;
    if (AppState.currentState === 'active' && ready) {
      void connected.track({ user_id: viewer, foreground: true }).catch(() => {
        onlineIds.clear(); notify();
      });
    } else {
      onlineIds.clear();
      void connected.untrack().catch(() => undefined);
      notify();
    }
  };
  appListener = AppState.addEventListener('change', (_state: AppStateStatus) => {
    trackForeground();
  });
  connected.on('presence', { event: 'sync' }, () => syncPresence(connected));
  connected.on('presence', { event: 'join' }, () => syncPresence(connected));
  connected.on('presence', { event: 'leave' }, () => syncPresence(connected));
  connected.subscribe(status => {
    if (connected !== channel) return;
    ready = status === 'SUBSCRIBED';
    if (ready) trackForeground();
    else { onlineIds.clear(); notify(); }
  });
}

export function isBuklodAvatarOnline(viewerId?: string | null, userId?: string | null): boolean {
  return ready && AppState.currentState === 'active'
    && !!viewer && viewer === normalizeId(viewerId)
    && onlineIds.has(normalizeId(userId));
}

export function subscribeBuklodAvatarPresence(viewerId: string, listener: Listener): () => void {
  const id = normalizeId(viewerId);
  if (!id) return () => undefined;
  listeners.add(listener);
  connect(id);
  listener();
  return () => {
    listeners.delete(listener);
    // Keep the single app-session presence alive through screens with no
    // visible avatars; otherwise active members falsely appear offline.
    // The auth watcher, AppState and socket lifecycle own disconnect.
  };
}
