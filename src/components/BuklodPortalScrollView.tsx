import React from 'react';

import {
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  mergeBuklodSafeContentInsets,
  useBuklodPortalContentInsets,
} from '@/lib/buklodSafeArea';

type Props = ScrollViewProps & {
  contentExtra?: number;
  scrollRef?: React.Ref<ScrollView>;
};

/**
 * Scroll container for Organization/Cluster portal and door screens.
 * Applies real top/bottom safe-area insets with global nav reservation.
 */
export default function BuklodPortalScrollView({
  contentContainerStyle,
  contentExtra = 16,
  scrollRef,
  ...rest
}: Props) {
  const portalInsets =
    useBuklodPortalContentInsets(
      contentExtra,
    );

  return (
    <ScrollView
      {...rest}
      ref={scrollRef}
      contentContainerStyle={mergeBuklodSafeContentInsets(
        contentContainerStyle,
        portalInsets,
      )}
    />
  );
}
