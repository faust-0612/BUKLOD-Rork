import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import {
  BUKLOD_FOUNDER,
  BUKLOD_PRINCIPLES,
  BUKLOD_VISIONS,
} from '@/lib/aboutBuklodContent';

// Reuse the already-bundled developer portrait. No network fetch or new asset
// dependency is introduced for this public route.
const founderPortrait = require('../../assets/branding/privacy-consent-developer.jpg');

export default function AboutBuklodScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useBuklodTheme();

  const shareFounder = async () => {
    const message = [
      'The Story Behind BUKLOD',
      BUKLOD_FOUNDER.name,
      BUKLOD_FOUNDER.descriptor,
      BUKLOD_FOUNDER.message,
      'https://buklod.expo.app',
    ].join('\n\n');

    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(message);
      } else {
        await Share.share({ message, title: 'The Story Behind BUKLOD' });
      }
    } catch {
      await Clipboard.setStringAsync(message).catch(() => undefined);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.canvas, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons name="arrow-left" size={23} color={theme.accent} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>About BUKLOD</Text>
        <Pressable
          onPress={shareFounder}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Share BUKLOD founder story"
        >
          <MaterialCommunityIcons name="share-variant-outline" size={22} color={theme.accent} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(44, insets.bottom + 24) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Image source={founderPortrait} style={styles.portrait} resizeMode="cover" accessibilityLabel="BUKLOD developer portrait" />
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: theme.accent }]}>THE PERSON BEHIND BUKLOD</Text>
            <Text style={[styles.name, { color: theme.textPrimary }]}>{BUKLOD_FOUNDER.name}</Text>
            <Text style={[styles.role, { color: theme.textMuted }]}>Founder & Developer</Text>
            <Text style={[styles.subrole, { color: theme.textSecondary }]}>Nurse • Educator • Mission Director</Text>
          </View>
        </View>

        <Text style={[styles.headline, { color: theme.textPrimary }]}>
          Higit pa sa isang application.
        </Text>
        <Text style={[styles.lead, { color: theme.textSecondary }]}>
          {BUKLOD_FOUNDER.descriptor}
        </Text>

        <View style={[styles.quote, { borderLeftColor: theme.accent, backgroundColor: theme.surface }]}>
          <MaterialCommunityIcons name="format-quote-open" size={23} color={theme.accent} />
          <Text style={[styles.quoteText, { color: theme.textPrimary }]}>
            {BUKLOD_FOUNDER.message}
          </Text>
          <Text style={[styles.signoff, { color: theme.textMuted }]}>— Faustino Jr. M. Gabut</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>My Story</Text>
        <Text style={[styles.introduction, { color: theme.textSecondary }]}>{BUKLOD_FOUNDER.introduction}</Text>
        {BUKLOD_FOUNDER.story.map((paragraph, index) => (
          <Text key={index} style={[styles.body, { color: theme.textSecondary }]}>
            {paragraph}
          </Text>
        ))}

        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Mga Prinsipyong Pinanghahawakan</Text>
        <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
          Mga pagpapahalagang sumasalamin sa aking mga gawain at adhikain.
        </Text>
        <View style={styles.cards}>
          {BUKLOD_PRINCIPLES.map((principle, index) => (
            <View
              key={principle.title}
              style={[styles.valueCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={[styles.valueNumber, { borderColor: theme.border }]}>
                <Text style={[styles.valueNumberText, { color: theme.accent }]}>{String(index + 1).padStart(2, '0')}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={[styles.valueTitle, { color: theme.textPrimary }]}>{principle.title}</Text>
                <Text style={[styles.valueBody, { color: theme.textSecondary }]}>{principle.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Ang Mas Malaking Pangarap</Text>
        {BUKLOD_VISIONS.map(vision => (
          <View key={vision.title} style={[styles.visionRow, { borderBottomColor: theme.border }]}>
            <MaterialCommunityIcons name="compass-outline" size={22} color={theme.accent} />
            <View style={styles.flex}>
              <Text style={[styles.valueTitle, { color: theme.textPrimary }]}>{vision.title}</Text>
              <Text style={[styles.valueBody, { color: theme.textSecondary }]}>{vision.body}</Text>
            </View>
          </View>
        ))}

        <View style={[styles.characterCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.valueTitle, { color: theme.textPrimary }]}>Mga Katangiang Hinahangaan</Text>
          <Text style={[styles.valueBody, { color: theme.textSecondary }]}>
            Tapang na may malasakit. Talinong may kababaang-loob. Paninindigang may pananagutan.
            Pamumunong marunong makinig. Mga katangiang nais kong patuloy na matutuhan at isabuhay.
          </Text>
        </View>

        <View style={[styles.presentationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.presentationHeading}>
            <MaterialCommunityIcons name="presentation-play" size={28} color={theme.accent} />
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Present BUKLOD</Text>
              <Text style={[styles.valueBody, { color: theme.textSecondary }]}>
                Ready-to-use short talks and demos for churches, schools, organizations, businesses, and friends.
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/about-buklod-present' as any)}
            accessibilityLabel="Open BUKLOD presentation guide"
            accessibilityRole="button"
            style={[styles.primaryButton, { backgroundColor: theme.accent }]}
          >
            <Text style={styles.primaryText}>Open Presentation Guide</Text>
            <MaterialCommunityIcons name="arrow-right" color="#FFFFFF" size={19} />
          </Pressable>
        </View>

        <Text style={[styles.footer, { color: theme.textMuted }]}>
          BUKLOD • Samahang Binuklod ng Pag-ibig
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    height: 55, paddingHorizontal: 8, flexDirection: 'row', gap: 4,
    alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 18 },
  hero: {
    flexDirection: 'row', borderWidth: 1, borderRadius: 18,
    overflow: 'hidden', minHeight: 188,
  },
  portrait: { width: '40%', minHeight: 190, height: '100%', backgroundColor: '#E9E9E9' },
  heroCopy: { paddingHorizontal: 16, paddingVertical: 17, flex: 1, justifyContent: 'center', gap: 6 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  name: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  role: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  subrole: { fontSize: 11, lineHeight: 17 },
  headline: { fontSize: 24, lineHeight: 31, fontWeight: '900', marginTop: 24 },
  lead: { fontSize: 15, lineHeight: 24, marginTop: 8 },
  quote: { padding: 17, borderRadius: 12, borderLeftWidth: 4, marginTop: 22 },
  quoteText: { fontSize: 16, lineHeight: 25, fontWeight: '600', marginTop: 5 },
  signoff: { fontSize: 12, fontWeight: '700', marginTop: 12 },
  sectionTitle: { marginTop: 30, marginBottom: 10, fontSize: 21, fontWeight: '900', lineHeight: 27 },
  sectionSub: { fontSize: 13, lineHeight: 20, marginBottom: 13 },
  introduction: { fontSize: 15, lineHeight: 24, fontWeight: '600', marginBottom: 12 },
  body: { fontSize: 14, lineHeight: 23, marginBottom: 12 },
  cards: { gap: 10 },
  valueCard: {
    borderWidth: 1, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  valueNumber: {
    width: 37, height: 37, borderRadius: 11,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  valueNumberText: { fontSize: 12, fontWeight: '900' },
  flex: { flex: 1 },
  valueTitle: { fontSize: 15, lineHeight: 22, fontWeight: '800' },
  valueBody: { fontSize: 13, lineHeight: 21, marginTop: 5 },
  visionRow: {
    flexDirection: 'row', gap: 12, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  characterCard: { padding: 16, borderRadius: 14, borderWidth: 1, marginTop: 18 },
  presentationCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginTop: 28 },
  presentationHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '900' },
  primaryButton: {
    marginTop: 17, minHeight: 48, borderRadius: 12, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10,
  },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 25 },
});
