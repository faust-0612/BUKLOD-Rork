import { supabase } from '@/lib/supabase';

export const BUKLOD_POST_MOTION_PRESETS = [
  'none', 'zoom', 'pan', 'float', 'fade',
  'rain', 'storm', 'snow', 'mist', 'sparkles', 'fireflies', 'petals',
  'sunrays', 'dust', 'bokeh', 'stars', 'autumn', 'underwater',
] as const;
export const BUKLOD_POST_MOTION_AMBIENCES = [
  'rain', 'storm', 'snow', 'mist', 'sparkles', 'fireflies', 'petals',
  'sunrays', 'dust', 'bokeh', 'stars', 'autumn', 'underwater',
] as const;
export const BUKLOD_POST_MOTION_LABELS: Record<typeof BUKLOD_POST_MOTION_PRESETS[number], string> = {
  none: 'No effect', zoom: 'Slow zoom', pan: 'Cinematic pan',
  float: 'Gentle float', fade: 'Soft fade', rain: 'Rainfall',
  storm: 'Heavy rain', snow: 'Snowfall', mist: 'Morning mist',
  sparkles: 'Sparkles', fireflies: 'Fireflies', petals: 'Flower petals',
  sunrays: 'Sun rays', dust: 'Floating dust', bokeh: 'Bokeh lights',
  stars: 'Twinkling stars', autumn: 'Autumn leaves',
  underwater: 'Underwater glow',
};
export type BuklodPostMotionPreset = typeof BUKLOD_POST_MOTION_PRESETS[number];
export type BuklodPostMusicTrack = {
  id: string; title: string; artist: string | null;
  audio_path: string; mime_type: string | null;
};
export type BuklodPostCreative = {
  post_id: string;
  motion_preset: BuklodPostMotionPreset;
  music_track_id: string | null;
  music_clip_start_seconds: number | null;
  music_clip_duration_seconds: number | null;
  music: BuklodPostMusicTrack | null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function normalizeBuklodMotion(v: unknown): BuklodPostMotionPreset {
  return BUKLOD_POST_MOTION_PRESETS.includes(v as BuklodPostMotionPreset) ? v as BuklodPostMotionPreset : 'none';
}
export async function listBuklodPostMusic(search = ''): Promise<BuklodPostMusicTrack[]> {
  let q = (supabase as any).from('buklod_music_library')
    .select('id,title,artist,audio_path,mime_type')
    .eq('is_active', true).order('sort_order', { ascending: true }).limit(120);
  const term = search.trim().replace(/[%_]/g, '').slice(0, 64);
  if (term) q = q.ilike('title', '%' + term + '%');
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).filter((t: any) => UUID.test(String(t.id)) && !!t.audio_path);
}
export async function loadBuklodPostCreatives(ids: string[]): Promise<Record<string, BuklodPostCreative>> {
  const unique = [...new Set(ids.filter(id => UUID.test(id)))];
  const rows: any[] = [];
  for (let offset=0; offset<unique.length; offset+=80) {
    const { data, error } = await (supabase as any).from('buklod_post_creatives')
      .select('post_id,music_track_id,motion_preset,music_clip_start_seconds,music_clip_duration_seconds').in('post_id', unique.slice(offset, offset+80));
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  const musicIds = [...new Set(rows.map(r => String(r.music_track_id ?? '')).filter(id => UUID.test(id)))];
  const tracks = new Map<string, BuklodPostMusicTrack>();
  for (let offset=0; offset<musicIds.length; offset+=80) {
    const { data, error } = await (supabase as any).from('buklod_music_library')
      .select('id,title,artist,audio_path,mime_type').eq('is_active', true)
      .in('id', musicIds.slice(offset, offset+80));
    if (error) throw error;
    for (const track of data ?? []) if (track?.audio_path) tracks.set(String(track.id), track);
  }
  const result: Record<string, BuklodPostCreative> = {};
  for (const r of rows) {
    const id=String(r.post_id);
    result[id]={post_id:id, music_track_id:r.music_track_id ?? null,
      motion_preset:normalizeBuklodMotion(r.motion_preset),
      music_clip_start_seconds:r.music_clip_start_seconds == null ? null : Number(r.music_clip_start_seconds),
      music_clip_duration_seconds:r.music_clip_duration_seconds == null ? null : Number(r.music_clip_duration_seconds),
      music:tracks.get(String(r.music_track_id ?? '')) ?? null};
  }
  return result;
}
export async function saveBuklodPostCreative(input: {
  postId:string; userId:string; musicTrackId:string|null; motionPreset:BuklodPostMotionPreset;
  clipStartSeconds?:number|null; clipDurationSeconds?:number|null;
}) {
  const motion = normalizeBuklodMotion(input.motionPreset);
  if (motion === 'none' && !input.musicTrackId) return;
  if (!UUID.test(input.postId) || !UUID.test(input.userId)) throw new Error('Invalid post/account ID.');
  const hasClip = !!input.musicTrackId && input.clipStartSeconds != null && input.clipDurationSeconds != null;
  const clipStart = hasClip ? Number(input.clipStartSeconds) : null;
  const clipDuration = hasClip ? Number(input.clipDurationSeconds) : null;
  if (hasClip && (!Number.isFinite(clipStart) || !Number.isFinite(clipDuration) ||
    clipStart! < 0 || clipStart! > 21600 || clipDuration! < 5 || clipDuration! > 60)) {
    throw new Error('Select a valid 5–60 second music clip.');
  }
  const { error } = await (supabase as any).from('buklod_post_creatives').insert({
    post_id:input.postId, created_by:input.userId,
    music_track_id:input.musicTrackId, motion_preset:motion,
    music_clip_start_seconds:clipStart, music_clip_duration_seconds:clipDuration,
  });
  if (error) throw error;
}
/** Only invoked after listener taps Play; keeps preview/catalog bandwidth minimal. */
export async function resolveBuklodPostMusicUrl(track: BuklodPostMusicTrack): Promise<string> {
  const original = String(track.audio_path ?? '').trim();
  if (!original) throw new Error('Music file unavailable.');
  if (/^https:\/\//i.test(original)) return original;
  if (/^http:\/\//i.test(original)) throw new Error('Insecure music URL blocked.');
  const path = original.replace(/^\/+/, '');
  const bare = path.replace(/^buklod-music-library\//i, '');
  let message = '';
  for (const candidate of [...new Set([path,bare])]) {
    const { data, error } = await (supabase as any).storage
      .from('buklod-music-library').createSignedUrl(candidate, 3600);
    if (!error && data?.signedUrl) return String(data.signedUrl);
    message = String(error?.message ?? message);
  }
  throw new Error(message || 'Secure music URL unavailable.');
}
