/* Keep Android external GIF shares alive until a comment is selected. */
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
const GIF_LIMIT_BYTES = 25 * 1024 * 1024;
const PREFIX = 'buklod-comment-share-';

export async function stageSharedCommentGif(sourceUri: string): Promise<string> {
  const uri = String(sourceUri ?? '').trim();
  if (!uri || !/^(file|content|blob):/i.test(uri)) {
    throw new Error('The shared GIF cannot be opened.');
  }
  if (Platform.OS === 'web') return uri;
  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error('Could not access BUKLOD GIF cache.');
  const target = directory + PREFIX + Date.now() + '-' +
    Math.random().toString(36).slice(2) + '.gif';
  try {
    await FileSystem.copyAsync({ from: uri, to: target });
    const info = await FileSystem.getInfoAsync(target);
    if (!info.exists || !('size' in info) || !Number(info.size)) {
      throw new Error('The shared GIF is empty or unreadable.');
    }
    if (Number(info.size) > GIF_LIMIT_BYTES) {
      throw new Error('Maximum GIF size is 25 MB.');
    }
    return target;
  } catch (error) {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
    throw error;
  }
}

export async function discardStagedSharedCommentGif(uri: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const directory = FileSystem.cacheDirectory;
  if (!directory || !String(uri).startsWith(directory + PREFIX)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}
