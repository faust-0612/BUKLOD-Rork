const PREFIX = '@buklod/kl-private-editor-draft-v1/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 500_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type KlEditorDraft = {
  userId: string;
  episodeId: string;
  title: string;
  manuscript: string;
  baseTitle: string;
  baseManuscript: string;
  editedAt: number;
};

export function klEditorDraftKey(userId?: string | null, episodeId?: string | null): string | null {
  if (!userId || !episodeId || !UUID.test(userId) || !UUID.test(episodeId)) return null;
  return PREFIX + userId.toLowerCase() + '/' + episodeId.toLowerCase();
}

export function buildKlEditorDraft(
  userId: string | null | undefined,
  episodeId: string,
  title: string,
  manuscript: string,
  baseTitle: string,
  baseManuscript: string,
): KlEditorDraft | null {
  if (!klEditorDraftKey(userId, episodeId) || [title, manuscript, baseTitle, baseManuscript].some(
    item => typeof item !== 'string' || item.length > LIMIT,
  )) return null;
  return { userId: userId!, episodeId, title, manuscript, baseTitle, baseManuscript, editedAt: Date.now() };
}

export function parseKlEditorDraft(raw: string | null, userId?: string | null, episodeId?: string | null, now = Date.now()): KlEditorDraft | null {
  if (!raw || !klEditorDraftKey(userId, episodeId)) return null;
  try {
    const draft: KlEditorDraft = JSON.parse(raw);
    if (draft.userId !== userId || draft.episodeId !== episodeId ||
        !Number.isFinite(draft.editedAt) || draft.editedAt > now ||
        now - draft.editedAt > MAX_AGE_MS ||
        [draft.title, draft.manuscript, draft.baseTitle, draft.baseManuscript].some(
          item => typeof item !== 'string' || item.length > LIMIT,
        )) return null;
    return draft;
  } catch { return null; }
}

export function hasUnsavedKlDraft(draft: KlEditorDraft | null, serverTitle: string, serverText: string): draft is KlEditorDraft {
  return !!draft && (draft.title !== serverTitle || draft.manuscript !== serverText);
}
