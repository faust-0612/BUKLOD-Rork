import React, { useRef, useState } from 'react';
import {
  Linking,
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
  BUKLOD_PITCHES,
  BUKLOD_PRESENTATION_DISCLOSURE,
  formatBuklodPitch,
  getBuklodPitch,
  type BuklodAudience,
} from '@/lib/aboutBuklodContent';

const SITE_URL = 'https://buklod.expo.app';

export default function AboutBuklodPresenterScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useBuklodTheme();
  const [selected, setSelected] = useState<BuklodAudience>('church');
  const [feedback, setFeedback] = useState('');
  const scroll = useRef<ScrollView>(null);
  const pitch = getBuklodPitch(selected);

  const selectAudience = (key: BuklodAudience) => {
    setSelected(key);
    setFeedback('');
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  const copyText = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setFeedback(label + ' copied. Paste it into your notes or message.');
    } catch {
      setFeedback('Could not copy. Please try again.');
    }
  };

  const sharePitch = async () => {
    const text = formatBuklodPitch(pitch);
    try {
      if (Platform.OS === 'web') {
        await copyText(text, 'Presentation guide');
        return;
      }
      await Share.share({ message: text, title: 'BUKLOD • ' + pitch.name });
    } catch {
      await copyText(text, 'Presentation guide');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.canvas, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to About BUKLOD"
          style={styles.iconButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.accent} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Present BUKLOD</Text>
        <Pressable onPress={sharePitch} accessibilityRole="button" accessibilityLabel="Share presentation guide" style={styles.iconButton}>
          <MaterialCommunityIcons name="share-variant-outline" size={22} color={theme.accent} />
        </Pressable>
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(48, insets.bottom + 28) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: theme.accent }]}>QUICK PRESENTATION TOOLKIT</Text>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Kilalanin muna ang iyong audience.</Text>
        <Text style={[styles.lead, { color: theme.textSecondary }]}>
          Piliin kung sino ang kausap. May ready-to-read opening, short talk, live demo, at invitation—hindi kailangang mag-imbento sa mismong presentation.
        </Text>

        <Text style={[styles.label, { color: theme.textPrimary }]}>Audience</Text>
        <View style={styles.audienceWrap}>
          {BUKLOD_PITCHES.map(item => {
            const active = selected === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => selectAudience(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.audienceChip,
                  { backgroundColor: active ? theme.accent : theme.surface, borderColor: active ? theme.accent : theme.border },
                ]}
              >
                <Text style={[styles.audienceText, { color: active ? '#FFFFFF' : theme.textPrimary }]}>
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.audienceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardEyebrow, { color: theme.accent }]}>WHAT MATTERS TO THEM</Text>
          <Text style={[styles.need, { color: theme.textPrimary }]}>{pitch.need}</Text>
        </View>

        <SectionTitle title="01 • Opening Question" />
        <View style={[styles.quoteCard, { backgroundColor: theme.surface, borderLeftColor: theme.accent }]}>
          <Text style={[styles.quote, { color: theme.textPrimary }]}>“{pitch.opener}”</Text>
        </View>

        <SectionTitle title="02 • 30–45 Second Pitch" />
        <Text style={[styles.body, { color: theme.textSecondary }]}>{pitch.shortTalk}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy short pitch"
          onPress={() => copyText(pitch.opener + '\n\n' + pitch.shortTalk + '\n\n' + SITE_URL, 'Short pitch')}
          style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
        >
          <MaterialCommunityIcons name="content-copy" size={18} color={theme.accent} />
          <Text style={[styles.secondaryText, { color: theme.textPrimary }]}>Copy Short Pitch</Text>
        </Pressable>

        <SectionTitle title="03 • Short Presentation Script" />
        <Text style={[styles.body, { color: theme.textSecondary }]}>{pitch.fullTalk}</Text>

        <SectionTitle title="04 • Show, Don't Just Tell" />
        <View style={[styles.stepGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {pitch.demo.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={[styles.stepCircle, { borderColor: theme.border }]}>
                <Text style={[styles.stepNumber, { color: theme.accent }]}>{index + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.textSecondary }]}>{step}</Text>
            </View>
          ))}
        </View>

        <SectionTitle title="05 • Listen to Their Needs" />
        {pitch.questions.map(question => (
          <View key={question} style={styles.questionRow}>
            <MaterialCommunityIcons name="comment-question-outline" size={18} color={theme.accent} />
            <Text style={[styles.question, { color: theme.textSecondary }]}>{question}</Text>
          </View>
        ))}

        <SectionTitle title="06 • Clear Next Step" />
        <View style={[styles.quoteCard, { backgroundColor: theme.surface, borderLeftColor: theme.accent }]}>
          <Text style={[styles.quote, { color: theme.textPrimary }]}>{pitch.close}</Text>
        </View>

        <Text style={[styles.label, { color: theme.textPrimary, marginTop: 28 }]}>Suggested 3-minute presentation</Text>
        <View style={[styles.timeline, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={[styles.timelineText, { color: theme.textSecondary }]}>
            0:00–0:20 • Opening question{'\n'}
            0:20–1:00 • Short pitch{'\n'}
            1:00–2:30 • Live app demonstration{'\n'}
            2:30–3:00 • Questions and next step
          </Text>
        </View>

        <View style={[styles.disclosureCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.disclosureHeading}>
            <MaterialCommunityIcons name="shield-check-outline" size={20} color={theme.accent} />
            <Text style={[styles.disclosureTitle, { color: theme.textPrimary }]}>Present with integrity</Text>
          </View>
          <Text style={[styles.disclosure, { color: theme.textSecondary }]}>
            {BUKLOD_PRESENTATION_DISCLOSURE}
          </Text>
        </View>

        {feedback ? (
          <Text accessibilityRole="alert" style={[styles.feedback, { color: theme.accent }]}>{feedback}</Text>
        ) : null}

        <Pressable
          style={[styles.primaryButton, { backgroundColor: theme.accent }]}
          onPress={() => copyText(formatBuklodPitch(pitch), 'Complete guide')}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="content-copy" size={19} color="#FFFFFF" />
          <Text style={styles.primaryText}>Copy Full Presentation</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, styles.launchButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => Linking.openURL(SITE_URL).catch(() => setFeedback('Could not open BUKLOD. Try ' + SITE_URL))}
          accessibilityRole="link"
        >
          <MaterialCommunityIcons name="open-in-new" size={19} color={theme.accent} />
          <Text style={[styles.secondaryText, { color: theme.textPrimary }]}>Open BUKLOD for Live Demo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );

  function SectionTitle({ title }: { title: string }) {
    return <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{title}</Text>;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    height: 55, paddingHorizontal: 8, flexDirection: 'row',
    alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 18 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.05 },
  title: { fontSize: 23, lineHeight: 31, fontWeight: '900', marginTop: 6 },
  lead: { fontSize: 14, lineHeight: 22, marginTop: 8 },
  label: { marginTop: 22, marginBottom: 10, fontSize: 14, fontWeight: '900' },
  audienceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  audienceChip: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  audienceText: { fontSize: 12, fontWeight: '700' },
  audienceCard: { padding: 15, marginTop: 18, borderWidth: 1, borderRadius: 14 },
  cardEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  need: { fontSize: 14, fontWeight: '600', lineHeight: 22, marginTop: 6 },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900', marginTop: 27, marginBottom: 10 },
  quoteCard: { borderRadius: 12, borderLeftWidth: 4, padding: 16 },
  quote: { fontSize: 15, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 23 },
  secondaryButton: {
    borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 12, minHeight: 46,
  },
  secondaryText: { fontSize: 13, fontWeight: '800' },
  stepGroup: { borderWidth: 1, padding: 14, borderRadius: 13, gap: 14 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepCircle: {
    height: 29, width: 29, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumber: { fontSize: 12, fontWeight: '900' },
  stepText: { fontSize: 13, lineHeight: 21, flex: 1 },
  questionRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  question: { fontSize: 14, lineHeight: 22, flex: 1 },
  timeline: { borderRadius: 12, borderWidth: 1, padding: 14 },
  timelineText: { fontSize: 13, lineHeight: 24 },
  disclosureCard: { borderWidth: 1, borderRadius: 13, padding: 14, marginTop: 24 },
  disclosureHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disclosureTitle: { fontSize: 14, fontWeight: '800' },
  disclosure: { marginTop: 8, fontSize: 12, lineHeight: 20 },
  feedback: { fontSize: 12, lineHeight: 19, marginTop: 14, fontWeight: '700' },
  primaryButton: {
    marginTop: 21, minHeight: 48, borderRadius: 12, padding: 13,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  launchButton: { marginTop: 10 },
});
