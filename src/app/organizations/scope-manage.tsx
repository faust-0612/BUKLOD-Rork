import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { supabase } from '../../lib/supabase';

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

export default function ExactOrganizationManageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const scopeId =
    firstString(params.scopeId) ||
    firstString(params.scope_id) ||
    firstString(params.organizationId) ||
    firstString(params.organization_id) ||
    firstString(params.id);

  const routeName =
    firstString(params.organizationName);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [scopeName, setScopeName] =
    useState(routeName || 'Organization');

  const verify = useCallback(async () => {
    if (!scopeId) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    try {
      const [
        manageableResult,
        scopeResult,
      ] = await Promise.all([
        (supabase as any).rpc(
          'buklod_my_manageable_organizations_v2',
        ),
        (supabase as any)
          .from('buklod_scopes')
          .select('*')
          .eq('id', scopeId)
          .maybeSingle(),
      ]);

      if (manageableResult.error) {
        throw manageableResult.error;
      }

      const canManage = (
        manageableResult.data || []
      ).some((row: any) =>
        String(
          row.scope_id || row.id || '',
        ).trim() === scopeId,
      );

      setAllowed(canManage);

      if (scopeResult.data?.name) {
        setScopeName(scopeResult.data.name);
      }
    } catch (error: any) {
      setAllowed(false);
      Alert.alert(
        'Manage Organization',
        error?.message ||
          'Could not verify admin access.',
      );
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void verify();
  }, [verify]);

  const open = (
    pathname: string,
    extra: Record<string, string> = {},
  ) => {
    router.push({
      pathname: pathname as any,
      params: {
        scopeId,
        scope_id: scopeId,
        organizationId: scopeId,
        organization_id: scopeId,
        id: scopeId,
        organizationName: scopeName,
        ...extra,
      },
    } as any);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{ title: 'Manage Organization' }}
        />
        <View style={styles.center}>
          <Text style={styles.muted}>
            Checking admin access...
          </Text>
        </View>
      </>
    );
  }

  if (!allowed) {
    return (
      <>
        <Stack.Screen
          options={{ title: 'Manage Organization' }}
        />
        <View style={styles.center}>
          <Text style={styles.deniedTitle}>
            ADMIN ACCESS REQUIRED
          </Text>
          <Text style={styles.muted}>
            Management controls are visible only to an
            authorized admin of this exact Organization
            or Sub-organization.
          </Text>
        </View>
      </>
    );
  }

  const buttons = [
    {
      title: 'Organizational Settings',
      subtitle:
        'Profile, visibility, policies, and editable Organization settings.',
      onPress: () =>
        open('/organizations/settings'),
    },
    {
      title: 'Members / Join Requests',
      subtitle:
        'Members, pending requests, approvals, and membership administration.',
      onPress: () =>
        open('/organizations/members-requests'),
    },
    {
      title: 'Events & Attendance',
      subtitle:
        'Open the exact-scope events and attendance area.',
      onPress: () =>
        open('/scope/attendance'),
    },
    {
      title: 'Giving / GCash Settings',
      subtitle:
        'Configure the Giving receiver for this exact scope.',
      onPress: () =>
        open('/scope-giving-settings'),
    },
    {
      title: 'More Admin Controls',
      subtitle:
        'Open the remaining existing admin controls for this exact scope.',
      onPress: () =>
        open('/organizations/manage-feature'),
    },
  ];

  return (
    <>
      <Stack.Screen
        options={{ title: 'Manage Organization' }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            EXACT-SCOPE ADMIN
          </Text>
          <Text style={styles.title}>
            {scopeName}
          </Text>
          <Text style={styles.subtitle}>
            Manage this Organization only.
          </Text>
        </View>

        {buttons.map(button => (
          <Pressable
            key={button.title}
            onPress={button.onPress}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.pressed,
            ]}>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>
                {button.title}
              </Text>
              <Text style={styles.cardSubtitle}>
                {button.subtitle}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 46,
    gap: 11,
    backgroundColor: '#F4F7F5',
  },
  center: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  muted: {
    color: '#6E7E76',
    textAlign: 'center',
    lineHeight: 18,
  },
  deniedTitle: {
    color: '#173B2F',
    fontSize: 15,
    fontWeight: '900',
  },
  header: {
    gap: 4,
    marginBottom: 5,
  },
  eyebrow: {
    color: '#61766C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    color: '#173B2F',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: '#697A71',
    fontSize: 11,
  },
  card: {
    minHeight: 82,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: '#173B2F',
    fontSize: 13,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: '#6E7E76',
    fontSize: 10,
    lineHeight: 15,
  },
  chevron: {
    color: '#176B4A',
    fontSize: 26,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});