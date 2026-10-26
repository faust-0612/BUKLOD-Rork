import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';

type Kind = 'cover' | 'illustration';
const DB_EPISODE_PREFIX = 'aa000001-0000-4000-8000-';
export const klDatabaseId = (episodeNumber: number) =>
  DB_EPISODE_PREFIX + String(episodeNumber + 1).padStart(12, '0');

export default function KlAdminMediaUpload({ episodeNumber, onUploaded }: {
  episodeNumber: number;
  onUploaded?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [kind, setKind] = useState<Kind>('illustration');
  const [items, setItems] = useState<{kind: Kind; placement: number; approved: boolean}[]>([]);
  const load = async () => {
    const { data } = await supabase.rpc('kl_admin_media_list_v1', { p_episode_id: klDatabaseId(episodeNumber) });
    if (Array.isArray(data)) setItems(data.filter((item) => item.kind === 'cover' || item.kind === 'illustration'));
  };
  useEffect(() => { void load(); }, [episodeNumber]);
  const approve = async (mediaKind: Kind, mediaPlacement: number) => {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.rpc('kl_admin_media_approve_v1', {
      p_episode_id: klDatabaseId(episodeNumber), p_kind: mediaKind, p_placement: mediaPlacement,
    });
    setFeedback(error ? error.message : 'Media approved on server.');
    await load();
    setBusy(false);
  };
  const [placement, setPlacement] = useState(1);
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
      const episodeId = klDatabaseId(episodeNumber);
      const filePath = `episodes/${episodeId}/${kind}-${kind === 'cover' ? 0 : placement}-${Date.now()}.jpg`;
      setFeedback('Nag-u-upload…');
      const { error: uploadError } = await supabase.storage.from('kl-publishing')
        .upload(filePath, decode(asset.base64), { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      const { error: saveError } = await supabase.rpc('kl_admin_media_save_v1', {
        p_episode_id: episodeId, p_kind: kind,
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
    {items.map((item) => <View key={item.kind + item.placement} style={{ flexDirection: 'row', gap: 12 }}>
      <Text style={{ color: '#fff' }}>{item.kind} {item.placement}: {item.approved ? 'Approved' : 'Pending'}</Text>
      {!item.approved && <Pressable disabled={busy} onPress={() => void approve(item.kind, item.placement)}>
        <Text style={{ color: '#f1d39b' }}>Approve Media</Text>
      </Pressable>}
    </View>)}
    {feedback ? <Text accessibilityRole="alert" style={{ color: '#fff' }}>{feedback}</Text> : null}
  </View>;
}
