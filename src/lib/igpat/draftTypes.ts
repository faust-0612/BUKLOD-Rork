import type { IgpatQuickEditState } from './quickEdit';

export type IgpatDraftAudience = 'group' | 'local' | 'public';

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
  savedAt: string;
};

export type IgpatDraftSaveInput = Omit<IgpatDraftSnapshot, 'version' | 'savedAt'>;

export function buildIgpatDraftSnapshot(input: IgpatDraftSaveInput): IgpatDraftSnapshot {
  return {
    ...input,
    version: 1,
    caption: input.caption.slice(0, 500),
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
    typeof row.savedAt === 'string'
  );
}
