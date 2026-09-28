import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type MediaAction = {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  route?: string;
  url?: string;
};

const ACTIONS: MediaAction[] = [
  {
    title: 'BUKLOD IGPAT',
    subtitle: 'Watch the canonical BUKLOD short-video experience.',
    icon: 'play-box-multiple-outline',
    route: '/igpat',
  },
  {
    title: 'Community Wall',
    subtitle: 'Return to community posts and conversations.',
    icon: 'account-multiple-outline',
    route: '/(tabs)/buklod',
  },
  {
    title: 'BUKLOD Radio',
    subtitle: 'Listen to 702 DZAS in-app, then discover more live stations.',
    icon: 'radio',
    route: '/personal-home/radio',
  },
  {
    title: 'Spotify',
    subtitle: 'Open music, playlists, podcasts, and saved listening.',
    icon: 'spotify',
    url: 'https://open.spotify.com/',
  },
  {
    title: 'YouTube Music',
    subtitle: 'Open music, mixes, albums, and playlists.',
    icon: 'music-note',
    url: 'https://music.youtube.com/',
  },
  {
    title: 'YouTube',
    subtitle: 'Open long-form video, livestreams, news, education, and entertainment.',
    icon: 'youtube',
    url: 'https://www.youtube.com/',
  },
];

export default function PersonalHomeMediaScreen() {
  const [error, setError] = useState('');

  const open = async (item: MediaAction) => {
    setError('');
    if (item.route) {
      router.push(item.route as any);
      return;
    }
    if (!item.url) return;
    try {
      await Linking.openURL(item.url);
    } catch {
      setError('Hindi mabuksan ang media provider sa device na ito.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={23} color="#234434" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Radio, Music & Watch</Text>
          <Text style={styles.subtitle}>
            BUKLOD keeps one media door and launches the appropriate BUKLOD experience or supported provider.
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.grid}>
        {ACTIONS.map((item) => (
          <Pressable key={item.title} onPress={() => open(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name={item.icon} size={29} color="#2D6B4F" />
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSub}>{item.subtitle}</Text>
            <View style={styles.openRow}>
              <Text style={styles.openText}>Open</Text>
              <MaterialCommunityIcons name="arrow-top-right" size={16} color="#2D6B4F" />
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F0E6' },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 16, paddingBottom: 42 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  headerCopy: { flex: 1 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D6D7CB' },
  title: { fontSize: 23, fontWeight: '900', color: '#22382C' },
  subtitle: { marginTop: 3, color: '#66756A', fontSize: 12, lineHeight: 17 },
  error: { marginBottom: 10, padding: 10, borderRadius: 10, backgroundColor: '#FFF2EF', color: '#9B4038', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexGrow: 1, flexBasis: 230, minHeight: 180, backgroundColor: '#FFFFFF', borderRadius: 19, borderWidth: 1, borderColor: '#DADBCF', padding: 16 },
  pressed: { opacity: 0.72 },
  iconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3EB' },
  cardTitle: { marginTop: 12, fontSize: 16, fontWeight: '900', color: '#253C2E' },
  cardSub: { marginTop: 5, color: '#6D786F', fontSize: 11.5, lineHeight: 17, flex: 1 },
  openRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  openText: { color: '#2D6B4F', fontWeight: '900', fontSize: 12 },
});
