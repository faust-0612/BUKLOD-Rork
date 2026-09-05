import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import FacultySubscriptionCard from '@/components/faculty/FacultySubscriptionCard';
import { useFacultyEntitlement } from '@/hooks/useFacultyEntitlement';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { useAuth } from '@/providers/AuthProvider';

export function FacultyGate({ children }: { children: ReactNode }) {
  const { theme } = useBuklodPresentation();
  const { hasRole } = useAuth();
  const {
    has_faculty_entitlement: active,
    loading,
    error,
  } = useFacultyEntitlement();

  if (loading) {
    return (
      <View style={[styles.gateLoading, { backgroundColor: theme.canvas }]}>
        <ActivityIndicator color={theme.accent} />
        <Text style={[styles.gateHint, { color: theme.textMuted }]}>Checking BUKLOD Faculty access…</Text>
      </View>
    );
  }

  if (active || hasRole('system_admin')) {
    return <>{children}</>;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.canvas }}
      contentContainerStyle={styles.gateContent}
    >
      <View style={styles.gateHeader}>
        <View style={[styles.gateIcon, { backgroundColor: theme.accentSoft }]}>
          <MaterialCommunityIcons name="human-male-board" size={28} color={theme.accent} />
        </View>
        <Text style={[styles.gateEyebrow, { color: theme.accent }]}>FACULTY WORKSPACE</Text>
        <Text style={[styles.gateTitle, { color: theme.textPrimary }]}>BUKLOD Faculty</Text>
        <Text style={[styles.gateHint, { color: theme.textMuted }]}> 
          Faculty controls require one active individual BUKLOD Faculty entitlement. It already includes Classroom faculty, Attendance faculty, and Quiz examiner access.
        </Text>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <FacultySubscriptionCard />

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={18} color={theme.textMuted} />
        <Text style={[styles.backLabel, { color: theme.textMuted }]}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

export function FacultyClassHeader({
  classroomName,
  eyebrow,
  title,
  subtitle,
}: {
  classroomName: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}) {
  const { theme } = useBuklodPresentation();

  return (
    <View style={{ marginBottom: title ? 16 : 8 }}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="arrow-left" size={22} color={theme.textPrimary} />
        <Text style={[styles.backText, { color: theme.textPrimary }]} numberOfLines={1}>
          {classroomName || 'BUKLOD Faculty'}
        </Text>
      </Pressable>
      {!!eyebrow && (
        <Text style={[styles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text>
      )}
      {!!title && (
        <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
      )}
      {!!subtitle && (
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gateLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  gateContent: { padding: 20, paddingTop: 48, paddingBottom: 50, gap: 15 },
  gateHeader: { gap: 5 },
  gateIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  gateEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  gateTitle: { fontSize: 28, fontWeight: '900' },
  gateHint: { lineHeight: 19, fontSize: 12 },
  errorText: { fontSize: 11, marginTop: 4, color: '#A53939' },
  backButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  backLabel: { fontWeight: '800' },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    marginBottom: 12,
  },
  backText: { fontWeight: '800', flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 27, fontWeight: '900', marginTop: 2 },
  subtitle: { marginTop: 5, lineHeight: 19 },
  pressed: { opacity: 0.85 },
});
