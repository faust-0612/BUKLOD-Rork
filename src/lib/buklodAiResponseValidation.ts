import { supabase } from '@/lib/supabase';
import type {
  AIAnswerValidationResult,
  BuklodQuestionContext,
  BuklodValidationAttachment,
  BuklodValidationFeedback,
  BuklodValidationProof,
  BuklodValidationScores,
} from '@/types/buklodAiValidation';

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

function normalizeFeedback(value: unknown): BuklodValidationFeedback {
  const row = asRecord(value);
  return {
    headline:
      typeof row?.headline === 'string'
        ? row.headline
        : 'Review your answer',
    guidance: asStringArray(row?.guidance),
    encouragement:
      typeof row?.encouragement === 'string' ? row.encouragement : undefined,
    language:
      row?.language === 'tl' || row?.language === 'en' || row?.language === 'taglish'
        ? row.language
        : 'taglish',
  };
}

function normalizeScores(value: unknown): BuklodValidationScores | undefined {
  const row = asRecord(value);
  if (!row) {
    return undefined;
  }

  const scores: BuklodValidationScores = {};
  for (const key of ['relevance', 'depth', 'clarity', 'effort', 'overall'] as const) {
    if (row[key] != null && Number.isFinite(Number(row[key]))) {
      scores[key] = Number(row[key]);
    }
  }

  return Object.keys(scores).length > 0 ? scores : undefined;
}

export function normalizeAIAnswerValidationResult(
  data: unknown,
): AIAnswerValidationResult | null {
  const row = asRecord(data);
  if (!row) {
    return null;
  }

  const status = row.status;
  if (
    status !== 'acceptable' &&
    status !== 'needs_improvement' &&
    status !== 'not_acceptable_yet'
  ) {
    return null;
  }

  return {
    status,
    attemptId: String(row.attempt_id ?? row.attemptId ?? ''),
    answerHash: String(row.answer_hash ?? row.answerHash ?? ''),
    feedback: normalizeFeedback(row.feedback),
    scores: normalizeScores(row.scores),
    model:
      row.model == null || row.model === ''
        ? null
        : String(row.model),
    validatedAt: String(
      row.validated_at ?? row.validatedAt ?? new Date().toISOString(),
    ),
    failOpen: Boolean(row.fail_open ?? row.failOpen),
    canSubmit: Boolean(row.can_submit ?? row.canSubmit ?? status === 'acceptable'),
  };
}

/** Client adapter — always calls server RPC (never client-only enforcement). */
export async function validateBuklodResponse(input: {
  questionContext: BuklodQuestionContext;
  response: string;
  attachments?: BuklodValidationAttachment[];
}): Promise<AIAnswerValidationResult> {
  const { data, error } = await (supabase as any).rpc(
    'validate_buklod_response_v1',
    {
      p_question_context: input.questionContext,
      p_response: input.response,
      p_attachments: input.attachments ?? [],
    },
  );

  if (error) {
    throw error;
  }

  const normalized = normalizeAIAnswerValidationResult(data);
  if (!normalized) {
    throw new Error('Validation service returned an unexpected response.');
  }

  return normalized;
}

export async function requestFacultyValidationOverride(input: {
  attemptId: string;
  reason: string;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    'override_buklod_response_validation_v1',
    {
      p_attempt_id: input.attemptId,
      p_reason: input.reason,
    },
  );

  if (error) {
    throw error;
  }

  return String(data);
}

export {
  buildGeneratedLessonQuestionContext,
  buildLessonAssignmentContext,
  buildLessonReflectionContext,
  buildMentoringGeneratedQuestionContext,
  buildMentoringReflectionContext,
  buildQuestionContextFromGenerated,
  buildQuestionId,
  buildStandardQuestionId,
  generateQuestionValidationContext,
  generateQuestionWithValidationContext,
  normalizeGeneratedQuestions,
  pickGeneratedQuestions,
} from '@/lib/buklodQuestionEngine';

export function buildValidationProof(
  results: AIAnswerValidationResult[],
  questionIds: string[],
): BuklodValidationProof {
  return {
    fields: results.map((result, index) => ({
      questionId: questionIds[index] ?? '',
      attemptId: result.attemptId,
      answerHash: result.answerHash,
    })),
  };
}

export function isValidationAcceptable(
  result: AIAnswerValidationResult | null | undefined,
): boolean {
  return Boolean(result?.canSubmit && result.status === 'acceptable');
}
