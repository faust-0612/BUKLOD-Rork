import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { createBuklodPerformanceFetch } from './buklodPerformanceFetch';

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

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-buklod-client': 'mobile',
    },

  fetch: buklodRootPerformanceFetch
},
  realtime: {
    params: {
      eventsPerSecond: 8,
    },
  },
});

let realtimeConnected = true;

AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();

    if (!realtimeConnected) {
      supabase.realtime.connect();
      realtimeConnected = true;
    }

    return;
  }

  supabase.auth.stopAutoRefresh();

  if (realtimeConnected) {
    supabase.realtime.disconnect();
    realtimeConnected = false;
  }
});
