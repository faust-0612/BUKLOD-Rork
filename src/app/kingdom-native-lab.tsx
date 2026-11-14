/**
 * Third Android app identity only. This screen never touches the live backend.
 * Native Godot, Gboard GIF, and Google Drive (SAF) can be accepted together
 * before exposing features to the existing user-facing staging channel.
 */
import React, { useMemo, useState } from 'react';
import { Redirect } from 'expo-router';
import {
  ActivityIndicator, Alert, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { pickKingdomLabDriveImage } from '@/lib/buklodLabDrivePicker';

const IS_LAB = Platform.OS === 'android' &&
  process.env.EXPO_PUBLIC_KINGDOM_NATIVE_LAB === '1';

export default function KingdomNativeLabScreen() {
  const [caption, setCaption] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<'gif' | 'image' | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const Editor: any = useMemo(() => IS_LAB
    ? require('../../modules/buklod-kingdom-lab/KeyboardGifInput').default
    : TextInput, []);

  if (!IS_LAB) return <Redirect href="/" />;

  const open3D = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { requireNativeModule } = require('expo-modules-core');
      await requireNativeModule('BuklodLabNative').openGodotWorld();
    } catch (error: any) {
      Alert.alert('Godot Lab', 'Embedded world not available in this build.');
    } finally {
      setBusy(false);
    }
  };
  const chooseDrive = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await pickKingdomLabDriveImage();
      if (!picked) return;
      setMediaUri(picked.uri);
      setMediaKind(picked.mimeType === 'image/gif' ? 'gif' : 'image');
      setNotice('Drive file staged locally. Nothing was uploaded.');
    } catch (error: any) {
      Alert.alert('Drive file', error?.message || 'File not available.');
    } finally {
      setBusy(false);
    }
  };

  return <ScrollView style={styles.root} contentContainerStyle={styles.content}
    keyboardShouldPersistTaps="handled">
    <Text style={styles.tag}>BUKLOD · NATIVE EXPERIMENT</Text>
    <Text style={styles.title}>Kingdom 3D + Drive + Keyboard GIF</Text>
    <Text style={styles.note}>ISOLATED APK · LOCAL-ONLY ACCEPTANCE · NO LIVE ACCOUNTS</Text>
    <Pressable style={styles.primary} onPress={() => void open3D()} disabled={busy}>
      <Text style={styles.primaryText}>OPEN GODOT KINGDOM 3D</Text>
    </Pressable>
    <Text style={styles.section}>Comment keyboard GIF test</Text>
    <Text style={styles.help}>
      Tap the field, choose GIF from Gboard, and confirm that its preview
      appears here without leaving the screen. It will NOT post to any Wall.
    </Text>
    <View style={styles.editorBox}>
      <Editor
        value={caption}
        onChangeText={setCaption}
        placeholder="Type here or insert a keyboard GIF…"
        editable={!busy}
        maxLength={2000}
        multiline
        style={styles.editor}
        onGif={(uri: string) => {
          if (!/^file:\/\/\//.test(uri)) return;
          setMediaUri(uri);
          setMediaKind('gif');
          setNotice('Keyboard GIF received natively · preview ready · NOT SENT');
        }}
      />
    </View>
    <Pressable onPress={() => void chooseDrive()} disabled={busy} style={styles.secondary}>
      <Text style={styles.secondaryText}>CHOOSE IMAGE / GIF FROM GOOGLE DRIVE</Text>
    </Pressable>
    {busy && <ActivityIndicator />}
    {mediaUri && <View style={styles.mediaBox}>
      <ExpoImage source={{ uri: mediaUri }} style={styles.preview} contentFit="contain" />
      <Text style={styles.small}>{mediaKind === 'gif' ? 'ANIMATED GIF' : 'IMAGE'} · LOCAL PREVIEW</Text>
      <Pressable style={styles.clear} onPress={() => {
        setMediaUri(null); setMediaKind(null); setNotice('Attachment cleared.');
      }}>
        <Text style={styles.clearText}>REMOVE ATTACHMENT</Text>
      </Pressable>
    </View>}
    <Pressable style={styles.secondary} onPress={() => {
      setNotice('Review complete. Sending is disabled in this offline lab; no real post was made.');
    }}>
      <Text style={styles.secondaryText}>REVIEW COMMENT (NO SEND)</Text>
    </Pressable>
    <Text style={styles.notice}>{notice}</Text>
    <Text style={styles.foot}>This lab does not use the public or staging-user OTA channel.</Text>
  </ScrollView>;
}
const styles=StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0c2928' },
  content: { padding: 18, paddingTop: 40, paddingBottom: 70, gap: 12 },
  tag: { color: '#b5e5cc', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#f6f9e7', fontSize: 24, fontWeight: '900' },
  note: { color: '#ffdfaf', fontSize: 11, fontWeight: '800' },
  primary: { backgroundColor: '#b2e0a8', borderRadius: 15, padding: 17, marginVertical: 7 },
  primaryText: { color: '#15362b', fontSize: 15, textAlign: 'center', fontWeight: '900' },
  secondary: { borderWidth: 1, borderColor: '#96c3ba', borderRadius: 12, padding: 13, marginTop: 5 },
  secondaryText: { color: '#e6fff1', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  section: { color: '#e8f7dd', fontSize: 17, fontWeight: '800', marginTop: 10 },
  help: { color: '#b7cfc4', fontSize: 12, lineHeight: 19 },
  editorBox: { minHeight: 90, backgroundColor: '#fff', borderRadius: 16, padding: 12 },
  editor: { width: '100%', height: 65, color: '#173a2b', fontSize: 16 },
  mediaBox: { alignItems: 'center', gap: 8 },
  preview: { width: '100%', height: 170, borderRadius: 12, backgroundColor: '#24403f' },
  small: { color: '#c9f2d6', fontSize: 11 },
  clear: { padding: 9 },
  clearText: { color: '#ffe1b9', fontSize: 12 },
  notice: { color: '#e3e8cd', fontSize: 12 },
  foot: { color: '#aac7b7', fontSize: 11, marginTop: 18 },
});
