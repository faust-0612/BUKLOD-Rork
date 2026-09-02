import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { loadReferralSummary, type ReferralSummary } from '@/lib/buklodRewards';
import { withAlpha } from '@/lib/buklodContrast';

function buildInviteMessage(code: string) {
  return `Join me on BUKLOD — use my invite code ${code} when you sign up.`;
}

export default function BuklodReferralInviteCard() {
  const { theme } = useBuklodPresentation();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await loadReferralSummary());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyCode = async () => {
    if (!summary?.referral_code) return;
    await Clipboard.setStringAsync(summary.referral_code);
    Alert.alert('Copied', 'Invite code copied to clipboard.');
  };

  const shareInvite = async () => {
    if (!summary?.referral_code) return;
    try {
      await Share.share({
        title: 'Join BUKLOD',
        message: buildInviteMessage(summary.referral_code),
      });
    } catch {
      // user dismissed
    }
  };

  const styles = StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 8,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
      color: theme.textMuted,
    },
    title: {
      fontSize: 15,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    sub: {
      fontSize: 12,
      lineHeight: 17,
      color: theme.textMuted,
    },
    codeRow: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    codePill: {
      flex: 1,
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: withAlpha(theme.accent, 0.35),
      backgroundColor: withAlpha(theme.accentSoft, 0.65),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    codeText: {
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 2,
      color: theme.accent,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    actionBtn: {
      flex: 1,
      minHeight: 38,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      backgroundColor: theme.accent,
    },
    actionBtnOutline: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#fff',
    },
    actionTextOutline: {
      color: theme.textPrimary,
    },
    stats: {
      marginTop: 2,
      fontSize: 11,
      color: theme.textMuted,
    },
  });

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!summary?.referral_code) {
    return (
      <View style={styles.card}>
        <Text style={styles.sub}>
          Invite friends to BUKLOD. Your referral code will appear here once
          rewards are enabled on the server.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>INVITE FRIENDS</Text>
      <Text style={styles.title}>Share BUKLOD</Text>
      <Text style={styles.sub}>
        One-level referrals only. You earn when someone you invite qualifies.
      </Text>

      <View style={styles.codeRow}>
        <View style={styles.codePill}>
          <Text style={styles.codeText}>{summary.referral_code}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={() => void copyCode()} style={styles.actionBtn}>
          <MaterialCommunityIcons name="content-copy" size={14} color="#fff" />
          <Text style={styles.actionText}>COPY</Text>
        </Pressable>
        <Pressable
          onPress={() => void shareInvite()}
          style={[styles.actionBtn, styles.actionBtnOutline]}
        >
          <MaterialCommunityIcons
            name="share-variant-outline"
            size={14}
            color={theme.textPrimary}
          />
          <Text style={[styles.actionText, styles.actionTextOutline]}>
            SHARE
          </Text>
        </Pressable>
      </View>

      <Text style={styles.stats}>
        Invited {summary.invited_count} · Qualified {summary.qualified_count}
        {summary.was_referred ? ' · You joined via referral' : ''}
      </Text>
    </View>
  );
}
