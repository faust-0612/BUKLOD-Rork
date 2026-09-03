import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../src/core';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => mounted && setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    const inLogin = segments[0] === 'login';
    if (!session && !inLogin) router.replace('/login');
    if (session && inLogin) router.replace('/(tabs)/home');
  }, [session, segments, router]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </SafeAreaProvider>
  );
}
