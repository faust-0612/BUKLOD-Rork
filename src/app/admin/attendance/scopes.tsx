import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AdminGate } from '@/components/AdminGate';
import { Card, shared } from '@/components/UI';
import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
import {
  fetchAttendanceScopeAdoption,
  type AttendanceScopeAdoptionRow,
} from '@/lib/admin/buklodAttendanceAdmin';
import { adminAttendanceScopeAdoptionCacheKey } from '@/lib/buklodOfflineSync';
import { colors } from '@/lib/theme';

function formatScopeType(value: string) {
  return value.replaceAll('_', ' ').toLowerCase();
}

export default function AdminAttendanceScopesScreen() {
  const {
    data: rows,
    loading,
    refreshing,
    refresh,
    error,
  } = useBuklodOfflineCache<AttendanceScopeAdoptionRow[]>({
    cacheKey: adminAttendanceScopeAdoptionCacheKey(),
    fetcher: () => fetchAttendanceScopeAdoption(100, 0),
  });

  const list = rows ?? [];

  return (
    <AdminGate>
      <View style={shared.screen}>
        <FlatList
          data={list}
          keyExtractor={(item) => item.scope_id}
          contentContainerStyle={styles.content}
          refreshing={refreshing}
          onRefresh={() => {
            void refresh();
          }}
          ListHeaderComponent={
            <>
              <Pressable onPress={() => router.back()} style={styles.back}>
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={22}
                  color={colors.greenDark}
                />
              </Pressable>

              <Text style={styles.eyebrow}>SYSTEM ADMIN</Text>
              <Text style={shared.h1}>Scope Adoption</Text>
              <Text style={shared.muted}>
                Organizations and clusters with BUKLOD Attendance events.
              </Text>
            </>
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.greenDark} />
            ) : (
              <Card>
                <Text style={shared.muted}>
                  {error
                    ? error
                    : 'No scopes have created attendance events yet.'}
                </Text>
              </Card>
            )
          }
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.scopeName}>{item.scope_name}</Text>
              <Text style={styles.scopeMeta}>
                {formatScopeType(item.scope_type)}
              </Text>
              <View style={styles.statsRow}>
                <Text style={styles.stat}>
                  {item.event_count} event{item.event_count === 1 ? '' : 's'}
                </Text>
                <Text style={styles.stat}>
                  {item.active_event_count} open
                </Text>
                <Text style={styles.stat}>
                  {item.record_count_30d} check-ins (30d)
                </Text>
              </View>
              <Text style={styles.scopeMeta}>
                {item.operator_count} operator
                {item.operator_count === 1 ? '' : 's'}
                {item.last_event_at
                  ? ` · Last event ${new Date(item.last_event_at).toLocaleDateString()}`
                  : ''}
              </Text>
            </Card>
          )}
        />
      </View>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 50,
    gap: 8,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
    marginBottom: 4,
  },
  scopeName: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  scopeMeta: {
    marginTop: 4,
    fontSize: 11,
    color: colors.muted,
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  stat: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.greenDark,
  },
});
