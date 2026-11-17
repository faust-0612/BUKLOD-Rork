import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const QR_FORMAT = /^BUKLOD:EVENT:V2:[0-9a-f-]{36}:[0-9a-f-]{36}$/i;

export default function AttendanceScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const locked = useRef(false);
  const scan = useCallback(async (payload: string) => {
    const value = payload.trim();
    if (locked.current) return;
    if (!QR_FORMAT.test(value)) {
      setError('This is not a BUKLOD Event QR. Ask the organizer for the Event QR.');
      return;
    }
    locked.current = true;
    setBusy(true);
    setError('');
    setResult('');
    try {
      const { data, error: rpcError } = await supabase.rpc('buklod_scan_event_qr_v2', { p_payload: value });
      if (rpcError) throw rpcError;
      const response = data as { status?: string } | null;
      setResult(response?.status === 'already_recorded'
        ? 'Attendance already recorded. No additional points will be generated.'
        : 'Attendance recorded. Any BP will require independent event verification.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to verify this QR. Check your connection.');
      // No local award or fabricated offline attendance; retry is safe/idempotent.
      locked.current = false;
    } finally {
      setBusy(false);
    }
  }, []);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Scan Event Attendance QR' }} />
      <Text style={styles.title}>Scan Event QR</Text>
      <Text style={styles.hint}>Scan the rotating QR displayed by the organizer. Your BUKLOD account is registered automatically.</Text>
      {!result && (
        permission?.granted ? (
          <View style={styles.cameraFrame}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={busy || locked.current ? undefined : event => void scan(event.data)}
            />
          </View>
        ) : (
          <Pressable style={styles.button} onPress={() => void requestPermission()}>
            <Text style={styles.buttonText}>ALLOW CAMERA TO SCAN QR</Text>
          </Pressable>
        )
      )}
      {busy && <ActivityIndicator color={colors.greenDark} />}
      {!!result && <View style={styles.success}><Text style={styles.successText}>{result}</Text></View>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Text style={styles.label}>Alternative: Paste Event QR code</Text>
      <TextInput style={styles.input} value={manual} onChangeText={setManual}
        autoCapitalize="none" autoCorrect={false} placeholder="BUKLOD:EVENT:V2:..." />
      <Pressable disabled={busy || !!result} style={[styles.button,(busy || !!result) && styles.disabled]}
        onPress={() => void scan(manual)}>
        <Text style={styles.buttonText}>VERIFY & CHECK IN</Text>
      </Pressable>
      {result ? (
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>DONE</Text>
        </Pressable>
      ) : null}
      <Text style={styles.hint}>No BP is issued on scan alone. Guest attendance does not grant membership in the host organization.</Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background, padding: 14, gap: 10 },
  title: { fontSize: 23, fontWeight: '900', color: colors.text },
  hint: { fontSize: 12, lineHeight: 18, color: colors.muted },
  cameraFrame: { height: 310, overflow: 'hidden', borderRadius: 16, backgroundColor: '#000' },
  camera: { flex: 1 },
  button: { borderRadius: 12, backgroundColor: colors.greenDark, padding: 14, alignItems: 'center' },
  buttonText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  disabled: { opacity: 0.5 },
  label: { marginTop: 12, fontSize: 12, fontWeight: '800', color: colors.text },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff',
    borderRadius: 10, padding: 12, fontSize: 12, color: colors.text },
  success: { padding: 16, borderRadius: 12, backgroundColor: '#E5F5E9' },
  successText: { color: '#125431', fontSize: 14, fontWeight: '800' },
  error: { padding: 10, color: '#9B2C26', backgroundColor: '#FFF0ED', borderRadius: 9, fontSize: 12 },
});