import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  buildIgpatDraftSnapshot,
  isIgpatDraftSnapshot,
  type IgpatDraftSaveInput,
  type IgpatDraftSnapshot,
} from './draftTypes';

const DRAFT_KEY_PREFIX = '@buklod_igpat_draft_v1:';
const userQueues = new Map<string, Promise<unknown>>();

function safeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function metadataKey(userId: string): string {
  return `${DRAFT_KEY_PREFIX}${userId}`;
}

function draftDirectory(userId: string): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('Durable local storage is unavailable on this device.');
  }
  return `${FileSystem.documentDirectory}igpat-drafts/${safeUserId(userId)}/`;
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'video/quicktime') return 'mov';
  if (mimeType === 'video/webm') return 'webm';
  return 'mp4';
}

function enqueueForUser<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const previous = userQueues.get(userId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  userQueues.set(userId, next);
  void next.finally(() => {
    if (userQueues.get(userId) === next) userQueues.delete(userId);
  }).catch(() => undefined);
  return next;
}

async function readMetadata(userId: string): Promise<IgpatDraftSnapshot | null> {
  const raw = await AsyncStorage.getItem(metadataKey(userId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!isIgpatDraftSnapshot(parsed) || parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function prepareNativeIgpatDraftMedia({
  userId,
  sourceUri,
  mimeType,
}: {
  userId: string;
  sourceUri: string;
  mimeType: string;
}): Promise<string> {
  const directory = draftDirectory(userId);
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const target = `${directory}draft-${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionForMime(mimeType)}`;
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  return target;
}

export function saveNativeIgpatDraft(
  input: IgpatDraftSaveInput
): Promise<IgpatDraftSnapshot> {
  return enqueueForUser(input.userId, async () => {
    const info = await FileSystem.getInfoAsync(input.mediaUri);
    if (!info.exists) {
      throw new Error('The saved IGPAT draft video is no longer available.');
    }

    const previous = await readMetadata(input.userId);
    const snapshot = buildIgpatDraftSnapshot(input);
    await AsyncStorage.setItem(metadataKey(input.userId), JSON.stringify(snapshot));

    if (previous?.mediaUri && previous.mediaUri !== snapshot.mediaUri) {
      await FileSystem.deleteAsync(previous.mediaUri, { idempotent: true }).catch(() => undefined);
    }

    return snapshot;
  });
}

export async function loadNativeIgpatDraft(
  userId: string
): Promise<IgpatDraftSnapshot | null> {
  await (userQueues.get(userId) ?? Promise.resolve()).catch(() => undefined);
  const snapshot = await readMetadata(userId);
  if (!snapshot) return null;

  try {
    const info = await FileSystem.getInfoAsync(snapshot.mediaUri);
    if (!info.exists) {
      await AsyncStorage.removeItem(metadataKey(userId));
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

export function clearNativeIgpatDraft(userId: string): Promise<void> {
  return enqueueForUser(userId, async () => {
    await AsyncStorage.removeItem(metadataKey(userId));
    try {
      await FileSystem.deleteAsync(draftDirectory(userId), { idempotent: true });
    } catch {
      // Draft metadata is already removed; stale media cleanup can safely retry later.
    }
  });
}
