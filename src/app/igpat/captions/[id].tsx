import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

type TranslationRow = {
  language?: string | null;
  text?: string | null;
  updated_at?: string | null;
};

type CaptionPayload = {
  configured?: boolean;
  is_owner?: boolean;
  language?: string | null;
  caption_text?: string | null;
  segments?: unknown[] | null;
  translations?: Record<string, TranslationRow> | null;
  is_visible?: boolean;
  updated_at?: string | null;
};

const TRANSLATION_TARGETS = [
  { key: 'en', label: 'English' },
  { key: 'fil', label: 'Filipino' },
  { key: 'ceb', label: 'Cebuano' },
] as const;

export default function IgpatCaptionsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const postId = (Array.isArray(params.id) ? params.id[0] : params.id ?? '').trim();
  const [payload, setPayload] = useState<CaptionPayload | null>(null);
  const [text, setText] = useState('');
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [translating, setTranslating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const translations = useMemo(() => {
    const raw = payload?.translations;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    return TRANSLATION_TARGETS
      .map(target => ({ target, row: raw[target.key] }))
      .filter(item => Boolean(item.row?.text?.trim()));
  }, [payload?.translations]);

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
    if (!postId || busy || translating) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('buklod-igpat-captions', {
        body: { post_id: postId, action: 'transcribe' },
      });
      if (invokeError) throw invokeError;
      if ((data as any)?.error) throw new Error(String((data as any).error));
      await load();
      Alert.alert('IGPAT Captions', 'Automatic captions are ready. Review and correct them before relying on them.');
    } catch (generateError: any) {
      const message = String(generateError?.message ?? generateError ?? 'Caption generation failed.');
      console.warn('BUKLOD IGPAT caption generation:', message);
      setError(message);
      Alert.alert('Could Not Generate Captions', message);
    } finally {
      setBusy(false);
    }
  };

  const generateTranslation = async (targetLanguage: string, targetLabel: string) => {
    if (!postId || busy || translating || !payload?.is_owner || !payload?.configured) return;
    setTranslating(targetLanguage);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('buklod-igpat-captions', {
        body: {
          post_id: postId,
          action: 'translate',
          target_language: targetLanguage,
        },
      });
      if (invokeError) throw invokeError;
      if ((data as any)?.error) throw new Error(String((data as any).error));
      await load();
      Alert.alert('IGPAT Translation', `${targetLabel} translation is ready.`);
    } catch (translationError: any) {
      const message = String(translationError?.message ?? translationError ?? 'Translation failed.');
      console.warn('BUKLOD IGPAT translation:', message);
      setError(message);
      Alert.alert('Could Not Translate Captions', message);
    } finally {
      setTranslating(null);
    }
  };

  const save = async () => {
    if (!postId || busy || translating || !payload?.is_owner || !payload?.configured) return;
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
      Alert.alert('IGPAT Captions', 'Caption changes saved. Manual corrections clear stale timing and translations so they can be regenerated from the corrected text.');
    } catch (saveError: any) {
      const message = String(saveError?.message ?? saveError ?? 'Could not save captions.');
      console.warn('BUKLOD IGPAT caption save:', message);
      setError(message);
      Alert.alert('Could Not Save Captions', message);
    } finally {
      setBusy(false);
    }
  };

  const renderTranslations = () => {
    if (!translations.length) return null;
    return (
      <View style={styles.translationList}>
        <Text style={styles.label}>AVAILABLE TRANSLATIONS</Text>
        {translations.map(({ target, row }) => (
          <View key={target.key} style={styles.translationCard} accessible accessibilityLabel={`${target.label} translation`}>
            <Text style={styles.translationTitle}>{target.label.toUpperCase()}</Text>
            <Text selectable style={styles.translationText}>{String(row?.text ?? '')}</Text>
          </View>
        ))}
      </View>
    );
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
          <Text style={styles.subtitle}>Optional speech captions with creator review and approved translations. Filipino, English, Cebuano and mixed speech may remain as spoken.</Text>
        </View>
      </View>

      <View style={styles.safetyCard}>
        <MaterialCommunityIcons name="closed-caption-outline" size={20} color="#D9FF69" />
        <View style={styles.safetyCopy}>
          <Text style={styles.safetyTitle}>CREATOR CONTROLLED</Text>
          <Text style={styles.safetyText}>Automatic captions and translations are assistance, not guaranteed transcripts. Review them before relying on them. Videos too large for the safe caption worker remain publishable without captions.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading captions…</Text></View>
      ) : error && !payload ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry captions" style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable>
        </View>
      ) : payload?.is_owner ? (
        <View style={styles.editor}>
          {!payload.configured ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateText}>No caption track has been generated for this IGPAT yet.</Text>
              <Pressable accessibilityRole="button" disabled={busy} style={styles.primaryButton} onPress={() => void generate()}>
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
                editable={!busy && !translating}
                placeholder="Correct the transcript here"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.input}
                textAlignVertical="top"
                accessibilityLabel="IGPAT caption text"
              />
              <Text style={styles.count}>{text.length.toLocaleString()} / 12,000</Text>

              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: visible }}
                disabled={busy || Boolean(translating)}
                onPress={() => setVisible(value => !value)}
                style={[styles.visibilityButton, visible && styles.visibilityButtonActive]}
              >
                <MaterialCommunityIcons name={visible ? 'eye-outline' : 'eye-off-outline'} size={18} color={visible ? '#07100B' : '#FFFFFF'} />
                <View style={styles.visibilityCopy}>
                  <Text style={[styles.visibilityTitle, visible && styles.visibilityTitleActive]}>{visible ? 'CAPTIONS VISIBLE' : 'CAPTIONS HIDDEN'}</Text>
                  <Text style={[styles.visibilityHint, visible && styles.visibilityHintActive]}>{visible ? 'Viewers may display this caption track.' : 'Only you can read/edit this track.'}</Text>
                </View>
              </Pressable>

              <Text style={styles.label}>TRANSLATE CORRECTED CAPTION</Text>
              <Text style={styles.helper}>Generate only the languages you want to make available. Editing the source caption later clears translations so stale text is never served.</Text>
              <View style={styles.translationButtons}>
                {TRANSLATION_TARGETS.map(target => (
                  <Pressable
                    key={target.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Generate ${target.label} caption translation`}
                    disabled={busy || Boolean(translating) || !text.trim()}
                    onPress={() => void generateTranslation(target.key, target.label)}
                    style={styles.translationButton}
                  >
                    {translating === target.key ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="translate" size={16} color="#FFFFFF" />}
                    <Text style={styles.translationButtonText}>{target.label.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>

              {renderTranslations()}
              {!!error && <Text style={styles.inlineError}>{error}</Text>}

              <View style={styles.actions}>
                <Pressable accessibilityRole="button" disabled={busy || Boolean(translating)} style={styles.secondaryButton} onPress={() => void generate()}>
                  <MaterialCommunityIcons name="refresh" size={17} color="#FFFFFF" />
                  <Text style={styles.secondaryText}>REGENERATE</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={busy || Boolean(translating)} style={styles.primaryButton} onPress={() => void save()}>
                  {busy ? <ActivityIndicator color="#07100B" /> : <MaterialCommunityIcons name="content-save-outline" size={17} color="#07100B" />}
                  <Text style={styles.primaryText}>SAVE</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      ) : payload?.configured ? (
        <View style={styles.viewerSection}>
          <View style={styles.stateCard}>
            <Text style={styles.viewerLabel}>ORIGINAL CAPTION</Text>
            <Text selectable style={styles.viewerCaption}>{String(payload.caption_text ?? '') || 'No intelligible speech was detected.'}</Text>
            <Text style={styles.stateText}>Caption management is available only to the IGPAT creator.</Text>
          </View>
          {renderTranslations()}
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
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0D120F' },
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
  retryButton: { marginTop: 13, alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 17, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  editor: { marginTop: 18 },
  viewerSection: { marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  metaText: { color: 'rgba(255,255,255,0.42)', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  label: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginTop: 16, marginBottom: 7 },
  helper: { marginTop: -2, marginBottom: 8, color: 'rgba(255,255,255,0.44)', fontSize: 8.5, lineHeight: 13 },
  input: { minHeight: 190, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0D120F', color: '#FFFFFF', padding: 14, fontSize: 12, lineHeight: 18 },
  count: { marginTop: 6, textAlign: 'right', color: 'rgba(255,255,255,0.34)', fontSize: 8.5 },
  visibilityButton: { marginTop: 14, minHeight: 66, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0D120F', flexDirection: 'row', alignItems: 'center', padding: 13, gap: 10 },
  visibilityButtonActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  visibilityCopy: { flex: 1 },
  visibilityTitle: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  visibilityTitleActive: { color: '#07100B' },
  visibilityHint: { marginTop: 3, color: 'rgba(255,255,255,0.45)', fontSize: 8.5 },
  visibilityHintActive: { color: 'rgba(7,16,11,0.62)' },
  translationButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  translationButton: { minHeight: 44, flexGrow: 1, minWidth: '30%', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0D120F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 9 },
  translationButtonText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  translationList: { marginTop: 8 },
  translationCard: { marginTop: 8, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 13 },
  translationTitle: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  translationText: { marginTop: 7, color: '#FFFFFF', fontSize: 12, lineHeight: 19 },
  inlineError: { marginTop: 12, color: '#FFB4A8', fontSize: 9.5, lineHeight: 15 },
  actions: { marginTop: 16, flexDirection: 'row', gap: 9 },
  primaryButton: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14 },
  primaryText: { color: '#07100B', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: '#0D120F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14 },
  secondaryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  viewerLabel: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  viewerCaption: { marginTop: 7, color: '#FFFFFF', fontSize: 14, lineHeight: 22, fontWeight: '700', marginBottom: 14 },
});