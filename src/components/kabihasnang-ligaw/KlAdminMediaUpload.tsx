import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';

type Kind = 'cover' | 'illustration';
const DB_EPISODE_PREFIX = 'aa000001-0000-4000-8000-';
export const klDatabaseId = (episodeNumber: number) =>
  DB_EPISODE_PREFIX + String(episodeNumber + 1).padStart(12, '0');

export default function KlAdminMediaUpload({ episodeNumber, episodeId: overrideId, onUploaded }: {
  episodeNumber: number;
  episodeId?: string;
  onUploaded?: () => void;
}) {
  const episodeId = overrideId ?? episodeId;
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [kind, setKind] = useState<Kind>('illustration');
  const [items, setItems] = useState<{kind: Kind; placement: number; approved: boolean}[]>([]);
  const load = async () => {
    const { data } = await supabase.rpc('kl_admin_media_list_v1', { p_episode_id: episodeId });
    if (Array.isArray(data)) setItems(data.filter((item) => item.kind === 'cover' || item.kind === 'illustration'));
  };
  useEffect(() => { void load(); }, [episodeNumber]);
  const approve = async (mediaKind: Kind, mediaPlacement: number) => {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.rpc('kl_admin_media_approve_v1', {
      p_episode_id: episodeId, p_kind: mediaKind, p_placement: mediaPlacement,
    });
    setFeedback(error ? error.message : 'Media approved on server.');
    await load();
    setBusy(false);
  };
  const [placement, setPlacement] = useState(1);
  const [effect, setEffect] = useState('none');
  const [anchor, setAnchor] = useState('');
  const [side, setSide] = useState<'before'|'after'>('after');
  const [intensity, setIntensity] = useState(30);
  const saveAnchor = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('kl_admin_place_media_v1', {
      p_episode_id: episodeId, p_kind: 'illustration', p_placement: placement,
      p_anchor: anchor.trim(), p_side: side,
    });
    setFeedback(error ? error.message : 'Placement saved.');
    setBusy(false);
  };
  const saveEffect = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('kl_admin_scene_effect_v1', {
      p_episode_id: episodeId, p_placement: placement,
      p_effect: effect, p_intensity: intensity,
    });
    setFeedback(error ? error.message : 'Scene effect saved.');
    setBusy(false);
  };
  const upload = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback('Pumili ng larawan…');
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: false, base64: true, quality: 0.85,
      });
      if (picked.canceled || !picked.assets[0]) { setFeedback('Kinansela.'); return; }
      const asset = picked.assets[0];
      if (!asset.base64) throw new Error('Hindi nabasa ang image data.');
      const selectedEpisodeId = episodeId;
      const filePath = `episodes/${selectedEpisodeId}/${kind}-${kind === 'cover' ? 0 : placement}-${Date.now()}.jpg`;
      setFeedback('Nag-u-upload…');
      const { error: uploadError } = await supabase.storage.from('kl-publishing')
        .upload(filePath, decode(asset.base64), { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      const { error: saveError } = await supabase.rpc('kl_admin_media_save_v1', {
        p_episode_id: selectedEpisodeId, p_kind: kind,
        p_placement: kind === 'cover' ? 0 : placement,
        p_path: filePath, p_approved: false,
      });
      if (saveError) throw saveError;
      setFeedback('Na-upload. Pending media approval; hindi pa public.');
      await load();
      onUploaded?.();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Hindi na-upload ang larawan.');
    } finally { setBusy(false); }
  };
  return <View style={{ gap: 8, paddingVertical: 8 }}>
    <Text style={{ color: '#f1d39b' }}>System Admin · Chapter media</Text>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Pressable disabled={busy} onPress={() => setKind('cover')}><Text style={{ color: kind === 'cover' ? '#f1d39b' : '#fff' }}>Cover</Text></Pressable>
      <Pressable disabled={busy} onPress={() => setKind('illustration')}><Text style={{ color: kind === 'illustration' ? '#f1d39b' : '#fff' }}>Illustration</Text></Pressable>
      {kind === 'illustration' && <Pressable disabled={busy} onPress={() => setPlacement((n) => n % 3 + 1)}><Text style={{ color: '#fff' }}>Scene {placement} (change)</Text></Pressable>}
    </View>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void upload()}>
      <Text style={{ color: '#f1d39b' }}>{busy ? 'Uploading…' : 'Upload Image'}</Text>
    </Pressable>
    <Text style={{ color: '#fff' }}>Exact paragraph anchor (paste a unique sentence from the chapter)</Text>
    <TextInput value={anchor} onChangeText={setAnchor} multiline placeholder="Sentence from manuscript" placeholderTextColor="#999" style={{ color: '#fff', borderWidth: 1, borderColor: '#888', padding: 8 }} />
    <Pressable onPress={() => setSide(side === 'before' ? 'after' : 'before')}><Text style={{ color: '#fff' }}>Image position: {side} selected paragraph</Text></Pressable>
    <Pressable disabled={busy || anchor.trim().length < 12} onPress={() => void saveAnchor()}><Text style={{ color: '#f1d39b' }}>Save exact placement</Text></Pressable>
    <Text style={{ color: '#fff' }}>Scene {placement} atmosphere (built-in, no animation upload)</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {['none','rain','fog','fireflies','embers','lightning'].map((option) =>
        <Pressable key={option} disabled={busy} onPress={() => setEffect(option)}>
          <Text style={{ color: effect === option ? '#f1d39b' : '#fff' }}>{option}</Text>
        </Pressable>)}
    </View>
    <Pressable disabled={busy} onPress={() => setIntensity((n) => n >= 80 ? 20 : n + 20)}>
      <Text style={{ color: '#fff' }}>Intensity {intensity}% (tap to adjust)</Text>
    </Pressable>
    <Pressable disabled={busy} onPress={() => void saveEffect()}>
      <Text style={{ color: '#f1d39b' }}>Save Scene Effect</Text>
    </Pressable>
    {items.map((item) => <View key={item.kind + item.placement} style={{ flexDirection: 'row', gap: 12 }}>
      <Text style={{ color: '#fff' }}>{item.kind} {item.placement}: {item.approved ? 'Approved' : 'Pending'}</Text>

    </View>)}
    {feedback ? <Text accessibilityRole="alert" style={{ color: '#fff' }}>{feedback}</Text> : null}
  </View>;
}
