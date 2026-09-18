import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import BuklodRorkHomeAtlas from '@/components/home/BuklodRorkHomeAtlas';
import BuklodSpatialHomeV2 from '@/components/home/BuklodSpatialHomeV2';

type HomeTool = {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  route: string;
  accessibilityLabel: string;
};

const HOME_TOOLS: HomeTool[] = [
  {
    label: 'AI Recipe',
    icon: 'chef-hat',
    route: '/personal-home/recipe',
    accessibilityLabel: 'Open AI Recipe',
  },
  {
    label: 'Budget',
    icon: 'wallet-outline',
    route: '/personal-home/budget',
    accessibilityLabel: 'Open Budget and Money',
  },
  {
    label: 'Media',
    icon: 'radio',
    route: '/personal-home/media',
    accessibilityLabel: 'Open Radio Music and Watch',
  },
  {
    label: 'Reminder',
    icon: 'alarm',
    route: '/personal-home/reminders',
    accessibilityLabel: 'Open Good Night and Reminders',
  },
];

export default function BuklodPersonalHomeE2E() {
  const [mode, setMode] = useState<'house' | 'details'>('house');

  return (
    <View style={styles.root}>
      <View style={styles.modeBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'house' }}
          onPress={() => setMode('house')}
          style={[styles.modeButton, mode === 'house' && styles.modeButtonActive]}
        >
          <MaterialCommunityIcons name="home-variant-outline" size={17} color={mode === 'house' ? '#FFFFFF' : '#355342'} />
          <Text style={[styles.modeText, mode === 'house' && styles.modeTextActive]}>House</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'details' }}
          onPress={() => setMode('details')}
          style={[styles.modeButton, mode === 'details' && styles.modeButtonActive]}
        >
          <MaterialCommunityIcons name="view-dashboard-outline" size={17} color={mode === 'details' ? '#FFFFFF' : '#355342'} />
          <Text style={[styles.modeText, mode === 'details' && styles.modeTextActive]}>Details</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {mode === 'house' ? (
          <BuklodRorkHomeAtlas onOpenDetails={() => setMode('details')} />
        ) : (
          <BuklodSpatialHomeV2 />
        )}
      </View>

      <View style={styles.dock}>
        {HOME_TOOLS.map((tool) => (
          <Pressable
            key={tool.route}
            onPress={() => router.push(tool.route as any)}
            accessibilityRole="button"
            accessibilityLabel={tool.accessibilityLabel}
            style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name={tool.icon} size={20} color="#2D6B4F" />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {tool.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F0E6',
  },
  modeBar: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 2,
    padding: 3,
    borderRadius: 17,
    backgroundColor: '#E8E2D5',
    gap: 3,
    zIndex: 5,
  },
  modeButton: {
    minHeight: 34,
    paddingHorizontal: 13,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: '#2D6B4F',
  },
  modeText: {
    color: '#355342',
    fontSize: 11,
    fontWeight: '900',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  dock: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 7,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D4D9D2',
  },
  tool: {
    flex: 1,
    minWidth: 0,
    maxWidth: 150,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: 4,
  },
  toolPressed: {
    backgroundColor: '#EEF5EF',
  },
  iconWrap: {
    width: 30,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#355342',
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },
});
