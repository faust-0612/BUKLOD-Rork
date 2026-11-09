import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BuklodMentionText } from '@/components/BuklodMentionText';

type Props = React.ComponentProps<typeof BuklodMentionText> & {
  /** Media captions stay on one line; short text-only posts use larger type. */
  hasMedia?: boolean;
};

const LARGE_TEXT_LIMIT = 80;
const MORE_HINT_MIN_CHARS = 32;

/**
 * One compact caption row, with an inline expansion control.
 * Only short text-only posts get enlarged typography. Mentions continue to
 * use the canonical BUKLOD mention renderer rather than a duplicated parser.
 */
export function BuklodExpandableWallCaption({
  hasMedia = false,
  ...mentionProps
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const fullText = String(mentionProps.text ?? '');
  const charCount = Array.from(fullText.trim()).length;
  const largeText = !hasMedia && charCount > 0 && charCount <= LARGE_TEXT_LIMIT;
  const canExpand =
    !largeText &&
    (charCount > MORE_HINT_MIN_CHARS || /[\r\n]/.test(fullText));

  useEffect(() => {
    setExpanded(false);
  }, [fullText, hasMedia]);

  if (!fullText.trim()) return null;

  if (largeText) {
    return (
      <BuklodMentionText
        {...mentionProps}
        text={fullText}
        numberOfLines={undefined}
        style={[mentionProps.style, styles.largeText]}
      />
    );
  }

  if (expanded) {
    return (
      <View>
        <BuklodMentionText
          {...mentionProps}
          text={fullText}
          numberOfLines={undefined}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See less"
          hitSlop={8}
          onPress={() => setExpanded(false)}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>See less</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.collapsedRow}>
      <View style={styles.preview}>
        <BuklodMentionText
          {...mentionProps}
          text={fullText.replace(/\s*[\r\n]+\s*/g, ' ').trim()}
          numberOfLines={1}
        />
      </View>
      {canExpand ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See more"
          hitSlop={8}
          onPress={() => setExpanded(true)}
          style={styles.inlineToggle}
        >
          <Text style={styles.toggleText}>See more</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
  },
  preview: {
    flex: 1,
    minWidth: 0,
  },
  inlineToggle: {
    minHeight: 32,
    justifyContent: 'center',
    paddingLeft: 6,
    flexShrink: 0,
  },
  toggle: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
    paddingRight: 8,
  },
  toggleText: {
    color: '#2867A5',
    fontWeight: '700',
    fontSize: 14,
  },
  largeText: {
    fontSize: 25,
    lineHeight: 33,
    fontWeight: '800',
    paddingVertical: 9,
  },
});
