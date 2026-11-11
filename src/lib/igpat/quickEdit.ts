export type IgpatContentFit = 'contain' | 'cover';
export type IgpatRotation = 0 | 90 | 180 | 270;
export type IgpatPlaybackRate = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

export type IgpatQuickEditState = {
  trimStartSeconds: number;
  trimEndSeconds: number | null;
  speed: IgpatPlaybackRate;
  muted: boolean;
  textOverlay: string;
  contentFit: IgpatContentFit;
  rotation: IgpatRotation;
  coverSeconds: number;
};

export type IgpatAutoImproveSuggestion = {
  edit: IgpatQuickEditState;
  changes: string[];
};

export const IGPAT_MIN_OUTPUT_SECONDS = 1;

export const DEFAULT_IGPAT_QUICK_EDIT: IgpatQuickEditState = {
  trimStartSeconds: 0,
  trimEndSeconds: null,
  speed: 1,
  muted: false,
  textOverlay: '',
  contentFit: 'contain',
  rotation: 0,
  coverSeconds: 0,
};

export function clampIgpatSeconds(value: number, durationSeconds: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(durationSeconds, value));
}

export function normalizeIgpatQuickEdit(
  edit: IgpatQuickEditState,
  durationSeconds: number
): IgpatQuickEditState {
  const safeDuration = Math.max(IGPAT_MIN_OUTPUT_SECONDS, Number(durationSeconds) || 0);
  const start = clampIgpatSeconds(edit.trimStartSeconds, safeDuration);
  const rawEnd = edit.trimEndSeconds == null
    ? safeDuration
    : clampIgpatSeconds(edit.trimEndSeconds, safeDuration);
  const end = Math.max(start + IGPAT_MIN_OUTPUT_SECONDS, rawEnd);
  const boundedEnd = Math.min(safeDuration, end);
  const boundedStart = Math.min(start, Math.max(0, boundedEnd - IGPAT_MIN_OUTPUT_SECONDS));
  const coverSeconds = Math.max(
    boundedStart,
    Math.min(boundedEnd, clampIgpatSeconds(edit.coverSeconds, safeDuration))
  );

  return {
    ...edit,
    trimStartSeconds: boundedStart,
    trimEndSeconds: boundedEnd,
    coverSeconds,
  };
}

export function suggestIgpatAutoImprove(
  edit: IgpatQuickEditState,
  durationSeconds: number
): IgpatAutoImproveSuggestion {
  const normalized = normalizeIgpatQuickEdit(edit, durationSeconds);
  const changes: string[] = [];
  const start = normalized.trimStartSeconds;
  const end = Number(normalized.trimEndSeconds ?? durationSeconds);
  const midpoint = Math.round((start + (end - start) / 2) * 10) / 10;
  const suggestedCover = Math.max(start, Math.min(end, midpoint));
  let next = normalized;

  // Never silently zoom or crop the original video when improving a cover frame.
  // A user may still explicitly select CROP TO FILL in the editor.
  if (Math.abs(normalized.coverSeconds - suggestedCover) > 0.11) {
    next = { ...next, coverSeconds: suggestedCover };
    changes.push('Suggested a cover frame near the middle of the selected clip.');
  }

  return {
    edit: normalizeIgpatQuickEdit(next, durationSeconds),
    changes,
  };
}

export function igpatOutputDurationSeconds(
  edit: IgpatQuickEditState,
  durationSeconds: number
): number {
  const normalized = normalizeIgpatQuickEdit(edit, durationSeconds);
  return Math.max(
    IGPAT_MIN_OUTPUT_SECONDS,
    Number(normalized.trimEndSeconds ?? durationSeconds) - normalized.trimStartSeconds
  );
}

export function isDefaultIgpatQuickEdit(
  edit: IgpatQuickEditState,
  durationSeconds: number
): boolean {
  const normalized = normalizeIgpatQuickEdit(edit, durationSeconds);
  return (
    normalized.trimStartSeconds <= 0.001 &&
    Math.abs(Number(normalized.trimEndSeconds ?? durationSeconds) - durationSeconds) <= 0.001 &&
    normalized.speed === 1 &&
    !normalized.muted &&
    !normalized.textOverlay.trim() &&
    normalized.contentFit === 'contain' &&
    normalized.rotation === 0 &&
    normalized.coverSeconds <= 0.001
  );
}

export function serializeIgpatQuickEdit(
  edit: IgpatQuickEditState,
  durationSeconds: number
): Record<string, unknown> {
  const normalized = normalizeIgpatQuickEdit(edit, durationSeconds);
  return {
    version: 1,
    trim_start_seconds: normalized.trimStartSeconds,
    trim_end_seconds: normalized.trimEndSeconds,
    speed: normalized.speed,
    muted: normalized.muted,
    text_overlay: normalized.textOverlay.trim().slice(0, 160),
    content_fit: normalized.contentFit,
    rotation: normalized.rotation,
    cover_seconds: normalized.coverSeconds,
  };
}

export function parseIgpatQuickEdit(
  value: unknown,
  durationSeconds: number
): IgpatQuickEditState {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const allowedSpeeds: IgpatPlaybackRate[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const speedValue = Number(row.speed ?? 1);
  const speed = allowedSpeeds.includes(speedValue as IgpatPlaybackRate)
    ? speedValue as IgpatPlaybackRate
    : 1;
  const rotationValue = Number(row.rotation ?? 0);
  const rotation: IgpatRotation = rotationValue === 90 || rotationValue === 180 || rotationValue === 270
    ? rotationValue
    : 0;

  return normalizeIgpatQuickEdit(
    {
      trimStartSeconds: Number(row.trim_start_seconds ?? 0),
      trimEndSeconds: row.trim_end_seconds == null ? durationSeconds : Number(row.trim_end_seconds),
      speed,
      muted: Boolean(row.muted),
      textOverlay: String(row.text_overlay ?? '').slice(0, 160),
      contentFit: row.content_fit === 'cover' ? 'cover' : 'contain',
      rotation,
      coverSeconds: Number(row.cover_seconds ?? 0),
    },
    durationSeconds
  );
}
