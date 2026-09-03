import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';

const BUCKET = 'buklod-classroom';
const R1_DIRECT_UPLOAD_LIMIT = 50 * 1024 * 1024;

type Context = { role: 'FACULTY' | 'STUDENT' };
type FileRow = {
  id: string;
  owner_user_id: string;
  file_kind: 'FILE' | 'PHOTO' | 'VIDEO' | 'AUDIO' | 'LINK';
  storage_bucket: string;
  storage_path: string | null;
  original_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  external_url: string | null;
  caption: string | null;
  created_at: string;
};

type PickedFile = { uri: string; name: string; mimeType?: string | null; size?: number | null };

function fileIcon(kind: FileRow['file_kind']) {
  if (kind === 'PHOTO') return 'image-outline';
  if (kind === 'VIDEO') return 'video-outline';
  if (kind === 'AUDIO') return 'music-note-outline';
  if (kind === 'LINK') return 'link-variant';
  return 'file-document-outline';
}

export default function BuklodClassroomMaterialsScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const classroomId = String(params.id ?? '');
  const classroomName = String(params.name ?? 'Classroom');

  const [context, setContext] = useState<Context | null>(null);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!classroomId) return;
    const [contextRes, fileRes] = await Promise.all([
      supabase.rpc('buklod_classroom_context_v1', { p_classroom_id: classroomId }),
      supabase
        .from('buklod_education_classroom_files')
        .select('id,owner_user_id,file_kind,storage_bucket,storage_path,original_name,mime_type,file_size,external_url,caption,created_at')
        .eq('classroom_id', classroomId)
        .eq('entity_type', 'MATERIAL')
        .order('created_at', { ascending: false }),
    ]);
    if (contextRes.error) return Alert.alert('Class Materials', contextRes.error.message);
    if (fileRes.error) return Alert.alert('Class Materials', fileRes.error.message);
    setContext(contextRes.data as Context);
    setRows((fileRes.data ?? []) as FileRow[]);
  }, [classroomId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const choose = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > R1_DIRECT_UPLOAD_LIMIT) {
      return Alert.alert(
        'Large Media',
        'The Classroom backend already allows files up to 1 GB, but the R1 direct mobile uploader is capped at 50 MB to avoid loading a huge video into phone memory. Large/resumable video upload will use this same private classroom storage.'
      );
    }
    setPicked({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size });
  };

  const upload = async () => {
    if (!picked || busy) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Please sign in again.');
      const base64 = await FileSystem.readAsStringAsync(picked.uri, { encoding: FileSystem.EncodingType.Base64 });
      const safeName = picked.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
      const path = `${classroomId}/${uid}/material/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, decode(base64), {
        contentType: picked.mimeType ?? 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const kind: FileRow['file_kind'] = picked.mimeType?.startsWith('image/') ? 'PHOTO' : picked.mimeType?.startsWith('video/') ? 'VIDEO' : picked.mimeType?.startsWith('audio/') ? 'AUDIO' : 'FILE';
      const { error: rowError } = await supabase.from('buklod_education_classroom_files').insert({
        classroom_id: classroomId,
        owner_user_id: uid,
        entity_type: 'MATERIAL',
        file_kind: kind,
        storage_bucket: BUCKET,
        storage_path: path,
        original_name: picked.name,
        mime_type: picked.mimeType ?? null,
        file_size: picked.size ?? null,
        caption: caption.trim() || null,
      });
      if (rowError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw rowError;
      }
      setPicked(null);
      setCaption('');
      await load();
    } catch (error) {
      Alert.alert('Upload Material', error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const addLink = async () => {
    const url = link.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) return Alert.alert('Class Link', 'Enter a complete http:// or https:// link.');
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const { error } = await supabase.from('buklod_education_classroom_files').insert({
      classroom_id: classroomId,
      owner_user_id: uid,
      entity_type: 'MATERIAL',
      file_kind: 'LINK',
      external_url: url,
      caption: caption.trim() || url,
    });
    if (error) return Alert.alert('Class Link', error.message);
    setLink('');
    setCaption('');
    await load();
  };

  const open = async (row: FileRow) => {
    if (row.external_url) return Linking.openURL(row.external_url);
    if (!row.storage_path) return;
    const { data, error } = await supabase.storage.from(row.storage_bucket || BUCKET).createSignedUrl(row.storage_path, 600);
    if (error || !data?.signedUrl) return Alert.alert('Material', error?.message ?? 'Could not open this material.');
    await Linking.openURL(data.signedUrl);
  };

  const remove = (row: FileRow) => {
    if (context?.role !== 'FACULTY') return;
    Alert.alert('Delete Material', `Delete ${row.caption || row.original_name || 'this material'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (row.storage_path) await supabase.storage.from(row.storage_bucket || BUCKET).remove([row.storage_path]);
          const { error } = await supabase.from('buklod_education_classroom_files').delete().eq('id', row.id);
          if (error) return Alert.alert('Delete Material', error.message);
          await load();
        },
      },
    ]);
  };

  const isFaculty = context?.role === 'FACULTY';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>{classroomName}</Text>
      </Pressable>
      <Text style={styles.eyebrow}>MATERIALS & MEDIA</Text>
      <Text style={styles.title}>Class Resources</Text>
      <Text style={styles.subtitle}>Private to this classroom. Files, photos, video, audio and learning links.</Text>

      {isFaculty && (
        <View style={styles.uploadCard}>
          <Text style={styles.cardTitle}>Share Material</Text>
          <TextInput value={caption} onChangeText={setCaption} placeholder="Title / caption" style={styles.input} />
          <Pressable style={styles.choose} onPress={choose}>
            <MaterialCommunityIcons name="paperclip" size={20} color="#1f7a3f" />
            <Text style={styles.chooseText}>{picked?.name || 'Choose file, photo or video'}</Text>
          </Pressable>
          {!!picked && (
            <Pressable disabled={busy} style={[styles.primary, busy && styles.disabled]} onPress={upload}>
              <Text style={styles.primaryText}>{busy ? 'Uploading…' : 'Upload to Classroom'}</Text>
            </Pressable>
          )}
          <View style={styles.divider} />
          <TextInput value={link} onChangeText={setLink} placeholder="https:// learning resource" autoCapitalize="none" style={styles.input} />
          <Pressable style={styles.secondary} onPress={addLink}><Text style={styles.secondaryText}>Add Learning Link</Text></Pressable>
          <Text style={styles.help}>Private bucket supports up to 1 GB/object. R1 phone direct-upload stays at 50 MB for memory safety until resumable large-video upload is enabled.</Text>
        </View>
      )}

      {rows.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No class material yet.</Text></View>
      ) : rows.map(row => (
        <Pressable key={row.id} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={() => open(row)} onLongPress={() => remove(row)}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name={fileIcon(row.file_kind) as any} size={25} color="#1f7a3f" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.materialTitle}>{row.caption || row.original_name || (row.file_kind === 'LINK' ? 'Learning link' : 'Class material')}</Text>
            <Text style={styles.materialMeta}>
              {row.file_kind}{row.file_size ? ` • ${(Number(row.file_size) / 1024 / 1024).toFixed(1)} MB` : ''}
            </Text>
            {!!row.original_name && <Text style={styles.fileName}>{row.original_name}</Text>}
          </View>
          <MaterialCommunityIcons name="open-in-new" size={18} color="#819087" />
        </Pressable>
      ))}
      {isFaculty && rows.length > 0 && <Text style={styles.longPress}>Faculty: long-press a material to delete it.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f6f2' },
  content: { padding: 20, paddingTop: 43, paddingBottom: 80 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 15 },
  backText: { color: '#17311f', fontWeight: '900' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#17311f', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#6d7970', lineHeight: 19, marginTop: 4, marginBottom: 15 },
  uploadCard: { backgroundColor: '#fff', borderRadius: 19, padding: 15, marginBottom: 15 },
  cardTitle: { color: '#283a2f', fontWeight: '900', fontSize: 16, marginBottom: 9 },
  input: { backgroundColor: '#f2f5f2', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: '#26382d', marginBottom: 8 },
  choose: { backgroundColor: '#edf5ee', borderRadius: 11, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  chooseText: { color: '#1f7a3f', fontWeight: '800', flex: 1 },
  primary: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondary: { backgroundColor: '#e7ede8', borderRadius: 11, paddingVertical: 10, alignItems: 'center' },
  secondaryText: { color: '#405249', fontWeight: '900' },
  disabled: { opacity: 0.45 },
  divider: { height: 1, backgroundColor: '#e4eae5', marginVertical: 11 },
  help: { color: '#7c877f', fontSize: 9, lineHeight: 14, marginTop: 9 },
  empty: { backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  emptyText: { color: '#718077' },
  card: { backgroundColor: '#fff', borderRadius: 17, padding: 13, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconWrap: { width: 45, height: 45, borderRadius: 14, backgroundColor: '#e7f4e9', alignItems: 'center', justifyContent: 'center' },
  materialTitle: { color: '#2a3c31', fontWeight: '900' },
  materialMeta: { color: '#748178', fontSize: 10, marginTop: 3 },
  fileName: { color: '#89928c', fontSize: 9, marginTop: 2 },
  longPress: { color: '#7a857e', fontSize: 9, textAlign: 'center', marginTop: 4 },
});
