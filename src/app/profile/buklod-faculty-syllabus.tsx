import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { FacultyGate } from '@/components/faculty/FacultyGate';
import { supabase } from '@/lib/supabase';

const BUCKET = 'buklod-classroom';
const AI_LIMIT = 20 * 1024 * 1024;

type SyllabusRow = {
  id: string;
  version_no: number;
  title: string;
  source_url: string | null;
  parsed_outline: any;
  status: string;
  activated_at: string | null;
  created_at: string;
};

type ModuleRow = {
  id: string;
  syllabus_version_id: string | null;
  term_key: string | null;
  module_no: number;
  title: string;
  release_mode: string;
  status: string;
};

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-140) || 'syllabus.pdf';
}

export default function FacultySyllabusScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const [versions, setVersions] = useState<SyllabusRow[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!classroomId) return;
    const [v, m] = await Promise.all([
      supabase.from('buklod_education_syllabus_versions').select('id,version_no,title,source_url,parsed_outline,status,activated_at,created_at').eq('classroom_id', classroomId).order('version_no', { ascending: false }),
      supabase.from('buklod_education_modules').select('id,syllabus_version_id,term_key,module_no,title,release_mode,status').eq('classroom_id', classroomId).order('module_no'),
    ]);
    if (v.error) return Alert.alert('Syllabus', v.error.message);
    if (m.error) return Alert.alert('Modules', m.error.message);
    setVersions((v.data ?? []) as SyllabusRow[]);
    setModules((m.data ?? []) as ModuleRow[]);
  }, [classroomId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const upload = async () => {
    if (uploading) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
      ],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    if (asset.size && asset.size > AI_LIMIT) {
      return Alert.alert('Syllabus Too Large', 'For automatic syllabus planning, use a PDF/DOCX/TXT up to 20 MB.');
    }
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Please sign in again.');
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const filename = safeName(asset.name || 'syllabus.pdf');
      const storagePath = `${classroomId}/${uid}/syllabus/${Date.now()}_${filename}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, decode(base64), {
        contentType: asset.mimeType || 'application/octet-stream',
        upsert: false,
        cacheControl: '3600',
      });
      if (uploadError) throw uploadError;
      const nextVersion = Math.max(0, ...versions.map(v => Number(v.version_no || 0))) + 1;
      const { data: row, error: rowError } = await supabase.from('buklod_education_syllabus_versions').insert({
        classroom_id: classroomId,
        version_no: nextVersion,
        title: asset.name || `Syllabus v${nextVersion}`,
        source_url: `${BUCKET}://${storagePath}`,
        parsed_outline: {},
        status: 'UPLOADED',
        created_by: uid,
      }).select('id').single();
      if (rowError || !row?.id) throw rowError ?? new Error('Could not create syllabus record.');
      await load();
      Alert.alert('Syllabus Uploaded', 'The file is private. Generate an AI draft plan when ready; nothing will be published automatically.');
    } catch (error: any) {
      Alert.alert('Upload Syllabus', String(error?.message ?? error));
    } finally {
      setUploading(false);
    }
  };

  const generate = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke('buklod-classroom-syllabus-plan', { body: { syllabus_version_id: id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await load();
      Alert.alert('AI Draft Ready', `${data?.modules ?? 0} module(s) and ${data?.items ?? 0} learning item(s) proposed. Review before applying.`);
    } catch (error: any) {
      Alert.alert('Generate Course Plan', String(error?.message ?? error));
    } finally {
      setBusyId(null);
    }
  };

  const applyPlan = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.rpc('buklod_classroom_faculty_apply_syllabus_plan_v1', { p_syllabus_version_id: id });
      if (error) throw error;
      await load();
      Alert.alert('Draft Modules Created', `${data?.draft_modules ?? 0} module(s) created as Faculty-only DRAFT. Students still cannot see them.`);
    } catch (error: any) {
      Alert.alert('Apply Draft Plan', String(error?.message ?? error));
    } finally {
      setBusyId(null);
    }
  };

  const activate = async (id: string) => {
    Alert.alert('Activate Course Flow?', 'This will make this reviewed syllabus and its modules visible to enrolled students. Previous active syllabus modules will be archived.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Activate', onPress: async () => {
        setBusyId(id);
        try {
          const { data, error } = await supabase.rpc('buklod_classroom_faculty_activate_syllabus_v1', { p_syllabus_version_id: id });
          if (error) throw error;
          await load();
          Alert.alert('Course Flow Active', `${data?.active_modules ?? 0} module(s) activated.`);
        } catch (error: any) {
          Alert.alert('Activate Syllabus', String(error?.message ?? error));
        } finally { setBusyId(null); }
      } },
    ]);
  };

  const moduleCount = (id: string) => modules.filter(m => m.syllabus_version_id === id).length;

  return <FacultyGate><ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async()=>{setRefreshing(true);await load();setRefreshing(false)}}/>}>
    <Pressable style={styles.back} onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={22} color="#17311f"/><Text style={styles.backText}>{classroomName}</Text></Pressable>
    <Text style={styles.eyebrow}>SYLLABUS AUTOMATION</Text>
    <Text style={styles.title}>Prepare once. Teach more.</Text>
    <Text style={styles.subtitle}>Upload the official syllabus, let BUKLOD propose a semester flow, review the draft, then activate. AI never publishes the course by itself.</Text>

    <Pressable disabled={uploading} style={[styles.upload, uploading && { opacity: .6 }]} onPress={upload}><MaterialCommunityIcons name="file-upload-outline" size={22} color="#fff"/><Text style={styles.uploadText}>{uploading ? 'Uploading…' : 'Upload Syllabus PDF / DOCX / TXT'}</Text></Pressable>

    {versions.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No syllabus uploaded yet</Text><Text style={styles.emptyText}>The course can still run manually. Upload a syllabus when you want automatic course-flow planning.</Text></View> : versions.map(v => {
      const outlineModules = Array.isArray(v.parsed_outline?.modules) ? v.parsed_outline.modules : [];
      const isBusy = busyId === v.id;
      return <View key={v.id} style={[styles.card, v.status === 'ACTIVE' && styles.activeCard]}>
        <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>v{v.version_no} • {v.title}</Text><Text style={styles.meta}>{v.status} • {outlineModules.length} AI module proposal(s) • {moduleCount(v.id)} saved module(s)</Text></View>{v.status === 'ACTIVE' && <Text style={styles.activeBadge}>ACTIVE</Text>}</View>
        {outlineModules.slice(0, 8).map((m:any, i:number) => <View key={`${v.id}-${i}`} style={styles.module}><Text style={styles.moduleNo}>{m.term_key || 'TERM'} • {m.module_no || i+1}</Text><Text style={styles.moduleTitle}>{m.title || `Module ${i+1}`}</Text><Text style={styles.moduleText} numberOfLines={2}>{m.description || 'No description'}</Text></View>)}
        {outlineModules.length > 8 && <Text style={styles.more}>+ {outlineModules.length - 8} more proposed modules</Text>}
        <View style={styles.actions}>
          <Pressable disabled={isBusy || v.status === 'ACTIVE'} style={styles.secondary} onPress={() => generate(v.id)}><Text style={styles.secondaryText}>{isBusy ? 'Working…' : outlineModules.length ? 'Regenerate AI Draft' : 'Generate AI Draft'}</Text></Pressable>
          {outlineModules.length > 0 && v.status !== 'ACTIVE' && <Pressable disabled={isBusy} style={styles.secondary} onPress={() => applyPlan(v.id)}><Text style={styles.secondaryText}>Apply as Draft Modules</Text></Pressable>}
          {moduleCount(v.id) > 0 && v.status !== 'ACTIVE' && <Pressable disabled={isBusy} style={styles.primary} onPress={() => activate(v.id)}><Text style={styles.primaryText}>Activate Course Flow</Text></Pressable>}
        </View>
      </View>;
    })}
  </ScrollView></FacultyGate>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#f4f7f2'},content:{padding:20,paddingTop:44,paddingBottom:70},back:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:18},backText:{fontWeight:'800',color:'#17311f'},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.3,color:'#1f7a3f'},title:{fontSize:28,fontWeight:'900',color:'#17311f',marginTop:3},subtitle:{color:'#68736b',lineHeight:19,marginTop:6,marginBottom:18},upload:{backgroundColor:'#174c2b',borderRadius:15,paddingVertical:14,paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:18},uploadText:{color:'#fff',fontWeight:'900'},empty:{backgroundColor:'#fff',borderRadius:18,padding:18},emptyTitle:{fontWeight:'900',color:'#22352a'},emptyText:{color:'#6b776e',lineHeight:18,marginTop:5},card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dde7df',borderRadius:19,padding:15,marginBottom:13},activeCard:{borderColor:'#83b990'},row:{flexDirection:'row',alignItems:'flex-start',gap:10},cardTitle:{fontWeight:'900',fontSize:15,color:'#24362b'},meta:{fontSize:11,color:'#748078',marginTop:3},activeBadge:{fontSize:9,fontWeight:'900',color:'#176a38',backgroundColor:'#e6f4e9',paddingHorizontal:8,paddingVertical:5,borderRadius:999,overflow:'hidden'},module:{marginTop:10,paddingTop:9,borderTopWidth:1,borderTopColor:'#edf1ed'},moduleNo:{fontSize:9,fontWeight:'900',color:'#2a7b44'},moduleTitle:{fontWeight:'900',color:'#26392d',marginTop:2},moduleText:{fontSize:11,color:'#6c796f',lineHeight:16,marginTop:2},more:{fontSize:11,fontWeight:'800',color:'#2a7b44',marginTop:9},actions:{marginTop:13,gap:7},secondary:{borderWidth:1,borderColor:'#b9cbbd',borderRadius:12,paddingVertical:11,alignItems:'center'},secondaryText:{fontWeight:'900',color:'#31543a'},primary:{backgroundColor:'#1f7a3f',borderRadius:12,paddingVertical:12,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'900'},
});