import type { FaithLessonStageAccess } from '@/lib/buklodScopeFaithAccess';
import { STAGE_PHASES, STAGE_SUBTITLES } from '@/lib/formationCopy';

export type BuklodLessonStageDefinition = {
  stage_code: number;
  title: string;
  subtitle: string;
  price_php: number;
  sort_order: number;
};

/** Product defaults — runtime access comes from Cluster packages, not per-stage prices. */
export const BUKLOD_LESSON_STAGE_CATALOG: BuklodLessonStageDefinition[] =
  [
    {
      stage_code: 101,
      title: STAGE_PHASES[101],
      subtitle: STAGE_SUBTITLES[101],
      price_php: 49,
      sort_order: 1,
    },
    {
      stage_code: 102,
      title: STAGE_PHASES[102],
      subtitle: STAGE_SUBTITLES[102],
      price_php: 49,
      sort_order: 2,
    },
    {
      stage_code: 103,
      title: STAGE_PHASES[103],
      subtitle: STAGE_SUBTITLES[103],
      price_php: 49,
      sort_order: 3,
    },
    {
      stage_code: 104,
      title: STAGE_PHASES[104],
      subtitle: STAGE_SUBTITLES[104],
      price_php: 59,
      sort_order: 4,
    },
    {
      stage_code: 105,
      title: STAGE_PHASES[105],
      subtitle: STAGE_SUBTITLES[105],
      price_php: 59,
      sort_order: 5,
    },
    {
      stage_code: 106,
      title: STAGE_PHASES[106],
      subtitle: STAGE_SUBTITLES[106],
      price_php: 69,
      sort_order: 6,
    },
    {
      stage_code: 107,
      title: STAGE_PHASES[107],
      subtitle: STAGE_SUBTITLES[107],
      price_php: 69,
      sort_order: 7,
    },
  ];

export function isBuklodLessonStageCode(
  value: unknown,
): value is number {
  const code = Number(value);

  return (
    Number.isInteger(code) &&
    code >= 101 &&
    code <= 107
  );
}

export function getBuklodLessonStageDefinition(
  stageCode: number,
): BuklodLessonStageDefinition | null {
  return (
    BUKLOD_LESSON_STAGE_CATALOG.find(
      (stage) => stage.stage_code === stageCode,
    ) ?? null
  );
}

/**
 * Always return BUKLOD 101–107 for scope lesson UI, merging RPC data when present.
 */
export function mergeFaithLessonStages(
  apiStages: FaithLessonStageAccess[] | null | undefined,
  options: {
    mzbScopeExempt?: boolean;
  } = {},
): FaithLessonStageAccess[] {
  const byCode = new Map<number, FaithLessonStageAccess>();

  (apiStages ?? []).forEach((stage) => {
    if (isBuklodLessonStageCode(stage.stage_code)) {
      byCode.set(stage.stage_code, stage);
    }
  });

  return BUKLOD_LESSON_STAGE_CATALOG.map((definition) => {
    const remote = byCode.get(definition.stage_code);

    return {
      stage_code: definition.stage_code,
      title: remote?.title ?? definition.title,
      price_php: remote?.price_php ?? definition.price_php,
      scope_unlocked:
        options.mzbScopeExempt === true ||
        remote?.scope_unlocked === true,
      pending_request_id:
        remote?.pending_request_id ?? null,
    };
  });
}

export function buildScopeBuklodLessonHubPath(
  scopeId: string,
) {
  return `/scope/buklod-lesson?scopeId=${encodeURIComponent(scopeId)}`;
}

export type BuklodFormationStageProgress = {
  stage_code: number;
  stage_title: string;
  expected_lessons: number;
  approved_lessons: number;
  required_records: number;
  verified_records: number;
  lessons_complete: boolean;
  requirements_complete: boolean;
  stage_complete: boolean;
};

function defaultFormationStageProgress(
  stageCode: number,
  stageTitle: string,
): BuklodFormationStageProgress {
  return {
    stage_code: stageCode,
    stage_title: stageTitle,
    expected_lessons: 0,
    approved_lessons: 0,
    required_records: 0,
    verified_records: 0,
    lessons_complete: false,
    requirements_complete: false,
    stage_complete: false,
  };
}

/** Always return BUKLOD 101–107 formation cards, merging RPC progress when present. */
export function mergeFormationStageProgress(
  rows: BuklodFormationStageProgress[] | null | undefined,
): BuklodFormationStageProgress[] {
  const byCode = new Map<number, BuklodFormationStageProgress>();

  (rows ?? []).forEach((row) => {
    if (isBuklodLessonStageCode(row.stage_code)) {
      byCode.set(row.stage_code, row);
    }
  });

  return BUKLOD_LESSON_STAGE_CATALOG.map((definition) => {
    const existing = byCode.get(definition.stage_code);

    return (
      existing ??
      defaultFormationStageProgress(
        definition.stage_code,
        definition.subtitle,
      )
    );
  });
}
