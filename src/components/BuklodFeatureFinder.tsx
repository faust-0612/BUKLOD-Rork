import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { findBuklodFeatures } from '@/lib/buklodNavigationV2';

/** Local, offline feature discovery. Deliberately not a posts, people or private-data search. */
export default function BuklodFeatureFinder() {
  const [query, setQuery] = useState('');
  const { theme } = useBuklodTheme();
  const results = useMemo(() => findBuklodFeatures(query), [query]);
  const isSearching = query.trim().length >= 2;
  return (
    <View style={{ paddingHorizontal: 12, gap: 5 }}>
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
          accessibilityHint="Search Settings, chat, files and other app destinations"
          placeholder="Find a feature..."
          placeholderTextColor={theme.textMuted}
          allowFontScaling
          autoCorrect={false}
          returnKeyType="search"
          style={{ flex: 1, minWidth: 0, paddingVertical: 9, fontSize: 16, color: theme.textPrimary }}
        />
        {query.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear feature search"
            onPress={() => setQuery('')} hitSlop={8}
            style={{ minWidth: 36, minHeight: 42, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="close-circle" size={19} color={theme.textMuted} />
          </Pressable>
        )}
      </View>
      {isSearching && (
        <View style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
          {results.length ? results.map((item, index) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}
              onPress={() => { setQuery(''); router.push(item.route as any); }}
              style={({ pressed }) => ({
                minHeight: 49, paddingHorizontal: 13, paddingVertical: 9,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: pressed ? theme.accentSoft : theme.surface,
                borderTopWidth: index ? 1 : 0, borderTopColor: theme.border,
              })}>
              <Text allowFontScaling style={{ flex: 1, fontSize: 15, fontWeight: '700', color: theme.textPrimary }}>{item.title}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textMuted} />
            </Pressable>
          )) : (
            <Text allowFontScaling style={{ padding: 12, fontSize: 14, color: theme.textMuted }}>
              No matching feature. Try a simpler word.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
