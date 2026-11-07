import { supabase } from '@/lib/supabase';

export type ScopeFaithLessonStageSummary = {
  stage_code: number;
  stage_title: string;
  completed_count: number;
  in_progress_count: number;
};

export type ScopeFaithMonitoringSummary = {
  scope_id: string;
  scope_name: string;
  summary_date: string;
  week_start: string;
  active_members: number;
  submission_mode?: string;
  human_approval_required?: boolean;
  daily_reading: {
    assignment_id: string | null;
    bible_reference: string | null;
    submitted_today: number;
    approved_today: number;
    automatic_checking: number;
    needs_revision: number;
    pending_review: number;
    not_submitted_today: number;
    approved_this_week: number;
  };
  devotion: {
    devotional_id: string | null;
    submitted_today: number;
    approved_today: number;
    automatic_checking: number;
    needs_revision: number;
    completed_today: number;
    completed_this_week: number;
    not_completed_today: number;
  };
  buklod_lesson: {
    members_active: number;
    members_not_started: number;
    submitted_today: number;
    approved_today: number;
    automatic_checking: number;
    needs_revision: number;
    stages: ScopeFaithLessonStageSummary[];
  };
};

export type ScopeFaithMonitoringLoadResult = {
  summary: ScopeFaithMonitoringSummary;
  isEmpty: boolean;
  warning: string | null;
  isHardError: boolean;
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseStageRows(value: unknown): ScopeFaithLessonStageSummary[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const item = row as Record<string, unknown>;
      const stageCode = toNumber(item.stage_code, 0);
      const stageTitle = String(item.stage_title ?? '').trim();
      if (!stageCode || !stageTitle) return null;

      return {
        stage_code: stageCode,
        stage_title: stageTitle,
        completed_count: toNumber(item.completed_count),
        in_progress_count: toNumber(item.in_progress_count),
      };
    })
    .filter(Boolean) as ScopeFaithLessonStageSummary[];
}

function parseSummary(raw: unknown): ScopeFaithMonitoringSummary | null {
  if (!raw || typeof raw !== 'object') return null;

  const row = raw as Record<string, unknown>;
  const daily = (row.daily_reading ?? {}) as Record<string, unknown>;
  const devotion = (row.devotion ?? {}) as Record<string, unknown>;
  const lesson = (row.buklod_lesson ?? {}) as Record<string, unknown>;
  const scopeId = String(row.scope_id ?? '').trim();
  if (!scopeId) return null;

  return {
    scope_id: scopeId,
    scope_name: String(row.scope_name ?? 'Scope'),
    summary_date: String(row.summary_date ?? todayIsoDate()),
    week_start: String(row.week_start ?? todayIsoDate()),
    active_members: toNumber(row.active_members),
    submission_mode: row.submission_mode ? String(row.submission_mode) : undefined,
    human_approval_required:
      typeof row.human_approval_required === 'boolean'
        ? row.human_approval_required
        : undefined,
    daily_reading: {
      assignment_id: daily.assignment_id ? String(daily.assignment_id) : null,
      bible_reference: daily.bible_reference ? String(daily.bible_reference) : null,
      submitted_today: toNumber(daily.submitted_today),
      approved_today: toNumber(daily.approved_today),
      automatic_checking: toNumber(daily.automatic_checking ?? daily.pending_review),
      needs_revision: toNumber(daily.needs_revision),
      pending_review: toNumber(daily.pending_review),
      not_submitted_today: toNumber(daily.not_submitted_today),
      approved_this_week: toNumber(daily.approved_this_week),
    },
    devotion: {
      devotional_id: devotion.devotional_id ? String(devotion.devotional_id) : null,
      submitted_today: toNumber(devotion.submitted_today ?? devotion.completed_today),
      approved_today: toNumber(devotion.approved_today),
      automatic_checking: toNumber(devotion.automatic_checking),
      needs_revision: toNumber(devotion.needs_revision),
      completed_today: toNumber(devotion.completed_today),
      completed_this_week: toNumber(devotion.completed_this_week),
      not_completed_today: toNumber(devotion.not_completed_today),
    },
    buklod_lesson: {
      members_active: toNumber(lesson.members_active),
      members_not_started: toNumber(lesson.members_not_started),
      submitted_today: toNumber(lesson.submitted_today),
      approved_today: toNumber(lesson.approved_today),
      automatic_checking: toNumber(lesson.automatic_checking),
      needs_revision: toNumber(lesson.needs_revision),
      stages: parseStageRows(lesson.stages),
    },
  };
}

function isMissingRpcError(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(message);
}

export function extractRpcErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.trim();
  if (error && typeof error === 'object') {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message) return message;
  }
  return String(error ?? '').trim();
}

export function buildEmptyScopeFaithMonitoringSummary(
  scopeId: string,
  scopeName = 'Scope'
): ScopeFaithMonitoringSummary {
  const today = todayIsoDate();

  return {
    scope_id: scopeId,
    scope_name: scopeName,
    summary_date: today,
    week_start: today,
    active_members: 0,
    submission_mode: 'AUTOMATIC',
    human_approval_required: false,
    daily_reading: {
      assignment_id: null,
      bible_reference: null,
      submitted_today: 0,
      approved_today: 0,
      automatic_checking: 0,
      needs_revision: 0,
      pending_review: 0,
      not_submitted_today: 0,
      approved_this_week: 0,
    },
    devotion: {
      devotional_id: null,
      submitted_today: 0,
      approved_today: 0,
      automatic_checking: 0,
      needs_revision: 0,
      completed_today: 0,
      completed_this_week: 0,
      not_completed_today: 0,
    },
    buklod_lesson: {
      members_active: 0,
      members_not_started: 0,
      submitted_today: 0,
      approved_today: 0,
      automatic_checking: 0,
      needs_revision: 0,
      stages: [],
    },
  };
}

export function isFaithMonitoringEmpty(summary: ScopeFaithMonitoringSummary) {
  const daily = summary.daily_reading;
  const devotion = summary.devotion;
  const lesson = summary.buklod_lesson;

  const hasDailyActivity =
    daily.submitted_today > 0 ||
    daily.approved_today > 0 ||
    daily.automatic_checking > 0 ||
    daily.needs_revision > 0 ||
    daily.approved_this_week > 0;
  const hasDevotionActivity =
    devotion.submitted_today > 0 ||
    devotion.approved_today > 0 ||
    devotion.automatic_checking > 0 ||
    devotion.needs_revision > 0 ||
    devotion.completed_this_week > 0;
  const hasLessonActivity =
    lesson.members_active > 0 ||
    lesson.submitted_today > 0 ||
    lesson.automatic_checking > 0 ||
    lesson.needs_revision > 0 ||
    lesson.stages.some((stage) => stage.completed_count > 0 || stage.in_progress_count > 0);

  return summary.active_members <= 0 || (!hasDailyActivity && !hasDevotionActivity && !hasLessonActivity);
}

export function mapFaithMonitoringErrorMessage(message: string) {
  const normalized = message.trim();
  if (!normalized) return 'Could not load faith monitoring. Please try again.';
  if (/authentication required/i.test(normalized)) return 'Sign in again to view faith monitoring.';
  if (/active membership required/i.test(normalized)) {
    return 'You need active membership in this workspace to view monitoring.';
  }
  if (/faith content is not enabled/i.test(normalized)) {
    return 'Faith monitoring is not enabled for this workspace.';
  }
  if (/scope not found/i.test(normalized)) return 'This workspace could not be found.';
  if (
    isMissingRpcError(normalized) ||
    /show_faith_content|column .* does not exist|undefined column/i.test(normalized)
  ) {
    return 'Faith monitoring is still being set up for this workspace.';
  }
  return normalized;
}

function isHardFaithMonitoringError(message: string) {
  return /authentication required|active membership required|scope not found/i.test(message);
}

export function formatFaithMonitoringRate(completed: number, total: number) {
  if (total <= 0) return '0%';
  return `${Math.round((completed / total) * 100)}%`;
}

export async function fetchScopeFaithMonitoringSummary(
  scopeId: string
): Promise<ScopeFaithMonitoringSummary | null> {
  const { data, error } = await supabase.rpc('buklod_scope_faith_monitoring_summary_v4' as any, {
    p_scope_id: scopeId,
  } as any);

  if (error) throw error;
  return parseSummary(data);
}

export async function fetchScopeFaithMonitoringSummaryResilient(input: {
  scopeId: string;
  scopeName?: string;
}): Promise<ScopeFaithMonitoringLoadResult> {
  const fallbackName = input.scopeName?.trim() || 'Scope';

  try {
    const summary =
      (await fetchScopeFaithMonitoringSummary(input.scopeId)) ??
      buildEmptyScopeFaithMonitoringSummary(input.scopeId, fallbackName);

    return {
      summary,
      isEmpty: isFaithMonitoringEmpty(summary),
      warning: null,
      isHardError: false,
    };
  } catch (error) {
    const rawMessage = extractRpcErrorMessage(error);
    const friendlyMessage = mapFaithMonitoringErrorMessage(rawMessage);
    const empty = buildEmptyScopeFaithMonitoringSummary(input.scopeId, fallbackName);

    return {
      summary: empty,
      isEmpty: true,
      warning: friendlyMessage,
      isHardError:
        /faith content is not enabled/i.test(rawMessage) || isHardFaithMonitoringError(rawMessage),
    };
  }
}
