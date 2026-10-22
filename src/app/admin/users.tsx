import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AdminGate } from '@/components/AdminGate';
import { shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { AppRole, useAuth } from '@/providers/AuthProvider';
import AdminDeleteAccountButton from '@/components/AdminDeleteAccountButton';

const ROLES: AppRole[] = [
  'system_admin',
];

const ROLE_LABELS: Record<AppRole, string> = {
  member: 'Member',
  leader: 'Leader',
  mentor: 'Mentor',
  pastor: 'Pastor',
  local_admin: 'Local Admin',
  system_admin: 'System Admin',
};

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  member: 'Baseline BUKLOD membership',
  leader: 'Cluster and member-care leadership',
  mentor: 'Mentoring and teaching access',
  pastor: 'Pastoral and formation validation access',
  local_admin: 'Local church administrative access',
  system_admin: 'System-wide administrative authority',
};

type UserItem = {
  id: string;
  full_name: string | null;
  mobile: string | null;
  role: AppRole;
  is_active: boolean;
  church?: {
    name?: string | null;
  } | null;
  roles: AppRole[];
};

export default function UsersScreen() {
  const {
    profile,
    refreshRoles,
  } = useAuth();

  const [items, setItems] = useState<UserItem[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [
      { data: profiles, error: profileError },
      { data: userRoles, error: rolesError },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id,full_name,mobile,role,is_active,church:church_id(name)'
        )
        .order('full_name'),

      supabase
        .from('user_roles')
        .select('user_id,role,is_active')
        .eq('is_active', true),
    ]);

    if (profileError) {
      Alert.alert('Users', profileError.message);
      return;
    }

    if (rolesError) {
      Alert.alert('Roles', rolesError.message);
      return;
    }

    const roleMap = new Map<string, AppRole[]>();

    for (const row of userRoles ?? []) {
      const role = row.role as AppRole;
      const current = roleMap.get(row.user_id) ?? [];

      if (!current.includes(role)) {
        current.push(role);
      }

      roleMap.set(row.user_id, current);
    }

    const merged: UserItem[] = (profiles ?? []).map(
      (user: any) => {
        const activeRoles =
          roleMap.get(user.id) ?? [];

        if (
          !activeRoles.includes('system_admin') &&
          !activeRoles.includes('member')
        ) {
          activeRoles.unshift('member');
        }

        return {
          ...user,
          roles: activeRoles,
        };
      }
    );

    setItems(merged);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setRole = async (
    user: UserItem,
    role: AppRole,
    active: boolean
  ) => {
    if (role === 'member' && !active) {
      Alert.alert(
        'Member role',
        'Member is the baseline role of every active BUKLOD account.'
      );
      return;
    }

    if (
      user.id === profile?.id &&
      role === 'system_admin' &&
      !active
    ) {
      Alert.alert(
        'Protected account',
        'You cannot remove your own System Admin role.'
      );
      return;
    }

    const key = `${user.id}:${role}`;
    setBusyKey(key);

    const { error } = await supabase.rpc(
      'admin_set_user_role',
      {
        p_user_id: user.id,
        p_role: role,
        p_active: active,
      }
    );

    setBusyKey(null);

    if (error) {
      Alert.alert(
        'Role update failed',
        error.message
      );
      return;
    }

    await load();

    if (user.id === profile?.id) {
      await refreshRoles();
    }
  };

  const setActive = async (
    user: UserItem,
    value: boolean
  ) => {
    const { error } = await supabase.rpc(
      'set_user_active',
      {
        p_user_id: user.id,
        p_active: value,
      }
    );

    if (error) {
      Alert.alert(
        'Status change failed',
        error.message
      );
      return;
    }

    await load();
  };

  return (
    <AdminGate>
      <FlatList
        style={shared.screen}
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>
              PEOPLE & ACCESS
            </Text>

            <Text style={styles.title}>
              Users & Roles
            </Text>

            <Text style={styles.subtitle}>
              One account may hold multiple active roles at the same time.
              Roles are independent and administrator-controlled.
            </Text>

            <View style={styles.infoBox}>
              <MaterialCommunityIcons
                name="shield-account-outline"
                size={22}
                color="#275D45"
              />

              <Text style={styles.infoText}>
                App-wide role control now uses System Admin only.
                Organization, Church and Cluster roles are managed
                inside their own scopes.
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={styles.userTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>
                  {item.full_name || 'Unnamed Member'}
                </Text>

                <Text style={styles.meta}>
                  {item.church?.name || 'No approved church'}
                  {'  |  '}
                  {item.mobile || 'No mobile'}
                </Text>
              </View>

              <View style={styles.statusBox}>
                <Text style={styles.statusLabel}>
                  ACTIVE
                </Text>

                <Switch
                  value={item.is_active}
                  onValueChange={(value) =>
                    setActive(item, value)
                  }
                  disabled={item.id === profile?.id}
                />
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.roleHeading}>
              ACTIVE ROLES
            </Text>

            <View style={styles.rolesGrid}>
              {ROLES.map((role) => {
                const active =
                  role === 'member' ||
                  item.roles.includes(role);

                const locked =
                  role === 'member' ||
                  (
                    item.id === profile?.id &&
                    role === 'system_admin'
                  );

                const busy =
                  busyKey === `${item.id}:${role}`;

                return (
                  <Pressable
                    key={role}
                    disabled={locked || busy}
                    onPress={() =>
                      setRole(
                        item,
                        role,
                        !active
                      )
                    }
                    style={({ pressed }) => [
                      styles.roleCard,
                      active && styles.roleCardOn,
                      locked && styles.roleCardLocked,
                      pressed && !locked && {
                        opacity: 0.72,
                      },
                    ]}
                  >
                    <View style={styles.roleTop}>
                      <View
                        style={[
                          styles.checkBox,
                          active &&
                            styles.checkBoxOn,
                        ]}
                      >
                        {active && (
                          <MaterialCommunityIcons
                            name="check"
                            size={15}
                            color="#FFFFFF"
                          />
                        )}
                      </View>

                      <Text
                        style={[
                          styles.roleName,
                          active &&
                            styles.roleNameOn,
                        ]}
                      >
                        {ROLE_LABELS[role]}
                      </Text>
                    </View>

                    <Text style={styles.roleDescription}>
                      {ROLE_DESCRIPTIONS[role]}
                    </Text>

                    {locked && (
                      <View style={styles.lockRow}>
                        <MaterialCommunityIcons
                          name="lock-outline"
                          size={13}
                          color="#7A867F"
                        />

                        <Text style={styles.lockText}>
                          {role === 'member'
                            ? 'Baseline role'
                            : 'Protected'}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>
                CURRENT ACCESS
              </Text>

              <Text style={styles.summaryText}>
                {item.roles
                  .map(
                    (role) =>
                      ROLE_LABELS[role]
                  )
                  .join('  |  ')}
              </Text>
            </View>
          

            <AdminDeleteAccountButton
              userId={item.id}
              userName={
                item.full_name ||
                'Unnamed Member'
              }
              disabled={
                busyKey !== null
              }
              onDeleted={() =>
                void load()
              }
            />
</View>
        )}
        ListFooterComponent={
          <View style={{ height: 70 }} />
        }
      />
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,

    // Keeps final controls above the bottom tab/navigation pane.
    paddingBottom: 130,
  },

  header: {
    marginBottom: 18,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    color: '#78857E',
  },

  title: {
    marginTop: 4,
    fontSize: 29,
    fontWeight: '900',
    color: '#1C2822',
  },

  subtitle: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: '#6F7C75',
  },

  infoBox: {
    marginTop: 15,
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(39,93,69,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.12)',
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#526159',
  },

  userCard: {
    marginBottom: 15,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.10)',
  },

  userTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  userName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1D2923',
  },

  meta: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 16,
    color: '#7C8881',
  },

  statusBox: {
    alignItems: 'center',
  },

  statusLabel: {
    marginBottom: 2,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#87918C',
  },

  divider: {
    height: 1,
    marginVertical: 14,
    backgroundColor: 'rgba(25,45,35,0.08)',
  },

  roleHeading: {
    marginBottom: 10,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: '#738078',
  },

  rolesGrid: {
    gap: 8,
  },

  roleCard: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.10)',
    backgroundColor: '#FAFBFA',
  },

  roleCardOn: {
    borderColor: 'rgba(39,93,69,0.35)',
    backgroundColor: 'rgba(39,93,69,0.065)',
  },

  roleCardLocked: {
    opacity: 0.82,
  },

  roleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B9C1BD',
    backgroundColor: '#FFFFFF',
  },

  checkBoxOn: {
    borderColor: '#275D45',
    backgroundColor: '#275D45',
  },

  roleName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#536058',
  },

  roleNameOn: {
    color: '#275D45',
  },

  roleDescription: {
    marginTop: 5,
    marginLeft: 31,
    fontSize: 11,
    lineHeight: 15,
    color: '#839088',
  },

  lockRow: {
    marginTop: 6,
    marginLeft: 31,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  lockText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7A867F',
  },

  summary: {
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: 'rgba(25,45,35,0.07)',
  },

  summaryLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#849089',
  },

  summaryText: {
    marginTop: 4,
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 17,
    color: '#536058',
  },
});

