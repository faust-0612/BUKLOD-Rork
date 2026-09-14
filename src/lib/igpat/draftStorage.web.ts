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

function metadataKey(userId: string): string {
  return `${META_KEY_PREFIX}${userId}`;
}

function mediaToken(userId: string): string {
  return `indexeddb://buklod-igpat-drafts/${userId}`;
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
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IGPAT draft storage.'));
  });
}

async function putDraftBlob(userId: string, blob: Blob): Promise<void> {
  const db = await openDraftDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      tx.objectStore(MEDIA_STORE).put(blob, userId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not save IGPAT draft video.'));
      tx.onabort = () => reject(tx.error ?? new Error('IGPAT draft video save was interrupted.'));
    });
  } finally {
    db.close();
  }
}

async function getDraftBlob(userId: string): Promise<Blob | null> {
  const db = await openDraftDb();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const request = tx.objectStore(MEDIA_STORE).get(userId);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error('Could not read IGPAT draft video.'));
    });
  } finally {
    db.close();
  }
}

async function deleteDraftBlob(userId: string): Promise<void> {
  const db = await openDraftDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      tx.objectStore(MEDIA_STORE).delete(userId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not clear IGPAT draft video.'));
      tx.onabort = () => reject(tx.error ?? new Error('IGPAT draft cleanup was interrupted.'));
    });
  } finally {
    db.close();
  }
}

export async function prepareWebIgpatDraftMedia(userId: string, blob: Blob): Promise<void> {
  await putDraftBlob(userId, blob);
}

export function saveWebIgpatDraft(input: IgpatDraftSaveInput): IgpatDraftSnapshot {
  if (typeof localStorage === 'undefined') {
    throw new Error('Local draft metadata storage is unavailable in this browser.');
  }

  const snapshot = buildIgpatDraftSnapshot({
    ...input,
    mediaUri: mediaToken(input.userId),
  });
  localStorage.setItem(metadataKey(input.userId), JSON.stringify(snapshot));
  return snapshot;
}

export async function loadWebIgpatDraft(
  userId: string
): Promise<{ snapshot: IgpatDraftSnapshot; uri: string } | null> {
  if (typeof localStorage === 'undefined') return null;

  const raw = localStorage.getItem(metadataKey(userId));
  if (!raw) return null;

  let snapshot: IgpatDraftSnapshot;
  try {
    const parsed = JSON.parse(raw);
    if (!isIgpatDraftSnapshot(parsed) || parsed.userId !== userId) return null;
    snapshot = parsed;
  } catch {
    return null;
  }

  try {
    const blob = await getDraftBlob(userId);
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
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(metadataKey(userId));
  }
  await deleteDraftBlob(userId).catch(() => undefined);
}
