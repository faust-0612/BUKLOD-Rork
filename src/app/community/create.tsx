import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { supabase } from '@/lib/supabase';
import {
  BUKLOD_COMMUNITY_KIND_LABELS,
  scanBuklodCommunityPrivacy,
  type BuklodCommunityKind,
} from '@/lib/buklodCommunityLiving';
import { pickCommunityPhotos } from '@/lib/buklodPickCommunityPhotos';
import { uploadCommunityPhotoFile } from '@/lib/uploadCommunityVideoFile';
import {
  attachCommunityPostMedia,
  extractCreatedRecordId,
} from '@/lib/buklodCommunityPostMedia';
import {
  sha256BuklodResource,
  uploadBuklodResource,
  validateBuklodResource,
} from '@/lib/buklodCommunityResourceUpload';

const PRIMARY_TYPES: BuklodCommunityKind[] = [
  'open_discussion',
  'question',
  'need_advice',
  'poll',
  'challenge',
  'moment',
  'resource',
  'encouragement',
  'idea',
  'share_a_win',
  'story',
];

type ResourceDraft = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

export default function CommunityCreateScreen() {
  const { user } = useAuth();
  const { theme } = useBuklodTheme();
  const [kind, setKind] = useState<BuklodCommunityKind>('open_discussion');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [pollText, setPollText] = useState('Yes\nNo');
  const [photo, setPhoto] = useState<{ uri: string } | null>(null);
  const [resource, setResource] = useState<ResourceDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const needsTitle = kind === 'resource' || kind === 'challenge';
  const prompt = useMemo(() => {
    switch (kind) {
      case 'question': return 'What do you want to ask?';
      case 'need_advice': return 'What are you going through?';
      case 'challenge': return 'Describe the challenge simply…';
      case 'poll': return 'Ask the community…';
      case 'moment': return 'What is happening in this moment?';
      case 'resource': return 'Why is this file useful?';
      case 'encouragement': return 'Share something encouraging…';
      case 'idea': return 'What is your idea?';
      case 'share_a_win': return 'What went well?';
      case 'story': return 'Tell your story…';
      default: return 'What’s on your mind?';
    }
  }, [kind]);

  const chooseMomentPhoto = async () => {
    try {
      const picked = await pickCommunityPhotos({ remaining: 1, maxPhotos: 1 });
      if (picked[0]) {
        setPhoto({ uri: picked[0].uri });
        setResource(null);
      }
    } catch (error: any) {
      Alert.alert('Photo', String(error?.message ?? 'Could not select a photo.'));
    }
  };

  const chooseResource = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      const draft: ResourceDraft = {
        uri: file.uri,
        name: file.name || 'resource',
        mimeType: String(file.mimeType || 'application/octet-stream').toLowerCase(),
        size: Number(file.size ?? 0),
      };
      const invalid = validateBuklodResource(draft);
      if (invalid) return Alert.alert('Resource', invalid);
      setResource(draft);
      setPhoto(null);
      if (!title.trim()) setTitle(draft.name.replace(/\.[^.]+$/, ''));
    } catch (error: any) {
      Alert.alert('Resource', String(error?.message ?? 'Could not select this file.'));
    }
  };

  const publish = async () => {
    if (!user?.id || busy) return;
    const cleanBody = body.trim();
    if (!cleanBody && !photo && !resource) {
      return Alert.alert('Community', 'Write something, add a photo, or attach a helpful Resource.');
    }
    if (needsTitle && !title.trim()) {
      return Alert.alert('Community', 'Add a short title.');
    }

    const shield = scanBuklodCommunityPrivacy(`${title}\n${cleanBody}`);
    if (shield.hardBlock) {
      return Alert.alert('Cannot post', shield.warnings.join('\n'));
    }
    if (shield.warnings.length) {
      const privacyWarnings = shield.warnings.filter(value => /phone|email|address/i.test(value));
      if (privacyWarnings.length) {
        return Alert.alert(
          'Privacy Shield',
          `${privacyWarnings.join('\n')}\n\nRemove identifying details before publishing publicly.`,
        );
      }
    }

    const options = kind === 'poll'
      ? pollText.split('\n').map(value => value.trim()).filter(Boolean).slice(0, 8)
      : [];
    if (kind === 'poll' && options.length < 2) {
      return Alert.alert('Poll', 'Add at least two choices, one per line.');
    }
    if (kind === 'moment' && !photo) {
      return Alert.alert('Moment', 'Add a photo to start a visual Moment.');
    }
    if (kind === 'resource' && !resource) {
      return Alert.alert('Resource', 'Choose a helpful file first.');
    }

    setBusy(true);
    let createdPostId: string | null = null;
    try {
      const { data: created, error: createError } = await (supabase as any).rpc(
        'create_buklod_community_post_v3',
        {
          p_audience: 'public',
          p_group_id: null,
          p_category: 'reflection',
          p_body: cleanBody || title.trim() || 'Shared with the Community.',
          p_media_path: null,
          p_media_mime_type: null,
          p_media_size_bytes: null,
          p_media_duration_seconds: null,
          p_is_reel: false,
          p_mentioned_user_ids: [],
        },
      );
      if (createError) throw createError;
      createdPostId = extractCreatedRecordId(created);
      if (!createdPostId) throw new Error('Post was created but its ID was not returned.');

      if (photo) {
        const path = `${user.id}/moment-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const uploaded = await uploadCommunityPhotoFile({ path, uri: photo.uri });
        await attachCommunityPostMedia(createdPostId, [{
          media_path: path,
          media_mime_type: 'image/jpeg',
          media_size_bytes: uploaded.sizeBytes,
        }]);
      }

      await (supabase as any).rpc('set_buklod_community_post_meta_v1', {
        p_post_id: createdPostId,
        p_kind: kind,
        p_privacy: 'public',
        p_title: title.trim() || null,
        p_topic: topic.trim() || null,
        p_quiet_mode: kind === 'need_advice' || kind === 'help_needed',
        p_poll_options: options.length ? options : null,
        p_challenge_config: kind === 'challenge' ? { reward_mode: 'existing_buklod_progression' } : null,
        p_context_config: kind === 'moment' ? { prompt: 'add_yours' } : {},
      });

      if (resource) {
        const hash = await sha256BuklodResource(resource.uri);
        const { data: existing } = await (supabase as any).rpc(
          'find_buklod_community_resource_object_v1',
          { p_sha256: hash, p_visibility: 'public' },
        );

        let storagePath = String(existing?.storage_path ?? '').trim();
        if (!storagePath) {
          const uploaded = await uploadBuklodResource({
            userId: user.id,
            uri: resource.uri,
            name: resource.name,
            mimeType: resource.mimeType,
          });
          storagePath = uploaded.storagePath;
        }

        const { error: resourceError } = await (supabase as any).rpc(
          'register_buklod_community_resource_v2',
          {
            p_post_id: createdPostId,
            p_title: title.trim() || resource.name,
            p_description: cleanBody || null,
            p_topic: topic.trim() || null,
            p_original_name: resource.name,
            p_mime_type: resource.mimeType,
            p_size_bytes: resource.size,
            p_sha256: hash,
            p_storage_path: storagePath,
            p_visibility: 'public',
          },
        );
        if (resourceError) throw resourceError;
      }

      router.replace('/(tabs)/buklod' as any);
    } catch (error: any) {
      Alert.alert('Could Not Post', String(error?.message ?? error ?? 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Create</Text>
        <Pressable disabled={busy} onPress={() => void publish()} style={[styles.postBtn, { backgroundColor: theme.accent }]}>
          {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postText}>Post</Text>}
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
          {PRIMARY_TYPES.map(value => {
            const active = value === kind;
            return <Pressable key={value} onPress={() => {
              setKind(value);
              if (value !== 'moment') setPhoto(null);
              if (value !== 'resource') setResource(null);
            }} style={[styles.typeChip, { borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.accentSoft : theme.surface }]}>
              <Text style={[styles.typeText, { color: active ? theme.accent : theme.textMuted }]}>{BUKLOD_COMMUNITY_KIND_LABELS[value]}</Text>
            </Pressable>;
          })}
        </ScrollView>

        {needsTitle ? <TextInput
          value={title} onChangeText={setTitle}
          placeholder={kind === 'resource' ? 'Resource title' : 'Challenge title'}
          placeholderTextColor={theme.textMuted}
          style={[styles.titleInput, { color: theme.textPrimary }]}
        /> : null}

        <TextInput
          multiline value={body} onChangeText={setBody}
          placeholder={prompt} placeholderTextColor={theme.textMuted}
          style={[styles.bodyInput, { color: theme.textPrimary }]}
        />

        {(kind === 'resource' || kind === 'challenge' || kind === 'question') ? <TextInput
          value={topic} onChangeText={setTopic} placeholder="Topic (optional)"
          placeholderTextColor={theme.textMuted}
          style={[styles.topicInput, { color: theme.textPrimary, borderColor: theme.border }]}
        /> : null}

        {kind === 'poll' ? <View style={[styles.subtlePanel, { backgroundColor: theme.surfaceMuted }]}>
          <Text style={[styles.panelLabel, { color: theme.textMuted }]}>CHOICES · ONE PER LINE</Text>
          <TextInput multiline value={pollText} onChangeText={setPollText}
            placeholderTextColor={theme.textMuted}
            style={[styles.pollInput, { color: theme.textPrimary }]}
          />
        </View> : null}

        {kind === 'moment' ? <Pressable onPress={() => void chooseMomentPhoto()} style={[styles.mediaPick, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {photo ? <Image source={{ uri: photo.uri }} style={styles.momentPhoto} /> : <>
            <MaterialCommunityIcons name="image-plus" size={30} color={theme.accent} />
            <Text style={[styles.mediaTitle, { color: theme.textPrimary }]}>Add a photo</Text>
            <Text style={[styles.mediaHint, { color: theme.textMuted }]}>Others can later continue it with “Add yours.”</Text>
          </>}
        </Pressable> : null}

        {kind === 'resource' ? <Pressable onPress={() => void chooseResource()} style={[styles.mediaPick, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <MaterialCommunityIcons name={resource ? 'file-check-outline' : 'file-plus-outline'} size={30} color={theme.accent} />
          <Text style={[styles.mediaTitle, { color: theme.textPrimary }]}>{resource?.name || 'Choose a helpful file'}</Text>
          <Text style={[styles.mediaHint, { color: theme.textMuted }]}>
            {resource ? `${Math.max(0.01, resource.size / 1024 / 1024).toFixed(2)} MB · stored once when duplicates are detected` : 'PDF, Office files, text, CSV, or images · max 20 MB'}
          </Text>
        </Pressable> : null}

        <View style={[styles.note, { backgroundColor: theme.surfaceMuted }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={17} color={theme.textMuted} />
          <Text style={[styles.noteText, { color: theme.textMuted }]}>
            Community stays public and easy to browse. Anonymous and poster-only replies are available inside DUGTONG chains; root-post anonymity is held back until the main feed can mask identity end-to-end.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '900' },
  postBtn: { minWidth: 72, minHeight: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  postText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 34 },
  typeRow: { gap: 7, paddingBottom: 12 },
  typeChip: { minHeight: 34, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  typeText: { fontSize: 10, fontWeight: '850' },
  titleInput: { fontSize: 20, fontWeight: '900', paddingHorizontal: 2, paddingVertical: 8 },
  bodyInput: { minHeight: 140, fontSize: 17, lineHeight: 24, paddingHorizontal: 2, paddingVertical: 10, textAlignVertical: 'top' },
  topicInput: { minHeight: 42, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, fontSize: 12, marginTop: 8 },
  subtlePanel: { borderRadius: 15, padding: 12, marginTop: 10 },
  panelLabel: { fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  pollInput: { minHeight: 90, marginTop: 4, fontSize: 14, lineHeight: 22, textAlignVertical: 'top' },
  mediaPick: { marginTop: 10, minHeight: 144, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 14 },
  momentPhoto: { width: '100%', aspectRatio: 1.35, borderRadius: 14 },
  mediaTitle: { marginTop: 7, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  mediaHint: { marginTop: 3, fontSize: 10.5, lineHeight: 15, textAlign: 'center' },
  note: { marginTop: 16, borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteText: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: '600' },
});
