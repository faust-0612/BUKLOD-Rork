import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';

/**
 * BUKLOD Faculty is a free faculty-side workspace.
 * Classroom-specific authority remains enforced by backend assignment/permission RPCs.
 * There is intentionally no subscription/paywall gate here.
 */
export function FacultyGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
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
