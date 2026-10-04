import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  getSmartDrawerSummary,
  initializeSmartDrawerStore,
} from '@/lib/smartDrawer/localStore';
import type {
  SmartDrawerItem,
  SmartDrawerSummary,
} from '@/lib/smartDrawer/types';
import { useAuth } from '@/providers/AuthProvider';

const EMPTY: SmartDrawerSummary = {
  forYou: [],
  dueSoon: 0,
  overdue: 0,
  activeLists: 0,
  totalActive: 0,
};

const ACTIONS = [
  {
    key: 'scan',
    label: 'Scan',
    icon: 'file-document-outline',
    route: '/drawer/capture?mode=scan',
    tone: '#E8F7F0',
    iconColor: '#11845E',
  },
  {
    key: 'camera',
    label: 'Camera',
    icon: 'camera-outline',
    route: '/drawer/capture?mode=camera',
    tone: '#EAF3FF',
    iconColor: '#1976D2',
  },
  {
    key: 'import',
    label: 'Import',
    icon: 'image-multiple-outline',
    route: '/drawer/import',
    tone: '#F4ECFF',
    iconColor: '#8E44CE',
  },
  {
    key: 'note',
    label: 'Quick Note',
    icon: 'note-text-outline',
    route: '/drawer/quick-note',
    tone: '#FFF4D9',
    iconColor: '#C67B00',
  },
] as const;

function itemIcon(item: SmartDrawerItem) {
  if (['EVENT', 'APPOINTMENT', 'PROGRAM'].includes(item.type)) {
    return 'calendar-outline';
  }
  if (['SHOPPING_LIST', 'CHECKLIST'].includes(item.type)) {
    return 'cart-outline';
  }
  if (item.type === 'DUE_TASK' || item.type === 'TASK') {
    return 'checkbox-marked-circle-outline';
  }
  return 'note-text-outline';
}

function timeLabel(item: SmartDrawerItem) {
  if (item.dueAt) {
    const date = new Date(item.dueAt);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }
  if (item.listItems.length) {
    const left = item.listItems.filter(entry => !entry.done).length;
    return `${left} item${left === 1 ? '' : 's'} left`;
  }
  return item.type.replaceAll('_', ' ');
}

export default function SmartDrawerWallCard() {
  const { user } = useAuth();
  const [summary, setSummary] =
    useState<SmartDrawerSummary>(EMPTY);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) {
      setSummary(EMPTY);
      return;
    }

    await initializeSmartDrawerStore();
    setSummary(
      await getSmartDrawerSummary(user.id),
    );
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void load().catch(() => {
        if (active) setSummary(EMPTY);
      });
      return () => {
        active = false;
      };
    }, [load]),
  );

  const visible = useMemo(
    () => summary.forYou.slice(0, 3),
    [summary.forYou],
  );

  const openSearch = () => {
    const q = query.trim();
    router.push(
      q
        ? (`/drawer?q=${encodeURIComponent(q)}` as any)
        : ('/drawer' as any),
    );
  };

  if (!user?.id) return null;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open My Drawer"
        onPress={() => router.push('/drawer' as any)}
        style={styles.headingRow}
      >
        <View style={styles.brandIcon}>
          <MaterialCommunityIcons
            name="archive-outline"
            size={20}
            color="#0A6EBD"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My Drawer</Text>
          <Text style={styles.subtitle}>
            Scan it. Save it. BUKLOD remembers the rest.
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={21}
          color="#6E88A0"
        />
      </Pressable>

      <View style={styles.search}>
        <MaterialCommunityIcons
          name="magnify"
          size={18}
          color="#54728B"
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={openSearch}
          returnKeyType="search"
          placeholder="Search your Drawer…"
          placeholderTextColor="#8295A8"
          style={styles.searchInput}
          accessibilityLabel="Search your Drawer"
        />
      </View>

      <View style={styles.actions}>
        {ACTIONS.map(action => (
          <Pressable
            key={action.key}
            onPress={() =>
              router.push(action.route as any)
            }
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={styles.action}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: action.tone },
              ]}
            >
              <MaterialCommunityIcons
                name={action.icon as any}
                size={21}
                color={action.iconColor}
              />
            </View>
            <Text style={styles.actionLabel}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>
          For You Now
        </Text>
        {!!summary.totalActive && (
          <Text style={styles.sectionMeta}>
            {summary.overdue
              ? `${summary.overdue} overdue`
              : summary.dueSoon
                ? `${summary.dueSoon} due soon`
                : 'All caught up'}
          </Text>
        )}
      </View>

      {visible.length ? (
        <View style={styles.items}>
          {visible.map(item => (
            <Pressable
              key={item.id}
              onPress={() =>
                router.push(
                  `/drawer/item/${item.id}` as any,
                )
              }
              style={styles.item}
            >
              <View style={styles.itemIcon}>
                <MaterialCommunityIcons
                  name={itemIcon(item) as any}
                  size={19}
                  color="#0A6EBD"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={styles.itemTitle}
                >
                  {item.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={styles.itemMeta}
                >
                  {timeLabel(item)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>
          Your saved notes, lists and reminders will appear here.
        </Text>
      )}

      <Pressable
        onPress={() => router.push('/drawer' as any)}
        accessibilityRole="button"
        style={styles.open}
      >
        <Text style={styles.openText}>Open Drawer</Text>
        <MaterialCommunityIcons
          name="arrow-right"
          size={16}
          color="#0A6EBD"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D7E5F2',
    backgroundColor: '#F5F9FD',
    padding: 12,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#E8F3FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#123B67',
    fontWeight: '900',
    fontSize: 15,
  },
  subtitle: {
    marginTop: 2,
    color: '#617B92',
    fontSize: 10.5,
    lineHeight: 14,
  },
  search: {
    marginTop: 10,
    minHeight: 40,
    borderRadius: 13,
    backgroundColor: '#EAF2F9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    gap: 7,
  },
  searchInput: {
    flex: 1,
    color: '#183E63',
    fontSize: 12.5,
    paddingVertical: 0,
  },
  actions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 6,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#254965',
    fontSize: 9.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  sectionHeading: {
    marginTop: 11,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    color: '#173B63',
    fontSize: 13,
    fontWeight: '900',
  },
  sectionMeta: {
    color: '#0A6EBD',
    fontSize: 9.5,
    fontWeight: '800',
  },
  items: {
    gap: 6,
  },
  item: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1EAF2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  itemIcon: {
    width: 31,
    height: 31,
    borderRadius: 9,
    backgroundColor: '#EAF4FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    color: '#193B5D',
    fontWeight: '900',
    fontSize: 11.5,
  },
  itemMeta: {
    marginTop: 2,
    color: '#71869A',
    fontSize: 9.5,
  },
  empty: {
    paddingVertical: 7,
    color: '#73879A',
    fontSize: 10.5,
    lineHeight: 15,
  },
  open: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  openText: {
    color: '#0A6EBD',
    fontWeight: '900',
    fontSize: 10.5,
  },
});
