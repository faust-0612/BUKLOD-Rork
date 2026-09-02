import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isValidationAcceptable,
  validateBuklodResponse,
} from '@/lib/buklodAiResponseValidation';
import type {
  AIAnswerValidationResult,
  BuklodQuestionContext,
  BuklodValidationAttachment,
} from '@/types/buklodAiValidation';

type ValidateInput = {
  response: string;
  attachments?: BuklodValidationAttachment[];
};

export function useBuklodAnswerValidation(
  questionContext: BuklodQuestionContext,
  /** When provided, stale validation is cleared if the answer text changes. */
  watchedResponse?: string,
) {
  const [isValidating, setIsValidating] = useState(false);
  const [lastResult, setLastResult] = useState<AIAnswerValidationResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const lastValidatedValueRef = useRef<string>('');

  const reset = useCallback(() => {
    setLastResult(null);
    setError(null);
    lastValidatedValueRef.current = '';
  }, []);

  useEffect(() => {
    reset();
  }, [questionContext.questionId, reset]);

  useEffect(() => {
    if (watchedResponse == null) {
      return;
    }

    const trimmed = watchedResponse.trim();
    if (
      lastValidatedValueRef.current &&
      trimmed !== lastValidatedValueRef.current
    ) {
      reset();
    }
  }, [watchedResponse, reset]);

  const validate = useCallback(
    async (input: ValidateInput): Promise<AIAnswerValidationResult | null> => {
      const trimmed = input.response.trim();
      if (!trimmed) {
        setError('Write your answer before checking.');
        setLastResult(null);
        return null;
      }

      setIsValidating(true);
      setError(null);

      try {
        const result = await validateBuklodResponse({
          questionContext,
          response: trimmed,
          attachments: input.attachments,
        });

        setLastResult(result);
        lastValidatedValueRef.current = trimmed;
        return result;
      } catch (validationError: any) {
        setError(
          validationError?.message ??
            'Could not check your answer right now. Please try again.',
        );
        setLastResult(null);
        return null;
      } finally {
        setIsValidating(false);
      }
    },
    [questionContext],
  );

  const isCurrentValueValidated = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || !lastResult) {
        return false;
      }

      return (
        trimmed === lastValidatedValueRef.current &&
        isValidationAcceptable(lastResult)
      );
    },
    [lastResult],
  );

  const validateBeforeSubmit = useCallback(
    async (input: ValidateInput): Promise<boolean> => {
      if (isCurrentValueValidated(input.response)) {
        return true;
      }

      const result = await validate(input);
      return isValidationAcceptable(result);
    },
    [isCurrentValueValidated, validate],
  );

  return {
    isValidating,
    lastResult,
    error,
    validate,
    validateBeforeSubmit,
    isCurrentValueValidated,
    reset,
    canSubmit: isValidationAcceptable(lastResult),
  };
}
