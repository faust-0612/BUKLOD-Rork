import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  initializeSmartDrawerStore,
  listSmartDrawerFolders,
  querySmartDrawerItems,
} from '@/lib/smartDrawer/localStore';
import {
  runSmartDrawerLifecycleCleanup,
} from '@/lib/smartDrawer/lifecycle';
import type {
  SmartDrawerItem,
  SmartDrawerFolder,
} from '@/lib/smartDrawer/types';
import { useAuth } from '@/providers/AuthProvider';

const PAGE = 50;

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

const VIEWS = [
  ['for-you', 'For You'],
  ['due-soon', 'Due Soon'],
  ['overdue', 'Overdue'],
  ['lists', 'Lists'],
  ['writing', 'Writing'],
  ['programs', 'Programs'],
  ['ideas', 'Ideas'],
  ['documents', 'Documents'],
  ['appointments', 'Appointments'],
  ['events', 'Events'],
  ['tasks', 'Tasks'],
  ['archive', 'Archive'],
  ['recently-removed', 'Recently Removed'],
] as const;

function iconFor(item: SmartDrawerItem) {
  switch (item.type) {
    case 'SHOPPING_LIST':
    case 'CHECKLIST':
      return 'cart-outline';
    case 'EVENT':
    case 'PROGRAM':
      return 'calendar-star';
    case 'APPOINTMENT':
      return 'calendar-clock-outline';
    case 'DUE_TASK':
    case 'TASK':
      return 'checkbox-marked-circle-outline';
    case 'WRITING':
    case 'POEM':
      return 'fountain-pen-tip';
    case 'IDEA':
      return 'lightbulb-outline';
    case 'RECEIPT':
      return 'receipt-text-outline';
    case 'DOCUMENT':
    case 'NOTICE':
      return 'file-document-outline';
    default:
      return 'note-text-outline';
  }
}

function metaFor(item: SmartDrawerItem) {
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

function sectionName(item: SmartDrawerItem) {
  if (
    item.dueAt ||
    ['EVENT', 'PROGRAM', 'APPOINTMENT', 'DUE_TASK'].includes(item.type)
  ) {
    return 'Upcoming';
  }
  if (['SHOPPING_LIST', 'CHECKLIST'].includes(item.type)) return 'Lists';
  if (['WRITING', 'POEM'].includes(item.type)) return 'Writing';
  if (['DOCUMENT', 'RECEIPT', 'NOTICE'].includes(item.type)) {
    return 'Documents';
  }
  if (item.type === 'IDEA') return 'Ideas';
  return 'Recent';
}

function groupItems(items: SmartDrawerItem[]) {
  const order = [
    'Upcoming',
    'Lists',
    'Writing',
    'Documents',
    'Ideas',
    'Recent',
  ];
  const map = new Map<string, SmartDrawerItem[]>();

  for (const item of items) {
    const key = sectionName(item);
    const current = map.get(key) ?? [];
    current.push(item);
    map.set(key, current);
  }

  return order
    .filter(key => map.has(key))
    .map(title => ({
      title,
      data: map.get(title) ?? [],
    }));
}

export default function SmartDrawerScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    q?: string | string[];
    folderId?: string | string[];
  }>();
  const initialQuery = Array.isArray(params.q)
    ? params.q[0] ?? ''
    : params.q ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [view, setView] = useState('for-you');
  const [items, setItems] = useState<SmartDrawerItem[]>([]);
  const [folders, setFolders] = useState<SmartDrawerFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const folderId = Array.isArray(params.folderId) ? params.folderId[0] : params.folderId;
    if (folderId) setView(`folder:${folderId}`);
  }, [params.folderId]);

  const load = useCallback(
    async (append = false, offset = 0) => {
      if (!user?.id) {
        setItems([]);
        setLoading(false);
        return;
      }

      if (append) setLoadingMore(true);
      else setLoading(true);
      setError('');

      try {
        await initializeSmartDrawerStore();
        const next = await querySmartDrawerItems(user.id, {
          search: query,
          view,
          limit: PAGE,
          offset: append ? offset : 0,
        });

        setItems(current =>
          append
            ? [
                ...current,
                ...next.filter(
                  row => !current.some(existing => existing.id === row.id),
                ),
              ]
            : next,
        );
        setHasMore(next.length === PAGE);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not open Smart Drawer.',
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, user?.id, view],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        if (user?.id) {
          void listSmartDrawerFolders(user.id).then(setFolders).catch(() => undefined);
          await runSmartDrawerLifecycleCleanup(
            user.id,
          ).catch(() => ({ removed: 0 }));
        }

        if (active) {
          await load(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [load, user?.id]),
  );

  const sections = useMemo(
    () => groupItems(items),
    [items],
  );

  const openWall = () => {
    router.replace('/buklod' as any);
  };

  if (!user?.id) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>
          Sign in to open your private Drawer.
        </Text>
        <Pressable onPress={openWall} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Back to BUKLOD</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={openWall}
          accessibilityRole="button"
          accessibilityLabel="Back to Community Wall"
          style={styles.iconButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color="#FFFFFF"
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Drawer</Text>
          <Text style={styles.headerSubtitle}>
            Your things, automatically organized.
          </Text>
        </View>

        <Pressable
          onPress={() =>
            router.push('/drawer/settings' as any)
          }
          accessibilityRole="button"
          accessibilityLabel="Drawer settings"
          style={styles.privateBadge}
        >
          <MaterialCommunityIcons
            name="cog-outline"
            size={19}
            color="#FFFFFF"
          />
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(30, insets.bottom + 24) },
        ]}
        ListHeaderComponent={
          <View>
            <View style={styles.search}>
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color="#58728A"
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => void load(false)}
                returnKeyType="search"
                placeholder="Search your Drawer…"
                placeholderTextColor="#8295A8"
                style={styles.searchInput}
                accessibilityLabel="Search your Drawer"
              />
              {!!query && (
                <Pressable
                  onPress={() => {
                    setQuery('');
                  }}
                  accessibilityLabel="Clear search"
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color="#8295A8"
                  />
                </Pressable>
              )}
            </View>

            <View style={styles.actions}>
              {ACTIONS.map(action => (
                <Pressable
                  key={action.key}
                  onPress={() => router.push(action.route as any)}
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
                      size={24}
                      color={action.iconColor}
                    />
                  </View>
                  <Text style={styles.actionLabel}>
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => router.push('/drawer/shared' as any)}
              accessibilityRole="button"
              accessibilityLabel="Open Shared Drawer collaboration"
              style={styles.sharedEntry}
            >
              <MaterialCommunityIcons name="account-group-outline" size={21} color="#087A66" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sharedTitle}>Shared Drawer</Text>
                <Text style={styles.sharedHint}>Cluster projects and individual collaboration</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#5A9B8A" />
            </Pressable>

            <Pressable onPress={() => router.push('/drawer/folders' as any)} style={styles.sharedEntry}>
              <MaterialCommunityIcons name="folder-plus-outline" size={21} color="#286EA1" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sharedTitle}>My Folders</Text>
                <Text style={styles.sharedHint}>Create, rename, browse or remove folders without losing notes</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#698DA9" />
            </Pressable>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {VIEWS.map(([key, label]) => {
                const selected = key === view;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setView(key);
                      setItems([]);
                    }}
                    style={[
                      styles.chip,
                      selected && styles.chipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
              {folders.map(folder => (
                <Pressable key={folder.id} onPress={() => { setView(`folder:${folder.id}`); setItems([]); }}
                  style={[styles.chip, view === `folder:${folder.id}` && styles.chipSelected]}>
                  <Text style={[styles.chipText, view === `folder:${folder.id}` && styles.chipTextSelected]}>📁 {folder.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {!!error && (
              <View style={styles.errorCard}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={19}
                  color="#A94A43"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorTitle}>
                    Drawer could not refresh
                  </Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
                <Pressable onPress={() => void load(false)}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            )}

            {loading && !items.length && (
              <View style={styles.loading}>
                <ActivityIndicator color="#0A6EBD" />
                <Text style={styles.loadingText}>
                  Opening your local Drawer…
                </Text>
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>
              {section.data.length}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(`/drawer/item/${item.id}` as any)
            }
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.item,
              pressed && { opacity: 0.75 },
            ]}
          >
            <View style={styles.itemIcon}>
              <MaterialCommunityIcons
                name={iconFor(item) as any}
                size={22}
                color="#0A6EBD"
              />
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.itemTop}>
                <Text
                  numberOfLines={1}
                  style={styles.itemTitle}
                >
                  {item.title}
                </Text>
                {item.keepOnTop && (
                  <MaterialCommunityIcons
                    name="pin"
                    size={14}
                    color="#D38700"
                  />
                )}
              </View>
              <Text
                numberOfLines={1}
                style={styles.itemMeta}
              >
                {metaFor(item)}
              </Text>
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color="#93A4B3"
            />
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name="archive-search-outline"
                size={34}
                color="#86A3BA"
              />
              <Text style={styles.emptyTitle}>
                {query
                  ? 'No matching Drawer item found.'
                  : 'Nothing here yet.'}
              </Text>
              <Text style={styles.emptyText}>
                Quick Note, Scan or Import something. BUKLOD will sort it for you.
              </Text>
            </View>
          ) : null
        }
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (hasMore && !loadingMore) {
            void load(true, items.length);
          }
        }}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              style={{ marginVertical: 18 }}
              color="#0A6EBD"
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F8FC',
  },
  center: {
    flex: 1,
    backgroundColor: '#F4F8FC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  centerTitle: {
    color: '#173B63',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 13,
    backgroundColor: '#0A6EBD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  header: {
    minHeight: 66,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0A5DA8',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  headerSubtitle: {
    marginTop: 2,
    color: '#DDEEFF',
    fontSize: 10.5,
  },
  privateBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  search: {
    minHeight: 45,
    borderRadius: 15,
    backgroundColor: '#E8F1F9',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#183E63',
    fontSize: 13,
    paddingVertical: 0,
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  sharedEntry: {
    marginTop: 12,
    backgroundColor: '#E9F8F1',
    borderRadius: 14,
    minHeight: 58,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sharedTitle: { color: '#176F5D', fontSize: 12.5, fontWeight: '900' },
  sharedHint: { color: '#579282', fontSize: 10, marginTop: 3 },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#224968',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  chips: {
    paddingVertical: 13,
    gap: 7,
  },
  chip: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7F0',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: '#0B70C9',
    borderColor: '#0B70C9',
  },
  chipText: {
    color: '#557087',
    fontSize: 10.5,
    fontWeight: '800',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  errorCard: {
    marginBottom: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#F0CFCC',
    backgroundColor: '#FFF3F1',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    color: '#7D332E',
    fontWeight: '900',
    fontSize: 11.5,
  },
  errorText: {
    marginTop: 2,
    color: '#8F5C57',
    fontSize: 10,
  },
  retryText: {
    color: '#0A6EBD',
    fontWeight: '900',
    fontSize: 10.5,
  },
  loading: {
    paddingVertical: 26,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#657C90',
    fontSize: 11,
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 6,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#15395E',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionCount: {
    color: '#7A92A6',
    fontSize: 10,
    fontWeight: '800',
  },
  item: {
    minHeight: 58,
    marginBottom: 7,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE9F1',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EAF4FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  itemTitle: {
    flex: 1,
    color: '#193B5D',
    fontSize: 12.5,
    fontWeight: '900',
  },
  itemMeta: {
    marginTop: 3,
    color: '#71869A',
    fontSize: 10,
  },
  empty: {
    paddingVertical: 38,
    alignItems: 'center',
    gap: 7,
  },
  emptyTitle: {
    color: '#284D6B',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    maxWidth: 300,
    color: '#71869A',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
