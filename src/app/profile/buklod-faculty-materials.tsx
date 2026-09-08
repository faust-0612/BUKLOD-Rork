import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';

import { uploadClassroomObject } from '@/lib/education/classroomTransfer';
import { supabase } from '@/lib/supabase';
import { FacultyGate } from '@/components/faculty/FacultyGate';

const BUCKET = 'buklod-education-materials';
const MAX_BYTES = 1024 * 1024 * 1024;

type MaterialRow = {
  id: string;
  title: string;
  original_name: string | null;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  allow_download: boolean;
  is_released: boolean;
  created_at: string;
};

export default function FacultyMaterialsScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');

  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [title, setTitle] = useState('');
  const [releaseNow, setReleaseNow] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const load = async () => {
    const { data, error } = await supabase
      .from('buklod_education_materials')
      .select('id,title,original_name,file_path,mime_type,file_size,allow_download,is_released,created_at')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false });

    if (error) return Alert.alert('Materials', error.message);
    setMaterials((data ?? []) as MaterialRow[]);
  };

  useEffect(() => {
    load();
  }, [classroomId]);

  const upload = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (picked.canceled) return;

    const asset = picked.assets[0];
    if (!asset) return;

    if (asset.size && asset.size > MAX_BYTES) {
      return Alert.alert('Material Too Large', 'BUKLOD Classroom accepts up to 1 GB per material file when the storage bucket permits it.');
    }

    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Please sign in again.');

      const safeName = asset.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
      const storagePath = `${classroomId}/${Date.now()}_${safeName}`;
      const transfer = await uploadClassroomObject({
        uri: asset.uri,
        bucket: BUCKET,
        path: storagePath,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
        onProgress: progress => setUploadProgress(progress.percent),
      });

      const { error: rowError } = await supabase
        .from('buklod_education_materials')
        .insert({
          classroom_id: classroomId,
          title: title.trim() || asset.name,
          original_name: asset.name,
          file_name: asset.name,
          file_path: storagePath,
          storage_bucket: BUCKET,
          mime_type: asset.mimeType ?? null,
          file_size: transfer.size,
          allow_download: true,
          is_released: releaseNow,
          released_at: releaseNow ? new Date().toISOString() : null,
          created_by: uid,
        });

      if (rowError) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
        throw rowError;
      }

      setTitle('');
      await load();
      Alert.alert('Material Uploaded', releaseNow ? 'Uploaded and released to students.' : 'Uploaded as faculty-only draft.');
    } catch (error) {
      Alert.alert('Material Upload', error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const toggleRelease = async (item: MaterialRow) => {
    const next = !item.is_released;
    const { error } = await supabase
      .from('buklod_education_materials')
      .update({
        is_released: next,
        released_at: next ? new Date().toISOString() : null,
      })
      .eq('id', item.id);

    if (error) return Alert.alert('Material', error.message);
    load();
  };

  const openMaterial = async (item: MaterialRow) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(item.file_path, 300);

    if (error || !data?.signedUrl) {
      return Alert.alert('Material', error?.message ?? 'Could not create secure link.');
    }

    await Linking.openURL(data.signedUrl);
  };

  const removeMaterial = async (item: MaterialRow) => {
    Alert.alert(
      'Delete Material',
      `Delete "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error: storageError } = await supabase.storage.from(BUCKET).remove([item.file_path]);
            if (storageError) return Alert.alert('Delete', storageError.message);

            const { error: rowError } = await supabase
              .from('buklod_education_materials')
              .delete()
              .eq('id', item.id);

            if (rowError) return Alert.alert('Delete', rowError.message);
            load();
          },
        },
      ]
    );
  };

  return (
    <FacultyGate>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>{classroomName}</Text>
      </Pressable>

      <Text style={styles.eyebrow}>FACULTY MATERIALS</Text>
      <Text style={styles.title}>Learning Materials</Text>
      <Text style={styles.subtitle}>Private classroom storage. Release only when ready.</Text>

      <View style={styles.uploadCard}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Optional display title"
          style={styles.input}
        />

        <Pressable style={styles.releaseRow} onPress={() => setReleaseNow(value => !value)}>
          <MaterialCommunityIcons
            name={releaseNow ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={22}
            color="#1f7a3f"
          />
          <Text style={styles.releaseText}>Release to students immediately</Text>
        </Pressable>

        <Pressable style={styles.primary} onPress={upload} disabled={uploading}>
          <MaterialCommunityIcons name="file-upload-outline" size={21} color="#fff" />
          <Text style={styles.primaryText}>{uploading ? `Uploading… ${uploadProgress}%` : 'Choose & Upload File'}</Text>
        </Pressable>
        <Text style={styles.help}>PDF, Office files, images, videos and other classroom files • up to 1 GB • larger uploads use resumable chunks and can retry from the saved offset.</Text>
      </View>

      <Text style={styles.sectionTitle}>Class Materials</Text>

      {materials.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No materials uploaded yet.</Text>
        </View>
      ) : (
        materials.map(item => (
          <View key={item.id} style={styles.materialCard}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="file-document-outline" size={24} color="#1f7a3f" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.materialTitle}>{item.title}</Text>
              <Text style={styles.materialMeta}>
                {item.is_released ? 'RELEASED' : 'DRAFT'}
                {item.file_size ? ` • ${(item.file_size / 1024 / 1024).toFixed(1)} MB` : ''}
              </Text>
              {!!item.original_name && <Text style={styles.fileName}>{item.original_name}</Text>}
              <View style={styles.rowActions}>
                <Pressable onPress={() => openMaterial(item)}>
                  <Text style={styles.link}>Open</Text>
                </Pressable>
                <Pressable onPress={() => toggleRelease(item)}>
                  <Text style={styles.link}>{item.is_released ? 'Unrelease' : 'Release'}</Text>
                </Pressable>
                <Pressable onPress={() => removeMaterial(item)}>
                  <Text style={styles.delete}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  content: { padding: 20, paddingTop: 42, paddingBottom: 60 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  backText: { color: '#17311f', fontWeight: '800' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#68736b', marginTop: 4, marginBottom: 18 },
  uploadCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 22 },
  input: { backgroundColor: '#f3f6f2', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12 },
  releaseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13 },
  releaseText: { color: '#405146', fontWeight: '700' },
  primary: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#1f7a3f', borderRadius: 12, paddingVertical: 13 },
  primaryText: { color: '#fff', fontWeight: '900' },
  help: { color: '#7a847d', fontSize: 11, marginTop: 9, lineHeight: 16 },
  sectionTitle: { color: '#17311f', fontSize: 17, fontWeight: '900', marginBottom: 10 },
  empty: { backgroundColor: '#fff', borderRadius: 15, padding: 16 },
  emptyText: { color: '#68736b' },
  materialCard: { flexDirection: 'row', gap: 11, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 9 },
  iconWrap: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#e8f4ea', alignItems: 'center', justifyContent: 'center' },
  materialTitle: { color: '#25372c', fontWeight: '900' },
  materialMeta: { color: '#1f7a3f', fontSize: 11, fontWeight: '900', marginTop: 3 },
  fileName: { color: '#788279', fontSize: 11, marginTop: 3 },
  rowActions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  link: { color: '#1f7a3f', fontWeight: '900' },
  delete: { color: '#a83c3c', fontWeight: '900' },
});