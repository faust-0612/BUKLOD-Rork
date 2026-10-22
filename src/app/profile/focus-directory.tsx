import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BuklodFoundationWorkspaceNav from '@/components/BuklodFoundationWorkspaceNav';
import BuklodNonMediaBanner from '@/components/BuklodNonMediaBanner';

export default function FocusDirectoryScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Focus Apps Directory' }} />
      <ScrollView style={styles.list} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Focus Apps Directory</Text>
        <Text style={styles.body}>Choose an app from the directory. Your existing role and subscription permissions still apply.</Text>
        <BuklodFoundationWorkspaceNav />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom }]}><BuklodNonMediaBanner placementId="focus_directory_bottom" /></View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F6' }, list: { flex: 1 },
  content: { padding: 16, gap: 12 }, title: { fontSize: 24, fontWeight: '800', color: '#173B2F' },
  body: { fontSize: 13, lineHeight: 20, color: '#53665B' }, footer: { paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
});
