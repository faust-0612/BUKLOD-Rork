export type FormationCatalogLesson = {
  track_lesson_id: string;
  lesson_sequence: number;
  title: string;
  learning_lesson_id: string | null;
  version_status: string | null;
  member_visible: boolean;
  controlled_batch?: string | null;
};

export type FormationRoleTrackCatalog = {
  role_track_id: string;
  track_code: string;
  title_en: string;
  title_fil: string;
  display_order: number;
  is_assigned: boolean;
  lessons: FormationCatalogLesson[];
  total_lessons: number;
  member_visible_lessons: number;
};

export type FormationStageCatalog = {
  stage_code: number;
  access_allowed: boolean;
  is_locked: boolean;
  blocking_reasons: string[];
  delivery_assigned: boolean;
  assigned_role_track_id: string | null;
  role_tracks: FormationRoleTrackCatalog[];
  mission_lessons: FormationCatalogLesson[];
  counts: {
    catalog_total: number;
    member_visible: number;
    published: number;
    draft: number;
  };
};

export type FormationLessonBlockingReason =
  | 'LESSON_NOT_RELEASED'
  | 'PREREQUISITE_LESSON_INCOMPLETE'
  | 'FORMATION_TRACK_NOT_ASSIGNED'
  | 'CURRICULUM_NOT_ASSIGNED'
  | 'STAGE_LOCKED'
  | 'REPEAT_REQUIRED'
  | 'LESSON_NOT_PUBLISHED'
  | 'LESSON_NOT_FOUND';

export type FormationLessonAccess = {
  allowed: boolean;
  stage_code: number | null;
  release_status: string | null;
  release_week: number | null;
  available_from: string | null;
  blocking_reason: FormationLessonBlockingReason | null;
  track_lesson_id?: string;
  lesson_sequence?: number;
  current_week?: number;
  lessons_per_week?: number;
};

export type FormationWeeklyLesson = {
  track_lesson_id: string;
  learning_lesson_id: string | null;
  lesson_sequence: number;
  title: string;
  calendar_released: boolean;
  prerequisites_met: boolean;
  access_allowed: boolean;
  approved: boolean;
  in_current_week: boolean;
};

export type FormationWeeklyDelivery = {
  stage_code: number;
  delivery_assigned: boolean;
  track_title?: string;
  lessons_per_week?: number;
  current_week?: number;
  release_status?: string;
  released_through_sequence?: number;
  started_at?: string;
  lessons?: FormationWeeklyLesson[];
  bayanihan_verified?: number;
  bayanihan_required?: number;
};

export type FormationMissionJournalPayload = {
  project_id?: string | null;
  track_lesson_id?: string | null;
  learning_lesson_id?: string | null;
  challenge_id?: string | null;
  mission_field?: string;
  target_people_group?: string;
  observed_need?: string;
  planned_action?: string;
  target_date?: string;
  what_happened?: string;
  people_reached_count?: number | null;
  what_learned?: string;
  next_step?: string;
  follow_up_date?: string;
  location_note?: string;
  evidence_url?: string;
  create_bayanihan_action?: boolean;
  action_category?: string;
};

export type FormationBlockingReason =
  | 'PREVIOUS_STAGE_INCOMPLETE'
  | 'LESSONS_INCOMPLETE'
  | 'DOCUMENT_PENDING'
  | 'VALIDATION_PENDING'
  | 'POINTS_REQUIREMENT_NOT_MET'
  | 'BAYANIHAN_REQUIREMENT_NOT_MET'
  | 'REPEAT_REQUIRED'
  | 'STAGE_DISABLED'
  | 'CURRICULUM_NOT_ASSIGNED';

export type FormationStageAccess = {
  allowed?: boolean;
  access_allowed: boolean;
  is_locked?: boolean;
  stage_code: number;
  engine_v2_enabled?: boolean;
  prerequisite_stage_code?: number | null;
  prerequisite_complete?: boolean;
  downstream_repeat_locked?: boolean;
  repeat_required?: boolean;
  blocking_reasons: FormationBlockingReason[];
  lessons_complete?: boolean;
  documents_or_milestones_complete?: boolean;
  validations_complete?: boolean;
  stage_points_current?: number;
  stage_points_required?: number;
  stage_points_met?: boolean;
  stage_bayanihan_current?: number;
  stage_bayanihan_required?: number;
  stage_bayanihan_met?: boolean;
  completion_status?: string;
  stage_complete?: boolean;
  requirements_met?: boolean;
};

export type FormationStageJourneyStatus =
  | 'locked'
  | 'current'
  | 'completed'
  | 'repeat_required'
  | 'historically_complete_locked';

export type FormationStageProgress = {
  expected_lessons: number;
  approved_lessons: number;
  required_records: number;
  verified_records: number;
  lessons_complete: boolean;
  requirements_complete: boolean;
  stage_complete: boolean;
};

export type FormationJourneyStage = {
  stage_code: number;
  stage_order: number;
  title_en: string;
  title_fil: string;
  status: FormationStageJourneyStatus;
  access_allowed: boolean;
  is_locked: boolean;
  locked: boolean;
  current: boolean;
  completed: boolean;
  historically_complete: boolean;
  downstream_repeat_locked: boolean;
  repeat_required: boolean;
  is_completable: boolean;
  prerequisite_complete?: boolean;
  completion_status?: string;
  lessons_complete?: boolean;
  documents_or_milestones_complete?: boolean;
  validations_complete?: boolean;
  stage_points_current?: number;
  stage_points_required?: number;
  stage_points_met?: boolean;
  stage_bayanihan_current?: number;
  stage_bayanihan_required?: number;
  stage_bayanihan_met?: boolean;
  progress: FormationStageProgress;
  access?: Record<string, unknown>;
  completion?: Record<string, unknown>;
  blocking_reasons: FormationBlockingReason[];
  next_action: string | null;
};

export type FormationJourney = {
  engine_v2_enabled: boolean;
  stages: FormationJourneyStage[];
  next_action: string | null;
};

export type FormationRepeatScope =
  | 'LESSON'
  | 'SELECTED_LESSONS'
  | 'ASSESSMENT'
  | 'MODULE'
  | 'STAGE';
