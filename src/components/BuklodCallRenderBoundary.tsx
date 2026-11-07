import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { reportBuklodMainHealthIssue } from '@/lib/buklodMainHealth';

type Props = {
  children: React.ReactNode;
  callActive: boolean;
  onLeave: () => Promise<void>;
};
type State = { failed: boolean; signature: string };

function safeSignature(error: Error): string {
  // Stable anonymous diagnostic only: never send call IDs, peer names or
  // SDK error text to the incident ledger.
  const message = `${error?.name ?? 'Error'}:${error?.message ?? ''}`;
  let hash = 2166136261;
  for (let index = 0; index < message.length; index++) {
    hash = Math.imul(hash ^ message.charCodeAt(index), 16777619);
  }
  return `CALL_${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

/**
 * Confine Stream ringing/unmount exceptions to its independent global call
 * surface. A teardown error must NEVER replace Home/Connect/Wall with SYS-500.
 * This boundary is remounted only on call identity transition, so a broken
 * call cannot spin in an unlimited retry loop.
 */
export default class BuklodCallRenderBoundary extends React.Component<Props, State> {
  state: State = { failed: false, signature: '' };

  static getDerivedStateFromError(error: Error): State {
    return { failed: true, signature: safeSignature(error) };
  }

  componentDidCatch(error: Error) {
    void reportBuklodMainHealthIssue({
      category: 'ROUTE',
      severity: 'ERROR',
      safeErrorCode: 'CALL-RENDER-500',
      errorSignature: safeSignature(error),
      correlationKey: 'BUKLOD_CALL_SURFACE_EXCEPTION',
      routeModule: 'connect/call-surface',
      localSelfHealAttempted: true,
      localSelfHealResult: 'AWAITING_USER',
      privacyClassification: 'OPERATIONAL',
    }).catch(() => undefined);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (!this.props.callActive) return null;

    return (
      <View style={styles.fallback} accessibilityRole="alert">
        <Text style={styles.title}>Call screen unavailable</Text>
        <Text style={styles.message}>
          The call interface was interrupted. Your BUKLOD messages and other screens remain available.
        </Text>
        <Text style={styles.code}>Support code: {this.state.signature}</Text>
        <Pressable accessibilityRole="button" style={styles.retry}
          onPress={() => this.setState({ failed: false, signature: '' })}>
          <Text style={styles.retryText}>RETRY CALL SCREEN</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.leave}
          onPress={() => {
            void this.props.onLeave().catch(() => undefined);
          }}>
          <Text style={styles.leaveText}>LEAVE CALL</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fallback: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10000, elevation: 10000,
    backgroundColor: '#092018', alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 26, gap: 14,
  },
  title: { fontSize: 21, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  message: { fontSize: 13, lineHeight: 19, color: '#DBEAE1', textAlign: 'center' },
  code: { fontSize: 10, color: '#BACFC1' },
  retry: {
    backgroundColor: '#1C784E', minHeight: 48, paddingHorizontal: 20,
    borderRadius: 13, justifyContent: 'center', alignItems: 'center',
  },
  retryText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  leave: {
    minHeight: 44, paddingHorizontal: 20, borderRadius: 13,
    borderWidth: 1, borderColor: '#E9F3EA',
    justifyContent: 'center', alignItems: 'center',
  },
  leaveText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
});
