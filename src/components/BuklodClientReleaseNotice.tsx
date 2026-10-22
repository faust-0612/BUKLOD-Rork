/* User-visible upgrade notice. Never blocks access without an approved native replacement. */
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { useAuth } from '@/providers/AuthProvider';
import { notifyBuklodBsocClientR1 } from '@/lib/buklodBsocClientSafetyR1';

export async function checkForApprovedBuklodOtaR1(): Promise<void> {
  if (Platform.OS === 'web') {
    Alert.alert('BUKLOD Web', 'Buksan muli ang official BUKLOD website para sa latest web version.');
    return;
  }
  if (__DEV__ || !Updates.isEnabled) {
    Alert.alert('Update not available here', 'Gamitin ang approved production APK para sa official OTA updates.');
    return;
  }
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      Alert.alert('Walang compatible OTA', 'Walang bagong compatible update para sa native runtime na ito. Kung outdated ang APK, kailangan ang latest approved installer.');
      return;
    }
    const result = await Updates.fetchUpdateAsync();
    if (!result.isNew) {
      Alert.alert('Update status', 'Walang bagong downloaded update sa device.');
      return;
    }
    Alert.alert('BUKLOD update downloaded', 'Handa na ang official compatible OTA. I-restart ang app para i-apply?', [
      { text: 'Mamaya', style: 'cancel' },
      { text: 'Restart & Apply', onPress: () => { void Updates.reloadAsync(); } },
    ]);
  } catch {
    Alert.alert('Update check failed', 'Hindi makontak ang update service. Maaari mong subukan ulit mamaya; hindi maaapektuhan ang kasalukuyang app.');
  }
}

export default function BuklodClientReleaseNotice() {
  const { config } = useRuntimeConfig();
  const { user } = useAuth();
  const [dismissedFor, setDismissedFor] = useState('');
  const [busy, setBusy] = useState(false);
  const recommended = config?.recommended_version ?? '';
  const visible = Boolean(user?.id && config?.update_recommended && !config.update_required &&
    recommended && recommended !== dismissedFor);

  useEffect(() => {
    if (visible) {
      void notifyBuklodBsocClientR1('UPGRADE_NOTICE', 'APP_VERSION_OLD', 'REPORTED');
    }
  }, [visible, recommended]);

  if (!visible) return null;
  return (
    <View style={styles.notice} accessibilityRole="alert">
      <View style={styles.copy}>
        <Text style={styles.heading}>May bagong approved BUKLOD version</Text>
        <Text style={styles.description}>{config?.update_message ||
          ('Recommended version: ' + recommended + '. I-check ang compatible update.')}</Text>
      </View>
      <Pressable style={styles.action} disabled={busy} onPress={async () => {
        if (busy) return;
        setBusy(true);
        try { await checkForApprovedBuklodOtaR1(); } finally { setBusy(false); }
      }}>
        <Text style={styles.actionText}>{busy ? 'Checking...' : 'CHECK UPDATE'}</Text>
      </Pressable>
      <Pressable accessibilityLabel="Remind me later" onPress={() => setDismissedFor(recommended)}>
        <Text style={styles.later}>Later</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  notice: { backgroundColor:'#EFF7EF',borderBottomColor:'#AFCDB0',borderBottomWidth:1,
    flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:10,paddingVertical:7 },
  copy: {flex:1},
  heading: {fontSize:12,fontWeight:'800',color:'#1D5034'},
  description: {fontSize:10,color:'#29563A'},
  action: {paddingVertical:8,paddingHorizontal:9,backgroundColor:'#23623D',borderRadius:8},
  actionText: {fontSize:10,color:'#FFFFFF',fontWeight:'800'},
  later: {fontSize:10,color:'#315E41',paddingVertical:8}
});
