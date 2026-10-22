import React from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
} from 'expo-router';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';

export default function AboutBuklodScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useBuklodTheme();

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.canvas,
          paddingTop: insets.top,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          {
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={theme.accent}
          />
        </Pressable>
        <Text
          style={[
            styles.headerTitle,
            { color: theme.textPrimary },
          ]}
        >
          About BUKLOD
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.name,
            { color: theme.textPrimary },
          ]}
        >
          Faustino Jr. M. Gabut
        </Text>
        <Text
          style={[
            styles.role,
            { color: theme.textMuted },
          ]}
        >
          Developer • BUKLOD
        </Text>

        <View
          style={[
            styles.note,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Text
            style={[
              styles.noteLabel,
              { color: theme.accent },
            ]}
          >
            From the Developer
          </Text>
          <Text
            style={[
              styles.noteBody,
              { color: theme.textSecondary },
            ]}
          >
            BUKLOD is built as a shared home for communities
            of belonging — Samahang Binuklod ng Pag-ibig.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    minHeight: 54,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  name: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  role: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  note: {
    marginTop: 28,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  noteBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
  },
});
