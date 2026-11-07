import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet,
  Switch, Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

type Preferences = {
  welcome_to_network: boolean;
  birthday_to_network: boolean;
};

const DEFAULTS: Preferences = {
  welcome_to_network: true,
  birthday_to_network: false,
};

/** Own preferences only. No ability to change another account. */
export default function BuklodCelebrationsSettings() {
  const { user } = useAuth();
  const { theme } = useBuklodTheme();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState('');
  const userId = user?.id ?? '';

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!userId) {
      setLoading(false);
      setAvailable(false);
      return () => { active = false; };
    }
    setLoading(true);
    void withBuklodTimeout(
      supabase.from('buklod_living_celebration_preferences')
        .select('welcome_to_network,birthday_to_network')
        .eq('user_id', userId)
        .maybeSingle(),
      4500, 'BUKLOD celebrations privacy'
    ).then(({ data, error }: any) => {
      if (!active) return;
      if (error) {
        setAvailable(false);
        setStatus('Hindi pa available ang settings sa server. Hindi nabago ang privacy ng iyong account.');
      } else {
        setAvailable(true);
        setStatus('');
        setPrefs({
          welcome_to_network: data?.welcome_to_network !== false,
          birthday_to_network: data?.birthday_to_network === true,
        });
      }
    }).catch(() => {
      if (active) {
        setAvailable(false);
        setStatus('Hindi makuha ang settings sa ngayon. Subukan kapag online.');
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [userId]));

  async function save(which: keyof Preferences, enabled: boolean) {
    if (!userId || busy || !available) return;
    setBusy(true);
    setStatus('');
    const next = { ...prefs, [which]: enabled };
    try {
      const { error } = await withBuklodTimeout(
        supabase.from('buklod_living_celebration_preferences').upsert(
          { user_id: userId, ...next, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        ),
        6000, 'Save BUKLOD celebrations privacy'
      );
      if (error) throw error;
      setPrefs(next);
      setStatus('Nai-save ang iyong celebration preferences.');
    } catch {
      setStatus('Hindi na-save ang pagbabago. Nananatili ang dating preference.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.surface }}
      contentContainerStyle={styles.page}>
      <Pressable accessibilityRole="button" style={styles.back}
        onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={theme.textPrimary} />
        <Text style={{ color: theme.textPrimary, fontWeight: '800' }}>Bumalik</Text>
      </Pressable>
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        BUKLOD Celebrations
      </Text>
      <Text style={[styles.note, { color: theme.textMuted }]}>
        Ang personal na birthday greeting ay makikita mo sa sarili mong Wall.
        Piliin kung may welcome at birthday greeting na makikita rin
        ng followers at mga kasama sa iyong active Cluster o Organization.
      </Text>
      {loading ? <ActivityIndicator color={theme.accent} /> : null}
      <View style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.inputSurface }]}>
        <View style={styles.row}>
          <View style={styles.words}>
            <Text style={[styles.heading, { color: theme.textPrimary }]}>
              Welcome kapag sumali ako
            </Text>
            <Text style={[styles.description, { color: theme.textMuted }]}>
              Batiin ako kapag may bagong active membership sa Cluster o Organization.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Welcome greetings to my Cluster, Organization and followers"
            value={prefs.welcome_to_network}
            disabled={!available || loading || busy}
            onValueChange={next => void save('welcome_to_network', next)}
          />
        </View>
        <View style={[styles.separator, { backgroundColor: theme.border }]} />
        <View style={styles.row}>
          <View style={styles.words}>
            <Text style={[styles.heading, { color: theme.textPrimary }]}>
              Birthday greeting sa community
            </Text>
            <Text style={[styles.description, { color: theme.textMuted }]}>
              Sabihin lang na birthday mo ngayon. Hindi ibabahagi ang birth year o age.
              Default: naka-off, hanggang ikaw ang mag-enable.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Birthday greetings to my Cluster, Organization and followers"
            value={prefs.birthday_to_network}
            disabled={!available || loading || busy}
            onValueChange={next => void save('birthday_to_network', next)}
          />
        </View>
      </View>
      {!!status && (
        <Text accessibilityRole="text" style={{ color: theme.textMuted, fontSize: 13 }}>
          {status}
        </Text>
      )}
      <Text style={[styles.footer, { color: theme.textMuted }]}>
        Walang automatic posting sa pangalan mo. Kapag may bumati sa Connect,
        siya ang pipili kung magpapadala ng mensahe. Emergency notifications
        ay hiwalay dito at hindi naaapektuhan.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 17, paddingBottom: 40 },
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  title: { fontSize: 23, fontWeight: '900' },
  note: { fontSize: 14, lineHeight: 21 },
  panel: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 15 },
  row: { flexDirection: 'row', paddingVertical: 18, alignItems: 'center', gap: 12 },
  words: { flex: 1 },
  heading: { fontSize: 15, fontWeight: '800' },
  description: { fontSize: 12, lineHeight: 19, marginTop: 5 },
  separator: { height: 1 },
  footer: { fontSize: 12, lineHeight: 19 },
});
