import React, { useCallback, useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import {
  ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showBuklodAdOpportunity, warmBuklodAdOpportunity } from '@/lib/buklodAdOpportunities';

type Task = {
  session_id: string;
  session_date: string;
  status: string;
  lesson: string;
  has_photo: boolean;
  photo_path?: string | null;
  location?: string | null;
  notes?: string | null;
  admin_note?: string | null;
  participant_count?: number;
  attendee_ids?: string[];
  points_credited?: number;
};
type Lesson = { id: string; title: string };
type Disciple = { disciple_id: string; disciple_name: string };
type Source = 'camera' | 'library';

const PHOTO_BUCKET = 'buklod-mentoring-evidence';
const MAX_LEARNERS = 50;
const isValidSessionId = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id);
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error || 'Please try again.');

function describeStatus(task: Task) {
  if (task.status === 'approved') {
    return Number(task.points_credited ?? 0) > 0
      ? `Approved · +${task.points_credited} BP credited`
      : 'Approved · reward ledger pending verification';
  }
  if (task.status === 'rejected') return 'Returned for correction';
  if (task.status === 'pending_admin' && task.has_photo) return 'Photo received · awaiting System Admin';
  return 'Action needed · attach photo evidence';
}

export default function MentorTeachingPhotoEvidence() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [lessonSearch, setLessonSearch] = useState('');
  const [disciples, setDisciples] = useState<Disciple[]>([]);
  const [selectedDisciples, setSelectedDisciples] = useState<string[]>([]);
  const [requestKey, setRequestKey] = useState(() => Crypto.randomUUID());
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [consent, setConsent] = useState(false);
  const [retrySessionId, setRetrySessionId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [revisionLocation, setRevisionLocation] = useState('');
  const [revisionLearners, setRevisionLearners] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [taskResponse, lessonResponse, menteeResponse] = await Promise.all([
        (supabase as any).rpc('get_my_mentor_photo_tasks_r2'),
        (supabase as any).rpc('get_my_mentor_reportable_lessons_r2'),
        (supabase as any).rpc('mentor_disciple_progress'),
      ]);
      if (taskResponse.error) throw taskResponse.error;
      if (lessonResponse.error) throw lessonResponse.error;
      if (menteeResponse.error) throw menteeResponse.error;
      setTasks(Array.isArray(taskResponse.data) ? taskResponse.data : []);
      setLessons(Array.isArray(lessonResponse.data) ? lessonResponse.data : []);
      setDisciples(Array.isArray(menteeResponse.data) ? menteeResponse.data : []);
      setPhotoUrls({});
    } catch (error) {
      setErr(`Unable to load mentoring reports: ${message(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    warmBuklodAdOpportunity('points_submission_success');
  }, [load]);

  const choosePhoto = async (source: Source): Promise<ImagePicker.ImagePickerAsset | null> => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Allow camera or photo access in your device settings to attach evidence.');
    }
    const selection = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'], quality: 1, allowsEditing: false,
          allowsMultipleSelection: false,
        });
    return selection.canceled ? null : (selection.assets?.[0] ?? null);
  };

  const pickForNewReport = async (source: Source) => {
    try {
      const asset = await choosePhoto(source);
      if (asset) {
        setPhoto(asset);
        setErr('');
      }
    } catch (error) {
      setErr(message(error));
    }
  };

  const uploadPhoto = async (sessionId: string, asset: ImagePicker.ImagePickerAsset) => {
    if (!isValidSessionId(sessionId)) throw new Error('Saved mentoring session ID is invalid.');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Sign in to submit mentoring evidence.');
    // Resize before base64 encoding; the private bucket enforces its 5 MB limit.
    const manipulation = ImageManipulator.ImageManipulator.manipulate(asset.uri);
    manipulation.resize({ width: Math.min(asset.width || 1280, 1280) });
    const rendered = await manipulation.renderAsync();
    const image = await rendered.saveAsync({
      format: ImageManipulator.SaveFormat.JPEG, compress: 0.68, base64: true,
    });
    if (!image.base64) throw new Error('Photo preparation failed. Choose another photo.');
    const path = `${user.id}/${sessionId}/${Crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(
      path, decode(image.base64), { contentType: 'image/jpeg', upsert: false },
    );
    if (uploadError) throw uploadError;
    try {
      const { data, error: attachError } = await (supabase as any).rpc(
        'attach_my_mentor_session_photo_r2',
        { p_session_id: sessionId, p_photo_path: path },
      );
      if (attachError) throw attachError;
      // Remove the superseded image only AFTER the new photo is linked.
      const previous = data?.previous_photo_path;
      if (typeof previous === 'string' && previous !== path) {
        await supabase.storage.from(PHOTO_BUCKET).remove([previous]).catch(() => {});
      }
    } catch (error) {
      // No orphaned photo if the transactional attachment fails.
      await supabase.storage.from(PHOTO_BUCKET).remove([path]).catch(() => {});
      throw error;
    }
  };

  const completeNewReport = () => {
    setRequestKey(Crypto.randomUUID());
    setNotes('');
    setLocation('');
    setSelectedLesson('');
    setSelectedDisciples([]);
    setLessonSearch('');
    setPhoto(null);
    setRetrySessionId(null);
    setConsent(false);
  };

  const createSession = async () => {
    if (busy || retrySessionId || !photo || !consent || !selectedLesson ||
      selectedDisciples.length < 1 || selectedDisciples.length > MAX_LEARNERS ||
      notes.trim().length < 20 || location.trim().length < 4) return;
    setBusy('creating');
    setErr('');
    let savedSessionId: string | null = null;
    try {
      const { data, error } = await (supabase as any).rpc(
        'report_my_mentor_teaching_with_details_r3', {
          p_lesson_id: selectedLesson,
          p_attendee_ids: selectedDisciples,
          p_notes: notes.trim(),
          p_location:location.trim(),
          p_request_key: requestKey,
        },
      );
      if (error) throw error;
      if (!isValidSessionId(data?.session_id)) throw new Error('Report saved without a valid session receipt.');
      savedSessionId = data.session_id;
      setRetrySessionId(savedSessionId);
      await uploadPhoto(savedSessionId, photo);
      completeNewReport();
      await load();
      Alert.alert('Report sent for review', 'Teaching report and private photo received. System Admin will verify before the +15 BP reward.');
      showBuklodAdOpportunity('points_submission_success');
    } catch (error) {
      if (savedSessionId) {
        await load();
        setErr(`Report was saved, but the photo is still pending: ${message(error)}. Use Retry photo below. Do not create another report.`);
      } else {
        setErr(`Could not save report: ${message(error)}`);
      }
    } finally {
      setBusy(null);
    }
  };

  const retryPhoto = async () => {
    if (!retrySessionId || !photo || !consent || busy) return;
    setBusy('retry');
    setErr('');
    try {
      await uploadPhoto(retrySessionId, photo);
      completeNewReport();
      await load();
      Alert.alert('Evidence received', 'Your report is now awaiting System Admin verification.');
    } catch (error) {
      setErr(`Photo still pending: ${message(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const attachExisting = async (task: Task, source: Source) => {
    if (busy || !consent || !['reported', 'pending_admin'].includes(task.status)) return;
    setBusy(task.session_id);
    setErr('');
    try {
      const asset = await choosePhoto(source);
      if (!asset) return;
      await uploadPhoto(task.session_id, asset);
      setConsent(false);
      await load();
      Alert.alert('Photo received', 'Your mentoring session is in the Admin review queue.');
      showBuklodAdOpportunity('points_submission_success');
    } catch (error) {
      setErr(`Could not attach photo: ${message(error)}. Your saved report remains available for retry.`);
    } finally {
      setBusy(null);
    }
  };

  const viewPrivatePhoto = async (task: Task) => {
    if (!task.photo_path) return;
    setErr('');
    try {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(task.photo_path, 120);
      if (error || !data?.signedUrl) throw error || new Error('Preview is unavailable');
      setPhotoUrls(current => ({ ...current, [task.session_id]: data.signedUrl }));
    } catch (error) {
      setErr(`Could not open your private evidence: ${message(error)}`);
    }
  };

  const startRevision = (task: Task) => {
    setEditingId(task.session_id);
    setRevisionLocation(task.location ?? '');
    setRevisionNotes(task.notes ?? '');
    const eligible = new Set(disciples.map(d => d.disciple_id));
    setRevisionLearners((task.attendee_ids ?? []).filter(id => eligible.has(id)));
    setErr('');
  };

  const revise = async (task: Task) => {
    if (busy || task.status !== 'rejected' ||
      revisionLocation.trim().length < 4 || revisionNotes.trim().length < 20 ||
      revisionLearners.length < 1 || revisionLearners.length > MAX_LEARNERS) return;
    setBusy(task.session_id);
    setErr('');
    try {
      const { data, error } = await (supabase as any).rpc(
        'revise_my_rejected_mentor_session_r4', {
          p_session_id: task.session_id,
          p_location: revisionLocation.trim(),
          p_notes: revisionNotes.trim(),
          p_attendee_ids: revisionLearners,
        },
      );
      if (error) throw error;
      setEditingId(null);
      setRevisionLearners([]);
      const previous = data?.previous_photo_path;
      if (typeof previous === 'string') {
        await supabase.storage.from(PHOTO_BUCKET).remove([previous]).catch(() => {});
      }
      await load();
      Alert.alert('Revision saved', 'Attach a new consented photo to send this corrected report back to Admin review.');
    } catch (error) {
      setErr(`Could not revise report: ${message(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const canCreate = !busy && !retrySessionId && !!photo && consent && !!selectedLesson &&
    selectedDisciples.length > 0 && selectedDisciples.length <= MAX_LEARNERS &&
    notes.trim().length >= 20 && location.trim().length >= 4;
  const visibleLessons = lessons.filter(lesson =>
    lesson.title.toLocaleLowerCase().includes(lessonSearch.trim().toLocaleLowerCase())).slice(0, 20);

  return <SafeAreaView style={s.root}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} style={s.back}>
        <Text style={s.backText}>‹ Back to BUKLOD Lesson</Text>
      </Pressable>
      <Text style={s.heading}>Mentoring Lesson Report</Text>
      <Text style={s.sub}>Record a lesson you actually taught to assigned learners. One report requires the lesson, attendees, venue, teaching summary and a genuine photo. Your private photo is sent to System Admin for verification; verified sessions earn +15 BP once.</Text>
      <Text style={s.privacy}>Ask participants for permission before taking or uploading a photo. For minors, obtain appropriate parent or guardian permission. Do not include sensitive records or unrelated people. Photos are private to the mentor and authorized reviewers.</Text>
      {!!err && <Text accessibilityRole="alert" style={s.err}>{err}</Text>}
      {loading && <ActivityIndicator size="large" color="#0A7436" />}

      <View style={s.card}>
        <Text style={s.lesson}>New teaching report</Text>
        <Text style={s.meta}>Choose the actual BUKLOD lesson taught.</Text>
        <TextInput style={s.field} value={lessonSearch} onChangeText={setLessonSearch}
          placeholder="Search BUKLOD / CCP / Discipleship lesson"
          placeholderTextColor="#859688" />
        {visibleLessons.map(lesson => <Pressable key={lesson.id} accessibilityRole="button"
          accessibilityState={{ selected: selectedLesson === lesson.id }}
          style={[s.choice, selectedLesson === lesson.id && s.selected]}
          onPress={() => setSelectedLesson(lesson.id)}>
          <Text style={s.choiceText}>{lesson.title}</Text>
        </Pressable>)}
        {lessons.length === 0 && !loading &&
          <Text style={s.meta}>No reportable lessons or mentor access. Ask your Cluster administrator to check your assigned mentor role.</Text>}
        {!!selectedLesson && <Text style={s.hint}>Selected: {lessons.find(l => l.id === selectedLesson)?.title}</Text>}
        <Text style={s.meta}>Select only assigned learners who actually attended ({selectedDisciples.length} selected; up to {MAX_LEARNERS}).</Text>
        {disciples.map(d => <Pressable key={d.disciple_id} accessibilityRole="checkbox"
          accessibilityState={{ checked: selectedDisciples.includes(d.disciple_id) }}
          style={[s.choice, selectedDisciples.includes(d.disciple_id) && s.selected]}
          onPress={() => setSelectedDisciples(current => current.includes(d.disciple_id)
            ? current.filter(id => id !== d.disciple_id)
            : current.length < MAX_LEARNERS ? [...current, d.disciple_id] : current)}>
          <Text style={s.choiceText}>{selectedDisciples.includes(d.disciple_id) ? '☑' : '☐'} {d.disciple_name}</Text>
        </Pressable>)}
        {disciples.length === 0 && !loading &&
          <Text style={s.meta}>No assigned learners. Ask your administrator to link your mentees first.</Text>}
        <TextInput style={s.field} value={location} onChangeText={setLocation}
          placeholder="Place / venue of teaching (required)" placeholderTextColor="#859688"
          maxLength={180} />
        <TextInput style={[s.field, s.multiline]} multiline textAlignVertical="top"
          placeholder="What did you teach, how, and what did the learners do? (20+ characters)"
          placeholderTextColor="#859688" value={notes} onChangeText={setNotes} maxLength={2000} />
        <Text style={s.meta}>Teaching photo required before the report goes to review.</Text>
        <View style={s.actions}>
          <Pressable style={[s.outline, s.flexButton]} disabled={busy !== null}
            onPress={() => void pickForNewReport('camera')}>
            <Text style={s.outlineText}>Take photo</Text>
          </Pressable>
          <Pressable style={[s.outline, s.flexButton]} disabled={busy !== null}
            onPress={() => void pickForNewReport('library')}>
            <Text style={s.outlineText}>Choose photo</Text>
          </Pressable>
        </View>
        {photo && <View style={s.photoWrap}>
          <Image source={{ uri: photo.uri }} style={s.preview} resizeMode="contain" />
          <Text style={s.hint}>Photo selected · compressed privately on submission</Text>
        </View>}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }}
          style={s.consent} onPress={() => setConsent(current => !current)}>
          <Text style={s.choiceText}>{consent ? '☑' : '☐'} I confirm permission to upload this mentoring photo for private review.</Text>
        </Pressable>
        {retrySessionId ? <>
          <Text style={s.warning}>A report is already saved. Retry its pending photo instead of creating a duplicate.</Text>
          <Pressable style={[s.button, (!photo || !consent || !!busy) && s.disabled]}
            disabled={!photo || !consent || busy !== null} onPress={() => void retryPhoto()}>
            <Text style={s.buttonText}>{busy === 'retry' ? 'Uploading...' : 'Retry saved photo'}</Text>
          </Pressable>
        </> : <Pressable accessibilityRole="button" disabled={!canCreate}
          style={[s.button, !canCreate && s.disabled]} onPress={() => void createSession()}>
          <Text style={s.buttonText}>{busy === 'creating' ? 'Saving & uploading...' : 'Submit report with photo'}</Text>
        </Pressable>}
      </View>

      <Text style={s.sectionTitle}>My teaching report history</Text>
      {!loading && tasks.length === 0 && <Text style={s.empty}>No mentoring reports recorded yet.</Text>}
      {tasks.map(task => <View style={s.card} key={task.session_id}>
        <Text style={s.lesson}>{task.lesson}</Text>
        <Text style={s.meta}>{task.session_date} · {task.participant_count ?? 0} learners</Text>
        {!!task.location && <Text style={s.meta}>Venue: {task.location}</Text>}
        <Text style={[s.status, task.status === 'rejected' && s.warningText]}>{describeStatus(task)}</Text>
        {!!task.admin_note && <Text style={s.feedback}>System Admin feedback: {task.admin_note}</Text>}
        {!!task.photo_path && <Pressable style={s.outline}
          onPress={() => void viewPrivatePhoto(task)}>
          <Text style={s.outlineText}>View my private evidence</Text>
        </Pressable>}
        {!!photoUrls[task.session_id] && <Image
          source={{ uri: photoUrls[task.session_id] }} style={s.preview} resizeMode="contain" />}
        {['reported', 'pending_admin'].includes(task.status) && <>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }}
            style={s.consent} onPress={() => setConsent(current => !current)}>
            <Text style={s.choiceText}>{consent ? '☑' : '☐'} I have permission to upload or replace this report's private photo.</Text>
          </Pressable>
          <Text style={s.meta}>{task.has_photo
            ? 'You may replace the photo before an Admin decision.'
            : 'Photo missing. Attach it to enter the review queue.'}</Text>
          <View style={s.actions}>
            <Pressable disabled={!!busy || !consent} style={[s.button, s.flexButton, (!!busy || !consent) && s.disabled]}
              onPress={() => void attachExisting(task, 'camera')}>
              <Text style={s.buttonText}>{busy === task.session_id ? 'Uploading...' : 'Camera'}</Text>
            </Pressable>
            <Pressable disabled={!!busy || !consent} style={[s.button, s.flexButton, (!!busy || !consent) && s.disabled]}
              onPress={() => void attachExisting(task, 'library')}>
              <Text style={s.buttonText}>Upload photo</Text>
            </Pressable>
          </View>
          {!consent && <Text style={s.hint}>Tick the photo permission checkbox above to attach evidence.</Text>}
        </>}
        {task.status === 'rejected' && <>
          <Pressable style={s.outline} onPress={() => startRevision(task)}>
            <Text style={s.outlineText}>Correct and resubmit this report</Text>
          </Pressable>
          {editingId === task.session_id && <>
            <TextInput style={s.field} value={revisionLocation} onChangeText={setRevisionLocation}
              placeholder="Correct teaching location" placeholderTextColor="#859688" maxLength={180} />
            <TextInput style={[s.field, s.multiline]} multiline textAlignVertical="top"
              value={revisionNotes} onChangeText={setRevisionNotes}
              placeholder="Correct teaching summary" placeholderTextColor="#859688" maxLength={2000} />
            <Text style={s.meta}>Correct the assigned learners who actually attended ({revisionLearners.length} selected).</Text>
            {disciples.map(d => <Pressable key={d.disciple_id} accessibilityRole="checkbox"
              accessibilityState={{ checked: revisionLearners.includes(d.disciple_id) }}
              style={[s.choice, revisionLearners.includes(d.disciple_id) && s.selected]}
              onPress={() => setRevisionLearners(current => current.includes(d.disciple_id)
                ? current.filter(id => id !== d.disciple_id)
                : current.length < MAX_LEARNERS ? [...current, d.disciple_id] : current)}>
              <Text style={s.choiceText}>{revisionLearners.includes(d.disciple_id) ? '☑' : '☐'} {d.disciple_name}</Text>
            </Pressable>)}
            <Text style={s.meta}>After saving corrections, attach a new consented photo. No duplicate report or BP is created.</Text>
            <View style={s.actions}>
              <Pressable style={[s.button, s.flexButton,
                (!!busy || revisionNotes.trim().length < 20 || revisionLocation.trim().length < 4 || revisionLearners.length < 1) && s.disabled]}
                disabled={!!busy || revisionNotes.trim().length < 20 || revisionLocation.trim().length < 4 || revisionLearners.length < 1}
                onPress={() => void revise(task)}>
                <Text style={s.buttonText}>Save revision</Text>
              </Pressable>
              <Pressable style={[s.outline, s.flexButton]} onPress={() => setEditingId(null)}>
                <Text style={s.outlineText}>Cancel</Text>
              </Pressable>
            </View>
          </>}
        </>}
      </View>)}
      <Pressable onPress={() => void load()} style={s.reload}>
        <Text style={s.reloadText}>Refresh report status</Text>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5FAF7' },
  content: { padding: 13, gap: 12, paddingBottom: 48 },
  back: { paddingVertical: 10 },
  backText: { color: '#236843', fontWeight: '800', fontSize: 15 },
  heading: { color: '#1E4C32', fontWeight: '900', fontSize: 23 },
  sub: { color: '#425E4B', fontSize: 14, lineHeight: 21 },
  privacy: { color: '#74603C', backgroundColor: '#FFF8E8',
    borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 18 },
  card: { padding: 14, backgroundColor: '#FFF', borderRadius: 15,
    borderWidth: 1, borderColor: '#DDEADB', gap: 9 },
  sectionTitle: { color: '#245036', fontSize: 17, fontWeight: '900' },
  lesson: { color: '#20442E', fontSize: 16, fontWeight: '900' },
  meta: { color: '#5C7264', fontSize: 13, lineHeight: 19 },
  hint: { color: '#52745C', fontSize: 12 },
  field: { padding: 12, borderRadius: 10, borderColor: '#CFE1D2',
    borderWidth: 1, color: '#214832', fontSize: 15 },
  multiline: { minHeight: 90 },
  choice: { padding: 12, backgroundColor: '#F0F5F1', borderRadius: 10 },
  selected: { borderColor: '#137944', borderWidth: 1, backgroundColor: '#E4F4E9' },
  choiceText: { color: '#294B34', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 9, alignItems: 'stretch' },
  button: { backgroundColor: '#0A7436', padding: 14, borderRadius: 11, alignItems: 'center' },
  flexButton: { flex: 1 },
  buttonText: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  outline: { borderColor: '#9EC9AC', borderWidth: 1, borderRadius: 10,
    padding: 11, justifyContent: 'center', alignItems: 'center' },
  outlineText: { color: '#17643B', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  consent: { padding: 11, backgroundColor: '#EDF7EF', borderRadius: 10 },
  photoWrap: { gap: 4 },
  preview: { width: '100%', height: 180, borderRadius: 11, backgroundColor: '#EEF3F0' },
  status: { color: '#176A3B', fontSize: 14, fontWeight: '900' },
  feedback: { color: '#59452C', backgroundColor: '#FFF8E6',
    borderRadius: 8, padding: 10, fontSize: 13 },
  warning: { color: '#845922', backgroundColor: '#FFF4DD', padding: 10, borderRadius: 8 },
  warningText: { color: '#A44A30' },
  err: { color: '#A53626', backgroundColor: '#FFE8E2', padding: 12,
    borderRadius: 9, fontSize: 13 },
  empty: { padding: 20, backgroundColor: '#FFF', color: '#62746A', borderRadius: 14 },
  reload: { padding: 13, alignItems: 'center' },
  reloadText: { color: '#0A7436', fontSize: 14, fontWeight: '800' },
});
