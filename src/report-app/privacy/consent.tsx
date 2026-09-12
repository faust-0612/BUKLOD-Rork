import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/lib/theme';
import { useCompliance } from '@/providers/ComplianceProvider';

export default function BuklodReportConsentScreen() {
  const insets = useSafeAreaInsets();
  const { acceptAll } = useCompliance();
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await acceptAll();
      if (result.error) {
        Alert.alert('BUKLOD Report', result.error);
        return;
      }
      router.replace('/');
    } catch (error: any) {
      Alert.alert('BUKLOD Report', error?.message ?? 'Could not save your acknowledgement. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, {
        paddingTop: Math.max(insets.top, 22),
        paddingBottom: Math.max(insets.bottom, 20) + 24,
      }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandIcon}>
        <MaterialCommunityIcons name="file-document-check-outline" size={30} color="#FFFFFF" />
      </View>
      <Text style={styles.eyebrow}>BUKLOD REPORT</Text>
      <Text style={styles.title}>Before you continue</Text>
      <Text style={styles.lead}>
        BUKLOD Report uses your existing BUKLOD account and your active Organization or Cluster memberships so the correct reports can be assigned, submitted and reviewed.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Standalone reporting workspace</Text>
        <Text style={styles.body}>
          This app does not switch your BUKLOD Main active workspace. Report access is resolved from your canonical account and Organization/Cluster memberships for each reporting action.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Report records and uploaded files</Text>
        <Text style={styles.body}>
          Submitted report data, reporting deadlines, review history and authorized uploaded reporting files are handled through the existing BUKLOD reporting backend and its access controls.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account approval remains required</Text>
        <Text style={styles.body}>
          This standalone app does not bypass BUKLOD account verification, inactive-account controls, or exact Organization/Cluster administration permissions.
        </Text>
      </View>

      <Pressable disabled={busy} onPress={() => void accept()} style={[styles.button, busy && styles.disabled]}>
        {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="check-circle-outline" size={19} color="#FFFFFF" />}
        <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Acknowledge & continue'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, gap: 12 },
  brandIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.greenDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 27, fontWeight: '900' },
  lead: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  card: { borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', padding: 14, gap: 6 },
  cardTitle: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  body: { color: colors.text, fontSize: 11, lineHeight: 17 },
  button: { minHeight: 49, marginTop: 4, borderRadius: 12, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
