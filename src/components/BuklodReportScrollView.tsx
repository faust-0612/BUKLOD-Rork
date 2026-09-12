import React from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';

import {
  mergeBuklodSafeContentInsets,
  useBuklodPortalContentInsets,
} from '@/lib/buklodSafeArea';
import { reportTheme } from '@/lib/buklodReportTheme';

type Props = ScrollViewProps & {
  contentExtra?: number;
  constrainContent?: boolean;
};

/** Report-only responsive/safe-area shell. Never changes the shared Main portal. */
export default function BuklodReportScrollView({
  contentContainerStyle,
  contentExtra = 16,
  constrainContent = true,
  keyboardShouldPersistTaps = 'handled',
  showsVerticalScrollIndicator = false,
  ...rest
}: Props) {
  const insets = useBuklodPortalContentInsets(contentExtra);

  return (
    <ScrollView
      {...rest}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      contentContainerStyle={mergeBuklodSafeContentInsets(
        [constrainContent ? styles.constrained : null, contentContainerStyle],
        insets,
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
