import { supabase } from '@/lib/supabase';
import type {
  FormationJourney,
  FormationLessonAccess,
  FormationStageAccess,
} from '@/types/buklodFormation';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export function normalizeFormationStageAccess(
  data: unknown,
): FormationStageAccess | null {
  const row = asRecord(data);
  if (!row) {
    return null;
  }

  return {
    allowed: Boolean(row.access_allowed ?? row.allowed),
    access_allowed: Boolean(row.access_allowed ?? row.allowed),
    stage_code: Number(row.stage_code ?? 0),
    engine_v2_enabled:
      row.engine_v2_enabled == null
        ? undefined
        : Boolean(row.engine_v2_enabled),
    prerequisite_stage_code:
      row.prerequisite_stage_code == null
        ? null
        : Number(row.prerequisite_stage_code),
    prerequisite_complete:
      row.prerequisite_complete == null
        ? undefined
        : Boolean(row.prerequisite_complete),
    lessons_complete:
      row.lessons_complete == null
        ? undefined
        : Boolean(row.lessons_complete),
    documents_or_milestones_complete:
      row.documents_or_milestones_complete == null
        ? row.documents_complete == null
          ? undefined
          : Boolean(row.documents_complete)
        : Boolean(row.documents_or_milestones_complete),
    stage_points_current:
      row.stage_points_current == null
        ? row.points_current == null
          ? undefined
          : Number(row.points_current)
        : Number(row.stage_points_current),
    stage_points_required:
      row.stage_points_required == null
        ? row.points_required == null
          ? undefined
          : Number(row.points_required)
        : Number(row.stage_points_required),
    stage_points_met:
      row.stage_points_met == null
        ? row.points_gate_met == null
          ? undefined
          : Boolean(row.points_gate_met)
        : Boolean(row.stage_points_met),
    stage_bayanihan_current:
      row.stage_bayanihan_current == null
        ? row.bayanihan_current == null
          ? undefined
          : Number(row.bayanihan_current)
        : Number(row.stage_bayanihan_current),
    stage_bayanihan_required:
      row.stage_bayanihan_required == null
        ? row.bayanihan_required == null
          ? undefined
          : Number(row.bayanihan_required)
        : Number(row.stage_bayanihan_required),
    stage_bayanihan_met:
      row.stage_bayanihan_met == null
        ? row.bayanihan_gate_met == null
          ? undefined
          : Boolean(row.bayanihan_gate_met)
        : Boolean(row.stage_bayanihan_met),
    validations_complete:
      row.validations_complete == null
        ? undefined
        : Boolean(row.validations_complete),
    repeat_required:
      row.repeat_required == null ? undefined : Boolean(row.repeat_required),
    blocking_reasons: asStringArray(row.blocking_reasons) as FormationStageAccess['blocking_reasons'],
  };
}

export function normalizeFormationJourney(data: unknown): FormationJourney | null {
  const row = asRecord(data);
  if (!row || !Array.isArray(row.stages)) {
    return null;
  }

  return {
    engine_v2_enabled: Boolean(row.engine_v2_enabled),
    next_action:
      typeof row.next_action === 'string'
        ? row.next_action
        : typeof row.next_actionable_requirement === 'string'
          ? row.next_actionable_requirement
          : null,
    stages: row.stages as FormationJourney['stages'],
  };
}

export async function loadFormationEngineEnabled(): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_formation_engine_v2_enabled',
  );

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function loadMyFormationJourney(): Promise<FormationJourney | null> {
  const { data, error } = await (supabase as any).rpc(
    'get_my_formation_journey_v1',
  );

  if (error) {
    throw error;
  }

  return normalizeFormationJourney(data);
}

export async function canAccessFormationStage(
  userId: string,
  stageCode: number | string,
): Promise<FormationStageAccess | null> {
  const { data, error } = await (supabase as any).rpc(
    'can_access_formation_stage_v1',
    {
      p_user_id: userId,
      p_stage_code: String(stageCode),
    },
  );

  if (error) {
    throw error;
  }

  return normalizeFormationStageAccess(data);
}

export async function requestFormationRepeat(input: {
  memberId: string;
  stageCode: number;
  repeatScope: string;
  reason: string;
  trackId?: string | null;
  lessonId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    'request_formation_repeat_v1',
    {
      p_member_id: input.memberId,
      p_stage_code: input.stageCode,
      p_repeat_scope: input.repeatScope,
      p_reason: input.reason,
      p_track_id: input.trackId ?? null,
      p_lesson_id: input.lessonId ?? null,
      p_metadata: input.metadata ?? {},
    },
  );

  if (error) {
    throw error;
  }

  return String(data);
}

export async function loadAdminFormationConfig(): Promise<Record<string, unknown>> {
  const { data, error } = await (supabase as any).rpc(
    'admin_get_formation_config_v1',
  );

  if (error) {
    throw error;
  }

  return asRecord(data) ?? {};
}

export async function submitMemberStageRequirement(input: {
  requirementCode: string;
  date?: string | null;
  witnessName?: string | null;
  documentUrl?: string | null;
  recordDetails?: Record<string, unknown>;
  acknowledgmentName?: string | null;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    'submit_member_stage_requirement_v1',
    {
      p_requirement_code: input.requirementCode,
      p_date: input.date ?? null,
      p_witness_name: input.witnessName ?? null,
      p_document_url: input.documentUrl ?? null,
      p_record_details: input.recordDetails ?? {},
      p_acknowledgment_name: input.acknowledgmentName ?? null,
    },
  );

  if (error) {
    throw error;
  }

  return String(data);
}

export async function submitFormationBayanihanAction(input: {
  stageCode: number;
  actionCategory: string;
  title?: string | null;
  description?: string | null;
  reflectionText?: string | null;
  evidenceUrl?: string | null;
  learningLessonId?: string | null;
  challengeId?: string | null;
  scopeMetadata?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    'submit_formation_bayanihan_action_v1',
    {
      p_stage_code: input.stageCode,
      p_action_category: input.actionCategory,
      p_title: input.title ?? null,
      p_description: input.description ?? null,
      p_reflection_text: input.reflectionText ?? null,
      p_evidence_url: input.evidenceUrl ?? null,
      p_track_lesson_id: null,
      p_learning_lesson_id: input.learningLessonId ?? null,
      p_challenge_id: input.challengeId ?? null,
      p_scope_metadata: input.scopeMetadata ?? {},
    },
  );

  if (error) {
    throw error;
  }

  return String(data);
}

export async function loadMyFormationRoleTrack(): Promise<Record<string, unknown>> {
  const { data, error } = await (supabase as any).rpc(
    'get_my_formation_role_track_v1',
  );

  if (error) {
    throw error;
  }

  return asRecord(data) ?? { assigned: false };
}

export async function assignFormationRoleTrack(input: {
  memberId: string;
  roleTrackId: string;
  validationNote?: string | null;
  lessonsPerWeek?: number | null;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    'assign_formation_role_track_v1',
    {
      p_member_id: input.memberId,
      p_role_track_id: input.roleTrackId,
      p_validation_note: input.validationNote ?? null,
      p_lessons_per_week: input.lessonsPerWeek ?? null,
    },
  );

  if (error) {
    throw error;
  }

  return String(data);
}

export async function setAdminFormationConfig(
  configKey: string,
  configValue: unknown,
): Promise<void> {
  const { error } = await (supabase as any).rpc(
    'admin_set_formation_config_v1',
    {
      p_config_key: configKey,
      p_config_value: configValue,
    },
  );

  if (error) {
    throw error;
  }
}

export function normalizeFormationLessonAccess(
  data: unknown,
): import('@/types/buklodFormation').FormationLessonAccess | null {
  const row = asRecord(data);
  if (!row) return null;

  return {
    allowed: Boolean(row.allowed),
    stage_code:
      row.stage_code == null ? null : Number(row.stage_code),
    release_status:
      typeof row.release_status === 'string' ? row.release_status : null,
    release_week:
      row.release_week == null ? null : Number(row.release_week),
    available_from:
      typeof row.available_from === 'string' ? row.available_from : null,
    blocking_reason:
      typeof row.blocking_reason === 'string'
        ? (row.blocking_reason as import('@/types/buklodFormation').FormationLessonBlockingReason)
        : null,
    track_lesson_id:
      typeof row.track_lesson_id === 'string' ? row.track_lesson_id : undefined,
    lesson_sequence:
      row.lesson_sequence == null ? undefined : Number(row.lesson_sequence),
    current_week:
      row.current_week == null ? undefined : Number(row.current_week),
    lessons_per_week:
      row.lessons_per_week == null ? undefined : Number(row.lessons_per_week),
  };
}

export function normalizeFormationWeeklyDelivery(
  data: unknown,
): import('@/types/buklodFormation').FormationWeeklyDelivery | null {
  const row = asRecord(data);
  if (!row) return null;

  return {
    stage_code: Number(row.stage_code ?? 0),
    delivery_assigned: Boolean(row.delivery_assigned),
    track_title:
      typeof row.track_title === 'string' ? row.track_title : undefined,
    lessons_per_week:
      row.lessons_per_week == null ? undefined : Number(row.lessons_per_week),
    current_week:
      row.current_week == null ? undefined : Number(row.current_week),
    release_status:
      typeof row.release_status === 'string' ? row.release_status : undefined,
    released_through_sequence:
      row.released_through_sequence == null
        ? undefined
        : Number(row.released_through_sequence),
    started_at:
      typeof row.started_at === 'string' ? row.started_at : undefined,
    lessons: Array.isArray(row.lessons)
      ? (row.lessons as import('@/types/buklodFormation').FormationWeeklyLesson[])
      : [],
    bayanihan_verified:
      row.bayanihan_verified == null
        ? undefined
        : Number(row.bayanihan_verified),
    bayanihan_required:
      row.bayanihan_required == null
        ? undefined
        : Number(row.bayanihan_required),
  };
}

export async function canAccessFormationLesson(
  lessonId: string,
): Promise<import('@/types/buklodFormation').FormationLessonAccess | null> {
  const { data, error } = await (supabase as any).rpc(
    'can_access_formation_lesson_v1',
    { p_lesson_id: lessonId },
  );

  if (error) {
    throw error;
  }

  return normalizeFormationLessonAccess(data);
}

export async function loadFormationLessonAccessBatch(
  lessonIds: string[],
): Promise<Map<string, FormationLessonAccess>> {
  const map = new Map<string, FormationLessonAccess>();

  if (!lessonIds.length) {
    return map;
  }

  const results = await Promise.all(
    lessonIds.map(async (lessonId) => ({
      lessonId,
      access: await canAccessFormationLesson(lessonId),
    })),
  );

  for (const { lessonId, access } of results) {
    if (access) {
      map.set(lessonId, access);
    }
  }

  return map;
}

export async function loadFormationTrackLessonAccessBatch(
  trackLessonIds: string[],
): Promise<Map<string, FormationLessonAccess>> {
  const map = new Map<string, FormationLessonAccess>();

  if (!trackLessonIds.length) {
    return map;
  }

  const results = await Promise.all(
    trackLessonIds.map(async (trackLessonId) => ({
      trackLessonId,
      access: await canAccessFormationTrackLesson(trackLessonId),
    })),
  );

  for (const { trackLessonId, access } of results) {
    if (access) {
      map.set(trackLessonId, access);
    }
  }

  return map;
}

export async function loadMyFormationWeeklyDelivery(
  stageCode: number,
): Promise<import('@/types/buklodFormation').FormationWeeklyDelivery | null> {
  const { data, error } = await (supabase as any).rpc(
    'get_my_formation_weekly_delivery_v1',
    { p_stage_code: stageCode },
  );

  if (error) {
    throw error;
  }

  return normalizeFormationWeeklyDelivery(data);
}

export function normalizeFormationStageCatalog(
  data: unknown,
): import('@/types/buklodFormation').FormationStageCatalog | null {
  const row = asRecord(data);
  if (!row) return null;

  return {
    stage_code: Number(row.stage_code ?? 0),
    access_allowed: Boolean(row.access_allowed),
    is_locked: Boolean(row.is_locked),
    blocking_reasons: Array.isArray(row.blocking_reasons)
      ? (row.blocking_reasons as string[])
      : [],
    delivery_assigned: Boolean(row.delivery_assigned),
    assigned_role_track_id:
      typeof row.assigned_role_track_id === 'string'
        ? row.assigned_role_track_id
        : null,
    role_tracks: Array.isArray(row.role_tracks)
      ? (row.role_tracks as import('@/types/buklodFormation').FormationRoleTrackCatalog[])
      : [],
    mission_lessons: Array.isArray(row.mission_lessons)
      ? (row.mission_lessons as import('@/types/buklodFormation').FormationCatalogLesson[])
      : [],
    counts: {
      catalog_total: Number(asRecord(row.counts)?.catalog_total ?? 0),
      member_visible: Number(asRecord(row.counts)?.member_visible ?? 0),
      published: Number(asRecord(row.counts)?.published ?? 0),
      draft: Number(asRecord(row.counts)?.draft ?? 0),
    },
  };
}

export async function loadFormationStageCatalog(
  stageCode: number,
): Promise<import('@/types/buklodFormation').FormationStageCatalog | null> {
  const { data, error } = await (supabase as any).rpc(
    'get_my_formation_stage_catalog_v1',
    { p_stage_code: stageCode },
  );

  if (error) {
    throw error;
  }

  return normalizeFormationStageCatalog(data);
}

export async function loadFormationTrackLesson(
  trackLessonId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await (supabase as any).rpc(
    'get_my_formation_track_lesson_v1',
    { p_track_lesson_id: trackLessonId },
  );

  if (error) {
    throw error;
  }

  return asRecord(data);
}

export async function canAccessFormationTrackLesson(
  trackLessonId: string,
): Promise<FormationLessonAccess | null> {
  const { data, error } = await (supabase as any).rpc(
    'can_access_formation_track_lesson_v1',
    { p_track_lesson_id: trackLessonId },
  );

  if (error) {
    throw error;
  }

  return normalizeFormationLessonAccess(data);
}

export async function startFormationCurriculumDelivery(input: {
  stageCode: number;
  memberId?: string | null;
  lessonsPerWeek?: number | null;
  roleTrackAssignmentId?: string | null;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    'start_formation_curriculum_delivery_v1',
    {
      p_stage_code: input.stageCode,
      p_member_id: input.memberId ?? null,
      p_lessons_per_week: input.lessonsPerWeek ?? null,
      p_role_track_assignment_id: input.roleTrackAssignmentId ?? null,
    },
  );

  if (error) {
    throw error;
  }

  return String(data);
}

export async function submitFormationMissionJournal(
  payload: import('@/types/buklodFormation').FormationMissionJournalPayload,
): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    'submit_formation_mission_journal_v1',
    { p_payload: payload },
  );

  if (error) {
    throw error;
  }

  return String(data);
}

export async function createMyFormationMissionProject(input?: {
  projectType?: string;
  missionFieldName?: string;
  generalLocation?: string;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    'create_my_formation_mission_project_v1',
    {
      p_project_type: input?.projectType ?? 'MISSION',
      p_mission_field_name: input?.missionFieldName ?? null,
      p_general_location: input?.generalLocation ?? null,
    },
  );

  if (error) {
    throw error;
  }

  return String(data);
}

export async function getFormationDocumentPath(input: {
  stageCode: number;
  requirementCode: string;
  filename: string;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    'get_formation_document_path_v1',
    {
      p_stage_code: input.stageCode,
      p_requirement_code: input.requirementCode,
      p_filename: input.filename,
    },
  );

  if (error) {
    throw error;
  }

  return String(data);
}

export async function loadAdminFormationCurriculumPreview(input?: {
  stageCode?: number | null;
  roleTrackId?: string | null;
}): Promise<unknown[]> {
  const { data, error } = await (supabase as any).rpc(
    'admin_get_formation_curriculum_preview_v1',
    {
      p_stage_code: input?.stageCode ?? null,
      p_role_track_id: input?.roleTrackId ?? null,
    },
  );

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function addFormationFeedback(input: {
  targetType: string;
  targetId: string;
  memberId: string;
  feedbackText: string;
  feedbackKind?: string;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    'add_formation_feedback_v1',
    {
      p_target_type: input.targetType,
      p_target_id: input.targetId,
      p_member_id: input.memberId,
      p_feedback_text: input.feedbackText,
      p_feedback_kind: input.feedbackKind ?? 'COMMENT',
    },
  );

  if (error) {
    throw error;
  }

  return String(data);
}

export type FormationLessonBuilderSnapshot = {
  providerConfigured: boolean;
  providerMessage: string;
  blueprints: Array<Record<string, unknown>>;
  units: Array<Record<string, unknown>>;
  generationJobs: Array<Record<string, unknown>>;
  manifests: Array<Record<string, unknown>>;
};

export type FormationCurriculumManifestCounts = {
  stageCode: number;
  components: Array<{
    code: string;
    trackSlug: string;
    expectedLessonCount: number;
    sourceReadyLessonCount?: number;
  }>;
};

export function normalizeFormationLessonBuilder(
  data: unknown,
): FormationLessonBuilderSnapshot | null {
  const row = asRecord(data);
  if (!row) return null;

  return {
    providerConfigured: Boolean(row.provider_configured),
    providerMessage:
      typeof row.provider_message === 'string'
        ? row.provider_message
        : 'AI provider not configured',
    blueprints: Array.isArray(row.blueprints)
      ? (row.blueprints as Array<Record<string, unknown>>)
      : [],
    units: Array.isArray(row.units)
      ? (row.units as Array<Record<string, unknown>>)
      : [],
    generationJobs: Array.isArray(row.generation_jobs)
      ? (row.generation_jobs as Array<Record<string, unknown>>)
      : [],
    manifests: Array.isArray(row.manifests)
      ? (row.manifests as Array<Record<string, unknown>>)
      : [],
  };
}

export function getAuthoritativeLessonCountExpectations(): FormationCurriculumManifestCounts[] {
  return [
    {
      stageCode: 101,
      components: [
        { code: 'CCP1', trackSlug: 'buklod-101-ccp-1', expectedLessonCount: 4 },
        { code: 'CCP2', trackSlug: 'buklod-101-ccp-2', expectedLessonCount: 4 },
      ],
    },
    {
      stageCode: 102,
      components: [
        { code: 'CCP3', trackSlug: 'buklod-102-ccp-3', expectedLessonCount: 7 },
      ],
    },
    {
      stageCode: 103,
      components: [
        { code: 'CCP4', trackSlug: 'buklod-103-ccp-4', expectedLessonCount: 3 },
        { code: 'CCP5', trackSlug: 'buklod-103-ccp-5', expectedLessonCount: 3 },
      ],
    },
    {
      stageCode: 104,
      components: [
        {
          code: 'PRE_ENCOUNTER',
          trackSlug: 'buklod-104-pre-encounter',
          expectedLessonCount: 7,
        },
        {
          code: 'POST_ENCOUNTER',
          trackSlug: 'buklod-104-post-encounter',
          expectedLessonCount: 10,
        },
      ],
    },
    {
      stageCode: 105,
      components: [
        {
          code: 'LEADERSHIP_1',
          trackSlug: 'buklod-105-leadership-1',
          expectedLessonCount: 10,
          sourceReadyLessonCount: 9,
        },
        {
          code: 'LEADERSHIP_2',
          trackSlug: 'buklod-105-leadership-2',
          expectedLessonCount: 10,
        },
        {
          code: 'LEADERSHIP_3',
          trackSlug: 'buklod-105-leadership-3',
          expectedLessonCount: 10,
        },
      ],
    },
  ];
}

export const AUTHORITATIVE_SOURCE_READY_COUNTS: Record<string, number> = {
  'buklod-101-ccp-1': 4,
  'buklod-101-ccp-2': 4,
  'buklod-102-ccp-3': 7,
  'buklod-103-ccp-4': 3,
  'buklod-103-ccp-5': 3,
  'buklod-104-pre-encounter': 7,
  'buklod-104-post-encounter': 10,
  'buklod-105-leadership-1': 9,
  'buklod-105-leadership-2': 10,
  'buklod-105-leadership-3': 10,
};

export function isDraftLessonMemberVisible(input: {
  stageCode?: number | null;
  publishedVersionStatus?: string | null;
  memberVisible?: boolean | null;
}): boolean {
  if (input.memberVisible != null) {
    return Boolean(input.memberVisible);
  }
  if (input.stageCode != null && input.stageCode >= 106) {
    return input.publishedVersionStatus === 'PUBLISHED';
  }
  return true;
}

export async function loadAdminFormationLessonBuilder(input?: {
  stageCode?: number | null;
}): Promise<FormationLessonBuilderSnapshot | null> {
  const { data, error } = await (supabase as any).rpc(
    'admin_get_formation_lesson_builder_v1',
    { p_stage_code: input?.stageCode ?? null },
  );

  if (error) {
    throw error;
  }

  return normalizeFormationLessonBuilder(data);
}

export async function syncAuthoritativeFormationCurriculum(input?: {
  stageCode?: number | null;
}): Promise<Record<string, unknown>> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_formation_sync_authoritative_curriculum_v1',
    { p_stage_code: input?.stageCode ?? null },
  );

  if (error) {
    throw error;
  }

  return asRecord(data) ?? {};
}

export async function createFormationGenerationJob(input: {
  blueprintUnitId: string;
  requestedLessonCount?: number;
  generationMode?: string;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    'create_formation_generation_job_v1',
    {
      p_blueprint_unit_id: input.blueprintUnitId,
      p_requested_lesson_count: input.requestedLessonCount ?? 1,
      p_generation_mode: input.generationMode ?? 'PROMPT_ONLY',
    },
  );

  if (error) {
    throw error;
  }

  return String(data);
}

export async function validateFormationLessonDraft(
  lessonVersionId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_formation_validate_lesson_draft_v1',
    { p_lesson_version_id: lessonVersionId },
  );

  if (error) {
    throw error;
  }

  return asRecord(data) ?? {};
}

export async function publishFormationLessonVersion(
  lessonVersionId: string,
): Promise<void> {
  const { error } = await (supabase as any).rpc(
    'publish_formation_lesson_version_v1',
    { p_lesson_version_id: lessonVersionId },
  );

  if (error) {
    throw error;
  }
}

/** Learning Progress / formation weekly surfaces — shared AI pre-submission validator adapter. */
export {
  buildGeneratedLessonQuestionContext,
  buildLessonAssignmentContext,
  buildLessonReflectionContext,
  buildMentoringGeneratedQuestionContext,
  buildMentoringReflectionContext,
  buildQuestionContextFromGenerated,
  generateQuestionWithValidationContext,
  isValidationAcceptable,
  pickGeneratedQuestions,
  validateBuklodResponse,
} from '@/lib/buklodAiResponseValidation';

export type {
  AIAnswerValidationResult,
  BuklodQuestionContext,
} from '@/types/buklodAiValidation';
