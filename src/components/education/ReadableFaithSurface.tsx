import type { ReactNode } from 'react';
import { Text, type ViewStyle } from 'react-native';

import { Card } from '@/components/UI';
import { colors } from '@/lib/theme';

/**
 * Contrast-safe compatibility surface for Faith/Lessons screens.
 *
 * These legacy screens still render static light-palette text styles
 * (shared.h2/shared.body/colors.text) rather than semantic theme roles.
 * The shared Card changes its surface with the system theme, making those
 * text styles nearly invisible on Night Pine / Graphite. Keep this
 * educational content on a light, readable surface until each descendant
 * has been migrated to fully semantic colors. Do not change global Cards:
 * themed Wall/Connect/ads/navigation rely on their existing appearance.
 */
const readableCard: ViewStyle = {
  backgroundColor: colors.white,
  borderColor: colors.line,
};

export function ReadableFaithCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <Card style={style ? [readableCard, style] : readableCard}>
      {children}
    </Card>
  );
}

/** The global SectionTitle follows dark textMuted even on these light pages. */
export function ReadableFaithSectionTitle({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        marginTop: 4,
        marginBottom: 2,
        color: colors.muted,
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '900',
        letterSpacing: 0.35,
      }}
    >
      {children}
    </Text>
  );
}
