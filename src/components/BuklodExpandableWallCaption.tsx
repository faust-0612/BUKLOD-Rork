import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BuklodMentionText } from '@/components/BuklodMentionText';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { readableAccentOnSurface } from '@/lib/buklodTheme';

import { WallPostDesignSurface, WallRankBonusFrame, wallFontTextStyle } from '@/components/BuklodWallPostDesignPicker';
import { rankBonusFrameForViewer } from '@/lib/buklodRankBonusFrames';
import { visibleWallPostDesign, wallFontForViewer } from '@/lib/buklodWallPostDesigns';

type Props = React.ComponentProps<typeof BuklodMentionText> & {
  /** Media captions stay on one line; short text-only posts use larger type. */
  hasMedia?: boolean;
  /** Stored author-selected design; no viewer rank gate. */
  designId?: string | null;
  animationActive?: boolean;
  fontId?: string | null;
  bonusKey?: string | null;
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
  designId = null,
  animationActive = false,
  fontId = 'standard',
  bonusKey = null,
  ...mentionProps
}: Props) {
  const { theme } = useBuklodTheme();
  const accentTextColor = readableAccentOnSurface(theme);
  const [expanded, setExpanded] = useState(false);
  // Feed surface and accent must resolve from the same active theme.
  const mentionStyle = mentionProps.mentionStyle ?? { color: accentTextColor, fontWeight: '800' as const };
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

  if (!hasMedia) {
    const design = visibleWallPostDesign(designId, false);
    const limit = 240;
    const codepoints = Array.from(fullText);
    const truncated = !expanded && codepoints.length > limit;
    const visibleText = truncated ? codepoints.slice(0, limit).join('').trimEnd() + '…' : fullText;
    const size = largeText ? 25 : charCount <= 180 ? 21 : 17;
    const content = (
      <>
        <BuklodMentionText
          {...mentionProps}
          mentionStyle={design ? { color: design.ink, fontWeight: '800' } : mentionStyle}
          preserveMentionColor={!!design}
          text={visibleText}
          numberOfLines={undefined}
          style={[mentionProps.style, largeText && styles.largeText, { fontSize: size, lineHeight: Math.round(size * 1.32), textAlign: charCount <= 180 ? 'center' : 'left' }, wallFontTextStyle(wallFontForViewer(fontId)), design && { color: design.ink }]}
        />
        {codepoints.length > limit && <Pressable accessibilityRole="button"
          accessibilityLabel={expanded ? 'See less' : 'See more'}
          onPress={() => setExpanded(v => !v)} style={styles.toggle}>
          <Text style={[styles.toggleText,{color:design?.ink ?? accentTextColor}]}>{expanded ? 'See less' : 'See more'}</Text>
        </Pressable>}
      </>
    );
    const surface=design
      ? <WallPostDesignSurface design={design} active={animationActive}>{content}</WallPostDesignSurface>
      : <View style={styles.textOnlySurface}>{content}</View>;
    const frame=rankBonusFrameForViewer(bonusKey);
    return frame?<WallRankBonusFrame frame={frame}>{surface}</WallRankBonusFrame>:surface;
  }

  if (expanded) {
    return (
      <View>
        <BuklodMentionText
          {...mentionProps}
          mentionStyle={mentionStyle}
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
          <Text style={[styles.toggleText, { color: accentTextColor }]}>See less</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.collapsedRow}>
      <View style={styles.preview}>
        <BuklodMentionText
          {...mentionProps}
          mentionStyle={mentionStyle}
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
          <Text style={[styles.toggleText, { color: accentTextColor }]}>See more</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  textOnlySurface: { minHeight: 132, paddingHorizontal: 10, paddingVertical: 16, justifyContent: 'center' },
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
