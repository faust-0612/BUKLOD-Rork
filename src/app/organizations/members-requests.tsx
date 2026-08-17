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

export default function MembersRequestsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const scopeId =
    firstString(params.scopeId) ||
    firstString(params.scope_id) ||
    firstString(params.organizationId) ||
    firstString(params.organization_id) ||
    firstString(params.id);

  const open = (pathname: string) => {
    router.push({
      pathname: pathname as any,
      params: {
        scopeId,
        scope_id: scopeId,
        organizationId: scopeId,
        organization_id: scopeId,
        id: scopeId,
        organization: scopeId,
      },
    } as any);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Members / Join Requests',
        }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}>
        <Pressable
          onPress={() =>
            open('/organizations/members')
          }
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.title}>
            Members
          </Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={() =>
            open('/organizations/join-requests')
          }
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.title}>
            Join Requests
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
    gap: 10,
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