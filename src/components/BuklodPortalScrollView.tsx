import React from 'react';

import {
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
} from 'react-native';

import {
  mergeBuklodSafeContentInsets,
  useBuklodPortalContentInsets,
} from '@/lib/buklodSafeArea';
import { reportTheme } from '@/lib/theme';

type Props = ScrollViewProps & {
  contentExtra?: number;
  /** Set false only for intentionally edge-to-edge portal content. */
  constrainContent?: boolean;
};

/**
 * Shared scroll container for the standalone Report/portal experience.
 * It keeps mobile safe-area behavior while preventing web/tablet screens from
 * stretching into an unreadable full-width canvas.
 */
export default function BuklodPortalScrollView({
  contentContainerStyle,
  contentExtra = 16,
  constrainContent = true,
  keyboardShouldPersistTaps = 'handled',
  showsVerticalScrollIndicator = false,
  ...rest
}: Props) {
  const portalInsets = useBuklodPortalContentInsets(contentExtra);

  return (
    <ScrollView
      {...rest}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      contentContainerStyle={mergeBuklodSafeContentInsets(
        [
          constrainContent ? styles.constrained : null,
          contentContainerStyle,
        ],
        portalInsets,
      )}
    />
  );
}

const styles = StyleSheet.create({
  constrained: {
    width: '100%',
    maxWidth: reportTheme.layout.maxContentWidth,
    alignSelf: 'center',
  },
});
