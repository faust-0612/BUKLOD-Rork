import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConnectScreen from '@/app/(tabs)/messages';
import { useAuth } from '@/providers/AuthProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { signOutBuklodResilient } from '@/lib/buklodAuthResilience';
import { shouldRequireBuklodNativeUpdate } from '@/lib/buklodConnectStandalone';

const GREEN = '#68B516';
const INK = '#1E3814';

export default function BuklodConnectStandaloneHome() {
  const insets = useSafeAreaInsets();
  const { session, loading } = useAuth();
  const { requiresAcceptance } = useCompliance();
  const { config } = useRuntimeConfig();
  const [signingOut, setSigningOut] = useState(false);

  if (loading && !session) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={GREEN} />
      <Text style={styles.loading}>Opening BUKLOD Connect…</Text>
    </View>
  );
  if (!session) return <Redirect href="/(auth)/login" />;
  if (config?.maintenance_mode) return <Redirect href="/system/maintenance" />;
  // Connect's mandatory update overlay is controlled by its own root boundary.
  // Do not redirect users to Main's APK update screen.
  if (shouldRequireBuklodNativeUpdate(config)) return null;
  if (config?.pilot_access_required && !config?.pilot_access_granted) return <Redirect href="/system/pilot-access" />;
  if (requiresAcceptance) return <Redirect href="/privacy/consent" />;

  const confirmSignOut = () => Alert.alert('Sign out?', 'Sign out of BUKLOD Connect on this device?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Sign out', style: 'destructive',
      onPress: () => {
        if (signingOut) return;
        setSigningOut(true);
        void signOutBuklodResilient().then(() => {
          router.replace('/(auth)/login');
        }).catch(() => {
          Alert.alert('Could not sign out', 'Check your connection and try again.');
        }).finally(() => setSigningOut(false));
      },
    },
  ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#90D43A', '#69BA19']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.mark}>
          <MaterialCommunityIcons name="chat-processing" size={26} color={INK} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.kicker}>BUKLOD</Text>
          <Text style={styles.title}>Connect</Text>
          <Text style={styles.subtitle}>Messages · Calls · Push-to-Talk</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={signingOut} onPress={confirmSignOut} style={styles.signOut}>
          <MaterialCommunityIcons name="logout-variant" size={22} color={INK} />
        </Pressable>
      </LinearGradient>
      <View style={styles.inbox}>
        <ConnectScreen />
      </View>
      <View style={[styles.nav, { paddingBottom: Math.max(10, insets.bottom) }]}>
        <View style={styles.navActive}>
          <MaterialCommunityIcons name="message-text" size={23} color="#437E0B" />
          <Text style={styles.navActiveLabel}>Connect</Text>
        </View>
        <Pressable style={styles.navAction} accessibilityRole="button" accessibilityLabel="Open Push-to-Talk" onPress={() => router.push('/personal-home/ptt')}>
          <MaterialCommunityIcons name="microphone" size={25} color={GREEN} />
          <Text style={styles.navLabel}>PTT Radio</Text>
        </Pressable>
        <Pressable style={styles.navAction} accessibilityRole="button" accessibilityLabel="Open notifications" onPress={() => router.push('/notifications')}>
          <MaterialCommunityIcons name="bell-outline" size={25} color={GREEN} />
          <Text style={styles.navLabel}>Alerts</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F9E9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F9E9' },
  loading: { color: INK, marginTop: 14 },
  header: { minHeight: 92, paddingHorizontal: 17, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  mark: { width: 46, height: 46, backgroundColor: '#EDFFD5', borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1 },
  kicker: { fontSize: 10, letterSpacing: 2.4, color: '#2A6013', fontWeight: '900' },
  title: { fontSize: 25, color: '#17370B', fontWeight: '900', lineHeight: 29 },
  subtitle: { fontSize: 11, fontWeight: '700', color: '#295D10', marginTop: 2 },
  signOut: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#E9FFD2', alignItems: 'center', justifyContent: 'center' },
  inbox: { flex: 1, overflow: 'hidden' },
  nav: { minHeight: 60, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#DDECCE', paddingTop: 5, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-around' },
  navActive: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F8D3', borderRadius: 17, paddingVertical: 5 },
  navAction: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 5 },
  navActiveLabel: { color: '#437E0B', fontSize: 11, fontWeight: '900', marginTop: 2 },
  navLabel: { color: '#507043', fontSize: 11, fontWeight: '700', marginTop: 2 },
});
