import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export const COMMUNITY_VIDEO_PREVIEW_MAX_BYTES = 125_000;

export type CommunityVideoPreviewFile = {
  uri: string;
  sizeBytes: number;
  cleanup: () => Promise<void>;
};

function stableHash(value: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ (code + i), 0x85ebca6b);
    b ^= b >>> 13;
  }
  return (a >>> 0).toString(16).padStart(8, '0') +
    (b >>> 0).toString(16).padStart(8, '0');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function communityVideoUploadPreviewPath(
  ownerId: string,
  originalMediaPath: string,
): string | null {
  const owner = String(ownerId ?? '').trim().toLowerCase();
  const source = String(originalMediaPath ?? '').trim();
  if (!UUID.test(owner) || !source || source.includes('..')) return null;
  return `${owner}/wall-previews/upload-${stableHash(source)}.jpg`;
}

export function communityVideoPostPreviewPath(
  viewerId: string,
  postId: string,
  mediaPosition: number,
  originalMediaPath: string,
): string | null {
  const owner = String(viewerId ?? '').trim().toLowerCase();
  const post = String(postId ?? '').trim().toLowerCase();
  const position = Number(mediaPosition);
  const source = String(originalMediaPath ?? '').trim();
  if (!UUID.test(owner) || !UUID.test(post) ||
      !Number.isInteger(position) || position < 0 || position > 10 ||
      !source || source.includes('..')) return null;
  return `${owner}/wall-previews/post-${post}-${position}-${stableHash(source)}.jpg`;
}

async function saveNativeThumbnail(thumbnail: any, side: number, quality: number) {
  const M = await import('expo-image-manipulator');
  const width = Number(thumbnail?.width ?? 0);
  const height = Number(thumbnail?.height ?? 0);
  if (!(width > 0 && height > 0)) return null;
  const context = M.ImageManipulator.manipulate(thumbnail);
  const longest = Math.max(width, height);
  if (longest > side) {
    context.resize(width >= height ? { width: side } : { height: side });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: M.SaveFormat.JPEG,
    compress: quality,
  });
  const info: any = await FileSystem.getInfoAsync(saved.uri, { size: true } as any);
  const sizeBytes = Number(info?.size ?? 0);
  if (!saved.uri || !sizeBytes) return null;
  return { uri: saved.uri, sizeBytes };
}

export async function saveCommunityVideoThumbnail(
  thumbnail: unknown,
): Promise<CommunityVideoPreviewFile | null> {
  if (!thumbnail || Platform.OS === 'web') return null;
  for (const [side, quality] of [[480, 0.58], [320, 0.44]] as const) {
    let saved: { uri: string; sizeBytes: number } | null = null;
    try {
      saved = await saveNativeThumbnail(thumbnail, side, quality);
      if (saved && saved.sizeBytes <= COMMUNITY_VIDEO_PREVIEW_MAX_BYTES) {
        return {
          ...saved,
          cleanup: async () => {
            await FileSystem.deleteAsync(saved!.uri, { idempotent: true }).catch(() => undefined);
          },
        };
      }
    } catch {
      // Try one smaller, more compressed rendition before giving up.
    }
    if (saved?.uri) {
      await FileSystem.deleteAsync(saved.uri, { idempotent: true }).catch(() => undefined);
    }
  }
  return null;
}

function waitForMediaEvent(target: any, eventName: string, timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener('error', onError);
      resolve(ok);
    };
    const onEvent = () => finish(true);
    const onError = () => finish(false);
    const timer = setTimeout(() => finish(false), timeoutMs);
    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener('error', onError, { once: true });
    if (eventName === 'loadeddata' && target.readyState >= 2) finish(true);
    if (eventName === 'seeked' && !target.seeking) finish(true);
  });
}

async function generateWebVideoPreview(uri: string): Promise<CommunityVideoPreviewFile | null> {
  const root: any = globalThis as any;
  const doc = root.document;
  const URLApi = root.URL;
  if (!doc?.createElement || !URLApi?.createObjectURL) return null;
  const video = doc.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = uri;
  try {
    const loaded = await waitForMediaEvent(video, 'loadeddata', 12_000);
    if (!loaded || !(video.videoWidth > 0 && video.videoHeight > 0)) return null;
    const duration = Number(video.duration);
    const seekTime = Number.isFinite(duration) && duration > 0
      ? Math.min(0.12, duration / 3)
      : 0;
    if (seekTime > 0) {
      video.currentTime = seekTime;
      if (!(await waitForMediaEvent(video, 'seeked', 5_000))) return null;
    }
    const longest = Math.max(video.videoWidth, video.videoHeight);
    for (const [side, quality] of [[480, 0.56], [320, 0.40]] as const) {
      const scale = Math.min(1, side / longest);
      const canvas = doc.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise(resolve =>
        canvas.toBlob((value: Blob | null) => resolve(value), 'image/jpeg', quality),
      );
      if (!blob || blob.size < 1 || blob.size > COMMUNITY_VIDEO_PREVIEW_MAX_BYTES) continue;
      const objectUrl = URLApi.createObjectURL(blob);
      return {
        uri: objectUrl,
        sizeBytes: blob.size,
        cleanup: async () => URLApi.revokeObjectURL(objectUrl),
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    try { video.pause(); } catch {}
    video.removeAttribute('src');
    try { video.load(); } catch {}
  }
}

async function generateNativeVideoPreview(uri: string): Promise<CommunityVideoPreviewFile | null> {
  const { createVideoPlayer } = await import('expo-video');
  const player: any = createVideoPlayer({ uri });
  try {
    player.muted = true;
    player.volume = 0;
    const ready = await new Promise<boolean>(resolve => {
      let settled = false;
      let subscription: any;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        subscription?.remove?.();
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), 15_000);
      subscription = player.addListener('statusChange', (event: any) => {
        const status = event?.status ?? player.status;
        if (status === 'readyToPlay') finish(true);
        else if (status === 'error') finish(false);
      });
      if (player.status === 'readyToPlay') finish(true);
      else if (player.status === 'error') finish(false);
    });
    if (!ready) return null;
    const duration = Number(player.duration ?? 0);
    const frameTime = duration > 0 ? Math.min(0.1, duration / 2) : 0.1;
    let thumbnailTimer: ReturnType<typeof setTimeout> | null = null;
    const thumbnails = await Promise.race([
      player.generateThumbnailsAsync([frameTime], { maxWidth: 480, maxHeight: 480 }),
      new Promise<never>((_, reject) => {
        thumbnailTimer = setTimeout(() => reject(new Error('Video poster generation timed out')), 10_000);
      }),
    ]).finally(() => {
      if (thumbnailTimer) clearTimeout(thumbnailTimer);
    });
    return await saveCommunityVideoThumbnail(thumbnails?.[0] ?? null);
  } catch {
    return null;
  } finally {
    try { player.release(); } catch {}
  }
}

/** Generate one small first-frame JPEG. Failures never block the original video. */
export async function generateCommunityVideoPreview(
  uri: string,
): Promise<CommunityVideoPreviewFile | null> {
  const source = String(uri ?? '').trim();
  if (!source) return null;
  return Platform.OS === 'web'
    ? generateWebVideoPreview(source)
    : generateNativeVideoPreview(source);
}
