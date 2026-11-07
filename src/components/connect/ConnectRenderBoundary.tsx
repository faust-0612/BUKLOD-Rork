import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { reportBuklodMainHealthIssue } from '@/lib/buklodMainHealth';

type Surface = 'inbox' | 'personal_thread' | 'community_thread';
type Props = {
  children: React.ReactNode;
  surface: Surface;
  /** Desktop embedded panels close in place; full routes still return to Wall. */
  onFallbackClose?: () => void;
};
type State = { failed: boolean; signature: string };

function renderSignature(error: Error) {
  // Hash only, never persist personal message text or a recipient ID.
  const detail = `${error?.name ?? 'Error'}:${error?.message ?? ''}`;
  let hash = 2166136261;
  for (let i = 0; i < detail.length; i += 1) hash = Math.imul(hash ^ detail.charCodeAt(i), 16777619);
  return `CONNECT_${(hash >>> 0).toString(16).toUpperCase()}`;
}

/** React render recovery only: native-process crashes still require Android logs. */
export default class ConnectRenderBoundary extends React.Component<Props, State> {
  state: State = { failed: false, signature: '' };
  static getDerivedStateFromError(error: Error): State {
    return { failed: true, signature: renderSignature(error) };
  }
  componentDidCatch(error: Error) {
    void reportBuklodMainHealthIssue({
      category: 'ROUTE', severity: 'ERROR', safeErrorCode: 'SYS-500',
      errorSignature: renderSignature(error),
      correlationKey: 'BUKLOD_CONNECT_RENDER_EXCEPTION',
      routeModule: this.props.surface === 'inbox' ? 'messages' :
        this.props.surface === 'personal_thread' ? 'connect/personal' : 'connect/community',
      localSelfHealAttempted: false, localSelfHealResult: 'NOT_ATTEMPTED',
      privacyClassification: 'OPERATIONAL',
    }).catch(() => undefined);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.shell} accessibilityRole="alert">
        <Text style={styles.title}>Hindi mabuksan ang Connect</Text>
        <Text style={styles.message}>May error sa screen. Puwedeng subukan muli o bumalik sa Wall.</Text>
        <Text style={styles.code}>Support code: {this.state.signature}</Text>
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={() => this.setState({ failed: false, signature: '' })}>
          <Text style={styles.buttonText}>Subukan muli</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondary}
          onPress={() => {
            if (this.props.onFallbackClose) {
              this.props.onFallbackClose();
              return;
            }
            router.replace('/(tabs)/buklod' as any);
          }}>
          <Text style={styles.secondaryText}>
            {this.props.onFallbackClose ? 'Close panel' : 'Bumalik sa Wall'}
          </Text>
        </Pressable>
      </View>
    );
  }
}
const styles = StyleSheet.create({
  shell: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F2F8F3', gap: 12 },
  title: { fontSize: 20, fontWeight: '900', color: '#064E35' },
  message: { fontSize: 14, lineHeight: 21, color: '#355348' },
  code: { fontSize: 11, color: '#567367' },
  button: { minHeight: 46, borderRadius: 12, backgroundColor: '#075D40', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#075D40', fontWeight: '800' },
});
