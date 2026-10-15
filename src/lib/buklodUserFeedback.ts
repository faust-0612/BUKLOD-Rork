import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { supabase } from '@/lib/supabase';

export type BuklodErrorCategory =
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'PERMISSION_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'CONFLICT_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'SERVICE_UNAVAILABLE'
  | 'RECOVERY_REQUIRED'
  | 'KNOWN_INCIDENT'
  | 'UNKNOWN_ERROR';

export type BuklodFeedbackTone =
  | 'success'
  | 'info'
  | 'warning'
  | 'error';

export type BuklodUserFeedback = {
  tone: BuklodFeedbackTone;
  category: BuklodErrorCategory | null;
  title: string;
  message: string;
  nextStep?: string | null;
  supportCode?: string | null;
  retryable: boolean;
  needsSupport: boolean;
};

export type BuklodFeedbackTelemetryEvent =
  | 'error_shown'
  | 'error_category'
  | 'recovery_offered'
  | 'recovery_attempted'
  | 'recovery_success'
  | 'support_opened_after_error'
  | 'user_abandoned_after_error'
  | 'action_processing'
  | 'action_success'
  | 'action_failed'
  | 'self_heal_attempted'
  | 'self_heal_success';

const SUPPORT_CODES: Record<BuklodErrorCategory, string> = {
  VALIDATION_ERROR: 'UX-100',
  AUTH_ERROR: 'AUTH-101',
  PERMISSION_ERROR: 'AUTHZ-403',
  NETWORK_ERROR: 'NET-100',
  TIMEOUT_ERROR: 'NET-408',
  CONFLICT_ERROR: 'UX-409',
  NOT_FOUND: 'UX-404',
  RATE_LIMIT: 'AUTH-429',
  SERVICE_UNAVAILABLE: 'SYS-503',
  RECOVERY_REQUIRED: 'REC-100',
  KNOWN_INCIDENT: 'INC-100',
  UNKNOWN_ERROR: 'SYS-500',
};

function rawErrorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error
  ) {
    return String((error as any).message ?? '');
  }
  return '';
}

export function classifyBuklodError(
  error: unknown,
  context: 'login' | 'recovery' | 'general' = 'general',
): BuklodErrorCategory {
  const text = rawErrorText(error).toLowerCase();

  if (/too many|rate.?limit|429/.test(text)) {
    return 'RATE_LIMIT';
  }
  if (/timeout|timed out|deadline|aborted/.test(text)) {
    return 'TIMEOUT_ERROR';
  }
  if (/offline|network|fetch failed|failed to fetch|connection/.test(text)) {
    return 'NETWORK_ERROR';
  }
  if (/permission|forbidden|not authorized|unauthorized|403/.test(text)) {
    return 'PERMISSION_ERROR';
  }
  if (/not found|404/.test(text)) {
    return 'NOT_FOUND';
  }
  if (/already|conflict|409/.test(text)) {
    return 'CONFLICT_ERROR';
  }
  if (/service unavailable|temporarily unavailable|503/.test(text)) {
    return 'SERVICE_UNAVAILABLE';
  }
  if (
    context === 'login' &&
    /invalid login|invalid credentials|incorrect password|wrong password|password.*invalid/.test(text)
  ) {
    return 'AUTH_ERROR';
  }
  if (
    context === 'recovery' &&
    /recovery|verification|otp|one-time|code|pin/.test(text)
  ) {
    return 'RECOVERY_REQUIRED';
  }

  return 'UNKNOWN_ERROR';
}

export function buildBuklodUserFeedback(
  error: unknown,
  options: {
    context?: 'login' | 'recovery' | 'general';
    fallbackTitle?: string;
    fallbackMessage?: string;
  } = {},
): BuklodUserFeedback {
  const context = options.context ?? 'general';
  const category = classifyBuklodError(error, context);
  const supportCode = SUPPORT_CODES[category];

  if (category === 'RATE_LIMIT') {
    return {
      tone: 'warning',
      category,
      title: 'Please wait before trying again',
      message:
        'BUKLOD is limiting repeated requests for a short time. Your information is safe.',
      nextStep: 'Wait briefly, then try once.',
      supportCode,
      retryable: true,
      needsSupport: false,
    };
  }

  if (category === 'TIMEOUT_ERROR') {
    return {
      tone: 'warning',
      category,
      title: 'This is taking longer than expected',
      message:
        "BUKLOD couldn't finish the request in time. Your information is safe.",
      nextStep: 'Try again. If it repeats, open Need Help.',
      supportCode,
      retryable: true,
      needsSupport: true,
    };
  }

  if (category === 'NETWORK_ERROR') {
    return {
      tone: 'warning',
      category,
      title: 'Connection problem',
      message:
        "BUKLOD couldn't reach the service right now.",
      nextStep: 'Check your connection, then try again.',
      supportCode,
      retryable: true,
      needsSupport: true,
    };
  }

  if (category === 'AUTH_ERROR' && context === 'login') {
    return {
      tone: 'error',
      category,
      title: 'Sign-in not completed',
      message:
        'The username, email, mobile number, or password is incorrect.',
      nextStep: 'Check the details, try again, or recover your account.',
      supportCode,
      retryable: true,
      needsSupport: true,
    };
  }

  if (category === 'PERMISSION_ERROR') {
    return {
      tone: 'warning',
      category,
      title: 'Access not available',
      message:
        "You don't have permission to complete this action.",
      nextStep: 'Go back or request access where available.',
      supportCode,
      retryable: false,
      needsSupport: false,
    };
  }

  if (category === 'SERVICE_UNAVAILABLE') {
    return {
      tone: 'warning',
      category,
      title: 'BUKLOD service is temporarily unavailable',
      message:
        "We couldn't complete this action right now.",
      nextStep: 'Please try again shortly. Open Need Help if it continues.',
      supportCode,
      retryable: true,
      needsSupport: true,
    };
  }

  if (category === 'RECOVERY_REQUIRED') {
    return {
      tone: 'error',
      category,
      title: 'Recovery not completed',
      message:
        options.fallbackMessage ??
        "BUKLOD couldn't complete account recovery.",
      nextStep: 'Check the recovery step and try again. Use Need Help if it repeats.',
      supportCode,
      retryable: true,
      needsSupport: true,
    };
  }

  return {
    tone: 'error',
    category,
    title: options.fallbackTitle ?? "We couldn't complete this action",
    message:
      options.fallbackMessage ??
      'Please try again.',
    nextStep: 'Try again. If the same problem continues, open Need Help.',
    supportCode,
    retryable: true,
    needsSupport: true,
  };
}

function sanitizeMetadata(input: Record<string, unknown> | undefined) {
  if (!input) return {};
  const output: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(input).slice(0, 20)) {
    const safeKey = String(key).slice(0, 64);
    if (
      /password|pin|otp|token|secret|credential|answer/i.test(safeKey)
    ) {
      continue;
    }

    if (
      value === null ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      output[safeKey] = value;
      continue;
    }

    if (typeof value === 'string') {
      output[safeKey] = value.slice(0, 240);
    }
  }

  return output;
}

// Avoid flooding the network when a component renders the same error repeatedly.
// Keep important recovery outcomes unthrottled; actual support tickets use a separate path.
const BUKLOD_FEEDBACK_EVENT_WINDOW_MS = 15_000;
const BUKLOD_FEEDBACK_MAX_CONCURRENT = 3;
const recentLowPriorityEvents = new Map<string, number>();
let telemetryPendingRequests = 0;

export async function trackBuklodFeedbackEvent(input: {
  event: BuklodFeedbackTelemetryEvent;
  category?: BuklodErrorCategory | null;
  supportCode?: string | null;
  route?: string | null;
  feature?: string | null;
  outcome?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const lowPriority =
    input.event === 'error_shown' ||
    input.event === 'error_category' ||
    input.event === 'recovery_offered';

  const eventKey = [
    input.event,
    input.category ?? '',
    input.supportCode ?? '',
    input.route ?? '',
    input.feature ?? '',
  ].join('|');
  const now = Date.now();
  if (lowPriority) {
    const last = recentLowPriorityEvents.get(eventKey) ?? 0;
    if (now - last < BUKLOD_FEEDBACK_EVENT_WINDOW_MS) return;
  }
  if (telemetryPendingRequests >= BUKLOD_FEEDBACK_MAX_CONCURRENT) return;
  if (lowPriority) {
    recentLowPriorityEvents.set(eventKey, now);
    if (recentLowPriorityEvents.size > 100) {
      for (const [key, timestamp] of recentLowPriorityEvents) {
        if (now - timestamp > BUKLOD_FEEDBACK_EVENT_WINDOW_MS) {
          recentLowPriorityEvents.delete(key);
        }
      }
    }
  }
  telemetryPendingRequests++;
  try {
    const request = supabase.functions.invoke('buklod-support-v1', {
      body: {
          action: 'telemetry',
          event: input.event,
          category: input.category ?? null,
          support_code: input.supportCode ?? null,
          route: input.route ?? null,
          feature: input.feature ?? null,
          outcome: input.outcome ?? null,
          app: 'BUKLOD Main',
          app_version: Constants.expoConfig?.version ?? '',
          platform: Platform.OS,
          metadata: sanitizeMetadata(input.metadata),
      },
    });
    // The visible action is not blocked by telemetry. The underlying promise
    // owns the concurrency slot until it truly settles, even on a client timeout.
    void request.finally(() => {
      telemetryPendingRequests = Math.max(0, telemetryPendingRequests - 1);
    }).catch(() => undefined);
    await withBuklodTimeout(request, 1_800, 'BUKLOD support telemetry');
  } catch {
    // Telemetry must never block or change the user's action.
  }
}
