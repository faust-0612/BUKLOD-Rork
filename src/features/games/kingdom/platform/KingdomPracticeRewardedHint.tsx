import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import {
  isBuklodRewardedAdAllowed,
} from '@/lib/buklodGlobalAdController';
import {
  showBuklodRewardedAd, warmBuklodRewardedAd,
} from '@/lib/buklodRewardedAds';

/**
 * Optional one-time practice hint, unlocked only on the SDK's EARNED_REWARD.
 * No BP, XP, cash, QMP or authenticated ledger grant is ever performed.
 * Does not gate proceeding to the next level or submitting current practice.
 */
export function KingdomPracticeRewardedHint({
  disabled, onHintEarned,
}: { disabled?: boolean; onHintEarned: () => void }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const allowed = Platform.OS === 'android' &&
    isBuklodRewardedAdAllowed('rewarded_kingdom_practice_hint');
  useEffect(() => {
    if (allowed) warmBuklodRewardedAd();
  }, [allowed]);
  if (!allowed) return null;
  const watch = async () => {
    if (disabled || busy || !isBuklodRewardedAdAllowed('rewarded_kingdom_practice_hint')) return;
    setBusy(true); setNotice('');
    try {
      const result = await showBuklodRewardedAd();
      if (result.earned) {
        onHintEarned();
      } else {
        setNotice(result.shown
          ? 'The hint unlocks only after completing the ad.'
          : 'Sponsor video unavailable. You can continue without it.');
      }
    } catch {
      setNotice('Sponsor video unavailable. Practice remains open.');
    } finally { setBusy(false); }
  };
  return (
    <>
      <Pressable accessibilityRole="button" disabled={disabled || busy}
        onPress={() => { void watch(); }}
        style={[styles.button, (disabled || busy) && styles.disabled]}>
        <Text style={styles.label}>{busy ? 'PREPARING VIDEO…' :
          'OPTIONAL • WATCH AD FOR 1 PRACTICE HINT'}</Text>
      </Pressable>
      {!!notice ? <Text accessibilityRole="alert" style={styles.note}>{notice}</Text> : null}
    </>
  );
}
const styles = StyleSheet.create({
  button: { backgroundColor:'#244e60',borderWidth:1,borderColor:'#d6bb7e',
    borderRadius:9,padding:12,alignItems:'center' },
  label: { color:'#ffe3b2',fontSize:11,fontWeight:'900' },
  note: { color:'#d6e6e9',fontSize:11,lineHeight:17 },
  disabled: { opacity:.45 },
});
