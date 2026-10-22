import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Card, shared } from '@/components/UI';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type Church = {
  church_id: string;
  church_name: string;
  church_code: string | null;
};

type Member = {
  user_id: string;
  full_name: string | null;
  mobile: string | null;
  church_id: string | null;
  church_name: string | null;
  legacy_role: string | null;
  is_active: boolean;
};

export default function LocalMembersScreen() {
  const { hasAnyRole } = useAuth();

  const allowed = hasAnyRole([
    'pastor',
    'local_admin',
    'system_admin',
  ]);

  const db = supabase as any;

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [churchId, setChurchId] = useState<string>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [churchResult, memberResult] =
        await Promise.all([
          db.rpc('get_my_manageable_churches'),

          db.rpc('get_my_manageable_members', {
            p_church_id: null,
            p_search: null,
          }),
        ]);

      if (churchResult.error) {
        throw churchResult.error;
      }

      if (memberResult.error) {
        throw memberResult.error;
      }

      setChurches(churchResult.data ?? []);
      setMembers(memberResult.data ?? []);
    } catch (error: any) {
      Alert.alert(
        'Local Members',
        error?.message ||
          'Could not load manageable members.'
      );
    } finally {
      setLoading(false);
    }
  }, [allowed, db]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();

    return members
      .filter(
        (item) =>
          churchId === 'all' ||
          item.church_id === churchId
      )
      .filter((item) => {
        if (!q) return true;

        return [
          item.full_name,
          item.mobile,
          item.church_name,
          item.legacy_role,
        ].some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(q)
        );
      })
      .sort((a, b) =>
        String(a.full_name ?? '').localeCompare(
          String(b.full_name ?? '')
        )
      );
  }, [members, churchId, search]);

  if (!allowed) {
    return (
      <View style={[shared.screen, styles.center]}>
        <Card>
          <Text style={shared.h1}>
            Local Members
          </Text>

          <Text style={[shared.muted, { marginTop: 7 }]}>
            Pastor or Admin access is required.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>
        PEOPLE MANAGEMENT
      </Text>

      <Text style={shared.h1}>
        Member Master Records
      </Text>

      <Text style={[shared.muted, { marginTop: 5 }]}>
        View the member record first before making
        mentoring, devotional or BUKLOD Cluster changes.
      </Text>

      <TextInput
        style={styles.search}
        placeholder="Search name or mobile number..."
        value={search}
        onChangeText={setSearch}
      />

      <Text style={styles.label}>
        LOCAL CHURCH
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Pressable
          style={[
            styles.chip,
            churchId === 'all' && styles.chipOn,
          ]}
          onPress={() => setChurchId('all')}
        >
          <Text
            style={[
              styles.chipText,
              churchId === 'all' && styles.chipTextOn,
            ]}
          >
            All Assigned Locals
          </Text>
        </Pressable>

        {churches.map((church) => (
          <Pressable
            key={church.church_id}
            style={[
              styles.chip,
              churchId === church.church_id &&
                styles.chipOn,
            ]}
            onPress={() =>
              setChurchId(church.church_id)
            }
          >
            <Text
              style={[
                styles.chipText,
                churchId === church.church_id &&
                  styles.chipTextOn,
              ]}
            >
              {church.church_name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.summary}>
        <Text style={styles.summaryValue}>
          {visible.length}
        </Text>

        <Text style={shared.muted}>
          {visible.length === 1
            ? 'member'
            : 'members'}{' '}
          in current view
        </Text>
      </View>

      {loading && (
        <ActivityIndicator color={colors.green} />
      )}

      {!loading && visible.length === 0 && (
        <Card>
          <Text style={shared.h2}>
            No members found
          </Text>

          <Text style={[shared.muted, { marginTop: 5 }]}>
            No member matches the current Local or search.
          </Text>
        </Card>
      )}

      {visible.map((item) => (
        <Pressable
          key={item.user_id}
          onPress={() =>
            router.push(
              {
                pathname: '/admin/member/[id]',
                params: {
                  id: item.user_id,
                },
              } as any
            )
          }
        >
          <Card>
            <View style={styles.memberHeader}>
              <View style={{ flex: 1 }}>
                <Text style={shared.h2}>
                  {item.full_name || 'Unnamed Member'}
                </Text>

                <Text
                  style={[
                    styles.local,
                    { marginTop: 3 },
                  ]}
                >
                  {item.church_name ||
                    'No Local assigned'}
                </Text>
              </View>

              <View
                style={[
                  styles.status,
                  !item.is_active &&
                    styles.statusInactive,
                ]}
              >
                <Text style={styles.statusText}>
                  {item.is_active
                    ? 'ACTIVE'
                    : 'INACTIVE'}
                </Text>
              </View>
            </View>

            {!!item.mobile && (
              <Text
                style={[
                  shared.muted,
                  { marginTop: 7 },
                ]}
              >
                {item.mobile}
              </Text>
            )}

            <Text style={styles.open}>
              VIEW MASTER RECORD {'->'}
            </Text>
          </Card>
        </Pressable>
      ))}

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 50,
  },

  center: {
    justifyContent: 'center',
    padding: 20,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.greenDark,
    marginBottom: 4,
  },

  search: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
  },

  label: {
    marginTop: 17,
    marginBottom: 7,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.muted,
  },

  chips: {
    gap: 7,
    paddingBottom: 3,
  },

  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 11,
    backgroundColor: colors.white,
  },

  chipOn: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },

  chipText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },

  chipTextOn: {
    color: colors.greenDark,
  },

  summary: {
    marginVertical: 16,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },

  summaryValue: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.greenDark,
  },

  memberHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  local: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.greenDark,
  },

  status: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.greenSoft,
  },

  statusInactive: {
    backgroundColor: '#F0F0F0',
  },

  statusText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.text,
  },

  open: {
    marginTop: 12,
    fontSize: 10,
    fontWeight: '900',
    color: colors.greenDark,
    letterSpacing: 0.5,
  },
});