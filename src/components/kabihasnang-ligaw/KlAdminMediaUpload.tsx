import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { emptyScene, reconcileSceneDrafts, type SceneDraft } from '@/lib/kabihasnang-ligaw/sceneDraftState';
import KlChapterAudio from './KlChapterAudio';
import { KlSceneEffect, type SceneEffect } from './KlSceneEffect';

type Kind = 'cover' | 'illustration' | 'music' | 'ambient';
type MediaItem = { kind: Kind; placement: number; approved: boolean; path: string;
  anchor?: string | null; side?: 'before' | 'after' | null;
  effect?: SceneEffect | null; intensity?: number | null };
type Feedback = { tone: 'success' | 'error' | 'info'; text: string };
type PendingAudio = { uri: string; name: string; mime: string; ext: string; kind: 'music' | 'ambient' };

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

export default function KlAdminMediaUpload({ episodeNumber, episodeId: overrideId, onUploaded, manuscript = '', manuscriptSaved = false, initialKind = 'illustration' }: {
  episodeNumber: number;
  episodeId?: string;
  onUploaded?: () => void;
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
  const [items, setItems] = useState<MediaItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [sceneDrafts, setSceneDrafts] = useState<Record<number, SceneDraft>>({});
  const sceneDirty = useRef<Record<number, { anchor?: boolean; effect?: boolean }>>({});
  const [motionPlaying, setMotionPlaying] = useState(true);
  const [audioUrl, setAudioUrl] = useState('');
  const [pendingAudio, setPendingAudio] = useState<PendingAudio | null>(null);
  const [audioSource, setAudioSource] = useState<'selected' | 'uploaded'>('uploaded');
  const [mediaRefreshToken, setMediaRefreshToken] = useState(0);

  useEffect(() => setKind(initialKind), [initialKind]);

  const selectedPlacement = kind === 'illustration' ? placement : 0;
  const selected = items.find((item) => item.kind === kind && item.placement === selectedPlacement);
  const imageSelected = kind === 'cover' || kind === 'illustration';
  const isBusy = !!busyAction;
  const scene = sceneDrafts[placement] ?? emptyScene();
  const pendingForKind = pendingAudio?.kind === kind ? pendingAudio : null;
  const selectedAudioUrl = audioSource === 'selected' && pendingForKind ? pendingForKind.uri : audioUrl;

  const changeScene = (change: Partial<SceneDraft>, field: 'anchor' | 'effect') => {
    sceneDirty.current[placement] = { ...sceneDirty.current[placement], [field]: true };
    setSceneDrafts((previous) => ({ ...previous,
      [placement]: { ...emptyScene(), ...previous[placement], ...change },
    }));
    setFeedback({ tone: 'info', text: 'Scene ' + placement + ': may binago sa ' +
      (field === 'anchor' ? 'paragraph placement' : 'animation') + '. Pindutin ang Save para maitala sa server.' });
  };

  const acceptMedia = (data: MediaItem[]) => {
    const list = data.filter((item) => kindLabels.some((option) => option.value === item.kind));
    setItems(list);
    setSceneDrafts((previous) => reconcileSceneDrafts(previous, list, sceneDirty.current));
  };

  const refreshMedia = async () => {
    const { data, error } = await supabase.rpc('kl_admin_media_list_v1', { p_episode_id: episodeId });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Hindi nabasa ang media list ng chapter.');
    acceptMedia(data as MediaItem[]);
  };

  useEffect(() => {
    let active = true;
    void supabase.rpc('kl_admin_media_list_v1', { p_episode_id: episodeId }).then(({ data, error }) => {
      if (!active) return;
      if (error) setFeedback({ tone: 'error', text: 'Hindi na-load ang media: ' + error.message });
      else if (Array.isArray(data)) acceptMedia(data as MediaItem[]);
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
    setBusyAction(label);
    setFeedback({ tone: 'info', text: label + '…' });
    try {
      await task();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Hindi natuloy ang request.' });
    } finally {
      lock.current = false;
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
      if (kind === 'illustration') sceneDirty.current[selectedPlacement] = {};
      setItems((previous) => [...previous.filter((item) => !(item.kind === kind && item.placement === selectedPlacement)),
        { kind, placement: selectedPlacement, approved: false, path }]);
      await refreshMedia().catch(() => undefined);
      setFeedback({ tone: 'success', text: 'Image uploaded and registered. Pending approval; private preview lang muna.' });
      onUploaded?.();
    });
  };

  const chooseAudio = () => {
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
      setPendingAudio({ uri: asset.uri, name: asset.name, mime, ext, kind: kind as 'music' | 'ambient' });
      setAudioSource('selected');
      setFeedback({ tone: 'success', text: 'Audio selected: ' + asset.name + '. Pakinggan muna sa player, saka pindutin ang Upload selected audio.' });
    });
  };

  const uploadAudio = () => {
    if (!pendingForKind) {
      setFeedback({ tone: 'error', text: 'Pumili muna ng audio file at i-test sa player.' });
      return;
    }
    const candidate = pendingForKind;
    void perform('Inihahanda ang audio upload', async () => {
      const bytes = await new File(candidate.uri).bytes();
      if (bytes.byteLength > MAX_BYTES) throw new Error('Audio limit: 15 MB.');
      const path = 'episodes/' + episodeId + '/' + candidate.kind + '-0-' + Date.now() + '.' + candidate.ext;
      setBusyAction('Nag-u-upload ng audio');
      setFeedback({ tone: 'info', text: 'Nag-u-upload ang audio…' });
      const { error: uploadError } = await supabase.storage.from('kl-publishing')
        .upload(path, bytes, { contentType: candidate.mime, upsert: false });
      if (uploadError) throw uploadError;
      setBusyAction('Inirerehistro sa server');
      const { data, error: saveError } = await supabase.rpc('kl_admin_media_save_v1', {
        p_episode_id: episodeId, p_kind: candidate.kind, p_placement: 0, p_path: path, p_approved: false,
      });
      if (saveError || !(data as { ok?: boolean } | null)?.ok) {
        throw new Error('Naka-upload ang audio pero hindi nakumpirma ang media record. ' +
          (saveError?.message ?? 'I-check muna ang media list.'));
      }
      setItems((previous) => [...previous.filter((item) => item.kind !== candidate.kind),
        { kind: candidate.kind, placement: 0, approved: false, path }]);
      setPendingAudio(null);
      setAudioSource('uploaded');
      setMediaRefreshToken((token) => token + 1);
      await refreshMedia().catch(() => undefined);
      setFeedback({ tone: 'success', text: 'Audio saved on server. Maaari mo itong pakinggan muli sa uploaded player. Pending approval; private pa.' });
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
    const exact = scene.anchor.trim();
    if (exact.length < 12 || !manuscript.includes(exact) || manuscript.split(exact).length !== 2) {
      setFeedback({ tone: 'error', text: 'Mag-paste ng unique sentence (12+ characters) na eksaktong isang beses lang makikita sa saved manuscript.' });
      return;
    }
    void perform('Sine-save ang image placement', async () => {
      const { data, error } = await supabase.rpc('kl_admin_place_media_v1', {
        p_episode_id: episodeId, p_kind: 'illustration', p_placement: placement,
        p_anchor: exact, p_side: scene.side,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; changed?: boolean } | null;
      if (!result?.ok) throw new Error('Hindi nakumpirma ng server ang placement.');
      sceneDirty.current[placement] = { ...sceneDirty.current[placement], anchor: false };
      await refreshMedia();
      setFeedback({ tone: 'success', text: result.changed === false
        ? 'Scene ' + placement + ': saved placement is unchanged. Existing approval preserved.'
        : 'Scene ' + placement + ': paragraph placement saved. Ibang scenes at approvals hindi naapektuhan.' });
    });
  };

  const saveEffect = () => {
    if (!selected) {
      setFeedback({ tone: 'error', text: 'Mag-upload muna ng illustration bago mag-save ng scene effect.' });
      return;
    }
    void perform('Sine-save ang scene effect', async () => {
      const { data, error } = await supabase.rpc('kl_admin_scene_effect_v1', {
        p_episode_id: episodeId, p_placement: placement, p_effect: scene.effect, p_intensity: scene.intensity,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; changed?: boolean } | null;
      if (!result?.ok) throw new Error('Hindi nakumpirma ng server ang scene effect.');
      sceneDirty.current[placement] = { ...sceneDirty.current[placement], effect: false };
      await refreshMedia();
      setFeedback({ tone: 'success', text: result.changed === false
        ? 'Scene ' + placement + ': effect already saved. Approval preserved.'
        : 'Scene ' + placement + ': animation effect saved; scene-specific approval needed. Ibang scenes hindi naapektuhan.' });
    });
  };

  const approveMedia = () => {
    if (!selected) return;
    if (kind === 'illustration' && (sceneDirty.current[placement]?.anchor || sceneDirty.current[placement]?.effect)) {
      setFeedback({ tone: 'error', text: 'I-save muna ang binagong placement at animation para sa Scene ' + placement + ' bago i-approve.' });
      return;
    }
    const item = selected;
    void perform('Ina-approve ang ' + item.kind + ' ' + item.placement, async () => {
      const { data, error } = await supabase.rpc('kl_admin_media_approve_v1', {
        p_episode_id: episodeId, p_kind: item.kind, p_placement: item.placement,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; changed?: boolean } | null;
      if (!result?.ok) throw new Error('Hindi nakumpirma ng server ang approval.');
      await refreshMedia();
      setFeedback({ tone: 'success', text: result.changed === false
        ? 'Already approved: ' + item.kind + ' ' + item.placement + '.'
        : 'Approved on server: ' + item.kind + ' ' + item.placement + '. Ibang scenes unchanged; hindi pa public ang chapter.' });
    });
  };

  return (
    <View style={{ gap: 10, paddingVertical: 12 }}>
      <Text style={{ color: '#ffe0a8', fontWeight: '700', fontSize: 17 }}>Illustrations · Music · Ambience · Animation</Text>
      <Text style={{ color: '#c8d2da' }}>Select a type. Every upload stays private until media approval and chapter release.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {kindLabels.map((option) => (
          <Choice key={option.value} label={option.label} selected={kind === option.value}
            disabled={isBusy} onPress={() => { setKind(option.value);
              setFeedback({ tone: 'info', text: option.label + ' tab selected. Ang media at approvals ay hiwalay bawat uri.' }); }} />
        ))}
      </View>
      {kind === 'illustration' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[1, 2, 3].map((scene) => (
            <Choice key={scene} label={'Scene ' + scene} selected={placement === scene}
              disabled={isBusy} onPress={() => { setPlacement(scene);
                setFeedback({ tone: 'info', text: 'Scene ' + scene + ' selected. Ipinapakita ang sariling saved anchor at effect nito.' }); }} />
          ))}
        </View>
      ) : null}
      <Choice label={isBusy ? busyAction + '…' : imageSelected ? 'Upload Image' : 'Choose audio to listen before upload'}
        disabled={isBusy} onPress={() => imageSelected ? uploadImage() : chooseAudio()} />
      {pendingForKind ? (
        <View style={{ gap: 8, padding: 10, backgroundColor: '#254439', borderRadius: 8 }}>
          <Text style={{ color: '#fff' }}>Selected for {kind}: {pendingForKind.name} · Not uploaded yet.</Text>
          <Choice label="Listen to selected audio" selected={audioSource === 'selected'} disabled={isBusy}
            onPress={() => { setAudioSource('selected'); setFeedback({ tone: 'info', text: 'Pindutin ang Play sa ibabang player para i-test ang napiling file.' }); }} />
          <Choice label="Upload selected audio" disabled={isBusy} onPress={uploadAudio} />
          <Choice label="Cancel selected audio" disabled={isBusy} onPress={() => {
            setPendingAudio(null); setAudioSource('uploaded');
            setFeedback({ tone: 'info', text: 'Audio selection cancelled. Walang na-upload.' });
          }} />
        </View>
      ) : null}
      {!imageSelected && selected?.path ? (
        <Choice label="Listen to uploaded audio" selected={audioSource === 'uploaded'} disabled={isBusy}
          onPress={() => { setAudioSource('uploaded'); setFeedback({ tone: 'info', text: 'Pindutin ang Play sa player para i-test ang naka-save na private audio.' }); }} />
      ) : null}
      {feedback ? (
        <Text accessibilityRole="alert" style={{
          padding: 10, borderRadius: 8, color: '#fff',
          backgroundColor: feedback.tone === 'error' ? '#543037' : feedback.tone === 'success' ? '#284d43' : '#293e57',
        }}>{feedback.text}</Text>
      ) : null}
      <Text style={{ color: '#fff' }}>
        {selected
          ? (kind + ' · ' + selectedPlacement + ' · ' + (selected.approved ? 'Approved ✓' : 'Pending approval'))
          : 'Wala pang uploaded ' + kind + ' para sa selection na ito.'}
      </Text>
      {selected ? <Choice label={selected.approved ? 'Approved on server ✓' : 'Approve this ' + (kind === 'illustration' ? 'scene' : kind) + ' only'}
        disabled={isBusy || selected.approved} onPress={approveMedia} /> : null}
      {imageSelected && previewUrl ? (
        <View style={{ gap: 5 }}>
          <View style={{ overflow: 'hidden', borderRadius: 9, backgroundColor: '#243748' }}>
            <Image source={{ uri: previewUrl }} contentFit="contain"
              style={{ width: '100%', aspectRatio: 16 / 9 }}
              onError={() => setFeedback({ tone: 'error', text: 'Hindi ma-render ang napiling larawan. I-check ang private media at i-refresh ang chapter.' })}
              accessibilityLabel="Private preview of selected chapter image" />
            {kind === 'illustration' ? (
              <KlSceneEffect effect={scene.effect} intensity={scene.intensity} active={motionPlaying} />
            ) : null}
          </View>
          <Text style={{ color: '#c8d2da' }}>Private image preview · {selected?.approved ? 'Approved' : 'Not yet public'}</Text>
        </View>
      ) : null}
      {!imageSelected ? (
        <View style={{ gap: 5 }}>
          <Text style={{ color: '#ffe0a8' }}>
            {audioSource === 'selected' && pendingForKind ? 'Local audio test · not uploaded' : 'Uploaded audio test · private file'}
          </Text>
          <KlChapterAudio music={kind === 'music' ? selectedAudioUrl : undefined}
            ambient={kind === 'ambient' ? selectedAudioUrl : undefined} showWhenEmpty />
        </View>
      ) : null}
      {kind === 'illustration' ? (
        <>
          <Text style={{ color: '#c8d2da' }}>Scene {placement} · {selected?.anchor ? 'Saved anchor loaded' : 'No saved anchor yet'} · {sceneDirty.current[placement]?.anchor ? 'Unsaved placement edits' : 'Placement synced'}</Text>
          <Text style={{ color: '#fff' }}>Exact paragraph anchor for Scene {placement} (unique sentence from saved manuscript)</Text>
          <TextInput value={scene.anchor} onChangeText={(value) => changeScene({ anchor: value }, 'anchor')} multiline
            placeholder="Sentence from manuscript" placeholderTextColor="#aeb4bb"
            style={{ color: '#fff', borderWidth: 1, borderColor: '#718096', padding: 12, borderRadius: 8 }} />
          <Choice label={'Image position: ' + scene.side + ' selected paragraph'} disabled={isBusy}
            onPress={() => changeScene({ side: scene.side === 'before' ? 'after' : 'before' }, 'anchor')} />
          <Choice label={busyAction === 'Sine-save ang image placement' ? 'Saving placement…' : 'Save exact placement'}
            disabled={isBusy} onPress={saveAnchor} />
          <Text style={{ color: '#fff' }}>Scene {placement} atmosphere (built-in, no animation upload)</Text>
          <Text style={{ color: '#c8d2da' }}>Live demo: pumili ng effect sa ibaba. Makikita agad ang galaw sa larawan sa itaas; Save Scene Effect para maitala sa server.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['none', 'rain', 'fog', 'fireflies', 'embers', 'lightning'].map((option) => (
              <Choice key={option} label={option} selected={scene.effect === option} disabled={isBusy}
                onPress={() => changeScene({ effect: option as SceneEffect }, 'effect')} />
            ))}
          </View>
          <Choice label={'Intensity ' + scene.intensity + '% (tap to adjust)'} disabled={isBusy}
            onPress={() => changeScene({ intensity: scene.intensity >= 80 ? 20 : scene.intensity + 20 }, 'effect')} />
          <Choice label={motionPlaying ? 'Pause animation preview' : 'Play animation preview'}
            disabled={isBusy} onPress={() => { setMotionPlaying((playing) => !playing);
              setFeedback({ tone: 'info', text: motionPlaying ? 'Animation preview paused.' : 'Animation preview playing on image above.' }); }} />
          <Choice label={busyAction === 'Sine-save ang scene effect' ? 'Saving scene effect…' : 'Save Scene Effect'}
            disabled={isBusy} onPress={saveEffect} />
          <Text style={{ color: '#c8d2da' }}>{sceneDirty.current[placement]?.effect ? 'Unsaved scene effect changes' : 'Scene effect synced with server'}</Text>
        </>
      ) : null}
      <Text style={{ color: '#c8d2da' }}>
        Uploaded media: {items.length}. Visual artwork approval is separate from server media approval.
        Approve each scene here or directly beside its illustration in the private story preview.
      </Text>
      <Choice label="Refresh media & approvals from server" disabled={isBusy}
        onPress={() => void perform('Nire-refresh ang media', async () => {
          await refreshMedia();
          setMediaRefreshToken((token) => token + 1);
          setFeedback({ tone: 'success', text: 'Updated media approval status from server.' });
        })} />
      {items.map((item) => (
        <Text key={item.kind + ':' + item.placement} style={{ color: '#fff' }}>
          {item.kind} {item.placement}: {item.approved ? 'Approved' : 'Pending approval'}
        </Text>
      ))}
    </View>
  );
}
