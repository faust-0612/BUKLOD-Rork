import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer } from 'expo-video';
import type { VideoThumbnail } from 'expo-video';

import { uploadCommunityPhotoFile } from '@/lib/uploadCommunityVideoFile';

const STILL_DIRECTORY = 'buklod-video-stills';

export function communityVideoStillKey(value: string) {
  const raw = String(value || '').trim().split('?')[0];
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function communityVideoPosterPath(mediaPath?: string | null) {
  const path = String(mediaPath ?? '').trim();
  if (!path || path.startsWith('aws:')) return '';
  if (!path.includes('post-video-v2-')) return '';
  return path.replace(/\.(mp4|mov|webm|m4v)$/i, '-still.jpg');
}

function stillDirectory() {
  const directory = new Directory(Paths.cache, STILL_DIRECTORY);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

function stillFile(cacheKey: string) {
  return new File(
    stillDirectory(),
    `${communityVideoStillKey(cacheKey)}.jpg`,
  );
}

export function readCachedCommunityVideoStill(cacheKey: string) {
  const key = String(cacheKey || '').trim();
  if (!key) return null;
  try {
    const file = stillFile(key);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

export async function persistCommunityVideoStill(
  cacheKey: string,
  frame: VideoThumbnail,
) {
  const key = String(cacheKey || '').trim();
  if (!key) return null;
  const existing = readCachedCommunityVideoStill(key);
  if (existing) return existing;

  try {
    const rendered = await ImageManipulator.manipulate(frame).renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.72,
    });
    const destination = stillFile(key);
    if (!destination.exists) {
      new File(saved.uri).copySync(destination);
    }
    return destination.exists ? destination.uri : saved.uri;
  } catch {
    return null;
  }
}

export async function cacheCommunityVideoPoster(
  cacheKey: string,
  url: string,
) {
  const key = String(cacheKey || '').trim();
  const source = String(url || '').trim();
  if (!key || !source || readCachedCommunityVideoStill(key)) return;

  try {
    await File.downloadFileAsync(source, stillFile(key), {
      idempotent: true,
    });
  } catch {
    // The remote still can still be shown. The next play can save it again.
  }
}

export async function uploadCommunityVideoPoster({
  videoUri,
  videoPath,
  posterPath,
}: {
  videoUri: string;
  videoPath: string;
  posterPath: string;
}) {
  const player = createVideoPlayer(videoUri);
  try {
    const ready = await new Promise<boolean>((resolve) => {
      if (player.status === 'readyToPlay') {
        resolve(true);
        return;
      }

      let settled = false;
      let subscription: { remove: () => void } | null = null;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        subscription?.remove();
        resolve(false);
      }, 8000);
      subscription = player.addListener('statusChange', (event) => {
        if (event.status !== 'readyToPlay' && event.status !== 'error') return;
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        subscription?.remove();
        resolve(event.status === 'readyToPlay');
      });
    });

    if (!ready) return false;

    const shots = await player.generateThumbnailsAsync(0, {
      maxWidth: 720,
    });
    const frame = shots?.[0];
    if (!frame) return false;

    const savedUri = await persistCommunityVideoStill(videoPath, frame);
    if (!savedUri) return false;

    await uploadCommunityPhotoFile({
      path: posterPath,
      uri: savedUri,
    });
    return true;
  } finally {
    player.release();
  }
}
