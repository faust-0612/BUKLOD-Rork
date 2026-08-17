import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  getMyBuklodFoundationWorkspaces,
  type BuklodFoundationWorkspace,
} from '@/lib/buklodFoundation';
import { supabase } from '@/lib/supabase';

export default function BuklodFoundationWorkspaceNav() {
  const [rows, setRows] = useState<
    BuklodFoundationWorkspace[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [openingKey, setOpeningKey] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const next =
        await getMyBuklodFoundationWorkspaces();

      // FOUNDATION 007-R5:
      // NO frontend canonical whitelist.
      // The database registry/RPC is the source of truth.
      setRows(next);
    } catch (error: any) {
      console.warn(
        'BUKLOD Foundation workspace load failed:',
        String(error?.message ?? error)
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openWorkspace = useCallback(
    async (item: BuklodFoundationWorkspace) => {
      if (openingKey) return;

      setOpeningKey(item.workspace_key);

      try {
        // Faculty activation stays idempotent and automatic.
        // This does NOT create an extra button.
        if (item.workspace_key === 'FACULTY') {
          const { error } = await (supabase as any).rpc(
            'buklod_education_activate_faculty_workspace_v1'
          );

          if (error) throw error;
        }

        router.push(item.route as any);
      } catch (error: any) {
        Alert.alert(
          item.title || 'BUKLOD Workspace',
          String(
            error?.message ??
              'Could not open this BUKLOD workspace.'
          )
        );
      } finally {
        setOpeningKey(null);
      }
    },
    [openingKey]
  );

  if (loading && !rows.length) {
    return (
      <View style={styles.section}>
        <Text style={styles.eyebrow}>
          MY BUKLOD WORKSPACES
        </Text>

        <View style={styles.loadingCard}>
          <ActivityIndicator color="#275D45" />
          <Text style={styles.loadingText}>
            Loading workspaces...
          </Text>
        </View>
      </View>
    );
  }

  if (!rows.length) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>
        MY BUKLOD WORKSPACES
      </Text>

      <View style={styles.card}>
        {rows.map((item, index) => {
          const opening =
            openingKey === item.workspace_key;

          return (
            <Pressable
              key={item.workspace_key}
              onPress={() => void openWorkspace(item)}
              disabled={!!openingKey}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.rowBorder,
                pressed && styles.pressed,
                opening && styles.opening,
              ]}
            >
              <View style={styles.iconBox}>
                <MaterialCommunityIcons
                  name={(item.icon || 'apps') as any}
                  size={21}
                  color="#275D45"
                />
              </View>

              <View style={styles.body}>
                <Text style={styles.title}>
                  {item.title}
                </Text>

                {!!item.subtitle && (
                  <Text
                    style={styles.subtitle}
                    numberOfLines={2}
                  >
                    {item.subtitle}
                  </Text>
                )}
              </View>

              {opening ? (
                <ActivityIndicator
                  size="small"
                  color="#275D45"
                />
              ) : (
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color="#6D7A73"
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 6,
  },
  eyebrow: {
    marginBottom: 6,
    color: '#275D45',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DDE5E0',
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
  },
  row: {
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4EAE6',
  },
  pressed: {
    opacity: 0.72,
  },
  opening: {
    opacity: 0.62,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF4F0',
  },
  body: {
    flex: 1,
  },
  title: {
    color: '#17231D',
    fontSize: 16,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    color: '#66736C',
    fontSize: 13,
    lineHeight: 18,
  },
  loadingCard: {
    minHeight: 58,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#DDE5E0',
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    color: '#66736C',
    fontSize: 14,
    fontWeight: '700',
  },
});