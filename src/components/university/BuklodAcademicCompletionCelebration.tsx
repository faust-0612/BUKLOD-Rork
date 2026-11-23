import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, AppState, Easing, Modal, Pressable, ScrollView,
  StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { playBuklodCue, type BuklodSoundCue } from '@/lib/buklodSounds';
import { useBuklodReduceMotion } from '@/components/HomeMotion';
import {
  getBuklodAcademicCompletionPresentation,
  type BuklodUniversityAwardReceipt,
} from '@/lib/buklodUniversityCompletionMotion';

type Props = {
  /** Must come from a fresh, authenticated Registrar-issued server receipt. */
  award: BuklodUniversityAwardReceipt | null;
  visible: boolean;
  /** Parent persists a per-user acknowledgement after dismissal. */
  onDismiss: (awardId: string) => void;
  /** Opens an authorized record/download route; never guesses a PDF URL. */
  onOpenAcademicPaper: (awardId: string) => void;
};

const PARTICLE_ANGLES = [0, 51, 102, 153, 204, 255, 306, 25, 76, 127, 178, 229, 280];

/** One-shot registrar celebration. Not shown for +UC or individual lesson achievements. */
export default function BuklodAcademicCompletionCelebration({
  award, visible, onDismiss, onOpenAcademicPaper,
}: Props) {
  const reduceMotion = useBuklodReduceMotion();
  const { height } = useWindowDimensions();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const preset = useMemo(() => getBuklodAcademicCompletionPresentation(award), [award]);
  const displayed = Boolean(visible && foreground && preset && award);
  const opacity = useRef(new Animated.Value(0)).current;
  const crestScale = useRef(new Animated.Value(0.55)).current;
  const crestSpin = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const paperY = useRef(new Animated.Value(24)).current;
  const paperOpacity = useRef(new Animated.Value(0)).current;
  const lastSoundAward = useRef<string | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      setForeground(next === 'active');
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!displayed || !preset) return;
    opacity.setValue(reduceMotion ? 1 : 0);
    crestScale.setValue(reduceMotion ? 1 : 0.55);
    crestSpin.setValue(reduceMotion ? 1 : 0);
    burst.setValue(reduceMotion ? 1 : 0);
    paperY.setValue(reduceMotion ? 0 : 24);
    paperOpacity.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) return;

    const sequence = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(crestScale, { toValue: 1, friction: 6, tension: 54, useNativeDriver: true }),
      Animated.timing(crestSpin, {
        toValue: 1, duration: preset.durationMs,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(150),
        Animated.timing(burst, {
          toValue: 1, duration: Math.min(1100, preset.durationMs - 200),
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(360),
        Animated.parallel([
          Animated.timing(paperOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.spring(paperY, { toValue: 0, friction: 8, tension: 52, useNativeDriver: true }),
        ]),
      ]),
    ]);
    sequence.start();
    if (lastSoundAward.current !== award?.awardId) {
      lastSoundAward.current = award?.awardId ?? null;
      const cue: BuklodSoundCue = ('university_' + award?.tier) as BuklodSoundCue;
      void playBuklodCue(cue).catch(() => undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    return () => sequence.stop();
  }, [award?.awardId, displayed, preset, reduceMotion, opacity, crestScale, crestSpin, burst, paperY, paperOpacity]);

  if (!displayed || !preset || !award) return null;
  const stop = () => onDismiss(award.awardId);
  const viewPaper = () => onOpenAcademicPaper(award.awardId);
  const spin = crestSpin.interpolate({ inputRange: [0, 1], outputRange: ['-20deg', '0deg'] });
  const sparkleOpacity = burst.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.8, 0] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={stop}>
      <ScrollView
        style={styles.overlay}
        contentContainerStyle={[styles.center, { minHeight: height }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.card, { opacity }]}>
          <Text style={styles.issuer}>MZB MINISTRY INC.</Text>
          <Text style={styles.school}>BUKLOD UNIVERSITY</Text>
          <Text style={styles.eyebrow}>VERIFIED ACADEMIC COMPLETION</Text>

          <View style={styles.ceremony}>
            <Animated.View style={[styles.glow, {
              backgroundColor: preset.glow,
              transform: [{ scale: crestScale }],
            }]} />
            {PARTICLE_ANGLES.slice(0, reduceMotion ? 0 : preset.burstCount).map((angle, index) => {
              const radians = angle * Math.PI / 180;
              const distance = 92 + (index % 3) * 15;
              return (
                <Animated.Text
                  key={index}
                  accessible={false}
                  style={[styles.particle, {
                    color: preset.accent,
                    opacity: sparkleOpacity,
                    transform: [
                      { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(radians) * distance] }) },
                      { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(radians) * distance] }) },
                      { scale: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1.2, 0.7] }) },
                    ],
                  }]}
                >
                  {index % 3 === 0 ? '✦' : '✧'}
                </Animated.Text>
              );
            })}
            <Animated.View
              style={[styles.crest, {
                borderColor: preset.accent,
                backgroundColor: preset.glow,
                transform: [{ scale: crestScale }, { rotate: spin }],
              }]}
            >
              <MaterialCommunityIcons name={preset.icon} size={51} color={preset.darkAccent} />
            </Animated.View>
          </View>

          <Animated.View style={{ alignItems: 'center', opacity: paperOpacity, transform: [{ translateY: paperY }] }}>
            <Text style={[styles.earned, { color: preset.darkAccent }]}>{preset.label}</Text>
            <Text style={styles.title}>{award.title.trim()}</Text>
            <View style={[styles.verifiedPill, { borderColor: preset.accent }]}>
              <MaterialCommunityIcons name="check-decagram" size={17} color={preset.darkAccent} />
              <Text style={[styles.verified, { color: preset.darkAccent }]}>OFFICIALLY RECORDED</Text>
            </View>
            <Text style={styles.help}>Your completion paper is ready in Academic Records.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View verified academic completion paper"
              onPress={viewPaper}
              style={({ pressed }) => [styles.primary, { backgroundColor: preset.darkAccent }, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="file-certificate-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryText}>VIEW ACADEMIC PAPER</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={stop} style={styles.secondary}>
              <Text style={styles.secondaryText}>CONTINUE</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(6, 22, 19, 0.82)' },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: {
    width: '100%', maxWidth: 400, backgroundColor: '#FFFEFA', borderRadius: 24,
    alignItems: 'center', paddingHorizontal: 22, paddingVertical: 24,
  },
  issuer: { fontSize: 10, letterSpacing: 1.7, color: '#516C5C', fontWeight: '800' },
  school: { marginTop: 3, color: '#154934', fontSize: 21, fontWeight: '900', letterSpacing: 0.6 },
  eyebrow: { marginTop: 7, color: '#65766C', fontSize: 9, letterSpacing: 1.2, fontWeight: '800' },
  ceremony: { height: 188, width: '100%', alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 170, height: 170, borderRadius: 85, opacity: 0.8 },
  crest: {
    width: 116, height: 116, borderRadius: 58, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center', elevation: 5,
  },
  particle: { position: 'absolute', fontSize: 19, fontWeight: '900' },
  earned: { fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  title: { marginTop: 8, fontSize: 22, fontWeight: '900', lineHeight: 29, textAlign: 'center', color: '#1A3025' },
  verifiedPill: { marginTop: 15, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1,
    borderRadius: 30, paddingVertical: 7, paddingHorizontal: 11 },
  verified: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  help: { fontSize: 12, color: '#63766B', marginTop: 16, textAlign: 'center', lineHeight: 18 },
  primary: { width: '100%', minHeight: 49, marginTop: 18, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  pressed: { opacity: 0.8 },
  secondary: { minHeight: 43, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: '#567366', fontSize: 12, fontWeight: '800' },
});
