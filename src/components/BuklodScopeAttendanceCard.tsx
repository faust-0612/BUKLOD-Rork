import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

type ActiveEvent = {
  id: string;
  title: string;
  starts_at: string;
};

export default function BuklodScopeAttendanceCard() {
  const { activeScope } = useBuklodScope();
  const [events, setEvents] = useState<ActiveEvent[]>([]);

  const load = useCallback(async () => {
    if (!activeScope?.scope_id) {
      setEvents([]);
      return;
    }

    const { data, error } = await supabase
      .from('attendance_events')
      .select('id,title,starts_at')
      .eq('scope_id', activeScope.scope_id)
      .eq('is_active', true)
      .order('starts_at', { ascending: true })
      .limit(3);

    if (error) {
      console.warn('Scope attendance card:', error.message);
      setEvents([]);
      return;
    }

    setEvents((data ?? []) as ActiveEvent[]);
  }, [activeScope?.scope_id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (
    !activeScope ||
    !['ORGANIZATION', 'CLUSTER'].includes(activeScope.scope_type)
  ) {
    return null;
  }

  const scopeKind =
    activeScope.scope_type === 'CLUSTER'
      ? 'Cluster'
      : activeScope.parent_scope_id
        ? 'Sub-organization'
        : 'Organization';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${scopeKind} Attendance`}
      onPress={() =>
        router.push('/scope/attendance' as any)
      }
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.icon}>
        <MaterialCommunityIcons
          name="clipboard-check-outline"
          size={24}
          color={colors.greenDark}
        />
      </View>

      <View style={styles.body}>
        <Text style={styles.kicker}>
          {scopeKind.toUpperCase()} ATTENDANCE
        </Text>
        <Text style={styles.title}>
          Events & Attendance
        </Text>
        <Text style={styles.subtitle}>
          {events.length > 0
            ? `${events.length} open event${events.length === 1 ? '' : 's'} • ${events[0].title}`
            : 'Create, open and review attendance for this exact scope.'}
        </Text>
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={24}
        color={colors.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    marginBottom: 4,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  body: {
    flex: 1,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.greenDark,
    letterSpacing: 0.6,
  },
  title: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
});
