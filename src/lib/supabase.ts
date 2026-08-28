import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('Missing Supabase environment variables.');
}

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
