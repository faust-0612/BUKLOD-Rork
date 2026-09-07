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
  daily_reading: {
    assignment_id: string | null;
    bible_reference: string | null;
    submitted_today: number;
    approved_today: number;
    pending_review: number;
    not_submitted_today: number;
    approved_this_week: number;
  };
  devotion: {
    devotional_id: string | null;
    completed_today: number;
    completed_this_week: number;
    not_completed_today: number;
  };
  buklod_lesson: {
    members_active: number;
    members_not_started: number;
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
    daily_reading: {
      assignment_id: daily.assignment_id
        ? String(daily.assignment_id)
        : null,
      bible_reference: daily.bible_reference
        ? String(daily.bible_reference)
        : null,
      submitted_today: toNumber(daily.submitted_today),
      approved_today: toNumber(daily.approved_today),
      pending_review: toNumber(daily.pending_review),
      not_submitted_today: toNumber(daily.not_submitted_today),
      approved_this_week: toNumber(daily.approved_this_week),
    },
    devotion: {
      devotional_id: devotion.devotional_id
        ? String(devotion.devotional_id)
        : null,
      completed_today: toNumber(devotion.completed_today),
      completed_this_week: toNumber(devotion.completed_this_week),
      not_completed_today: toNumber(devotion.not_completed_today),
    },
    buklod_lesson: {
      members_active: toNumber(lesson.members_active),
      members_not_started: toNumber(lesson.members_not_started),
      stages: parseStageRows(lesson.stages),
    },
  };
}

function isMissingRpcError(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

export function extractRpcErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.trim();
  }

  if (error && typeof error === 'object') {
    const message = String(
      (error as { message?: unknown }).message ?? ''
    ).trim();

    if (message) {
      return message;
    }
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
    daily_reading: {
      assignment_id: null,
      bible_reference: null,
      submitted_today: 0,
      approved_today: 0,
      pending_review: 0,
      not_submitted_today: 0,
      approved_this_week: 0,
    },
    devotion: {
      devotional_id: null,
      completed_today: 0,
      completed_this_week: 0,
      not_completed_today: 0,
    },
    buklod_lesson: {
      members_active: 0,
      members_not_started: 0,
      stages: [],
    },
  };
}

export function isFaithMonitoringEmpty(
  summary: ScopeFaithMonitoringSummary
) {
  const daily = summary.daily_reading;
  const devotion = summary.devotion;
  const lesson = summary.buklod_lesson;

  const hasDailyActivity =
    daily.submitted_today > 0 ||
    daily.approved_today > 0 ||
    daily.pending_review > 0 ||
    daily.approved_this_week > 0;

  const hasDevotionActivity =
    devotion.completed_today > 0 || devotion.completed_this_week > 0;

  const hasLessonActivity =
    lesson.members_active > 0 ||
    lesson.stages.some(
      (stage) =>
        stage.completed_count > 0 || stage.in_progress_count > 0
    );

  return (
    summary.active_members <= 0 ||
    (!hasDailyActivity && !hasDevotionActivity && !hasLessonActivity)
  );
}

export function mapFaithMonitoringErrorMessage(message: string) {
  const normalized = message.trim();

  if (!normalized) {
    return 'Could not load faith monitoring. Please try again.';
  }

  if (/authentication required/i.test(normalized)) {
    return 'Sign in again to view faith monitoring.';
  }

  if (/active membership required/i.test(normalized)) {
    return 'You need active membership in this workspace to view monitoring.';
  }

  if (/faith content is not enabled/i.test(normalized)) {
    return 'Faith monitoring is not enabled for this workspace.';
  }

  if (/scope not found/i.test(normalized)) {
    return 'This workspace could not be found.';
  }

  if (
    isMissingRpcError(normalized) ||
    /show_faith_content|column .* does not exist|undefined column/i.test(
      normalized
    )
  ) {
    return 'Faith monitoring is still being set up for this workspace.';
  }

  return normalized;
}

function isHardFaithMonitoringError(message: string) {
  return (
    /authentication required/i.test(message) ||
    /active membership required/i.test(message) ||
    /scope not found/i.test(message)
  );
}

export function formatFaithMonitoringRate(
  completed: number,
  total: number
) {
  if (total <= 0) return '0%';
  return `${Math.round((completed / total) * 100)}%`;
}

export async function fetchScopeFaithMonitoringSummary(
  scopeId: string
): Promise<ScopeFaithMonitoringSummary | null> {
  const exact = await supabase.rpc(
    'buklod_scope_faith_monitoring_summary_v2' as any,
    { p_scope_id: scopeId } as any
  );

  if (!exact.error) {
    return parseSummary(exact.data);
  }

  if (!isMissingRpcError(String(exact.error.message ?? ''))) {
    throw exact.error;
  }

  const { data, error } = await supabase.rpc(
    'buklod_scope_faith_monitoring_summary_v1',
    { p_scope_id: scopeId }
  );

  if (error) {
    if (isMissingRpcError(String(error.message ?? ''))) {
      return null;
    }

    throw error;
  }

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
      buildEmptyScopeFaithMonitoringSummary(
        input.scopeId,
        fallbackName
      );

    return {
      summary,
      isEmpty: isFaithMonitoringEmpty(summary),
      warning: null,
      isHardError: false,
    };
  } catch (error) {
    const rawMessage = extractRpcErrorMessage(error);
    const friendlyMessage = mapFaithMonitoringErrorMessage(rawMessage);

    if (/faith content is not enabled/i.test(rawMessage)) {
      return {
        summary: buildEmptyScopeFaithMonitoringSummary(
          input.scopeId,
          fallbackName
        ),
        isEmpty: true,
        warning: friendlyMessage,
        isHardError: true,
      };
    }

    if (isHardFaithMonitoringError(rawMessage)) {
      return {
        summary: buildEmptyScopeFaithMonitoringSummary(
          input.scopeId,
          fallbackName
        ),
        isEmpty: true,
        warning: friendlyMessage,
        isHardError: true,
      };
    }

    return {
      summary: buildEmptyScopeFaithMonitoringSummary(
        input.scopeId,
        fallbackName
      ),
      isEmpty: true,
      warning: friendlyMessage,
      isHardError: false,
    };
  }
}