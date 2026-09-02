import React, { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { usePathname } from 'expo-router';

import {
  normalizeBuklodPathname,
} from '@/lib/buklodSafeArea';

function isMessagesInboxPath(pathname: string): boolean {
  const normalized = normalizeBuklodPathname(pathname);

  return (
    normalized === '/messages' ||
    normalized.startsWith('/messages/')
  );
}

function isConnectThreadPath(pathname: string): boolean {
  const normalized = normalizeBuklodPathname(pathname);

  return (
    normalized === '/connect/personal' ||
    normalized.startsWith('/connect/personal/') ||
    normalized === '/connect/community' ||
    normalized.startsWith('/connect/community/')
  );
}

/**
 * Root keyboard avoidance — disabled on Messages inbox and Connect threads.
 * Those screens position the composer with useConnectComposerKeyboardInset.
 */
export default function BuklodRootKeyboardAvoidingView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const pathname = usePathname();

  const enabled = useMemo(
    () =>
      !isMessagesInboxPath(pathname) &&
      !isConnectThreadPath(pathname),
    [pathname]
  );

  return (
    <KeyboardAvoidingView
      style={style}
      enabled={enabled}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
