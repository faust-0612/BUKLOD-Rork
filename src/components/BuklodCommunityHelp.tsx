import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';

type HelpKind = 'HELP' | 'EMERGENCY';
type HelpCategory =
  | 'GENERAL'
  | 'MEDICAL'
  | 'FIRE'
  | 'ACCIDENT'
  | 'SAFETY'
  | 'DISASTER'
  | 'MISSING_PERSON'
  | 'OTHER';
type HelpResponse = 'CAN_HELP' | 'ON_MY_WAY' | 'CONFIRM_INCIDENT' | 'CANNOT_HELP' | 'FALSE_ALERT';

type NearbyHelp = {
  id: string;
  creator_id: string;
  kind: HelpKind;
  category: HelpCategory;
  message: string;
  status: string;
  distance_km: number | null;
  created_at: string;
  expires_at: string;
  can_help_count: number;
  on_my_way_count: number;
  confirm_count: number;
  my_response: HelpResponse | null;
};

const CATEGORIES: Array<{ key: HelpCategory; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: 'MEDICAL', label: 'Medical', icon: 'medical-bag' },
  { key: 'FIRE', label: 'Fire', icon: 'fire' },
  { key: 'ACCIDENT', label: 'Accident', icon: 'car-emergency' },
  { key: 'SAFETY', label: 'Safety', icon: 'shield-alert-outline' },
  { key: 'DISASTER', label: 'Disaster', icon: 'weather-hurricane' },
  { key: 'MISSING_PERSON', label: 'Missing', icon: 'account-search-outline' },
  { key: 'OTHER', label: 'Other', icon: 'alert-circle-outline' },
];

const HELP_CATEGORIES: Array<{ key: HelpCategory; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: 'GENERAL', label: 'General', icon: 'hand-heart-outline' },
  ...CATEGORIES,
];

function categoryLabel(value: HelpCategory) {
  return HELP_CATEGORIES.find((item) => item.key === value)?.label ?? 'Help';
}

function relativeAge(iso: string) {
  const ms = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return hr < 24 ? `${hr}h` : `${Math.floor(hr / 24)}d`;
}

export default function BuklodCommunityHelp() {
  const { user } = useAuth();
  const { colors } = useBuklodPresentation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearby, setNearby] = useState<NearbyHelp[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [kind, setKind] = useState<HelpKind>('HELP');
  const [category, setCategory] = useState<HelpCategory>('GENERAL');
  const [message, setMessage] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const registerPushToken = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const permission = await Notifications.getPermissionsAsync();
      let status = permission.status;
      if (status !== 'granted') {
        status = (await Notifications.requestPermissionsAsync()).status;
      }
      if (status !== 'granted') return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('buklod-emergency', {
          name: 'BUKLOD Emergency Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 300, 180, 300],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      const projectId =
        Constants.easConfig?.projectId ??
        (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);
      if (!projectId) return;
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      if (!token) return;
      await supabase.rpc('buklod_help_register_device_token', {
        p_token: token,
        p_platform: Platform.OS,
      });
    } catch {
      // The Community Wall must remain usable even if push registration is unavailable.
    }
  }, []);

  const refreshNearby = useCallback(async () => {
    if (!user?.id || !enabled) return;
    setLoadingNearby(true);
    try {
      const { data, error } = await supabase.rpc('buklod_help_list_nearby', { p_limit: 12 });
      if (error) throw error;
      if (mountedRef.current) setNearby((data ?? []) as NearbyHelp[]);
    } catch {
      if (mountedRef.current) setNearby([]);
    } finally {
      if (mountedRef.current) setLoadingNearby(false);
    }
  }, [enabled, user?.id]);

  const updatePresence = useCallback(async (showErrors = true) => {
    if (!user?.id) return null;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        if (showErrors) Alert.alert('Location needed', 'Nearby Help and SOS need your location to find BUKLOD users near you.');
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      const { error } = await supabase.rpc('buklod_help_update_presence', {
        p_latitude: coords.latitude,
        p_longitude: coords.longitude,
        p_enabled: true,
      });
      if (error) throw error;
      if (mountedRef.current) setEnabled(true);
      void registerPushToken();
      return coords;
    } catch (error: any) {
      if (showErrors) Alert.alert('Could not enable nearby alerts', String(error?.message ?? 'Please try again.'));
      return null;
    }
  }, [registerPushToken, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      try {
        const { data } = await supabase
          .from('buklod_help_presence')
          .select('safety_alerts_enabled,updated_at')
          .eq('user_id', user.id)
          .maybeSingle();
        const fresh = data?.updated_at && Date.now() - new Date(data.updated_at).getTime() < 60 * 60 * 1000;
        if (data?.safety_alerts_enabled && fresh && mountedRef.current) setEnabled(true);
      } catch {}
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!enabled) return;
    void refreshNearby();
    const refreshTimer = setInterval(() => void refreshNearby(), 20000);
    const presenceTimer = setInterval(() => void updatePresence(false), 5 * 60 * 1000);
    return () => {
      clearInterval(refreshTimer);
      clearInterval(presenceTimer);
    };
  }, [enabled, refreshNearby, updatePresence]);

  const openComposer = useCallback(async (nextKind: HelpKind) => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in before requesting help.');
      return;
    }
    setKind(nextKind);
    setCategory(nextKind === 'EMERGENCY' ? 'MEDICAL' : 'GENERAL');
    setMessage('');
    setComposerOpen(true);
  }, [user?.id]);

  const submit = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const coords = await updatePresence(true);
      if (!coords) return;
      const { data, error } = await supabase.rpc('buklod_help_create_request', {
        p_kind: kind,
        p_category: category,
        p_message: message.trim(),
        p_latitude: coords.latitude,
        p_longitude: coords.longitude,
      });
      if (error) throw error;
      const requestId = String(data ?? '');

      setComposerOpen(false);
      setMessage('');
      await refreshNearby();

      if (kind === 'EMERGENCY' && requestId) {
        const result = await supabase.functions.invoke('buklod-help-alert', {
          body: { request_id: requestId },
        });
        if (result.error) {
          Alert.alert(
            'SOS posted',
            'Your emergency is visible to nearby BUKLOD users. Push delivery could not be confirmed, so contact official emergency services too.'
          );
        } else {
          Alert.alert(
            'SOS sent',
            'Nearby eligible BUKLOD users were alerted. If you are in immediate danger, contact official emergency services as well.'
          );
        }
      }
    } catch (error: any) {
      const raw = String(error?.message ?? 'Please try again.');
      const friendly = raw.includes('ACTIVE_EMERGENCY_EXISTS')
        ? 'You already have an active emergency. Resolve it before sending another.'
        : raw.includes('PLEASE_WAIT_BEFORE_SENDING_AGAIN')
          ? 'Please wait a few seconds before sending another request.'
          : raw;
      Alert.alert(kind === 'EMERGENCY' ? 'SOS not sent' : 'Help request not sent', friendly);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [busy, category, kind, message, refreshNearby, updatePresence]);

  const respond = useCallback(async (requestId: string, responseType: HelpResponse) => {
    try {
      const { error } = await supabase.rpc('buklod_help_respond', {
        p_request_id: requestId,
        p_response_type: responseType,
      });
      if (error) throw error;
      await refreshNearby();
    } catch (error: any) {
      Alert.alert('Could not update response', String(error?.message ?? 'Please try again.'));
    }
  }, [refreshNearby]);

  const resolve = useCallback((requestId: string) => {
    Alert.alert('End this alert?', 'Use this when you are safe or no longer need help.', [
      { text: 'Keep active', style: 'cancel' },
      {
        text: "I'm safe / Resolve",
        onPress: async () => {
          const { error } = await supabase.rpc('buklod_help_resolve', {
            p_request_id: requestId,
            p_status: 'RESOLVED',
          });
          if (error) Alert.alert('Could not resolve alert', error.message);
          else await refreshNearby();
        },
      },
    ]);
  }, [refreshNearby]);

  const categoryOptions = kind === 'EMERGENCY' ? CATEGORIES : HELP_CATEGORIES;

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <View style={styles.brandBlock}>
          <MaterialCommunityIcons name="shield-heart-outline" size={17} color={colors.greenDark} />
          <View style={styles.brandCopy}>
            <Text style={styles.title}>BUKLOD HELP</Text>
            <Text style={styles.subtitle}>Ask nearby. Respond nearby.</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Request help from nearby BUKLOD users"
            onPress={() => void openComposer('HELP')}
            style={({ pressed }) => [styles.helpBtn, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="hand-heart-outline" size={16} color={colors.greenDark} />
            <Text style={styles.helpText}>Need Help</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open emergency SOS"
            onPress={() => void openComposer('EMERGENCY')}
            style={({ pressed }) => [styles.sosBtn, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="alarm-light-outline" size={16} color="#FFFFFF" />
            <Text style={styles.sosText}>SOS</Text>
          </Pressable>
        </View>
      </View>

      {!enabled ? (
        <Pressable onPress={() => void updatePresence(true)} style={styles.enableRow}>
          <MaterialCommunityIcons name="map-marker-radius-outline" size={14} color={colors.greenDark} />
          <Text style={styles.enableText}>Enable nearby safety alerts</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.muted} />
        </Pressable>
      ) : null}

      {enabled && (loadingNearby || nearby.length > 0) ? (
        <View style={styles.nearbyBlock}>
          <View style={styles.nearbyHeading}>
            <Text style={styles.nearbyTitle}>NEARBY NOW</Text>
            {loadingNearby ? <ActivityIndicator size="small" color={colors.green} /> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.alertRow}>
            {nearby.map((item) => {
              const mine = item.creator_id === user?.id;
              const emergency = item.kind === 'EMERGENCY';
              return (
                <View key={item.id} style={[styles.alertCard, emergency && styles.emergencyCard]}>
                  <View style={styles.alertTop}>
                    <MaterialCommunityIcons
                      name={emergency ? 'alarm-light' : 'hand-heart-outline'}
                      size={15}
                      color={emergency ? '#B42318' : colors.greenDark}
                    />
                    <Text style={[styles.alertKind, emergency && styles.emergencyText]}>
                      {emergency ? 'EMERGENCY' : 'NEED HELP'} · {categoryLabel(item.category)}
                    </Text>
                  </View>
                  <Text numberOfLines={2} style={styles.alertMessage}>
                    {item.message || (emergency ? 'Emergency assistance requested.' : 'A nearby BUKLOD member needs help.')}
                  </Text>
                  <Text style={styles.alertMeta}>
                    {mine ? 'Your alert' : `${Number(item.distance_km ?? 0).toFixed(1)} km away`} · {relativeAge(item.created_at)}
                  </Text>
                  <Text style={styles.signalMeta}>
                    {Number(item.on_my_way_count ?? 0)} going · {Number(item.confirm_count ?? 0)} confirmed
                  </Text>

                  {mine ? (
                    <Pressable onPress={() => resolve(item.id)} style={styles.resolveBtn}>
                      <Text style={styles.resolveText}>I'M SAFE / RESOLVE</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.responseRow}>
                      <Pressable
                        onPress={() => void respond(item.id, 'CAN_HELP')}
                        style={[styles.responseBtn, item.my_response === 'CAN_HELP' && styles.responseBtnOn]}
                      >
                        <Text style={[styles.responseText, item.my_response === 'CAN_HELP' && styles.responseTextOn]}>CAN HELP</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void respond(item.id, 'ON_MY_WAY')}
                        style={[styles.responseBtn, item.my_response === 'ON_MY_WAY' && styles.responseBtnOn]}
                      >
                        <Text style={[styles.responseText, item.my_response === 'ON_MY_WAY' && styles.responseTextOn]}>ON MY WAY</Text>
                      </Pressable>
                      {emergency ? (
                        <Pressable onPress={() => void respond(item.id, 'CONFIRM_INCIDENT')} style={styles.iconResponseBtn}>
                          <MaterialCommunityIcons name="check-decagram-outline" size={15} color={colors.greenDark} />
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={() => !busy && setComposerOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, kind === 'EMERGENCY' && styles.emergencyText]}>
                  {kind === 'EMERGENCY' ? 'Emergency SOS' : 'Need Help'}
                </Text>
                <Text style={styles.sheetHint}>
                  {kind === 'EMERGENCY'
                    ? 'BUKLOD community alert — not a replacement for official emergency services.'
                    : 'Nearby BUKLOD users can see and respond to your request.'}
                </Text>
              </View>
              <Pressable disabled={busy} onPress={() => setComposerOpen(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {categoryOptions.map((item) => {
                const selected = item.key === category;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setCategory(item.key)}
                    style={[styles.categoryChip, selected && styles.categoryChipOn]}
                  >
                    <MaterialCommunityIcons name={item.icon} size={14} color={selected ? '#FFFFFF' : colors.greenDark} />
                    <Text style={[styles.categoryText, selected && styles.categoryTextOn]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.fieldLabel}>DETAILS {kind === 'EMERGENCY' ? '(OPTIONAL)' : ''}</Text>
            <TextInput
              value={message}
              onChangeText={(value) => setMessage(value.slice(0, 500))}
              editable={!busy}
              multiline
              placeholder={kind === 'EMERGENCY' ? 'Short detail if you can type safely…' : 'What kind of help do you need?'}
              placeholderTextColor={colors.muted}
              style={styles.input}
            />

            {kind === 'EMERGENCY' ? (
              <>
                <Text style={styles.safetyNote}>Your exact location is used for proximity matching. Nearby users receive distance/area context, not your raw coordinates.</Text>
                <Pressable
                  disabled={busy}
                  delayLongPress={1800}
                  onLongPress={() => void submit()}
                  style={({ pressed }) => [styles.holdSos, pressed && { opacity: 0.8 }, busy && { opacity: 0.55 }]}
                >
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="gesture-tap-hold" size={20} color="#FFFFFF" />}
                  <Text style={styles.holdSosText}>{busy ? 'SENDING…' : 'HOLD TO SEND SOS'}</Text>
                </Pressable>
                <Text style={styles.holdHint}>Hold for about 2 seconds to prevent accidental emergency alerts.</Text>
              </>
            ) : (
              <Pressable disabled={busy} onPress={() => void submit()} style={[styles.submitHelp, busy && { opacity: 0.55 }]}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="send" size={17} color="#FFFFFF" />}
                <Text style={styles.submitHelpText}>{busy ? 'POSTING…' : 'ASK NEARBY'}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useBuklodPresentation>['colors']) {
  return StyleSheet.create({
    wrap: { marginTop: 5, marginBottom: 10 },
    bar: {
      minHeight: 52,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      backgroundColor: colors.white,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    brandBlock: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
    brandCopy: { flex: 1, minWidth: 0 },
    title: { color: colors.greenDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
    subtitle: { color: colors.muted, fontSize: 8.5, fontWeight: '700', marginTop: 1 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    helpBtn: { height: 34, paddingHorizontal: 10, borderRadius: 17, backgroundColor: `${colors.green}12`, flexDirection: 'row', alignItems: 'center', gap: 5 },
    helpText: { color: colors.greenDark, fontSize: 9.5, fontWeight: '900' },
    sosBtn: { height: 34, minWidth: 62, paddingHorizontal: 10, borderRadius: 17, backgroundColor: '#B42318', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
    sosText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
    pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
    enableRow: { marginTop: 6, minHeight: 32, paddingHorizontal: 9, borderRadius: 10, backgroundColor: `${colors.green}0C`, flexDirection: 'row', alignItems: 'center', gap: 6 },
    enableText: { flex: 1, color: colors.greenDark, fontSize: 9, fontWeight: '800' },
    nearbyBlock: { marginTop: 8 },
    nearbyHeading: { minHeight: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    nearbyTitle: { color: colors.muted, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 },
    alertRow: { gap: 8, paddingRight: 10 },
    alertCard: { width: 246, minHeight: 142, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.white, padding: 10 },
    emergencyCard: { borderColor: '#F2B8B5', backgroundColor: '#FFF9F8' },
    alertTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    alertKind: { flex: 1, color: colors.greenDark, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.2 },
    emergencyText: { color: '#B42318' },
    alertMessage: { color: colors.text, fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 7, minHeight: 30 },
    alertMeta: { color: colors.muted, fontSize: 8.5, fontWeight: '700', marginTop: 5 },
    signalMeta: { color: colors.muted, fontSize: 8, fontWeight: '700', marginTop: 2 },
    responseRow: { flexDirection: 'row', gap: 5, marginTop: 9 },
    responseBtn: { minHeight: 28, paddingHorizontal: 8, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    responseBtnOn: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
    responseText: { color: colors.greenDark, fontSize: 7.5, fontWeight: '900' },
    responseTextOn: { color: '#FFFFFF' },
    iconResponseBtn: { width: 30, height: 28, borderRadius: 14, backgroundColor: `${colors.green}12`, alignItems: 'center', justifyContent: 'center' },
    resolveBtn: { marginTop: 9, minHeight: 29, borderRadius: 15, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center' },
    resolveText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
    backdrop: { flex: 1, backgroundColor: 'rgba(7,15,10,0.55)', justifyContent: 'flex-end' },
    sheet: { maxHeight: '86%', borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.white, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 22 },
    sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
    sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
    sheetHint: { maxWidth: 310, color: colors.muted, fontSize: 9.5, lineHeight: 13, fontWeight: '650', marginTop: 3 },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: `${colors.text}08`, alignItems: 'center', justifyContent: 'center' },
    fieldLabel: { color: colors.muted, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7, marginBottom: 6, marginTop: 3 },
    categoryRow: { gap: 7, paddingBottom: 12 },
    categoryChip: { minHeight: 34, paddingHorizontal: 10, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 5 },
    categoryChipOn: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
    categoryText: { color: colors.greenDark, fontSize: 9, fontWeight: '850' },
    categoryTextOn: { color: '#FFFFFF' },
    input: { minHeight: 92, maxHeight: 150, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 11, paddingVertical: 10, color: colors.text, fontSize: 12, lineHeight: 17, textAlignVertical: 'top', marginBottom: 12 },
    safetyNote: { color: colors.muted, fontSize: 9, lineHeight: 13, fontWeight: '650', marginBottom: 11 },
    holdSos: { minHeight: 50, borderRadius: 16, backgroundColor: '#B42318', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    holdSosText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
    holdHint: { color: colors.muted, fontSize: 8.5, textAlign: 'center', fontWeight: '650', marginTop: 6 },
    submitHelp: { minHeight: 48, borderRadius: 16, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    submitHelpText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.3 },
  });
}
