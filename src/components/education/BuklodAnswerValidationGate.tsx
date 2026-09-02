import { ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Card, shared } from '@/components/UI';
import { colors } from '@/lib/theme';
import type { AIAnswerValidationResult } from '@/types/buklodAiValidation';

type FeedbackProps = {
  isValidating: boolean;
  lastResult: AIAnswerValidationResult | null;
  error: string | null;
};

function statusTone(status: AIAnswerValidationResult['status'] | undefined) {
  switch (status) {
    case 'acceptable':
      return {
        border: colors.green,
        background: '#EEF7F0',
        title: colors.greenDark,
      };
    case 'needs_improvement':
      return {
        border: '#C9A227',
        background: '#FFF9E8',
        title: '#8A6D00',
      };
    default:
      return {
        border: '#C45C4A',
        background: '#FFF3F0',
        title: '#8A2E1F',
      };
  }
}

export function BuklodAnswerValidationFeedback({
  isValidating,
  lastResult,
  error,
}: FeedbackProps) {
  const tone = statusTone(lastResult?.status);
  const showGuidance = lastResult && lastResult.status !== 'acceptable';

  return (
    <View style={styles.wrapper}>
      {isValidating ? (
        <View style={styles.checkingRow}>
          <ActivityIndicator color={colors.green} size="small" />
          <Text style={styles.checkingText}>Checking your answer…</Text>
        </View>
      ) : null}

      {error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorTitle}>Could not check answer</Text>
          <Text style={shared.body}>{error}</Text>
        </Card>
      ) : null}

      {showGuidance && lastResult ? (
        <Card
          style={[
            styles.guidanceCard,
            {
              borderColor: tone.border,
              backgroundColor: tone.background,
            },
          ]}
        >
          <Text style={[styles.guidanceTitle, { color: tone.title }]}>
            {lastResult.feedback.headline}
          </Text>

          {lastResult.feedback.guidance.map((line, index) => (
            <Text key={`${lastResult.attemptId}-${index}`} style={shared.body}>
              • {line}
            </Text>
          ))}

          {lastResult.feedback.encouragement ? (
            <Text style={[shared.muted, styles.encouragement]}>
              {lastResult.feedback.encouragement}
            </Text>
          ) : null}

          <Text style={styles.reviseHint}>
            Revise your answer, then try submitting again. This check does not
            affect your points or rewards.
          </Text>
        </Card>
      ) : null}

      {lastResult?.status === 'acceptable' ? (
        <View style={styles.acceptableBanner}>
          <Text style={styles.acceptableTitle}>✓ Ready to submit</Text>
          <Text style={styles.acceptableText}>
            Your answer meets the quality check. You may submit for faculty
            review.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

type GateProps = FeedbackProps & {
  children: ReactNode;
};

/** Wraps answer fields and shows pre-submission validation feedback (not on keystroke). */
export function BuklodAnswerValidationGate({
  children,
  isValidating,
  lastResult,
  error,
}: GateProps) {
  return (
    <View style={styles.gate}>
      {children}
      <BuklodAnswerValidationFeedback
        isValidating={isValidating}
        lastResult={lastResult}
        error={error}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gate: {
    gap: 10,
  },
  wrapper: {
    gap: 10,
  },
  checkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checkingText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.greenDark,
  },
  guidanceCard: {
    borderWidth: 1,
    gap: 6,
  },
  guidanceTitle: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 2,
  },
  encouragement: {
    marginTop: 4,
  },
  reviseHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
  },
  acceptableBanner: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#EEF7F0',
    borderWidth: 1,
    borderColor: colors.line,
  },
  acceptableTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.greenDark,
  },
  acceptableText: {
    marginTop: 3,
    fontSize: 11,
    color: colors.text,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: '#C45C4A',
  },
  errorTitle: {
    fontWeight: '900',
    color: '#8A2E1F',
    marginBottom: 4,
  },
});
