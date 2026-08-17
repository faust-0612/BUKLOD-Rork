import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

function firstString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (
    Array.isArray(value) &&
    typeof value[0] === 'string'
  ) {
    return value[0].trim();
  }

  return '';
}

export default function EventsAttendanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const scopeId =
    firstString(params.scopeId) ||
    firstString(params.scope_id) ||
    firstString(params.organizationId) ||
    firstString(params.organization_id) ||
    firstString(params.id);

  const openAttendance = () => {
    router.push({
      pathname: '/scope/attendance' as any,
      params: {
        scopeId,
        scope_id: scopeId,
        organizationId: scopeId,
        organization_id: scopeId,
        id: scopeId,
      },
    } as any);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Events & Attendance',
        }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}>
        <Pressable
          onPress={openAttendance}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.title}>
            Open Events & Attendance
          </Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 42,
    backgroundColor: '#F4F7F5',
  },
  card: {
    minHeight: 66,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    color: '#173B2F',
    fontSize: 13,
    fontWeight: '900',
  },
  chevron: {
    color: '#176B4A',
    fontSize: 25,
  },
  pressed: {
    opacity: 0.7,
  },
});