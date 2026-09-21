import React, { useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import BuklodScopedWorkspaceScrollView from '@/components/BuklodScopedWorkspaceScrollView';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import BuklodBulletinVideo from '@/components/BuklodBulletinVideo';
import { ensureImagePickerLibraryAccess } from '@/lib/buklodImagePickerAccess';

type ScopeRow = {
  scope_id: string;
  scope_type: 'CLUSTER' | 'CHURCH' | string;
  name: string;
  is_admin?: boolean;
};

type PickedMedia = {
  uri: string;
  type: 'image' | 'video';
  mimeType: string;
  fileName: string;
};

type Feedback = {
  kind: 'error' | 'info';
  text: string;
};

function extensionFor(
  fileName: string,
  mimeType: string,
  type: 'image' | 'video',
) {
  const name = fileName.split('?')[0].trim();
  const ext = name.includes('.')
    ? name.split('.').pop()?.toLowerCase()
    : null;

  if (ext && /^[a-z0-9]{2,5}$/.test(ext)) {
    return ext;
  }

  if (mimeType === 'video/quicktime') return 'mov';
  if (mimeType.includes('webm')) return 'webm';
  if (type === 'video') return 'mp4';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

async function readMediaForUpload(picked: PickedMedia) {
  if (Platform.OS === 'web') {
    const response = await fetch(picked.uri);
    if (!response.ok) {
      throw new Error('Could not read the selected bulletin media. Please choose it again.');
    }
    return response.arrayBuffer();
  }

  const base64 = await FileSystem.readAsStringAsync(picked.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return decode(base64);
}

export default function ScopeBulletinEditor() {
  const params = useLocalSearchParams<{
    scopeId?: string | string[];
  }>();

  const scopeId = Array.isArray(params.scopeId)
    ? params.scopeId[0]
    : params.scopeId;

  const [scope, setScope] = useState<ScopeRow | null>(null);
  const [bulletinId, setBulletinId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [existingMediaPath, setExistingMediaPath] = useState<string | null>(null);
  const [existingMediaKind, setExistingMediaKind] = useState<'image' | 'video' | null>(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const previewType = picked?.type ?? existingMediaKind;
  const previewUri = picked?.uri ?? existingMediaUrl;

  const heading = useMemo(() => {
    if (scope?.scope_type === 'CHURCH') return 'Church Bulletin';
    if (scope?.scope_type === 'ORGANIZATION') return 'Organization Announcement';
    return 'Cluster Bulletin';
  }, [scope?.scope_type]);

  const reportSaveError = (message: string) => {
    setFeedback({ kind: 'error', text: message });
    if (Platform.OS !== 'web') {
      Alert.alert('Bulletin', message);
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        if (!scopeId) {
          throw new Error('Missing scope.');
        }

        const { data: scopeRows, error: scopeError } = await (supabase as any).rpc(
          'buklod_my_scopes',
        );

        if (scopeError) throw scopeError;

        const selected = (scopeRows ?? []).find(
          (item: ScopeRow) => item.scope_id === scopeId,
        ) as ScopeRow | undefined;

        if (
          !selected ||
          !['CLUSTER', 'CHURCH', 'ORGANIZATION'].includes(
            selected.scope_type,
          )
        ) {
          throw new Error(
            'This announcement is not available for the selected workspace.',
          );
        }

        if (!selected.is_admin) {
          throw new Error('Only an authorized workspace admin can edit this announcement.');
        }

        if (!active) return;
        setScope(selected);

        const { data: rows, error: bulletinError } = await supabase
          .from('buklod_scope_bulletins')
          .select('id,title,body,is_pinned,media_path,media_kind')
          .eq('scope_id', scopeId)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (bulletinError) throw bulletinError;

        const item = rows?.[0] ?? null;
        if (item && active) {
          setBulletinId(item.id);
          setTitle(item.title ?? '');
          setBody(item.body ?? '');
          setPinned(Boolean(item.is_pinned));
          setExistingMediaPath(item.media_path ?? null);
          setExistingMediaKind(item.media_kind ?? null);

          if (item.media_path) {
            const { data: signed, error: signedError } = await supabase.storage
              .from('scope-bulletin-media')
              .createSignedUrl(item.media_path, 3600);

            if (!signedError && active) {
              setExistingMediaUrl(signed?.signedUrl ?? null);
            }
          }
        }
      } catch (error) {
        const message = String((error as any)?.message ?? error);
        Alert.alert('Bulletin', message, [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [scopeId]);

  const pickMedia = async () => {
    setFeedback(null);

    const permissionGranted = await ensureImagePickerLibraryAccess(
      ImagePicker.requestMediaLibraryPermissionsAsync,
    );

    if (!permissionGranted) {
      reportSaveError('Please allow photo and video access first.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'] as any,
      allowsMultipleSelection: false,
      quality: 0.88,
      videoMaxDuration: 180,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const type: 'image' | 'video' = asset.type === 'video' ? 'video' : 'image';

    setPicked({
      uri: asset.uri,
      type,
      mimeType: asset.mimeType ?? (type === 'video' ? 'video/mp4' : 'image/jpeg'),
      fileName: asset.fileName ?? (type === 'video' ? 'bulletin.mp4' : 'bulletin.jpg'),
    });
  };

  const save = async () => {
    setFeedback(null);

    if (!scopeId || !scope || !scope.is_admin) {
      reportSaveError('Your workspace admin access could not be verified. Reopen the Organization and try again.');
      return;
    }

    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (!cleanTitle || !cleanBody) {
      reportSaveError('Title and message are required before publishing.');
      return;
    }

    setSaving(true);
    setFeedback({ kind: 'info', text: 'Publishing bulletin…' });

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw authError ?? new Error('Please sign in again.');
      }

      let mediaPath = existingMediaPath;
      let mediaKind = existingMediaKind;

      if (picked) {
        const uploadBody = await readMediaForUpload(picked);
        const extension = extensionFor(picked.fileName, picked.mimeType, picked.type);

        mediaPath = `${scopeId}/${Date.now()}-${authData.user.id}.${extension}`;
        mediaKind = picked.type;

        const { error: uploadError } = await supabase.storage
          .from('scope-bulletin-media')
          .upload(mediaPath, uploadBody, {
            contentType: picked.mimeType,
            upsert: false,
          });

        if (uploadError) throw uploadError;
      }

      const payload = {
        scope_id: scopeId,
        title: cleanTitle,
        body: cleanBody,
        is_pinned: pinned,
        media_path: mediaPath,
        media_kind: mediaKind,
        is_published: true,
        starts_at: new Date().toISOString(),
        expires_at: null,
      };

      if (bulletinId) {
        const { data: updated, error } = await supabase
          .from('buklod_scope_bulletins')
          .update(payload)
          .eq('id', bulletinId)
          .select('id')
          .single();

        if (error) throw error;
        if (!updated?.id) throw new Error('Bulletin was not updated. Please try again.');
      } else {
        const { data: inserted, error } = await supabase
          .from('buklod_scope_bulletins')
          .insert({
            ...payload,
            created_by: authData.user.id,
          })
          .select('id')
          .single();

        if (error) throw error;
        if (!inserted?.id) throw new Error('Bulletin was not created. Please try again.');
        setBulletinId(inserted.id);
      }

      setFeedback({ kind: 'info', text: 'Bulletin published.' });
      router.back();
    } catch (error) {
      reportSaveError(String((error as any)?.message ?? error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (!scope || !scopeId) return null;

  return (
    <BuklodScopedWorkspaceScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <Text style={styles.eyebrow}>{scope.scope_type}</Text>
      <Text style={styles.title}>{heading}</Text>
      <Text style={styles.scopeName}>{scope.name}</Text>

      <TextInput
        value={title}
        onChangeText={(value) => {
          setTitle(value);
          if (feedback?.kind === 'error') setFeedback(null);
        }}
        placeholder="Bulletin title"
        style={styles.input}
      />

      <TextInput
        value={body}
        onChangeText={(value) => {
          setBody(value);
          if (feedback?.kind === 'error') setFeedback(null);
        }}
        placeholder="Write the bulletin..."
        multiline
        style={[styles.input, styles.bodyInput]}
      />

      <Pressable
        onPress={() => setPinned((value) => !value)}
        style={[styles.toggle, pinned && styles.toggleOn]}
      >
        <MaterialCommunityIcons
          name={pinned ? 'pin' : 'pin-outline'}
          size={20}
          color={colors.greenDark}
        />
        <Text style={styles.toggleText}>
          {pinned ? 'Pinned bulletin' : 'Pin this bulletin'}
        </Text>
      </Pressable>

      <Pressable onPress={pickMedia} style={styles.mediaButton}>
        <MaterialCommunityIcons
          name="image-multiple-outline"
          size={22}
          color={colors.greenDark}
        />
        <Text style={styles.mediaButtonText}>ADD / CHANGE IMAGE OR VIDEO</Text>
      </Pressable>

      {!!previewUri && previewType === 'image' && (
        <Image source={{ uri: previewUri }} resizeMode="cover" style={styles.preview} />
      )}

      {!!previewUri && previewType === 'video' && (
        <BuklodBulletinVideo uri={previewUri} />
      )}

      {!!feedback && (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.feedback,
            feedback.kind === 'error' ? styles.feedbackError : styles.feedbackInfo,
          ]}
        >
          <Text
            style={[
              styles.feedbackText,
              feedback.kind === 'error' && styles.feedbackErrorText,
            ]}
          >
            {feedback.text}
          </Text>
        </View>
      )}

      <Pressable
        disabled={saving}
        onPress={save}
        accessibilityRole="button"
        style={[styles.publish, saving && styles.publishDisabled]}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.publishText}>PUBLISH BULLETIN</Text>
        )}
      </Pressable>
    </BuklodScopedWorkspaceScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: colors.background,
    minHeight: '100%',
  },
  eyebrow: {
    color: colors.green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  title: {
    marginTop: 4,
    color: colors.greenDark,
    fontSize: 26,
    fontWeight: '900',
  },
  scopeName: {
    marginTop: 4,
    marginBottom: 18,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: 14,
  },
  bodyInput: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  toggle: {
    minHeight: 48,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.white,
  },
  toggleOn: {
    borderColor: colors.green,
    backgroundColor: colors.greenSoft,
  },
  toggleText: {
    color: colors.text,
    fontWeight: '800',
  },
  mediaButton: {
    minHeight: 50,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 14,
    backgroundColor: colors.white,
  },
  mediaButtonText: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  preview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: '#EEF1EF',
  },
  feedback: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  feedbackInfo: {
    borderColor: colors.green,
    backgroundColor: colors.greenSoft,
  },
  feedbackError: {
    borderColor: '#D92D20',
    backgroundColor: '#FFF1F0',
  },
  feedbackText: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: '800',
  },
  feedbackErrorText: {
    color: '#B42318',
  },
  publish: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.greenDark,
  },
  publishDisabled: {
    opacity: 0.5,
  },
  publishText: {
    color: colors.white,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
