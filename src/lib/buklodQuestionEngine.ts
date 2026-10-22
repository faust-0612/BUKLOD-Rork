import type {
  BuklodGeneratedQuestion,
  BuklodQuestionContext,
  BuklodQuestionType,
  BuklodQuestionValidationMetadata,
  BuklodValidationModule,
} from '@/types/buklodAiValidation';

/** Standard id: `{module}:{sourceId}:{type}:{index}` */
export function buildStandardQuestionId(input: {
  module: BuklodValidationModule;
  sourceId: string;
  type: BuklodQuestionType | string;
  index?: number | string | null;
}): string {
  const parts = [input.sourceId, input.type];
  if (input.index != null && String(input.index).trim() !== '') {
    parts.push(String(input.index));
  }
  return `${input.module}:${parts.join(':')}`;
}

export function buildQuestionId(
  module: BuklodValidationModule,
  parts: Array<string | number | null | undefined>,
): string {
  const suffix = parts
    .filter((part) => part != null && String(part).trim() !== '')
    .map((part) => String(part))
    .join(':');

  return `${module}:${suffix}`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeValidationMetadata(
  value: unknown,
): BuklodQuestionValidationMetadata | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const learningObjective = String(row.learningObjective ?? row.learning_objective ?? '').trim();
  if (!learningObjective) {
    return null;
  }

  return {
    learningObjective,
    expectedConcepts: asStringArray(row.expectedConcepts ?? row.expected_concepts),
    requiredPoints: asStringArray(row.requiredPoints ?? row.required_points),
    competency: String(row.competency ?? 'comprehension'),
    validationGuidance: String(
      row.validationGuidance ?? row.validation_guidance ?? '',
    ).trim(),
  };
}

const GENERATED_QUESTION_TEMPLATES: Array<{
  competency: string;
  build: (input: {
    lessonTitle: string;
    scriptureReference?: string | null;
    questionText: string;
    index: number;
  }) => BuklodQuestionValidationMetadata;
}> = [
  {
    competency: 'comprehension',
    build: ({ lessonTitle, questionText }) => ({
      learningObjective: `Identify and explain the main message of "${lessonTitle}".`,
      expectedConcepts: ['main message', 'central theme', 'lesson takeaway'],
      requiredPoints: [
        'States the main message in the learner\'s own words',
        'Connects the message to the lesson content',
      ],
      competency: 'comprehension',
      validationGuidance:
        `Accept answers that clearly summarize the core teaching. Question: ${questionText}`,
    }),
  },
  {
    competency: 'analysis',
    build: ({ lessonTitle, scriptureReference, questionText }) => ({
      learningObjective: scriptureReference
        ? `Reflect on ${scriptureReference} in the context of "${lessonTitle}".`
        : `Reflect on a meaningful part of "${lessonTitle}".`,
      expectedConcepts: ['scripture connection', 'personal insight', 'reflection'],
      requiredPoints: [
        'Names a specific part, verse, or idea that stood out',
        'Explains why it was meaningful',
      ],
      competency: 'analysis',
      validationGuidance:
        `Look for personal engagement with scripture or lesson content. Question: ${questionText}`,
    }),
  },
  {
    competency: 'application',
    build: ({ lessonTitle, questionText }) => ({
      learningObjective: `Articulate discipleship lessons from "${lessonTitle}".`,
      expectedConcepts: ['faith', 'discipleship', 'God', 'Christ-like living'],
      requiredPoints: [
        'Mentions a spiritual truth or discipleship lesson',
        'Shows understanding beyond copying the question',
      ],
      competency: 'application',
      validationGuidance:
        `Expect faith-connected explanation, not generic filler. Question: ${questionText}`,
    }),
  },
  {
    competency: 'action',
    build: ({ lessonTitle, questionText }) => ({
      learningObjective: `Plan a concrete response to "${lessonTitle}".`,
      expectedConcepts: ['practical action', 'obedience', 'service', 'life change'],
      requiredPoints: [
        'Names a specific, doable next step',
        'Shows intent to apply the lesson',
      ],
      competency: 'action',
      validationGuidance:
        `Accept concrete, sincere action steps tied to the lesson. Question: ${questionText}`,
    }),
  },
];

/** Build hidden validation metadata for a template-generated question. */
export function generateQuestionValidationContext(input: {
  questionText: string;
  questionIndex: number;
  lessonTitle?: string | null;
  scriptureReference?: string | null;
  persistedContext?: unknown;
}): BuklodQuestionValidationMetadata {
  const persisted = normalizeValidationMetadata(input.persistedContext);
  if (persisted) {
    return persisted;
  }

  const template =
    GENERATED_QUESTION_TEMPLATES[input.questionIndex - 1] ??
    GENERATED_QUESTION_TEMPLATES[0];

  return template.build({
    lessonTitle: input.lessonTitle?.trim() || 'this lesson',
    scriptureReference: input.scriptureReference ?? null,
    questionText: input.questionText,
    index: input.questionIndex,
  });
}

/** When AI/template generates a question, also produce hidden validation metadata. */
export function generateQuestionWithValidationContext(input: {
  questionText: string;
  questionIndex: number;
  lessonTitle?: string | null;
  scriptureReference?: string | null;
  persistedContext?: unknown;
}): BuklodGeneratedQuestion {
  return {
    questionText: input.questionText,
    questionIndex: input.questionIndex,
    validationContext: generateQuestionValidationContext(input),
  };
}

function readPersistedGeneratedContext(
  aiValidationContext: unknown,
  questionIndex: number,
): unknown {
  const root = asRecord(aiValidationContext);
  if (!root) {
    return null;
  }

  const generated = root.generated ?? root.generated_questions;
  if (!Array.isArray(generated)) {
    return null;
  }

  return generated[questionIndex - 1] ?? null;
}

function attachValidationMetadata(
  context: BuklodQuestionContext,
  metadata: BuklodQuestionValidationMetadata,
): BuklodQuestionContext {
  return {
    ...context,
    learningObjective: metadata.learningObjective,
    expectedConcepts: metadata.expectedConcepts,
    requiredPoints: metadata.requiredPoints,
    competency: metadata.competency,
    validationGuidance: metadata.validationGuidance,
    metadata: {
      ...(context.metadata ?? {}),
      validation_context: metadata,
    },
  };
}

export function buildQuestionContextFromGenerated(input: {
  module: BuklodValidationModule;
  sourceId: string;
  questionIndex: number;
  questionText: string;
  lessonId?: string | null;
  trackId?: string | null;
  enrollmentId?: string | null;
  stageCode?: number | null;
  lessonTitle?: string | null;
  scriptureReference?: string | null;
  minimumChars?: number;
  aiValidationContext?: unknown;
}): BuklodQuestionContext {
  const validationContext = generateQuestionValidationContext({
    questionText: input.questionText,
    questionIndex: input.questionIndex,
    lessonTitle: input.lessonTitle,
    scriptureReference: input.scriptureReference,
    persistedContext: readPersistedGeneratedContext(
      input.aiValidationContext,
      input.questionIndex,
    ),
  });

  return attachValidationMetadata(
    {
      questionId: buildStandardQuestionId({
        module: input.module,
        sourceId: input.sourceId,
        type: 'generated',
        index: input.questionIndex,
      }),
      module: input.module,
      questionType: 'generated',
      lessonId: input.lessonId ?? null,
      trackId: input.trackId ?? null,
      enrollmentId: input.enrollmentId ?? null,
      stageCode: input.stageCode ?? null,
      questionText: input.questionText,
      lessonTitle: input.lessonTitle ?? null,
      scriptureReference: input.scriptureReference ?? null,
      minimumChars: input.minimumChars ?? 10,
      languageHint: 'taglish',
    },
    validationContext,
  );
}

export function buildLessonReflectionContext(input: {
  lessonId: string;
  trackId?: string | null;
  enrollmentId?: string | null;
  stageCode?: number | null;
  questionText: string;
  lessonTitle?: string | null;
  scriptureReference?: string | null;
  minimumChars?: number;
  aiValidationContext?: unknown;
}): BuklodQuestionContext {
  const root = asRecord(input.aiValidationContext);
  const persisted = normalizeValidationMetadata(root?.reflection);
  const metadata =
    persisted ??
    generateQuestionValidationContext({
      questionText: input.questionText,
      questionIndex: 0,
      lessonTitle: input.lessonTitle,
      scriptureReference: input.scriptureReference,
    });

  return attachValidationMetadata(
    {
      questionId: buildStandardQuestionId({
        module: 'lesson',
        sourceId: input.lessonId,
        type: 'reflection',
      }),
      module: 'lesson',
      questionType: 'reflection',
      lessonId: input.lessonId,
      trackId: input.trackId ?? null,
      enrollmentId: input.enrollmentId ?? null,
      stageCode: input.stageCode ?? null,
      questionText: input.questionText,
      lessonTitle: input.lessonTitle ?? null,
      scriptureReference: input.scriptureReference ?? null,
      minimumChars: input.minimumChars ?? 20,
      languageHint: 'taglish',
    },
    {
      ...metadata,
      learningObjective:
        metadata.learningObjective ||
        `Personal reflection on "${input.lessonTitle ?? 'this lesson'}".`,
      competency: 'reflection',
      validationGuidance:
        metadata.validationGuidance ||
        'Expect personal, sincere reflection connected to the lesson — not copied prompts.',
    },
  );
}

export function buildLessonAssignmentContext(input: {
  lessonId: string;
  trackId?: string | null;
  enrollmentId?: string | null;
  prompt: string;
  lessonTitle?: string | null;
  minimumChars?: number;
}): BuklodQuestionContext {
  return {
    questionId: buildStandardQuestionId({
      module: 'lesson',
      sourceId: input.lessonId,
      type: 'assignment',
    }),
    module: 'lesson',
    questionType: 'assignment',
    lessonId: input.lessonId,
    trackId: input.trackId ?? null,
    enrollmentId: input.enrollmentId ?? null,
    questionText: input.prompt,
    lessonTitle: input.lessonTitle ?? null,
    minimumChars: input.minimumChars ?? 30,
    languageHint: 'taglish',
    learningObjective: `Complete the assignment for "${input.lessonTitle ?? 'this lesson'}".`,
    competency: 'application',
    validationGuidance:
      'Answer the assignment prompt directly with thoughtful detail and personal effort.',
  };
}

/** Formation / LP lesson — uses `lesson` module id prefix to match submission RPCs. */
export function buildGeneratedLessonQuestionContext(input: {
  lessonId: string;
  trackId?: string | null;
  enrollmentId?: string | null;
  stageCode?: number | null;
  questionIndex: number;
  questionText: string;
  lessonTitle?: string | null;
  scriptureReference?: string | null;
  aiValidationContext?: unknown;
}): BuklodQuestionContext {
  return buildQuestionContextFromGenerated({
    module: 'lesson',
    sourceId: input.lessonId,
    questionIndex: input.questionIndex,
    questionText: input.questionText,
    lessonId: input.lessonId,
    trackId: input.trackId,
    enrollmentId: input.enrollmentId,
    stageCode: input.stageCode,
    lessonTitle: input.lessonTitle,
    scriptureReference: input.scriptureReference,
    aiValidationContext: input.aiValidationContext,
  });
}

/** Mentoring release (BUKLOD 106/107) generated question context. */
export function buildMentoringGeneratedQuestionContext(input: {
  releaseId: string;
  questionIndex: number;
  questionText: string;
  lessonTitle?: string | null;
  scriptureReference?: string | null;
  stageCode?: number | null;
}): BuklodQuestionContext {
  return buildQuestionContextFromGenerated({
    module: 'formation',
    sourceId: input.releaseId,
    questionIndex: input.questionIndex,
    questionText: input.questionText,
    stageCode: input.stageCode ?? null,
    lessonTitle: input.lessonTitle,
    scriptureReference: input.scriptureReference,
  });
}

export function buildMentoringReflectionContext(input: {
  releaseId: string;
  questionText?: string;
  lessonTitle?: string | null;
  stageCode?: number | null;
}): BuklodQuestionContext {
  const questionText =
    input.questionText ??
    'What did God teach you, and how will you apply it?';

  const metadata = generateQuestionValidationContext({
    questionText,
    questionIndex: 0,
    lessonTitle: input.lessonTitle,
  });

  return attachValidationMetadata(
    {
      questionId: buildStandardQuestionId({
        module: 'formation',
        sourceId: input.releaseId,
        type: 'reflection',
      }),
      module: 'formation',
      questionType: 'reflection',
      stageCode: input.stageCode ?? null,
      questionText,
      lessonTitle: input.lessonTitle ?? null,
      minimumChars: 20,
      languageHint: 'taglish',
    },
    {
      ...metadata,
      competency: 'reflection',
      learningObjective:
        metadata.learningObjective ||
        `Personal mentoring reflection for "${input.lessonTitle ?? 'this release'}".`,
    },
  );
}

export function normalizeGeneratedQuestions(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

export function pickGeneratedQuestions(input: {
  fil?: unknown;
  en?: unknown;
}): string[] {
  const fil = normalizeGeneratedQuestions(input.fil);
  if (fil.length === 4) {
    return fil;
  }

  const en = normalizeGeneratedQuestions(input.en);
  return en.length === 4 ? en : [];
}
