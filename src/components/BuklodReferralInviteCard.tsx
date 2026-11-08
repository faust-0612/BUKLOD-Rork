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
import { router } from 'expo-router';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { loadReferralSummary, type ReferralSummary } from '@/lib/buklodRewards';
import { withAlpha } from '@/lib/buklodContrast';

function buildInviteMessage(code: string, username?: string | null) {
  if (username) {
    return `Join me on BUKLOD — when you create your account, type my account name ${username} (or invite code ${code}) in the referral bar.`;
  }
  return `Join me on BUKLOD — when you create your account, use my invite code ${code} in the referral bar.`;
}

type Props = {
  username?: string | null;
};

export default function BuklodReferralInviteCard({
  username = null,
}: Props) {
  const { theme } = useBuklodPresentation();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadReferralSummary();
      setSummary(next);
      if (!next?.referral_code) {
        setError(
          'Your invite code could not be loaded. Tap retry.',
        );
      }
    } catch (loadError: unknown) {
      setSummary(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load your invite details.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accountName = String(username ?? '').trim();
  const code = String(summary?.referral_code ?? '').trim();

  const copyCode = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', 'Invite code copied.');
  };

  const copyAccountName = async () => {
    if (!accountName) return;
    await Clipboard.setStringAsync(accountName);
    Alert.alert('Copied', 'Account name copied.');
  };

  const shareInvite = async () => {
    if (!code) return;
    try {
      await Share.share({
        title: 'Join BUKLOD',
        message: buildInviteMessage(code, accountName || null),
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
    identityRow: {
      marginTop: 2,
      borderWidth: 1,
      borderColor: withAlpha(theme.accent, 0.28),
      backgroundColor: withAlpha(theme.accentSoft, 0.5),
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 2,
    },
    identityLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: theme.textMuted,
    },
    identityValue: {
      fontSize: 16,
      fontWeight: '900',
      color: theme.accent,
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
    reportBtn: {
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: withAlpha(theme.accent, 0.24),
      backgroundColor: withAlpha(theme.accentSoft, 0.45),
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 7,
      marginTop: 2,
    },
    secondaryBtn: {
      minHeight: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 7,
    },
    reportText: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.accent,
    },
    secondaryText: {
      fontSize: 10.5,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    stats: {
      marginTop: 2,
      fontSize: 11,
      color: theme.textMuted,
    },
    economyNote: {
      fontSize: 10.5,
      lineHeight: 15,
      color: theme.textMuted,
    },
    errorText: {
      fontSize: 12,
      lineHeight: 17,
      color: '#9A3412',
      fontWeight: '700',
    },
  });

  const economyLinks = (
    <>
      <Pressable
        onPress={() => router.push('/bayanihan' as any)}
        style={({ pressed }) => [styles.reportBtn, pressed && { opacity: 0.76 }]}
      >
        <MaterialCommunityIcons name="chart-donut" size={16} color={theme.accent} />
        <Text style={styles.reportText}>VIEW MY ECONOMY REPORT</Text>
      </Pressable>
      <View style={styles.actionRow}>
        <Pressable
          onPress={() => router.push('/bayanihan/payout-profile' as any)}
          style={({ pressed }) => [styles.secondaryBtn, { flex: 1 }, pressed && { opacity: 0.76 }]}
        >
          <MaterialCommunityIcons name="cash-check" size={16} color={theme.textPrimary} />
          <Text style={styles.secondaryText}>PAYOUT PROFILE</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/bayanihan/withdrawals' as any)}
          style={({ pressed }) => [styles.secondaryBtn, { flex: 1 }, pressed && { opacity: 0.76 }]}
        >
          <MaterialCommunityIcons name="history" size={16} color={theme.textPrimary} />
          <Text style={styles.secondaryText}>HISTORY</Text>
        </Pressable>
      </View>
    </>
  );

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!code) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>INVITE FRIENDS</Text>
        <Text style={styles.title}>Share BUKLOD</Text>
        <Text style={styles.errorText}>
          {error ||
            'Your invite code is not ready yet. Tap retry to create it.'}
        </Text>
        {accountName ? (
          <Pressable onPress={() => void copyAccountName()} style={styles.identityRow}>
            <Text style={styles.identityLabel}>YOUR ACCOUNT NAME</Text>
            <Text style={styles.identityValue}>@{accountName}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => void load()}
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.8 }]}
        >
          <MaterialCommunityIcons name="refresh" size={14} color="#fff" />
          <Text style={styles.actionText}>RETRY</Text>
        </Pressable>
        {economyLinks}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>INVITE FRIENDS</Text>
      <Text style={styles.title}>Share BUKLOD</Text>
      <Text style={styles.sub}>
        Friends can type your BUKLOD account name or invite code when they
        create an account. Copy or share below.
      </Text>

      {accountName ? (
        <Pressable onPress={() => void copyAccountName()} style={styles.identityRow}>
          <Text style={styles.identityLabel}>YOUR ACCOUNT NAME</Text>
          <Text style={styles.identityValue}>@{accountName}</Text>
        </Pressable>
      ) : null}

      <View style={styles.codeRow}>
        <Pressable onPress={() => void copyCode()} style={styles.codePill}>
          <Text style={styles.codeText}>{code}</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        {accountName ? (
          <Pressable
            onPress={() => void copyAccountName()}
            style={[styles.actionBtn, styles.actionBtnOutline]}
          >
            <MaterialCommunityIcons
              name="account-outline"
              size={14}
              color={theme.textPrimary}
            />
            <Text style={[styles.actionText, styles.actionTextOutline]}>
              COPY NAME
            </Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => void copyCode()} style={styles.actionBtn}>
          <MaterialCommunityIcons name="content-copy" size={14} color="#fff" />
          <Text style={styles.actionText}>COPY CODE</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => void shareInvite()}
        style={({ pressed }) => [
          styles.actionBtn,
          { marginTop: 2 },
          pressed && { opacity: 0.84 },
        ]}
      >
        <MaterialCommunityIcons name="share-variant" size={14} color="#fff" />
        <Text style={styles.actionText}>SHARE INVITE</Text>
      </Pressable>

      <Text style={styles.stats}>
        Invited {summary?.invited_count ?? 0} · Qualified{' '}
        {summary?.qualified_count ?? 0}
        {summary?.was_referred ? ' · You joined via referral' : ''}
      </Text>
      {Number(summary?.legacy_unreconciled_count ?? 0) > 0 ? (
        <Text style={styles.economyNote}>
          {summary?.legacy_unreconciled_count} earlier invitation(s) are counted but awaiting
          financial reconciliation. Historical referrals are not withdrawable earnings.
        </Text>
      ) : null}
      {!!summary?.legacy_code && summary.legacy_code !== code ? (
        <Text style={styles.economyNote}>
          A previous invite code exists. Use the code above for NEW invitations;
          it matches Economy and Life Sharing.
        </Text>
      ) : null}
      <Text style={styles.economyNote}>
        Sharing and finance rewards are separate. Earnings are recognized only
        after official qualification, funding and settlement.
      </Text>

      {economyLinks}
    </View>
  );
}
