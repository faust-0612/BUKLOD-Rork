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

function isDevotionReflectionPath(pathname: string): boolean {
  const normalized = normalizeBuklodPathname(pathname);

  return (
    normalized === '/reflection' ||
    normalized.startsWith('/reflection/')
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
 * Root keyboard avoidance — disabled on Messages inbox, Connect threads,
 * and the Devotion reflection screen. Reflection keeps its bottom ad in
 * place so the keyboard only covers it.
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
      !isConnectThreadPath(pathname) &&
      !isDevotionReflectionPath(pathname),
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
