import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BuklodNonMediaBanner from '@/components/BuklodNonMediaBanner';

const resources = [
  { title: 'Bible Book & Chapter Directory', detail: 'Choose a book and chapter before opening the reader.', route: '/bible/directory' },
  { title: 'Daily Devotion', detail: 'Published Word and devotional archive.', route: '/word' },
  { title: 'Daily Reading', detail: 'Your assigned reading and existing completion flow.', route: '/bible' },
  { title: 'ABC Study', detail: 'Christian growth lessons.', route: '/faith/abc' },
  { title: 'Hymnbook', detail: 'Browse the existing song library.', route: '/faith/hymns' },
] as const;

export default function FaithLibraryScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Show Faith Library' }} />
      <ScrollView style={styles.list} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Show Faith Library</Text>
        <Text style={styles.description}>Choose a resource. Existing access and completion rules apply when you open it.</Text>
        {resources.map(item => (
          <Pressable key={item.route} accessibilityRole="button" onPress={() => router.push(item.route as any)} style={styles.card}>
            <Text style={styles.name}>{item.title}</Text><Text style={styles.description}>{item.detail}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom }]}><BuklodNonMediaBanner placementId="faith_library_bottom" /></View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F6' }, list: { flex: 1 },
  content: { padding: 16, gap: 12 }, title: { fontSize: 24, fontWeight: '800', color: '#173B2F' },
  name: { fontSize: 16, fontWeight: '700', color: '#173B2F' },
  description: { fontSize: 13, lineHeight: 20, color: '#53665B' },
  card: { padding: 16, gap: 6, borderRadius: 12, backgroundColor: '#FFFFFF' },
  footer: { paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
});
