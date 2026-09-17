import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '@/lib/theme';
import {
  armBuklodSosReadyNotification,
  disarmBuklodSosReadyNotification,
  ensureBuklodEmergencyChannel,
  getBuklodEmergencyAlertModeState,
  isBuklodSosReadyNotificationArmed,
  openBuklodDndAccessSettings,
  openBuklodNotificationSettings,
  rebuildBuklodEmergencyChannelForDnd,
  registerBuklodEmergencyNotificationCategory,
  registerBuklodSosTriggerCategory,
  sendBuklodEmergencyLocalTest,
  type BuklodEmergencyAlertModeState,
} from '@/lib/buklodEmergencyAlertMode';

const EMPTY: BuklodEmergencyAlertModeState = {
  platform: Platform.OS,
  supported: Platform.OS === 'android' || Platform.OS === 'ios',
  channelReady: false,
  bypassDnd: false,
  importance: null,
  nativeDndPermissionReady: false,
  nativeVersionCode: null,
};

export default function BuklodEmergencyAlertModeCard() {
  const [state, setState] = useState<BuklodEmergencyAlertModeState>(EMPTY);
  const [sosReadyArmed, setSosReadyArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const awaitingDndSetup = useRef(false);

  const refresh = useCallback(async () => {
    try {
      if (Platform.OS === 'android') await ensureBuklodEmergencyChannel();
      await registerBuklodEmergencyNotificationCategory();
      await registerBuklodSosTriggerCategory();
      const [nextState, armed] = await Promise.all([
        getBuklodEmergencyAlertModeState(),
        isBuklodSosReadyNotificationArmed(),
      ]);
      setState(nextState);
      setSosReadyArmed(armed);
    } catch {
      setState(EMPTY);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', next => {
      if (next !== 'active') return;
      if (awaitingDndSetup.current && Platform.OS === 'android') {
        awaitingDndSetup.current = false;
        void (async () => {
          setBusy(true);
          try {
            setState(await rebuildBuklodEmergencyChannelForDnd());
          } finally {
            setBusy(false);
          }
        })();
        return;
      }
      void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;

  const enableDnd = async () => {
    if (!state.nativeDndPermissionReady) {
      Alert.alert(
        'Native app update required',
        'MAX-priority Emergency Alert Mode works now, but Android Do Not Disturb override requires BUKLOD Main build 21 or newer.',
      );
      return;
    }

    setBusy(true);
    try {
      await ensureBuklodEmergencyChannel();
      awaitingDndSetup.current = true;
      await openBuklodDndAccessSettings();
    } catch (error: any) {
      awaitingDndSetup.current = false;
      Alert.alert('Emergency Alert Mode', String(error?.message ?? 'Could not open Android emergency alert settings.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleSosReady = async () => {
    setBusy(true);
    try {
      if (sosReadyArmed) {
        await disarmBuklodSosReadyNotification();
        setSosReadyArmed(false);
        Alert.alert('SOS Ready shortcut off', 'The lock-screen notification shortcut was removed. In-app SOS remains available.');
      } else {
        await armBuklodSosReadyNotification();
        setSosReadyArmed(true);
        Alert.alert(
          'SOS Ready shortcut armed',
          'BUKLOD added an optional notification/lock-screen entry point. Opening it never sends automatically; the verified SOS screen still requires the deliberate hold and device-owner check.',
        );
      }
    } catch (error: any) {
      Alert.alert('SOS Ready shortcut', String(error?.message ?? 'Could not update the SOS shortcut.'));
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    setBusy(true);
    try {
      await sendBuklodEmergencyLocalTest();
      Alert.alert(
        'Private test sent',
        'This alert is only on your phone. It does not create an SOS and does not notify nearby BUKLOD users.',
      );
    } catch (error: any) {
      Alert.alert('Test alert unavailable', String(error?.message ?? 'Please check notification permissions.'));
    } finally {
      setBusy(false);
    }
  };

  const androidReady = Platform.OS === 'android' && state.channelReady;
  const status = Platform.OS === 'android'
    ? state.bypassDnd
      ? 'DND OVERRIDE ACTIVE'
      : !state.nativeDndPermissionReady
        ? 'MAX ALERT MODE READY · DND NATIVE UPDATE PENDING'
        : androidReady
          ? 'ALARM CHANNEL READY · DND OVERRIDE OFF'
          : 'SETUP NEEDED'
    : 'TIME-SENSITIVE ALERTS';

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="alarm-light-outline" size={17} color="#B42318" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>EMERGENCY ALERT MODE</Text>
          <Text style={[styles.status, state.bypassDnd && styles.statusOn]}>{status}</Text>
        </View>
      </View>

      <Text style={styles.body}>
        {Platform.OS === 'android'
          ? 'Uses a separate MAX-priority emergency channel with strong vibration and alarm audio behavior. DND override is opt-in and requires Android Notification Policy access.'
          : 'BUKLOD SOS uses Time Sensitive delivery on iPhone. Silent-mode bypass requires Apple Critical Alerts approval and is not claimed by this mode.'}
      </Text>

      <View style={styles.actions}>
        {Platform.OS === 'android' ? (
          <Pressable
            disabled={busy}
            onPress={enableDnd}
            style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed, !state.nativeDndPermissionReady && styles.pending]}
          >
            <MaterialCommunityIcons name="shield-alert-outline" size={14} color="#FFF" />
            <Text style={styles.primaryText}>
              {state.bypassDnd ? 'RECHECK DND' : state.nativeDndPermissionReady ? 'ENABLE DND OVERRIDE' : 'DND: NEXT APP BUILD'}
            </Text>
          </Pressable>
        ) : (
          <Pressable disabled={busy} onPress={() => void openBuklodNotificationSettings()} style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed]}>
            <Text style={styles.primaryText}>NOTIFICATION SETTINGS</Text>
          </Pressable>
        )}
        <Pressable disabled={busy} onPress={() => void toggleSosReady()} style={({ pressed }) => [styles.secondary, (pressed || busy) && styles.pressed, sosReadyArmed && styles.secondaryOn]}>
          <MaterialCommunityIcons name={sosReadyArmed ? 'lock-open-alert-outline' : 'lock-alert-outline'} size={14} color={colors.greenDark} />
          <Text style={styles.secondaryText}>{sosReadyArmed ? 'SOS READY ON' : 'ARM LOCK-SCREEN SOS'}</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={runTest} style={({ pressed }) => [styles.secondary, (pressed || busy) && styles.pressed]}>
          <MaterialCommunityIcons name="cellphone-sound" size={14} color={colors.greenDark} />
          <Text style={styles.secondaryText}>TEST THIS PHONE</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>
        SOS Ready is a shortcut only; opening it never broadcasts automatically. The verified SOS flow still requires a deliberate hold and device-owner authentication when available.
        {Platform.OS === 'android' && state.nativeVersionCode ? ` Native build: ${state.nativeVersionCode}.` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E7B8B3', backgroundColor: '#FFF8F7', gap: 7 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FEE4E2', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { fontSize: 10.5, fontWeight: '900', letterSpacing: .35, color: '#7A271A' },
  status: { marginTop: 1, fontSize: 8.5, fontWeight: '800', color: '#B54708' },
  statusOn: { color: '#067647' },
  body: { fontSize: 10, lineHeight: 14, color: '#69413A' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  primary: { minHeight: 31, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#B42318', flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  pending: { backgroundColor: '#B54708' },
  primaryText: { color: '#FFF', fontSize: 8.5, fontWeight: '900', letterSpacing: .2 },
  secondary: { minHeight: 31, paddingHorizontal: 10, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: '#B7D1BF', backgroundColor: '#FFF', flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  secondaryOn: { backgroundColor: '#EAF6ED' },
  secondaryText: { color: colors.greenDark, fontSize: 8.5, fontWeight: '900', letterSpacing: .2 },
  note: { fontSize: 8.5, lineHeight: 12.5, color: '#8A5A50' },
  pressed: { opacity: .68 },
});
