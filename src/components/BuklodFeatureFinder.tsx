import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { BUKLOD_FEATURE_LINKS, findBuklodFeatures, type BuklodFeatureLink } from '@/lib/buklodNavigationV2';
import {
  buklodPinnedNavigationStorageKey,
  normalizeBuklodPinnedNavigation,
  toggleBuklodPinnedNavigation,
  buklodRecentNavigationStorageKey,
  normalizeBuklodRecentNavigation,
  rememberBuklodRecentNavigation,
} from '@/lib/buklodPinnedNavigation';
import { BUKLOD_LONG_PRESS_MS } from '@/lib/buklodTouch';
import BuklodNavigationContextSheet, { type BuklodNavigationContextAction } from '@/components/BuklodNavigationContextSheet';

const PINNABLE_FEATURE_IDS = BUKLOD_FEATURE_LINKS.map(item => item.id);
const GLOBAL_DESTINATIONS = new Set(['/buklod', '/messages', '/clusters', '/me']);
function openFeature(item: BuklodFeatureLink) {
  if (GLOBAL_DESTINATIONS.has(item.route)) router.navigate(item.route as any);
  else router.push(item.route as any);
}

/**
 * Offline search of *routes*, not posts/people or sensitive content.
 * Bookmarks are locally stored per authenticated account, never shared.
 * Destination guards are still the final authority.
 */
export default function BuklodFeatureFinder() {
  const { user } = useAuth();
  const accountId = user?.id ?? null;
  const [query, setQuery] = useState('');
  const [menuItem, setMenuItem] = useState<BuklodFeatureLink | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const recentRef = useRef<string[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const { theme } = useBuklodTheme();

  useEffect(() => {
    let active = true;
    setPinned([]);
    setRecent([]);
    recentRef.current = [];
    setLoadedFor(null);
    if (!accountId) return () => { active = false; };
    let key: string;
    try { key = buklodPinnedNavigationStorageKey(accountId); }
    catch { return () => { active = false; }; }
    const recentKey = buklodRecentNavigationStorageKey(accountId);
    const load = async () => {
      const [pins, history] = await Promise.all([
        AsyncStorage.getItem(key).then(raw =>
          normalizeBuklodPinnedNavigation(raw ? JSON.parse(raw) : [], PINNABLE_FEATURE_IDS)
        ).catch(() => [] as string[]),
        AsyncStorage.getItem(recentKey).then(raw =>
          normalizeBuklodRecentNavigation(raw ? JSON.parse(raw) : [], PINNABLE_FEATURE_IDS)
        ).catch(() => [] as string[]),
      ]);
      if (!active) return;
      setPinned(pins);
      recentRef.current = history;
      setRecent(history);
      setLoadedFor(accountId);
    };
    void load();
    return () => { active = false; };
  }, [accountId]);

  useEffect(() => {
    if (!accountId || loadedFor !== accountId) return;
    const key = buklodPinnedNavigationStorageKey(accountId);
    const contents = JSON.stringify(normalizeBuklodPinnedNavigation(pinned, PINNABLE_FEATURE_IDS));
    // Serialize writes: rapid pin/unpin cannot persist an older revision last.
    writeQueue.current = writeQueue.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(key, contents))
      .catch(() => undefined);
  }, [accountId, loadedFor, pinned]);

  const results = useMemo(() => findBuklodFeatures(query), [query]);
  const savedLinks = useMemo(() => pinned.map(id => BUKLOD_FEATURE_LINKS.find(item => item.id === id))
    .filter((item): item is BuklodFeatureLink => Boolean(item)), [pinned]);
  const recentLinks = useMemo(() => recent
    .filter(id => !pinned.includes(id))
    .map(id => BUKLOD_FEATURE_LINKS.find(item => item.id === id))
    .filter((item): item is BuklodFeatureLink => Boolean(item)), [recent, pinned]);
  const searching = query.trim().length >= 2;
  const canPin = loadedFor !== null && loadedFor === accountId;

  const openAndRemember = (item: BuklodFeatureLink) => {
    setQuery('');
    if (canPin && accountId) {
      const next = rememberBuklodRecentNavigation(recentRef.current, item.id, PINNABLE_FEATURE_IDS);
      recentRef.current = next;
      setRecent(next);
      const key = buklodRecentNavigationStorageKey(accountId);
      // Persist before routing; Home can unmount immediately after navigation.
      writeQueue.current = writeQueue.current
        .catch(() => undefined)
        .then(() => AsyncStorage.setItem(key, JSON.stringify(next)))
        .catch(() => undefined);
    }
    openFeature(item);
  };

  const togglePin = (item: BuklodFeatureLink) => {
    if (!canPin) return;
    setPinned(current => toggleBuklodPinnedNavigation(current, item.id, PINNABLE_FEATURE_IDS));
  };

  const removeRecent = (item: BuklodFeatureLink) => {
    if (!canPin || !accountId) return;
    const next = normalizeBuklodRecentNavigation(
      recentRef.current.filter(id => id !== item.id), PINNABLE_FEATURE_IDS,
    );
    recentRef.current = next;
    setRecent(next);
    const key = buklodRecentNavigationStorageKey(accountId);
    writeQueue.current = writeQueue.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(key, JSON.stringify(next)))
      .catch(() => undefined);
  };

  const contextActions: BuklodNavigationContextAction[] = menuItem
    ? [
      { id: 'open', title: 'Open ' + menuItem.title, icon: 'open-in-new', onPress: () => openAndRemember(menuItem) },
      ...(canPin ? [{
        id: pinned.includes(menuItem.id) ? 'unpin' : 'pin',
        title: pinned.includes(menuItem.id) ? 'Unpin shortcut' : 'Pin to Home',
        icon: (pinned.includes(menuItem.id) ? 'star-off-outline' : 'star-outline') as BuklodNavigationContextAction['icon'],
        onPress: () => togglePin(menuItem),
      }] : []),
      ...(canPin && recent.includes(menuItem.id) ? [{
        id: 'remove-recent', title: 'Remove from recent', icon: 'history',
        onPress: () => removeRecent(menuItem),
      } as BuklodNavigationContextAction] : []),
    ]
    : [];

  return (
    <View style={{ paddingHorizontal: 12, gap: 6 }}>
      <View style={{
        minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9,
        backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
        borderRadius: 14, paddingHorizontal: 12, paddingVertical: 3,
      }}>
        <MaterialCommunityIcons name="magnify" size={23} color={theme.accent} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="Find a BUKLOD feature"
          accessibilityHint="Type a common task such as password, chat or tulong"
          placeholder="Find a feature..."
          placeholderTextColor={theme.textMuted}
          allowFontScaling
          autoCorrect={false}
          returnKeyType="search"
          style={{ flex: 1, minWidth: 0, paddingVertical: 9, fontSize: 16, color: theme.textPrimary }}
        />
        {query.length === 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="How to find and pin BUKLOD features"
            onPress={() => router.push('/settings/navigation-help' as any)}
            style={{ minWidth: 45, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <MaterialCommunityIcons name="help-circle-outline" size={22} color={theme.textMuted} />
          </Pressable>
        )}
        {query.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear feature search"
            onPress={() => setQuery('')} hitSlop={6}
            style={{ minWidth: 44, minHeight: 46, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="close-circle" size={19} color={theme.textMuted} />
          </Pressable>
        )}
      </View>

      {searching && (
        <View style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
          {results.length ? results.map((item, index) => {
            const isPinned = pinned.includes(item.id);
            return (
              <View key={item.id} style={{
                flexDirection: 'row', alignItems: 'center', minHeight: 55,
                borderTopWidth: index ? 1 : 0, borderTopColor: theme.border,
              }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.title}`}
                  accessibilityHint="Long press for actions, or use the star icon to pin"
                  onPress={() => openAndRemember(item)}
                  onLongPress={() => setMenuItem(item)}
                  delayLongPress={BUKLOD_LONG_PRESS_MS}
                  style={({ pressed }) => ({
                    flex: 1, minWidth: 0, minHeight: 55, flexDirection: 'row',
                    alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 12, backgroundColor: pressed ? theme.accentSoft : theme.surface,
                  })}
                >
                  <Text allowFontScaling style={{ flex: 1, fontSize: 16, fontWeight: '700', color: theme.textPrimary }}>{item.title}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textMuted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isPinned ? `Unpin ${item.title}` : `Pin ${item.title} to Home`}
                  accessibilityState={{ disabled: !canPin }}
                  disabled={!canPin}
                  onPress={() => togglePin(item)}
                  style={{ minWidth: 48, minHeight: 55, alignItems: 'center', justifyContent: 'center' }}
                >
                  <MaterialCommunityIcons name={isPinned ? 'star' : 'star-outline'} size={21} color={theme.accent} />
                </Pressable>
              </View>
            );
          }) : (
            <Text allowFontScaling style={{ padding: 12, fontSize: 15, color: theme.textMuted }}>
              No matching feature. Try another word.
            </Text>
          )}
        </View>
      )}

      {!searching && recentLinks.length > 0 && (
        <View style={{ gap: 6, paddingTop: 4 }}>
          <Text allowFontScaling style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '800' }}>
            Recently opened
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {recentLinks.map(item => (
              <View key={item.id} style={{
                minHeight: 48, flexDirection: 'row', alignItems: 'center', borderRadius: 12,
                borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
              }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open recent ${item.title}`}
                  accessibilityHint="Long press for more options"
                  onPress={() => openAndRemember(item)}
                  onLongPress={() => setMenuItem(item)}
                  delayLongPress={BUKLOD_LONG_PRESS_MS}
                  style={({ pressed }) => ({
                    minHeight: 48, paddingLeft: 10, paddingRight: 6, paddingVertical: 8,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: pressed ? theme.accentSoft : theme.surface,
                  })}
                >
                  <MaterialCommunityIcons name="history" size={16} color={theme.accent} />
                  <Text allowFontScaling style={{ fontSize: 15, color: theme.textPrimary, fontWeight: '700' }}>{item.title}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`More options for ${item.title}`}
                  onPress={() => setMenuItem(item)}
                  style={{ minWidth: 46, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
                >
                  <MaterialCommunityIcons name="dots-vertical" size={20} color={theme.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      {!searching && savedLinks.length > 0 && (
        <View style={{ gap: 6, paddingTop: 5 }}>
          <Text allowFontScaling style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '800' }}>
            Pinned shortcuts
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {savedLinks.map(item => (
              <View key={item.id} style={{
                minHeight: 48, flexDirection: 'row', alignItems: 'center', borderRadius: 12,
                borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
              }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open pinned ${item.title}`}
                  accessibilityHint="Long press for more options"
                  onPress={() => openAndRemember(item)}
                  onLongPress={() => setMenuItem(item)}
                  delayLongPress={BUKLOD_LONG_PRESS_MS}
                  style={({ pressed }) => ({
                    minHeight: 48, paddingLeft: 10, paddingRight: 6, paddingVertical: 8,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: pressed ? theme.accentSoft : theme.surface,
                  })}
                >
                  <MaterialCommunityIcons name="star" size={16} color={theme.accent} />
                  <Text allowFontScaling style={{ fontSize: 15, color: theme.textPrimary, fontWeight: '700' }}>{item.title}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`More options for ${item.title}`}
                  onPress={() => setMenuItem(item)}
                  style={{ minWidth: 46, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
                >
                  <MaterialCommunityIcons name="dots-vertical" size={20} color={theme.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}
      <BuklodNavigationContextSheet
        visible={menuItem !== null}
        title={menuItem?.title ?? 'Options'}
        actions={contextActions}
        onClose={() => setMenuItem(null)}
      />
    </View>
  );
}
