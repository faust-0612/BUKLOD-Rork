import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';

import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function BuklodReportAccessPendingScreen() {
  const {
    profile,
    membershipState,
    refreshProfile,
    refreshMembership,
    signOut,
  } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const copy = useMemo(() => {
    if (profile?.is_active === false) {
      return {
        title: 'Account inactive',
        body: 'This BUKLOD account is currently inactive. Contact a BUKLOD administrator before using BUKLOD Report.',
      };
    }
    if (!profile) {
      return {
        title: 'Account setup incomplete',
        body: 'Your authenticated BUKLOD account does not yet have a usable profile. Complete the normal BUKLOD account approval/setup process first.',
      };
    }
    if (membershipState === 'rejected') {
      return {
        title: 'Access not approved',
        body: 'The current BUKLOD membership request was not approved. BUKLOD Report cannot bypass the canonical account and membership rules.',
      };
    }
    if (membershipState === 'pending') {
      return {
        title: 'Approval pending',
        body: 'Your BUKLOD account or membership is still waiting for approval. BUKLOD Report will open automatically once the canonical account access becomes valid.',
      };
    }
    return {
      title: 'Report access unavailable',
      body: 'This account does not currently satisfy the canonical BUKLOD access rules required by the standalone Report app.',
    };
  }, [membershipState, profile]);

  const retry = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.allSettled([refreshProfile(), refreshMembership()]);
      router.replace('/' as any);
    } finally {
      setRefreshing(false);
    }
  };

  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/report-login' as any);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'BUKLOD Report Access' }} />
      <View style={styles.screen}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="shield-account-outline" size={34} color="#FFFFFF" />
        </View>
        <Text style={styles.eyebrow}>BUKLOD REPORT</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Canonical access is preserved</Text>
          <Text style={styles.cardText}>
            This standalone app shares BUKLOD account identity and Organization/Cluster memberships, but it does not bypass approval rules and does not change BUKLOD Main navigation or active scope.
          </Text>
        </View>

        <Pressable disabled={refreshing || signingOut} onPress={() => void retry()} style={[styles.primary, (refreshing || signingOut) && styles.disabled]}>
          {refreshing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="refresh" size={19} color="#FFFFFF" />}
          <Text style={styles.primaryText}>{refreshing ? 'Checking access…' : 'Check again'}</Text>
        </Pressable>

        <Pressable disabled={refreshing || signingOut} onPress={() => void logout()} style={[styles.secondary, (refreshing || signingOut) && styles.disabled]}>
          {signingOut ? <ActivityIndicator size="small" color={colors.greenDark} /> : <MaterialCommunityIcons name="logout" size={18} color={colors.greenDark} />}
          <Text style={styles.secondaryText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  iconWrap: {
    width: 66,
    height: 66,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenDark,
    marginBottom: 13,
  },
  eyebrow: { color: colors.greenDark, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 5, color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  body: { maxWidth: 480, marginTop: 9, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  card: { width: '100%', maxWidth: 480, marginTop: 22, borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 14, gap: 5 },
  cardTitle: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  cardText: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  primary: { width: '100%', maxWidth: 480, minHeight: 48, marginTop: 14, borderRadius: 12, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  secondary: { width: '100%', maxWidth: 480, minHeight: 46, marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
