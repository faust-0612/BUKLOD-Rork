import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type KlEditorDraft, klEditorDraftKey, parseKlEditorDraft,
} from './editorDraftRecovery';

export async function readKlEditorDraft(userId?: string | null, episodeId?: string | null) {
  const key = klEditorDraftKey(userId, episodeId);
  if (!key) return null;
  return parseKlEditorDraft(await AsyncStorage.getItem(key), userId, episodeId);
}

export async function writeKlEditorDraft(draft: KlEditorDraft): Promise<void> {
  const key = klEditorDraftKey(draft.userId, draft.episodeId);
  if (!key) return;
  await AsyncStorage.setItem(key, JSON.stringify(draft));
}

export async function removeKlEditorDraft(userId?: string | null, episodeId?: string | null): Promise<void> {
  const key = klEditorDraftKey(userId, episodeId);
  if (key) await AsyncStorage.removeItem(key);
}
