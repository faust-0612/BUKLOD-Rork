import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  return (
    <View style={styles.root}>
      <BuklodSpatialHomeV2 />
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
