import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { createBuklodPerformanceFetch } from './buklodPerformanceFetch';
import { createBuklodPermissionSnapshotFetch } from './buklodPermissionSnapshotFetch';
import { createBuklodR4RequestShield } from './buklodR4RequestShield';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('Missing Supabase environment variables.');
}


/* BUKLOD_ROOT_PERFORMANCE_R3
 * Collapse simultaneous identical SAFE READS before they reach Supabase.
 * R3.4 auto-detected and preserves the existing base fetch transport.
 */
const buklodRootPerformanceFetch =
  createBuklodPerformanceFetch(fetch);

/* BUKLOD_ROOT_PERFORMANCE_R4
 * Add targeted coalescing/cache windows for the heaviest Home/Cluster reads.
 * Writes still bypass caching and invalidate affected R4 table entries.
 */
const buklodR4PerformanceFetch =
  createBuklodR4RequestShield(buklodRootPerformanceFetch);

/* BUKLOD_PERMISSION_SNAPSHOT_R1
 * Foundation presentation checks previously issued dozens of distinct
 * buklod_has_permission RPCs after login. Serve current-user checks from one
 * short-lived authenticated permission snapshot; privileged target-user
 * checks and all mutations bypass this layer.
 */
const buklodPermissionSnapshotFetch =
  createBuklodPermissionSnapshotFetch(buklodR4PerformanceFetch);

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-buklod-client':
        Platform.OS === 'web'
          ? 'web'
          : 'mobile',
    },

  fetch: buklodPermissionSnapshotFetch
},
  realtime: {
    params: {
      eventsPerSecond: 8,
    },
  },
});

/*
 * BUKLOD_MAIN_AUTH_STORM_R21
 * React Native needs AppState-controlled auth refresh, but the listener must
 * exist exactly once per runtime. A module-level addEventListener can be
 * duplicated by Fast Refresh / bundle re-evaluation and create overlapping
 * startAutoRefresh/stopAutoRefresh cycles. Web does not need this native
 * AppState bridge at all.
 */
type BuklodSupabaseLifecycleState = {
  installed: boolean;
  realtimeConnected: boolean;
};

const SUPABASE_LIFECYCLE_STATE_KEY =
  '__BUKLOD_SUPABASE_LIFECYCLE_R21__';

function getBuklodSupabaseLifecycleState(): BuklodSupabaseLifecycleState {
  const root = globalThis as any;
  const existing = root[SUPABASE_LIFECYCLE_STATE_KEY] as
    | BuklodSupabaseLifecycleState
    | undefined;

  if (existing) {
    return existing;
  }

  const created: BuklodSupabaseLifecycleState = {
    installed: false,
    realtimeConnected: true,
  };

  root[SUPABASE_LIFECYCLE_STATE_KEY] = created;
  return created;
}

const lifecycleState = getBuklodSupabaseLifecycleState();

if (
  Platform.OS !== 'web' &&
  !lifecycleState.installed
) {
  lifecycleState.installed = true;

  AppState.addEventListener('change', state => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();

      if (!lifecycleState.realtimeConnected) {
        supabase.realtime.connect();
        lifecycleState.realtimeConnected = true;
      }

      return;
    }

    supabase.auth.stopAutoRefresh();

    if (lifecycleState.realtimeConnected) {
      supabase.realtime.disconnect();
      lifecycleState.realtimeConnected = false;
    }
  });
}
