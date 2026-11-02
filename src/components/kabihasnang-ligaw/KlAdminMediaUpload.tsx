import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import KlChapterAudio from './KlChapterAudio';
import { klSceneEffectSaved, klServerApprovedCount } from '@/lib/kabihasnang-ligaw/mediaApprovalState';
import { KlSceneEffect, type SceneEffect } from './KlSceneEffect';
import { sceneEditorValues, updateSceneDraft, clearSceneDraft, klSceneNumbers, nextKlSceneCount, KL_MAX_SCENE_COUNT, type SceneDrafts, type SceneDraft } from '@/lib/kabihasnang-ligaw/sceneDrafts';

type Kind = 'cover' | 'illustration' | 'music' | 'ambient';
type MediaItem = {
  kind: Kind; placement: number; approved: boolean; path: string;
  anchor?: string | null; side?: string | null;
  effect?: string | null; intensity?: number | null;
};
type Feedback = { tone: 'success' | 'error' | 'info'; text: string };

const DB_EPISODE_PREFIX = 'aa000001-0000-4000-8000-';
const MAX_BYTES = 15 * 1024 * 1024;
export const klDatabaseId = (episodeNumber: number) =>
  DB_EPISODE_PREFIX + String(episodeNumber + 1).padStart(12, '0');

const kindLabels: { value: Kind; label: string }[] = [
  { value: 'cover', label: 'Cover' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'music', label: 'Music' },
  { value: 'ambient', label: 'Ambient' },
];

function Choice({ label, selected, disabled, onPress }: {
  label: string;
  selected?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected, disabled }}
      disabled={disabled} onPress={onPress}
      style={{ paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, borderRadius: 8, backgroundColor: selected ? '#426b5c' : '#334a59' }}>
      <Text style={{ color: selected ? '#ffe0a8' : '#fff', fontWeight: selected ? '700' : '400' }}>{label}</Text>
    </Pressable>
  );
}

export default function KlAdminMediaUpload({ episodeNumber, episodeId: overrideId, onUploaded, onPreviewInvalidated, approvalRefreshToken = 0, onBusyChange, manuscript = '', manuscriptSaved = false, initialKind = 'illustration' }: {
  episodeNumber: number;
  episodeId?: string;
  onUploaded?: () => void;
  onPreviewInvalidated?: () => void;
  approvalRefreshToken?: number;
  onBusyChange?: (busy: boolean) => void;
  manuscript?: string;
  manuscriptSaved?: boolean;
  initialKind?: Kind;
}) {
  const episodeId = overrideId ?? klDatabaseId(episodeNumber);
  const [busyAction, setBusyAction] = useState('');
  const lock = useRef(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [kind, setKind] = useState<Kind>(initialKind);
  const [placement, setPlacement] = useState(1);
  const [visibleSceneCount, setVisibleSceneCount] = useState(3);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState('');
  // Unsaved edits are keyed by scene. Saved values always come from the server's
  // media list, so switching scenes or reopening this panel restores each placement.
  const [sceneDrafts, setSceneDrafts] = useState<SceneDrafts>({});
  const [motionPlaying, setMotionPlaying] = useState(true);
  const [audioUrl, setAudioUrl] = useState('');
  const [mediaRefreshToken, setMediaRefreshToken] = useState(0);

  useEffect(() => setKind(initialKind), [initialKind]);

  const sceneNumbers = klSceneNumbers(items, visibleSceneCount);
  const selectedPlacement = kind === 'illustration' ? placement : 0;
  const selected = items.find((item) => item.kind === kind && item.placement === selectedPlacement);
  const { anchor, side, effect, intensity } = sceneEditorValues(items, placement, sceneDrafts[placement]);
  const editScene = (changes: SceneDraft) =>
    setSceneDrafts((previous) => updateSceneDraft(previous, placement, changes));
  const placementSaved = selected?.kind === 'illustration'
    && !!selected.anchor && selected.anchor === anchor.trim() && selected.side === side;
  const effectSaved = klSceneEffectSaved(selected, effect, intensity);
  const approvedCount = klServerApprovedCount(items);
  const imageSelected = kind === 'cover' || kind === 'illustration';
  const isBusy = !!busyAction;

  const refreshMedia = async () => {
    const { data, error } = await supabase.rpc('kl_admin_media_list_v1', { p_episode_id: episodeId });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Hindi nabasa ang media list ng chapter.');
    setItems((data as MediaItem[]).filter((item) => kindLabels.some((option) => option.value === item.kind)));
  };

  useEffect(() => {
    if (approvalRefreshToken <= 0) return;
    void refreshMedia()
      .then(() => setFeedback({ tone: 'success', text: 'Media approval synced from server.' }))
      .catch((cause) => setFeedback({ tone: 'error', text: 'Hindi ma-refresh ang approval: ' + (cause instanceof Error ? cause.message : 'Retry.') }));
  }, [approvalRefreshToken]);

  useEffect(() => {
    let active = true;
    void supabase.rpc('kl_admin_media_list_v1', { p_episode_id: episodeId }).then(({ data, error }) => {
      if (!active) return;
      if (error) setFeedback({ tone: 'error', text: 'Hindi na-load ang media: ' + error.message });
      else if (Array.isArray(data)) setItems((data as MediaItem[]).filter((item) => kindLabels.some((option) => option.value === item.kind)));
      else setFeedback({ tone: 'error', text: 'Hindi nabasa ang media list.' });
    });
    return () => { active = false; };
  }, [episodeId]);

  useEffect(() => {
    let active = true;
    setPreviewUrl('');
    if (imageSelected && selected?.path) {
      void supabase.storage.from('kl-publishing').createSignedUrl(selected.path, 600).then(({ data, error }) => {
        if (!active) return;
        if (error) setFeedback({ tone: 'error', text: 'Media saved, pero hindi ma-load ang private preview: ' + error.message });
        else if (data?.signedUrl) setPreviewUrl(data.signedUrl);
      });
    }
    return () => { active = false; };
  }, [episodeId, imageSelected, selected?.path, mediaRefreshToken]);

  useEffect(() => {
    let active = true;
    setAudioUrl('');
    if (!imageSelected && selected?.path) {
      void supabase.storage.from('kl-publishing').createSignedUrl(selected.path, 600).then(({ data, error }) => {
        if (!active) return;
        if (error) setFeedback({ tone: 'error', text: 'Audio saved, pero hindi ma-play ang private preview: ' + error.message });
        else if (data?.signedUrl) setAudioUrl(data.signedUrl);
      });
    }
    return () => { active = false; };
  }, [episodeId, imageSelected, selected?.path, mediaRefreshToken]);

  const perform = async (label: string, task: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    onBusyChange?.(true);
    setBusyAction(label);
    setFeedback({ tone: 'info', text: label + '…' });
    try {
      await task();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Hindi natuloy ang request.' });
    } finally {
      lock.current = false;
      onBusyChange?.(false);
      setBusyAction('');
    }
  };

  const uploadImage = () => {
    void perform('Pumipili ng larawan', async () => {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: false, base64: true, quality: 0.85,
      });
      if (picked.canceled || !picked.assets[0]) {
        setFeedback({ tone: 'info', text: 'Walang image na pinili.' });
        return;
      }
      const asset = picked.assets[0];
      if (!asset.base64) throw new Error('Hindi nabasa ang image. Pumili ng JPEG, PNG o WebP.');
      const mime = asset.mimeType ?? 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
        throw new Error('JPEG, PNG o WebP lamang ang puwedeng i-upload.');
      }
      if ((asset.fileSize ?? Math.ceil(asset.base64.length * 3 / 4)) > MAX_BYTES) {
        throw new Error('Lampas 15 MB ang image. Gumamit ng mas maliit na file.');
      }
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      const path = 'episodes/' + episodeId + '/' + kind + '-' + selectedPlacement + '-' + Date.now() + '.' + ext;
      setBusyAction('Nag-u-upload ng larawan');
      setFeedback({ tone: 'info', text: 'Nag-u-upload ang larawan…' });
      const { error: uploadError } = await supabase.storage.from('kl-publishing').upload(
        path, decode(asset.base64), { contentType: mime, upsert: false },
      );
      if (uploadError) throw uploadError;
      setBusyAction('Inirerehistro sa server');
      setFeedback({ tone: 'info', text: 'Na-upload ang file. Inirerehistro ang chapter media…' });
      const { data, error: saveError } = await supabase.rpc('kl_admin_media_save_v1', {
        p_episode_id: episodeId, p_kind: kind, p_placement: selectedPlacement, p_path: path, p_approved: false,
      });
      if (saveError || !(data as { ok?: boolean } | null)?.ok) {
        throw new Error('Naka-upload ang file pero hindi nakumpirma ang media record. ' +
          (saveError?.message ?? 'Huwag munang mag-upload muli; i-check ang media list.'));
      }
      setItems((previous) => [...previous.filter((item) => !(item.kind === kind && item.placement === selectedPlacement)),
        { kind, placement: selectedPlacement, approved: false, path }]);
      if (kind === 'illustration') {
        // New artwork invalidates the old placement and effect for this scene only.
        setSceneDrafts((previous) => clearSceneDraft(previous, selectedPlacement));
      }
      await refreshMedia().catch(() => undefined);
      setFeedback({ tone: 'success', text: 'Image uploaded and registered. Pending approval; private preview lang muna.' });
      onUploaded?.();
    });
  };

  const uploadAudio = () => {
    void perform('Pumipili ng audio', async () => {
      const picked = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets[0]) {
        setFeedback({ tone: 'info', text: 'Walang audio na pinili.' });
        return;
      }
      const asset = picked.assets[0];
      const name = asset.name.toLowerCase();
      let mime: string;
      let ext: string;
      if (name.endsWith('.mp3')) { mime = 'audio/mpeg'; ext = 'mp3'; }
      else if (name.endsWith('.m4a') || name.endsWith('.mp4')) { mime = 'audio/mp4'; ext = 'm4a'; }
      else if (name.endsWith('.ogg')) { mime = 'audio/ogg'; ext = 'ogg'; }
      else throw new Error('MP3, M4A o OGG lamang ang supported audio. Hindi supported ang WAV sa private bucket.');
      if (asset.size && asset.size > MAX_BYTES) throw new Error('Audio limit: 15 MB.');
      const bytes = await new File(asset.uri).bytes();
      if (bytes.byteLength > MAX_BYTES) throw new Error('Audio limit: 15 MB.');
      const path = 'episodes/' + episodeId + '/' + kind + '-0-' + Date.now() + '.' + ext;
      setBusyAction('Nag-u-upload ng audio');
      setFeedback({ tone: 'info', text: 'Nag-u-upload ang audio…' });
      const { error: uploadError } = await supabase.storage.from('kl-publishing')
        .upload(path, bytes, { contentType: mime, upsert: false });
      if (uploadError) throw uploadError;
      setBusyAction('Inirerehistro sa server');
      const { data, error: saveError } = await supabase.rpc('kl_admin_media_save_v1', {
        p_episode_id: episodeId, p_kind: kind, p_placement: 0, p_path: path, p_approved: false,
      });
      if (saveError || !(data as { ok?: boolean } | null)?.ok) {
        throw new Error('Naka-upload ang audio pero hindi nakumpirma ang media record. ' +
          (saveError?.message ?? 'I-check muna ang media list.'));
      }
      setItems((previous) => [...previous.filter((item) => item.kind !== kind),
        { kind, placement: 0, approved: false, path }]);
      await refreshMedia().catch(() => undefined);
      setFeedback({ tone: 'success', text: 'Audio uploaded and registered. Pending approval; hindi pa public.' });
      onUploaded?.();
    });
  };

  const saveAnchor = () => {
    if (!selected) {
      setFeedback({ tone: 'error', text: 'Mag-upload muna ng illustration para sa napiling scene.' });
      return;
    }
    if (!manuscriptSaved) {
      setFeedback({ tone: 'error', text: 'I-save muna ang manuscript bago piliin ang exact placement.' });
      return;
    }
    const exact = anchor.trim();
    if (exact.length < 12 || !manuscript.includes(exact) || manuscript.split(exact).length !== 2) {
      setFeedback({ tone: 'error', text: 'Mag-paste ng unique sentence (12+ characters) na eksaktong isang beses lang makikita sa saved manuscript.' });
      return;
    }
    const duplicateSavedScene = items.some((item) =>
      item.kind === 'illustration' && item.placement !== placement && item.anchor?.trim() === exact);
    const duplicateDraftScene = Object.entries(sceneDrafts).some(([scene, draft]) =>
      Number(scene) !== placement && (draft.anchor ?? '').trim() === exact);
    if (duplicateSavedScene || duplicateDraftScene) {
      setFeedback({ tone: 'error', text: 'Gumamit ng ibang passage para sa bawat scene. May scene nang gumagamit ng pangungusap na ito.' });
      return;
    }
    void perform('Sine-save ang image placement', async () => {
      const { data, error } = await supabase.rpc('kl_admin_place_media_v1', {
        p_episode_id: episodeId, p_kind: 'illustration', p_placement: placement,
        p_anchor: exact, p_side: side,
      });
      if (error) throw error;
      if (!(data as { ok?: boolean } | null)?.ok) throw new Error('Hindi nakumpirma ng server ang placement.');
      const changed = (data as { changed?: boolean }).changed !== false;
      setItems((previous) => previous.map((item) =>
        item.kind === 'illustration' && item.placement === placement
          ? { ...item, anchor: exact, side, approved: changed ? false : item.approved }
          : item));
      setFeedback({ tone: 'success', text: changed
        ? 'Scene ' + placement + ' placement saved on server. Kailangan ulit mag-prepare ng preview.'
        : 'Scene ' + placement + ' placement is already saved on server.' });
      if (changed) onPreviewInvalidated?.();
    });
  };

  const saveEffect = () => {
    if (!selected) {
      setFeedback({ tone: 'error', text: 'Mag-upload muna ng illustration bago mag-save ng scene effect.' });
      return;
    }
    void perform('Sine-save ang scene effect', async () => {
      const { data, error } = await supabase.rpc('kl_admin_scene_effect_v1', {
        p_episode_id: episodeId, p_placement: placement, p_effect: effect, p_intensity: intensity,
      });
      if (error) throw error;
      if (!(data as { ok?: boolean } | null)?.ok) throw new Error('Hindi nakumpirma ng server ang scene effect.');
      const changed = (data as { changed?: boolean }).changed !== false;
      setItems((previous) => previous.map((item) =>
        item.kind === 'illustration' && item.placement === placement
          ? { ...item, effect, intensity, approved: changed ? false : item.approved }
          : item));
      setFeedback({ tone: 'success', text: changed
        ? 'Scene ' + placement + ' effect saved. Preview approval will be required again.'
        : 'Scene ' + placement + ' effect is already saved on server.' });
      if (changed) onPreviewInvalidated?.();
    });
  };

  return (
    <View style={{ gap: 10, paddingVertical: 12 }}>
      <Text style={{ color: '#ffe0a8', fontWeight: '700', fontSize: 17 }}>Illustrations · Music · Ambience · Animation</Text>
      <Text style={{ color: '#c8d2da' }}>Select a type. Every upload stays private until media approval and chapter release.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {kindLabels.map((option) => (
          <Choice key={option.value} label={option.label} selected={kind === option.value}
            disabled={isBusy} onPress={() => setKind(option.value)} />
        ))}
      </View>
      {kind === 'illustration' ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#c8d2da' }}>
            Puwedeng magdagdag ng hanggang {KL_MAX_SCENE_COUNT} scenes. May sariling image, exact placement at effect ang bawat isa.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {sceneNumbers.map((scene) => (
              <Choice key={scene} label={'Scene ' + scene} selected={placement === scene}
                disabled={isBusy} onPress={() => setPlacement(scene)} />
            ))}
            <Choice label="+ Add Scene" disabled={isBusy || sceneNumbers.length >= KL_MAX_SCENE_COUNT}
              onPress={() => {
                const next = nextKlSceneCount(items, visibleSceneCount);
                setVisibleSceneCount(next);
                setPlacement(next);
                setFeedback({ tone: 'info', text: 'Scene ' + next + ' is ready. Mag-upload ng illustration para ma-save sa server.' });
              }} />
          </View>
          {sceneNumbers.length >= KL_MAX_SCENE_COUNT
            ? <Text style={{ color: '#ffe0a8' }}>Maximum na ang {KL_MAX_SCENE_COUNT} scenes sa kabanatang ito.</Text>
            : null}
        </View>
      ) : null}
      <Choice label={isBusy ? busyAction + '…' : imageSelected ? 'Upload Image' : 'Upload Audio'}
        disabled={isBusy} onPress={() => imageSelected ? uploadImage() : uploadAudio()} />
      {feedback ? (
        <Text accessibilityRole="alert" style={{
          padding: 10, borderRadius: 8, color: '#fff',
          backgroundColor: feedback.tone === 'error' ? '#543037' : feedback.tone === 'success' ? '#284d43' : '#293e57',
        }}>{feedback.text}</Text>
      ) : null}
      <Text style={{ color: '#fff' }}>
        {selected
          ? (kind + ' · ' + selectedPlacement + ' · ' + (selected.approved ? 'Approved' : 'Pending approval'))
          : 'Wala pang uploaded ' + kind + ' para sa selection na ito.'}
      </Text>
      {imageSelected && previewUrl ? (
        <View style={{ gap: 5 }}>
          <View style={{ overflow: 'hidden', borderRadius: 9, backgroundColor: '#243748' }}>
            <Image source={{ uri: previewUrl }} contentFit="contain"
              style={{ width: '100%', aspectRatio: 16 / 9 }}
              onError={() => setFeedback({ tone: 'error', text: 'Hindi ma-render ang napiling larawan. I-check ang private media at i-refresh ang chapter.' })}
              accessibilityLabel="Private preview of selected chapter image" />
            {kind === 'illustration' ? (
              <KlSceneEffect effect={effect as SceneEffect} intensity={intensity} active={motionPlaying} />
            ) : null}
          </View>
          <Text style={{ color: '#c8d2da' }}>Private image preview · {selected?.approved ? 'Approved' : 'Not yet public'}</Text>
        </View>
      ) : null}
      {!imageSelected ? <KlChapterAudio music={kind === 'music' ? audioUrl : undefined}
        ambient={kind === 'ambient' ? audioUrl : undefined} showWhenEmpty /> : null}
      {kind === 'illustration' ? (
        <>
          <Text style={{ color: '#fff' }}>Exact paragraph anchor (unique sentence from saved manuscript)</Text>
          <TextInput value={anchor} onChangeText={(value) => editScene({ anchor: value })} multiline
            placeholder="Sentence from manuscript" placeholderTextColor="#aeb4bb"
            style={{ color: '#fff', borderWidth: 1, borderColor: '#718096', padding: 12, borderRadius: 8 }} />
          <Text style={{ color: placementSaved ? '#c7f4d8' : '#ffe0a8' }}>
            {placementSaved ? 'Scene ' + placement + ': exact placement saved on server'
              : selected?.anchor ? 'Scene ' + placement + ': unsaved placement changes'
                : 'Scene ' + placement + ': no saved paragraph position yet'}
          </Text>
          <Choice label={'Image position: ' + side + ' selected paragraph'} disabled={isBusy}
            onPress={() => editScene({ side: side === 'before' ? 'after' : 'before' })} />
          <Choice label={busyAction === 'Sine-save ang image placement' ? 'Saving placement…' : 'Save exact placement'}
            disabled={isBusy} onPress={saveAnchor} />
          {placementSaved ? <Text style={{ color: '#c7f4d8' }}>✓ Scene {placement} placement saved on server.</Text> : null}
          <Text style={{ color: '#fff' }}>Scene {placement} atmosphere (built-in, no animation upload)</Text>
          <Text style={{ color: '#c8d2da' }}>Live demo: pumili ng effect sa ibaba. Makikita agad ang galaw sa larawan sa itaas; Save Scene Effect para maitala sa server.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['none', 'rain', 'fog', 'fireflies', 'embers', 'lightning'].map((option) => (
              <Choice key={option} label={option} selected={effect === option} disabled={isBusy}
                onPress={() => editScene({ effect: option })} />
            ))}
          </View>
          <Choice label={'Intensity ' + intensity + '% (tap to adjust)'} disabled={isBusy}
            onPress={() => editScene({ intensity: intensity >= 80 ? 20 : intensity + 20 })} />
          <Choice label={motionPlaying ? 'Pause animation preview' : 'Play animation preview'}
            disabled={isBusy} onPress={() => setMotionPlaying((playing) => !playing)} />
          <Choice label={busyAction === 'Sine-save ang scene effect' ? 'Saving scene effect…' : 'Save Scene Effect'}
            disabled={isBusy} onPress={saveEffect} />
          <Text style={{ color: effectSaved ? '#c7f4d8' : '#ffe0a8' }}>
            {effectSaved ? '✓ Scene ' + placement + ' effect saved on server.' : 'Scene ' + placement + ' effect has unsaved changes.'}
          </Text>
        </>
      ) : null}
      <Text style={{ color: '#c8d2da' }}>
        Uploaded media: {items.length}. Server-approved: {approvedCount}/{items.length}.
        Visual artwork approval is separate from server media approval.
        Prepare and open the private preview below to review and approve each media file.
      </Text>
      <Choice label="Refresh media & approvals from server" disabled={isBusy}
        onPress={() => void perform('Nire-refresh ang media', async () => {
          await refreshMedia();
          setMediaRefreshToken((token) => token + 1);
          setFeedback({ tone: 'success', text: 'Updated media approval status from server.' });
        })} />
      {feedback ? (
        <Text accessibilityRole="alert" style={{ color: feedback.tone === 'error' ? '#ffb8b8' : feedback.tone === 'success' ? '#c7f4d8' : '#e3e8ef' }}>
          {feedback.text}
        </Text>
      ) : null}
      {items.map((item) => (
        <Text key={item.kind + ':' + item.placement} style={{ color: '#fff' }}>
          {item.kind} {item.placement}: {item.approved ? 'Approved' : 'Pending approval'}
        </Text>
      ))}
    </View>
  );
}
