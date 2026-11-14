import React, { useState } from 'react';
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import {
  generateSmartDrawerRecoveryKey,
  shareSmartDrawerBackup,
  restoreSmartDrawerBackup,
} from '@/lib/smartDrawer/portableBackup';

// Uses Android's Google Drive document provider; no OAuth token or automatic
// cloud sync. All archives are encrypted locally and bound to their BUKLOD owner.
export default function SmartDrawerCloudBackup() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const accountId = user?.id ?? '';

  const permitted = () => {
    if (!accountId) { setNotice('Sign in to the account that owns these notes.'); return false; }
    if (!/^[0-9a-fA-F]{64}$/.test(key.trim())) {
      setNotice('Enter or generate the complete 64-character recovery key.');
      return false;
    }
    return true;
  };
  const generate = async () => {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      setKey(await generateSmartDrawerRecoveryKey());
      setNotice('Keep your recovery key somewhere private. A lost key cannot be recovered.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Key generation failed.');
    } finally { setBusy(false); }
  };
  const copy = async () => {
    if (!permitted()) return;
    await Clipboard.setStringAsync(key.trim());
    setNotice('Copied. Clear the key from your clipboard when you have stored it securely.');
  };
  const exportBackup = async () => {
    if (busy || !permitted()) return;
    setBusy(true); setNotice('');
    try {
      const result = await shareSmartDrawerBackup(accountId, key);
      setNotice('Encrypted backup for ' + result.count + ' items prepared. Choose Google Drive in Android Share to save it.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Backup export failed.');
    } finally { setBusy(false); }
  };
  const restore = () => {
    if (busy || !permitted()) return;
    Alert.alert('Restore private notes?',
      'Choose an encrypted backup in Android Files or Google Drive. Only the original BUKLOD account can restore it. Existing notes are preserved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose backup', onPress: () => {
        void (async () => {
          setBusy(true); setNotice('');
          try {
            const r = await restoreSmartDrawerBackup(accountId, key);
            setNotice(r.canceled ? 'Canceled; nothing changed.' : 'Restored ' + r.restored + ' notes, skipped ' + r.skipped + ' existing notes.');
          } catch (e) {
            setNotice(e instanceof Error ? e.message : 'Restore failed.');
          } finally { setBusy(false); }
        })();
      } },
    ]);
  };
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={24} color="#173B2E" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Encrypted Drive backup</Text>
          <Text style={s.small}>Android document provider — manual transfer</Text>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={s.heading}>Private, encrypted, and in your control</Text>
        <Text style={s.body}>Generate a key, export an encrypted archive, then select Google Drive from Android Share. To restore, open the backup through Android Files or the Google Drive provider. Google Drive needs to be available on your device.</Text>
        <Text style={s.heading}>Recovery key</Text>
        <Text style={s.body}>Keep your key separately. BUKLOD cannot recover it and never uploads the key.</Text>
        <TextInput
          value={key} onChangeText={setKey} secureTextEntry
          autoCapitalize="none" autoCorrect={false} selectTextOnFocus
          editable={!busy} placeholder="64-character recovery key"
          placeholderTextColor="#6E897A" style={s.input}
          accessibilityLabel="Private 64-character backup recovery key"
        />
        <View style={s.actions}>
          <Pressable disabled={busy} onPress={() => void generate()} style={s.secondary}>
            <Text style={s.secondaryText}>Generate key</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => void copy()} style={s.secondary}>
            <Text style={s.secondaryText}>Copy key</Text>
          </Pressable>
        </View>
        <Pressable disabled={busy} onPress={() => void exportBackup()} style={s.primary}>
          <MaterialCommunityIcons name="cloud-upload-outline" size={22} color="#FFFFFF" />
          <Text style={s.primaryText}>Export encrypted backup to Drive</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={restore} style={s.secondary}>
          <MaterialCommunityIcons name="cloud-download-outline" size={22} color="#17643E" />
          <Text style={s.secondaryText}>Restore from Drive / Files</Text>
        </Pressable>
        {busy && <ActivityIndicator color="#17643E" />}
        {!!notice && <Text accessibilityRole="alert" style={s.notice}>{notice}</Text>}
        <Text style={s.warning}>No automatic sync or Google OAuth connection is enabled. This feature sends no backup to BUKLOD servers.</Text>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4FAF6' },
  header: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#D9EBDD' },
  back: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#173B2E', fontSize: 20, fontWeight: '700' },
  small: { color: '#577D69', fontSize: 13 },
  content: { gap: 15, padding: 16 },
  heading: { color: '#174E33', fontSize: 18, fontWeight: '700' },
  body: { color: '#345946', fontSize: 15, lineHeight: 22 },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#A0C6AF', borderRadius: 12, paddingHorizontal: 12, fontSize: 16, backgroundColor: '#FFFFFF', color: '#163D29' },
  actions: { flexDirection: 'row', gap: 10 },
  primary: { flexDirection: 'row', minHeight: 52, gap: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#17643E' },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, flexShrink: 1 },
  secondary: { flexDirection: 'row', flex: 1, minHeight: 52, gap: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#9ABDA8', backgroundColor: '#FFFFFF' },
  secondaryText: { color: '#17643E', fontWeight: '700', fontSize: 14, flexShrink: 1 },
  notice: { color: '#194E35', fontSize: 14, padding: 12, backgroundColor: '#E2F3E9', borderRadius: 10 },
  warning: { color: '#76582B', fontSize: 13, lineHeight: 20 },
});
