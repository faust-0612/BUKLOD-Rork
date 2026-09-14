import {
  buildIgpatDraftSnapshot,
  isIgpatDraftSnapshot,
  type IgpatDraftSaveInput,
  type IgpatDraftSnapshot,
} from './draftTypes';

const DB_NAME = 'buklod-igpat-drafts-v1';
const DB_VERSION = 1;
const MEDIA_STORE = 'media';
const META_KEY_PREFIX = 'buklod_igpat_draft_v1:';
const MEDIA_TOKEN_PREFIX = 'indexeddb://buklod-igpat-drafts/';

function metadataKey(userId: string): string {
  return `${META_KEY_PREFIX}${userId}`;
}

function mediaToken(mediaKey: string): string {
  return `${MEDIA_TOKEN_PREFIX}${encodeURIComponent(mediaKey)}`;
}

function mediaKeyFromToken(token: string): string | null {
  if (!token.startsWith(MEDIA_TOKEN_PREFIX)) return null;
  try {
    return decodeURIComponent(token.slice(MEDIA_TOKEN_PREFIX.length));
  } catch {
    return null;
  }
}

function readMetadata(userId: string): IgpatDraftSnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(metadataKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!isIgpatDraftSnapshot(parsed) || parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IGPAT draft storage.'));
  });
}

async function putDraftBlob(mediaKey: string, blob: Blob): Promise<void> {
  const db = await openDraftDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      tx.objectStore(MEDIA_STORE).put(blob, mediaKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not save IGPAT draft video.'));
      tx.onabort = () => reject(tx.error ?? new Error('IGPAT draft video save was interrupted.'));
    });
  } finally {
    db.close();
  }
}

async function getDraftBlob(token: string): Promise<Blob | null> {
  const mediaKey = mediaKeyFromToken(token);
  if (!mediaKey) return null;
  const db = await openDraftDb();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const request = tx.objectStore(MEDIA_STORE).get(mediaKey);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error('Could not read IGPAT draft video.'));
    });
  } finally {
    db.close();
  }
}

async function deleteDraftBlob(token: string): Promise<void> {
  const mediaKey = mediaKeyFromToken(token);
  if (!mediaKey) return;
  const db = await openDraftDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      tx.objectStore(MEDIA_STORE).delete(mediaKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not clear IGPAT draft video.'));
      tx.onabort = () => reject(tx.error ?? new Error('IGPAT draft cleanup was interrupted.'));
    });
  } finally {
    db.close();
  }
}

export async function prepareWebIgpatDraftMedia(userId: string, blob: Blob): Promise<string> {
  const mediaKey = `${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  await putDraftBlob(mediaKey, blob);
  return mediaToken(mediaKey);
}

export function saveWebIgpatDraft(input: IgpatDraftSaveInput): IgpatDraftSnapshot {
  if (typeof localStorage === 'undefined') {
    throw new Error('Local draft metadata storage is unavailable in this browser.');
  }
  if (!mediaKeyFromToken(input.mediaUri)) {
    throw new Error('The IGPAT draft video is not durably stored in this browser.');
  }

  const previous = readMetadata(input.userId);
  const snapshot = buildIgpatDraftSnapshot(input);
  localStorage.setItem(metadataKey(input.userId), JSON.stringify(snapshot));

  if (previous?.mediaUri && previous.mediaUri !== snapshot.mediaUri) {
    void deleteDraftBlob(previous.mediaUri).catch(() => undefined);
  }

  return snapshot;
}

export async function loadWebIgpatDraft(
  userId: string
): Promise<{ snapshot: IgpatDraftSnapshot; uri: string } | null> {
  if (typeof localStorage === 'undefined') return null;
  const snapshot = readMetadata(userId);
  if (!snapshot) return null;

  try {
    const blob = await getDraftBlob(snapshot.mediaUri);
    if (!blob) {
      localStorage.removeItem(metadataKey(userId));
      return null;
    }
    return { snapshot, uri: URL.createObjectURL(blob) };
  } catch {
    return null;
  }
}

export async function clearWebIgpatDraft(userId: string): Promise<void> {
  const snapshot = readMetadata(userId);
  if (typeof localStorage !== 'undefined') localStorage.removeItem(metadataKey(userId));
  if (snapshot?.mediaUri) await deleteDraftBlob(snapshot.mediaUri).catch(() => undefined);
}
