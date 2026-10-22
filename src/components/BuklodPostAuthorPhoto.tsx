import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ProfileAvatarStatusIndicator } from '@/components/ProfileAvatar';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Props = {
  userId?: string | null;
  uri?: string | null;
  name?: string | null;
  size?: number;
  fallbackSource?: number | { uri: string } | null;
};
const metadata = new Map<string, { url: string | null; at: number }>();
const pending = new Map<string, Promise<string | null>>();
function normalize(raw?: string | null) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const objectPath = value.replace(/^\/+/, '').replace(/^profile-avatars\//i, '').split('?')[0];
  return objectPath ? supabase.storage.from('profile-avatars').getPublicUrl(objectPath).data.publicUrl : null;
}
async function selectedPhoto(userId: string, force = false) {
  const running = pending.get(userId);
  if (running) return running;
  const saved = metadata.get(userId);
  if (!force && saved && Date.now() - saved.at < 120_000) return saved.url;
  const request = (async () => {
    const { data, error } = await (supabase as any).rpc('get_buklod_profile_avatars_v1', { p_user_ids: [userId] });
    if (error) throw error;
    const row = Array.isArray(data) ? data.find((item: any) => item.user_id === userId || item.id === userId) ?? data[0] : data;
    const url = normalize(row?.avatar_url);
    metadata.set(userId, { url, at: Date.now() });
    return url;
  })();
  pending.set(userId, request);
  try { return await request; } finally { if (pending.get(userId) === request) pending.delete(userId); }
}

/** Wall-only recovery: selected profile photo first; bounded retry per identity. */
export default function BuklodPostAuthorPhoto({ userId, uri, name, size = 42, fallbackSource }: Props) {
  const [url, setUrl] = useState<string | null>(() => normalize(uri) || (userId ? metadata.get(userId)?.url : null) || null);
  const [retryVersion, setRetryVersion] = useState(0);
  const retry = useRef(false);
  const recovering = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    retry.current = false;
    recovering.current = false;
    setRetryVersion(0);
    const direct = normalize(uri);
    setUrl(direct || (userId ? metadata.get(userId)?.url : null) || null);
    if (!direct && userId) {
      void selectedPhoto(userId).then(next => {
        if (generation.current === current) setUrl(next || normalize(`${userId}/avatar.jpg`));
      }).catch(() => {
        if (generation.current === current) setUrl(normalize(`${userId}/avatar.jpg`));
      });
    }
    return () => { generation.current += 1; };
  }, [userId, uri]);
  const recover = async () => {
    if (recovering.current) return;
    if (retry.current || !userId) { setUrl(null); return; }
    retry.current = true;
    recovering.current = true;
    const current = generation.current;
    try {
      const next = await selectedPhoto(userId, true);
      let recovered = next || normalize(`${userId}/avatar.jpg`);
      const signedPath = recovered?.match(/\/storage\/v1\/object\/sign\/profile-avatars\/([^?]+)/)?.[1];
      if (signedPath) {
        const { data, error } = await supabase.storage.from('profile-avatars').createSignedUrl(decodeURIComponent(signedPath), 3600);
        if (!error && data?.signedUrl) recovered = data.signedUrl;
      } else if (recovered?.includes('/storage/v1/object/public/profile-avatars/')) {
        recovered += `${recovered.includes('?') ? '&' : '?'}buklod_photo_retry=${Date.now()}`;
      }
      if (generation.current !== current) return;
      setRetryVersion(value => value + 1);
      setUrl(recovered);
    } catch { if (generation.current === current) setUrl(null); }
    finally { if (generation.current === current) recovering.current = false; }
  };
  const circle = { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.greenSoft };
  return (
    <View style={{ width: size, height: size }}>
      {fallbackSource ? <Image source={fallbackSource} style={circle} contentFit="cover" cachePolicy="memory-disk" /> : (
        <View style={[circle, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: colors.greenDark, fontWeight: '900', fontSize: size * 0.38 }}>{(name?.trim()[0] || 'B').toUpperCase()}</Text>
        </View>
      )}
      {url ? <Image key={`${url}:${retryVersion}`} source={{ uri: url, cacheKey: `wall-author:${userId || ''}:${url}:${retryVersion}` }} style={[circle, { position: 'absolute' }]} contentFit="cover" cachePolicy="memory-disk" transition={0} onError={() => { void recover(); }} /> : null}
      <ProfileAvatarStatusIndicator userId={userId} size={size} />
    </View>
  );
}
