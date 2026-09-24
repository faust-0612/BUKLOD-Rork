import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type {
  BuklodFeedbackTone,
  BuklodUserFeedback,
} from '@/lib/buklodUserFeedback';

const TONES: Record<
  BuklodFeedbackTone,
  {
    background: string;
    border: string;
    text: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }
> = {
  success: {
    background: '#EAF6EE',
    border: '#BDDCC8',
    text: '#1F6442',
    icon: 'check-circle-outline',
  },
  info: {
    background: '#EEF5F8',
    border: '#C7DCE5',
    text: '#315C6C',
    icon: 'information-outline',
  },
  warning: {
    background: '#FFF7E6',
    border: '#E9D29B',
    text: '#7A5A12',
    icon: 'alert-outline',
  },
  error: {
    background: '#FFF0EE',
    border: '#EBC4BF',
    text: '#8A3B34',
    icon: 'alert-circle-outline',
  },
};

export function BuklodFeedbackBanner({
  feedback,
  onRetry,
  onNeedHelp,
  onDismiss,
  compact = false,
}: {
  feedback: BuklodUserFeedback;
  onRetry?: (() => void) | null;
  onNeedHelp?: (() => void) | null;
  onDismiss?: (() => void) | null;
  compact?: boolean;
}) {
  const tone = TONES[feedback.tone];

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.container,
        compact && styles.compact,
        {
          backgroundColor: tone.background,
          borderColor: tone.border,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={tone.icon}
        size={20}
        color={tone.text}
      />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: tone.text }]}>
          {feedback.title}
        </Text>
        <Text style={[styles.message, { color: tone.text }]}>
          {feedback.message}
        </Text>
        {!!feedback.nextStep && (
          <Text style={[styles.nextStep, { color: tone.text }]}>
            Next: {feedback.nextStep}
          </Text>
        )}
        {!!feedback.supportCode && feedback.tone !== 'success' && (
          <Text style={[styles.code, { color: tone.text }]}>
            Support code: {feedback.supportCode}
          </Text>
        )}
        {(onRetry || onNeedHelp) && (
          <View style={styles.actions}>
            {!!onRetry && feedback.retryable && (
              <Pressable
                accessibilityRole="button"
                onPress={onRetry}
                style={styles.action}
              >
                <Text style={[styles.actionText, { color: tone.text }]}>
                  TRY AGAIN
                </Text>
              </Pressable>
            )}
            {!!onNeedHelp && feedback.needsSupport && (
              <Pressable
                accessibilityRole="button"
                onPress={onNeedHelp}
                style={styles.action}
              >
                <Text style={[styles.actionText, { color: tone.text }]}>
                  NEED HELP?
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
      {!!onDismiss && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          onPress={onDismiss}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="close"
            size={18}
            color={tone.text}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  compact: {
    paddingVertical: 9,
    borderRadius: 10,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
  },
  message: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  nextStep: {
    marginTop: 5,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '800',
  },
  code: {
    marginTop: 5,
    fontSize: 10.5,
    fontWeight: '900',
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  action: {
    paddingVertical: 5,
    paddingHorizontal: 3,
  },
  actionText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
