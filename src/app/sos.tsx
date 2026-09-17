import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  setNextBuklodEmergencyTriggerContext,
  type BuklodEmergencyTriggerSource,
} from '@/lib/buklodEmergencyTriggerFetch';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type SosCategory =
  | 'MEDICAL'
  | 'FIRE'
  | 'ACCIDENT'
  | 'SAFETY'
  | 'DISASTER'
  | 'MISSING_PERSON'
  | 'OTHER';

const CATEGORIES: Array<{
  key: SosCategory;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}> = [
  { key: 'MEDICAL', label: 'Medical', icon: 'medical-bag' },
  { key: 'FIRE', label: 'Fire', icon: 'fire' },
  { key: 'ACCIDENT', label: 'Accident', icon: 'car-emergency' },
  { key: 'SAFETY', label: 'Safety', icon: 'shield-alert-outline' },
  { key: 'DISASTER', label: 'Disaster', icon: 'weather-hurricane' },
  { key: 'MISSING_PERSON', label: 'Missing', icon: 'account-search-outline' },
  { key: 'OTHER', label: 'Other', icon: 'alert-circle-outline' },
];

function normalizeTriggerSource(value: unknown): BuklodEmergencyTriggerSource {
  const source = String(Array.isArray(value) ? value[0] : value ?? '')
    .trim()
    .toLowerCase();

  if (source === 'quick_tile') return 'QUICK_TILE';
  if (source === 'lockscreen_action') return 'LOCKSCREEN_ACTION';
  if (source === 'app_shortcut') return 'APP_SHORTCUT';
  if (source === 'deep_link') return 'DEEP_LINK';
  return 'IN_APP';
}

export default function BuklodSosScreen() {
  const params = useLocalSearchParams<{ trigger?: string }>();
  const { user } = useAuth();
  const source = useMemo(
    () => normalizeTriggerSource(params.trigger),
    [params.trigger],
  );

  const [category, setCategory] = useState<SosCategory>('MEDICAL');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentId, setSentId] = useState('');
  const inFlight = useRef(false);

  const sendSos = async () => {
    if (inFlight.current || sending || sentId) return;
    if (!user?.id) {
      Alert.alert(
        'Sign in required',
        'BUKLOD must know which account sent the emergency alert. Sign in first, then trigger SOS again.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'SIGN IN',
            onPress: () => router.replace('/(auth)/login' as any),
          },
        ],
      );
      return;
    }

    inFlight.current = true;
    setSending(true);

    try {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (foreground.status !== 'granted') {
        throw new Error(
          'Location permission is required so BUKLOD can trace and route this emergency alert to nearby responders.',
        );
      }

      let position: Location.LocationObject | null = null;
      try {
        position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
      } catch {
        position = await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
          requiredAccuracy: 500,
        });
      }

      if (!position) {
        throw new Error(
          'BUKLOD could not obtain a usable location. Move where GPS/network location is available and try again.',
        );
      }

      setNextBuklodEmergencyTriggerContext({
        source,
        locationAccuracyMeters:
          typeof position.coords.accuracy === 'number'
            ? position.coords.accuracy
            : null,
      });

      const { data, error } = await supabase.rpc('buklod_help_create_request', {
        p_kind: 'EMERGENCY',
        p_category: category,
        p_message: message.trim(),
        p_latitude: position.coords.latitude,
        p_longitude: position.coords.longitude,
      });

      if (error) {
        if (
          String(error.message ?? '').includes('BUKLOD_SOS_DEVICE_AUTH_REQUIRED') ||
          String(error.message ?? '').includes('SOS_DEVICE_AUTH_REQUIRED')
        ) {
          throw new Error(
            'SOS was NOT sent because device-owner verification was cancelled or failed. Hold the button again and complete fingerprint, Face ID, or device authentication.',
          );
        }
        throw error;
      }

      const requestId = String(data ?? '').trim();
      if (!requestId) throw new Error('Emergency request ID was not returned.');

      const alertResult = await supabase.functions.invoke('buklod-help-alert', {
        body: { request_id: requestId },
      });

      setSentId(requestId);

      Alert.alert(
        alertResult.error ? 'SOS active' : 'SOS sent',
        alertResult.error
          ? 'Your emergency is active in BUKLOD, but push delivery could not be confirmed. Use official emergency services too when immediate danger exists.'
          : 'BUKLOD recorded your account, trigger source, device-auth assurance, time, and location for this emergency and alerted eligible nearby users.',
      );
    } catch (error: any) {
      Alert.alert(
        'SOS not sent',
        String(error?.message ?? error ?? 'Please try again.'),
      );
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>BUKLOD EMERGENCY</Text>
          <Text style={styles.title}>Verified SOS</Text>
        </View>
        <View style={styles.shield}>
          <MaterialCommunityIcons name="shield-key-outline" size={22} color="#FFFFFF" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.assuranceCard}>
          <MaterialCommunityIcons name="fingerprint" size={27} color={colors.green} />
          <View style={{ flex: 1 }}>
            <Text style={styles.assuranceTitle}>Identity assurance before dispatch</Text>
            <Text style={styles.assuranceBody}>
              On a supported native device, BUKLOD requires fingerprint, Face ID,
              or device authentication before sending. Your BUKLOD password is not stored by this SOS gate.
            </Text>
          </View>
        </View>

        <View style={styles.traceCard}>
          <Text style={styles.traceTitle}>TRACE RECORD</Text>
          <Text style={styles.traceText}>Account session · trigger source · device installation · timestamp · GPS location/accuracy</Text>
          <Text style={styles.traceSource}>Trigger: {source.replaceAll('_', ' ')}</Text>
        </View>

        <Text style={styles.label}>EMERGENCY TYPE</Text>
        <View style={styles.categories}>
          {CATEGORIES.map((item) => {
            const selected = category === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                onPress={() => setCategory(item.key)}
                style={[styles.category, selected && styles.categorySelected]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={17}
                  color={selected ? '#FFFFFF' : colors.green}
                />
                <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>DETAILS (OPTIONAL)</Text>
        <TextInput
          value={message}
          onChangeText={(value) => setMessage(value.slice(0, 500))}
          editable={!sending && !sentId}
          multiline
          placeholder="Short detail if you can type safely…"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        {sentId ? (
          <View style={styles.sentCard}>
            <MaterialCommunityIcons name="check-decagram" size={28} color={colors.green} />
            <Text style={styles.sentTitle}>SOS IS ACTIVE</Text>
            <Text style={styles.sentBody}>Request ID: {sentId}</Text>
            <Pressable onPress={() => router.replace('/' as any)} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>RETURN TO BUKLOD</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hold to verify and send SOS"
              disabled={sending}
              delayLongPress={1800}
              onLongPress={() => void sendSos()}
              style={({ pressed }) => [
                styles.sosButton,
                pressed && styles.sosButtonPressed,
                sending && styles.sosButtonDisabled,
              ]}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons name="gesture-tap-hold" size={25} color="#FFFFFF" />
              )}
              <Text style={styles.sosButtonText}>
                {sending ? 'VERIFYING / SENDING…' : 'HOLD TO VERIFY & SEND SOS'}
              </Text>
            </Pressable>
            <Text style={styles.hint}>
              Hold for about 2 seconds. This reduces accidental alerts; the device-owner check follows immediately.
            </Text>
          </>
        )}

        <Text style={styles.safetyNote}>
          BUKLOD community SOS does not replace official emergency services. If there is immediate danger, contact the appropriate local emergency service as well.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF9F8' },
  header: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6D5D2',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  eyebrow: { color: '#B42318', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 2, color: colors.text, fontSize: 23, fontWeight: '900' },
  shield: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B42318',
  },
  content: { padding: 16, paddingBottom: 36 },
  assuranceCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E7DD',
  },
  assuranceTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  assuranceBody: { marginTop: 4, color: colors.muted, fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
  traceCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#1E2420',
  },
  traceTitle: { color: '#CFE6D5', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  traceText: { marginTop: 5, color: '#FFFFFF', fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
  traceSource: { marginTop: 6, color: '#AFC4B5', fontSize: 9, fontWeight: '800' },
  label: { marginTop: 18, marginBottom: 8, color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E2DC',
  },
  categorySelected: { backgroundColor: colors.green, borderColor: colors.green },
  categoryText: { color: colors.green, fontSize: 10, fontWeight: '900' },
  categoryTextSelected: { color: '#FFFFFF' },
  input: {
    minHeight: 92,
    maxHeight: 150,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2CECA',
    backgroundColor: '#FFFFFF',
    color: colors.text,
    textAlignVertical: 'top',
    fontSize: 12,
    lineHeight: 17,
  },
  sosButton: {
    marginTop: 20,
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#B42318',
  },
  sosButtonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  sosButtonDisabled: { opacity: 0.62 },
  sosButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
  hint: { marginTop: 7, textAlign: 'center', color: colors.muted, fontSize: 9, lineHeight: 13, fontWeight: '700' },
  safetyNote: { marginTop: 18, color: '#7A4941', fontSize: 9.5, lineHeight: 14, fontWeight: '700' },
  sentCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CFE6D5',
  },
  sentTitle: { marginTop: 7, color: colors.green, fontSize: 15, fontWeight: '900' },
  sentBody: { marginTop: 4, color: colors.muted, fontSize: 9.5, fontWeight: '700' },
  doneButton: { marginTop: 14, minHeight: 42, paddingHorizontal: 18, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green },
  doneButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
});
