import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { reportBuklodMainHealthIssue } from '@/lib/buklodMainHealth';
import { klEditorRenderSignature, klEditorCrashComponent } from '@/lib/kabihasnang-ligaw/editorCrashDiagnostics';

/** A failed KL widget must not replace the entire BUKLOD navigator. */
export default class KlEditorRenderBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean; signature: string }
> {
  state = { failed: false, signature: '' };

  static getDerivedStateFromError(error: Error) {
    return { failed: true, signature: klEditorRenderSignature(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    void reportBuklodMainHealthIssue({
      category: 'ROUTE',
      severity: 'ERROR',
      safeErrorCode: 'SYS-500',
      errorSignature: klEditorRenderSignature(error),
      correlationKey: 'BUKLOD_KL_EDITOR_RENDER_EXCEPTION',
      routeModule: 'admin/kabihasnang-ligaw',
      knownIncidentHint: klEditorCrashComponent(info.componentStack ?? undefined),
      localSelfHealAttempted: false,
      localSelfHealResult: 'NOT_ATTEMPTED',
      privacyClassification: 'OPERATIONAL',
    }).catch(() => undefined);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.container} accessibilityRole="alert">
        <Text style={styles.heading}>KL Editor encountered an error</Text>
        <Text style={styles.body}>
          Hindi naapektuhan ang mga na-save sa server. Kapag bumalik ang editor,
          buksan ang chapter at gamitin ang Restore local edits kung may hindi pa na-save.
        </Text>
        <Text style={styles.code}>Support code: {this.state.signature}</Text>
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={() => this.setState({ failed: false, signature: '' })}>
          <Text style={styles.buttonText}>Reopen KL Editor</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondary}
          onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { padding: 18, gap: 12, backgroundColor: '#182537', borderRadius: 12 },
  heading: { color: '#ffe0a8', fontSize: 19, fontWeight: '700' },
  body: { color: '#fff', lineHeight: 22 },
  code: { color: '#c4d1d9' },
  button: { padding: 14, backgroundColor: '#276c4f', borderRadius: 8, alignSelf: 'flex-start' },
  secondary: { padding: 14, backgroundColor: '#44535e', borderRadius: 8, alignSelf: 'flex-start' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
