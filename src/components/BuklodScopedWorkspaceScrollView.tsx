import React from 'react';

import {
  ScrollView,
  type ScrollViewProps,
} from 'react-native';

import {
  mergeBuklodSafeContentInsets,
  useBuklodScopedWorkspaceContentInsets,
} from '@/lib/buklodSafeArea';

type Props = ScrollViewProps & {
  contentExtra?: number;
  /** Set false when a parent header already applied top safe-area inset. */
  includeTopInset?: boolean;
};

/**
 * Scroll container for Manage / Attendance / other `/scope/*` child screens.
 * Applies real safe-area insets without reserving global bottom nav height.
 */
export default function BuklodScopedWorkspaceScrollView({
  contentContainerStyle,
  contentExtra = 16,
  includeTopInset = true,
  ...rest
}: Props) {
  const workspaceInsets =
    useBuklodScopedWorkspaceContentInsets(
      contentExtra,
      { includeTopInset },
    );

  return (
    <ScrollView
      {...rest}
      contentContainerStyle={mergeBuklodSafeContentInsets(
        contentContainerStyle,
        workspaceInsets,
      )}
    />
  );
}
