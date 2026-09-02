/**
 * GLOBAL BUKLOD AI Pre-Submission Content Validation — shared contracts.
 * All meaningful learner Q&A surfaces should use these types.
 */

export type BuklodAIValidationStatus =
  | 'acceptable'
  | 'needs_improvement'
  | 'not_acceptable_yet';

export type BuklodValidationModule =
  | 'lesson'
  | 'learning_progress'
  | 'classroom'
  | 'formation'
  | 'assessment'
  | 'bayanihan'
  | 'bible'
  | 'other';

export type BuklodQuestionType =
  | 'reflection'
  | 'assignment'
  | 'free_text'
  | 'generated'
  | 'photo_evidence'
  | 'short_answer';

export type BuklodFeedbackLanguage = 'tl' | 'en' | 'taglish';

/** Hidden validation metadata generated alongside auto-generated questions. */
export type BuklodQuestionValidationMetadata = {
  learningObjective: string;
  expectedConcepts: string[];
  requiredPoints: string[];
  competency: string;
  validationGuidance: string;
};

/** Auto-generated question + hidden validation context (server or client). */
export type BuklodGeneratedQuestion = {
  questionText: string;
  questionIndex: number;
  validationContext: BuklodQuestionValidationMetadata;
};

/** Canonical question context passed to the validation engine. */
export type BuklodQuestionContext = {
  /** Stable id, e.g. `lesson:{uuid}:reflection` or `lp:{stage}:q3` */
  questionId: string;
  module: BuklodValidationModule;
  questionText: string;
  questionType?: BuklodQuestionType;
  lessonId?: string | null;
  trackId?: string | null;
  enrollmentId?: string | null;
  stageCode?: number | null;
  minimumChars?: number;
  minimumWords?: number;
  expectedThemes?: string[];
  languageHint?: BuklodFeedbackLanguage | 'auto';
  lessonTitle?: string | null;
  scriptureReference?: string | null;
  rubricNotes?: string | null;
  allowPhotoEvidence?: boolean;
  /** Hidden semantic validation metadata (not shown to learners). */
  learningObjective?: string;
  expectedConcepts?: string[];
  requiredPoints?: string[];
  competency?: string;
  validationGuidance?: string;
  metadata?: Record<string, unknown>;
};

export type BuklodValidationAttachment = {
  type: 'photo' | 'document' | 'audio';
  url?: string;
  storagePath?: string;
  mimeType?: string;
  caption?: string;
};

export type BuklodValidationScores = {
  relevance?: number;
  depth?: number;
  clarity?: number;
  effort?: number;
  overall?: number;
};

export type BuklodValidationFeedback = {
  headline: string;
  guidance: string[];
  encouragement?: string;
  language: BuklodFeedbackLanguage;
};

/** Server RPC + client hook result shape. */
export type AIAnswerValidationResult = {
  status: BuklodAIValidationStatus;
  attemptId: string;
  answerHash: string;
  feedback: BuklodValidationFeedback;
  scores?: BuklodValidationScores;
  model?: string | null;
  validatedAt: string;
  failOpen?: boolean;
  /** True when learner may proceed to faculty submission RPC. */
  canSubmit: boolean;
};

export type BuklodValidationProofField = {
  questionId: string;
  attemptId: string;
  answerHash: string;
};

export type BuklodValidationProof = {
  fields: BuklodValidationProofField[];
};
