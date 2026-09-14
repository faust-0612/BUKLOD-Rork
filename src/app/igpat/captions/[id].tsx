import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type CaptionPayload = {
  configured?: boolean;
  is_owner?: boolean;
  language?: string | null;
  caption_text?: string | null;
  segments?: unknown[] | null;
  is_visible?: boolean;
  updated_at?: string | null;
};

export default function IgpatCaptionsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const postId = (Array.isArray(params.id) ? params.id[0] : params.id ?? '').trim();
  const [payload, setPayload] = useState<CaptionPayload | null>(null);
  const [text, setText] = useState('');
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!postId || !user?.id) {
      setPayload(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: captionError } = await (supabase as any).rpc(
        'get_buklod_igpat_caption_v1',
        { p_post_id: postId }
      );
      if (captionError) throw captionError;
      const next = (data ?? {}) as CaptionPayload;
      setPayload(next);
      setText(String(next.caption_text ?? ''));
      setVisible(next.is_visible !== false);
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT captions:', String(loadError?.message ?? loadError));
      setError('Captions are not available yet. The IGPAT caption server update may still need to be applied.');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [postId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    if (!postId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('buklod-igpat-captions', {
        body: { post_id: postId },
      });
      if (invokeError) throw invokeError;
      if ((data as any)?.error) throw new Error(String((data as any).error));
      await load();
      Alert.alert('IGPAT Captions', 'Automatic captions are ready. Review and correct them before leaving them visible.');
    } catch (generateError: any) {
      const message = String(generateError?.message ?? generateError ?? 'Caption generation failed.');
      console.warn('BUKLOD IGPAT caption generation:', message);
      setError(message);
      Alert.alert('Could Not Generate Captions', message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!postId || busy || !payload?.is_owner || !payload?.configured) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: saveError } = await (supabase as any).rpc(
        'update_buklod_igpat_caption_v1',
        {
          p_post_id: postId,
          p_caption_text: text.slice(0, 12000),
          p_is_visible: visible,
        }
      );
      if (saveError) throw saveError;
      const next = (data ?? {}) as CaptionPayload;
      setPayload(next);
      setText(String(next.caption_text ?? text));
      setVisible(next.is_visible !== false);
      Alert.alert('IGPAT Captions', 'Caption changes saved. Manual corrections now use the corrected full-text caption instead of stale AI timestamps.');
    } catch (saveError: any) {
      const message = String(saveError?.message ?? saveError ?? 'Could not save captions.');
      console.warn('BUKLOD IGPAT caption save:', message);
      setError(message);
      Alert.alert('Could Not Save Captions', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
          <Text style={styles.title}>Captions</Text>
          <Text style={styles.subtitle}>Optional speech captions with creator review. Tagalog, English and Taglish may remain as spoken.</Text>
        </View>
      </View>

      <View style={styles.safetyCard}>
        <MaterialCommunityIcons name="closed-caption-outline" size={20} color="#D9FF69" />
        <View style={styles.safetyCopy}>
          <Text style={styles.safetyTitle}>CREATOR CONTROLLED</Text>
          <Text style={styles.safetyText}>Automatic captions are assistance, not a guaranteed transcript. Review them before relying on them. Videos that are too large for the safe caption worker remain publishable without captions.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading captions…</Text></View>
      ) : error && !payload ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable>
        </View>
      ) : payload?.is_owner ? (
        <View style={styles.editor}>
          {!payload.configured ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateText}>No caption track has been generated for this IGPAT yet.</Text>
              <Pressable disabled={busy} style={styles.primaryButton} onPress={() => void generate()}>
                {busy ? <ActivityIndicator color="#07100B" /> : <MaterialCommunityIcons name="auto-fix" size={18} color="#07100B" />}
                <Text style={styles.primaryText}>GENERATE CAPTIONS</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>LANGUAGE · {String(payload.language ?? 'AUTO').toUpperCase()}</Text>
                <Text style={styles.metaText}>{Array.isArray(payload.segments) && payload.segments.length ? `${payload.segments.length} TIMED SEGMENTS` : 'CORRECTED FULL TEXT'}</Text>
              </View>

              <Text style={styles.label}>CAPTION TEXT</Text>
              <TextInput
                value={text}
                onChangeText={value => setText(value.slice(0, 12000))}
                multiline
                editable={!busy}
                placeholder="Correct the transcript here"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.input}
                textAlignVertical="top"
              />
              <Text style={styles.count}>{text.length.toLocaleString()} / 12,000</Text>

              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: visible }}
                disabled={busy}
                onPress={() => setVisible(value => !value)}
                style={[styles.visibilityButton, visible && styles.visibilityButtonActive]}
              >
                <MaterialCommunityIcons name={visible ? 'eye-outline' : 'eye-off-outline'} size={18} color={visible ? '#07100B' : '#FFFFFF'} />
                <View style={styles.visibilityCopy}>
                  <Text style={[styles.visibilityTitle, visible && styles.visibilityTitleActive]}>{visible ? 'CAPTIONS VISIBLE' : 'CAPTIONS HIDDEN'}</Text>
                  <Text style={[styles.visibilityHint, visible && styles.visibilityHintActive]}>{visible ? 'Viewers may display this caption track.' : 'Only you can read/edit this track.'}</Text>
                </View>
              </Pressable>

              {!!error && <Text style={styles.inlineError}>{error}</Text>}

              <View style={styles.actions}>
                <Pressable disabled={busy} style={styles.secondaryButton} onPress={() => void generate()}>
                  <MaterialCommunityIcons name="refresh" size={17} color="#FFFFFF" />
                  <Text style={styles.secondaryText}>REGENERATE</Text>
                </Pressable>
                <Pressable disabled={busy} style={styles.primaryButton} onPress={() => void save()}>
                  {busy ? <ActivityIndicator color="#07100B" /> : <MaterialCommunityIcons name="content-save-outline" size={17} color="#07100B" />}
                  <Text style={styles.primaryText}>SAVE</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      ) : payload?.configured ? (
        <View style={styles.stateCard}>
          <Text style={styles.viewerCaption}>{String(payload.caption_text ?? '') || 'No intelligible speech was detected.'}</Text>
          <Text style={styles.stateText}>Caption management is available only to the IGPAT creator.</Text>
        </View>
      ) : (
        <View style={styles.stateCard}><Text style={styles.stateText}>This IGPAT does not have a visible caption track.</Text></View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050807' },
  content: { padding: 18, paddingTop: 54, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0D120F' },
  headerCopy: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.46)', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 4, color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.58)', fontSize: 11, lineHeight: 17 },
  safetyCard: { marginTop: 20, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(217,255,105,0.20)', backgroundColor: '#10150D', padding: 14, flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  safetyCopy: { flex: 1 },
  safetyTitle: { color: '#D9FF69', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  safetyText: { marginTop: 4, color: 'rgba(255,255,255,0.56)', fontSize: 9.5, lineHeight: 15 },
  centerState: { marginTop: 40, alignItems: 'center', gap: 10 },
  stateCard: { marginTop: 18, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 18 },
  stateText: { color: 'rgba(255,255,255,0.62)', fontSize: 10.5, lineHeight: 17, textAlign: 'center' },
  retryButton: { marginTop: 13, alignSelf: 'center', paddingHorizontal: 17, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  editor: { marginTop: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  metaText: { color: 'rgba(255,255,255,0.42)', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  label: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginBottom: 7 },
  input: { minHeight: 190, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0D120F', color: '#FFFFFF', padding: 14, fontSize: 12, lineHeight: 18 },
  count: { marginTop: 6, textAlign: 'right', color: 'rgba(255,255,255,0.34)', fontSize: 8.5 },
  visibilityButton: { marginTop: 14, minHeight: 66, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0D120F', flexDirection: 'row', alignItems: 'center', padding: 13, gap: 10 },
  visibilityButtonActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  visibilityCopy: { flex: 1 },
  visibilityTitle: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  visibilityTitleActive: { color: '#07100B' },
  visibilityHint: { marginTop: 3, color: 'rgba(255,255,255,0.45)', fontSize: 8.5 },
  visibilityHintActive: { color: 'rgba(7,16,11,0.62)' },
  inlineError: { marginTop: 12, color: '#FFB4A8', fontSize: 9.5, lineHeight: 15 },
  actions: { marginTop: 16, flexDirection: 'row', gap: 9 },
  primaryButton: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14 },
  primaryText: { color: '#07100B', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  secondaryButton: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: '#0D120F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14 },
  secondaryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  viewerCaption: { color: '#FFFFFF', fontSize: 14, lineHeight: 22, fontWeight: '700', marginBottom: 14 },
});
