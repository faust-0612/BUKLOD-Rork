import type { IgpatQuickEditState } from './quickEdit';
import { normalizeIgpatRelayPrompt, type IgpatRelayPrompt } from './relay';

export type IgpatDraftAudience = 'group' | 'local' | 'public';
export type IgpatCreationMode = 'standard' | 'quick-capture';

export type IgpatDraftSnapshot = {
  version: 1;
  userId: string;
  mediaUri: string;
  durationSeconds: number;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
  edit: IgpatQuickEditState;
  caption: string;
  audience: IgpatDraftAudience;
  groupId: string | null;
  creationMode?: IgpatCreationMode;
  relayParentPostId?: string | null;
  relayPrompt?: IgpatRelayPrompt | null;
  relayParentAuthor?: string | null;
  savedAt: string;
};

export type IgpatDraftSaveInput = Omit<IgpatDraftSnapshot, 'version' | 'savedAt'>;

export function buildIgpatDraftSnapshot(input: IgpatDraftSaveInput): IgpatDraftSnapshot {
  return {
    ...input,
    version: 1,
    caption: input.caption.slice(0, 500),
    creationMode: input.creationMode === 'quick-capture' ? 'quick-capture' : 'standard',
    relayParentPostId: input.relayParentPostId ? String(input.relayParentPostId) : null,
    relayPrompt: normalizeIgpatRelayPrompt(input.relayPrompt),
    relayParentAuthor: input.relayParentAuthor ? String(input.relayParentAuthor).slice(0, 120) : null,
    savedAt: new Date().toISOString(),
  };
}

export function isIgpatDraftSnapshot(value: unknown): value is IgpatDraftSnapshot {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    row.version === 1 &&
    typeof row.userId === 'string' &&
    typeof row.mediaUri === 'string' &&
    typeof row.durationSeconds === 'number' &&
    row.durationSeconds >= 1 &&
    row.durationSeconds <= 60 &&
    typeof row.sizeBytes === 'number' &&
    typeof row.mimeType === 'string' &&
    typeof row.fileName === 'string' &&
    typeof row.edit === 'object' &&
    typeof row.caption === 'string' &&
    (row.audience === 'group' || row.audience === 'local' || row.audience === 'public') &&
    (row.groupId == null || typeof row.groupId === 'string') &&
    (row.creationMode == null || row.creationMode === 'standard' || row.creationMode === 'quick-capture') &&
    (row.relayParentPostId == null || typeof row.relayParentPostId === 'string') &&
    (row.relayPrompt == null || normalizeIgpatRelayPrompt(row.relayPrompt) != null) &&
    (row.relayParentAuthor == null || typeof row.relayParentAuthor === 'string') &&
    typeof row.savedAt === 'string'
  );
}
