import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodPhan3DSlot from '@/components/character3d/BuklodPhan3DSlot';
import {
  PHAN_3D_ANIMATIONS,
  type Phan3DAnimation,
  type Phan3DQuality,
} from '@/components/character3d/phan3dConfig';
import { DEFAULT_CHARACTER } from '@/lib/buklodCharacter';

const LEVELS = Array.from({ length: 25 }, (_, index) => index + 1);
const QUALITIES: Phan3DQuality[] = ['low', 'medium', 'high'];

export default function Phan3DPreviewScreen() {
  const [level, setLevel] = useState(1);
  const [animation, setAnimation] = useState<Phan3DAnimation>('Idle');
  const [quality, setQuality] = useState<Phan3DQuality>('medium');
  const [active, setActive] = useState(true);

  const body = DEFAULT_CHARACTER.body;
  const equipment = useMemo(
    () => DEFAULT_CHARACTER.equipment,
    [],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>BUKLOD CHARACTER LAB</Text>
        <Text style={styles.title}>Phan 3D Preview</Text>
        <Text style={styles.copy}>
          Local/QA route only. No deployment is required. If the real rigged
          phan.glb is absent or cannot load, the proven layered character remains
          visible as the fallback.
        </Text>

        <View style={styles.stage}>
          <BuklodPhan3DSlot
            level={level}
            body={body}
            equipment={equipment}
            height={430}
            width={280}
            animation={animation}
            quality={quality}
            active={active}
          />
        </View>

        <Text style={styles.status}>
          Level {level} · {animation} · {quality.toUpperCase()} ·{' '}
          {active ? 'PLAYING' : 'PAUSED'} · {Platform.OS.toUpperCase()}
        </Text>

        <Section title="Level">
          <View style={styles.wrapRow}>
            {LEVELS.map((item) => (
              <Chip
                key={item}
                label={String(item)}
                selected={item === level}
                onPress={() => setLevel(item)}
              />
            ))}
          </View>
        </Section>

        <Section title="Animation">
          <View style={styles.wrapRow}>
            {PHAN_3D_ANIMATIONS.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={item === animation}
                onPress={() => setAnimation(item)}
              />
            ))}
          </View>
        </Section>

        <Section title="Quality">
          <View style={styles.wrapRow}>
            {QUALITIES.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={item === quality}
                onPress={() => setQuality(item)}
              />
            ))}
          </View>
        </Section>

        <Pressable
          accessibilityRole="button"
          onPress={() => setActive((value) => !value)}
          style={({ pressed }) => [
            styles.toggle,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.toggleText}>
            {active ? 'Pause animation' : 'Resume animation'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          selected && styles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#07111f',
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 56,
  },
  eyebrow: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  title: {
    marginTop: 6,
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '900',
  },
  copy: {
    marginTop: 8,
    color: '#a9b7c9',
    fontSize: 13,
    lineHeight: 19,
  },
  stage: {
    marginTop: 20,
    minHeight: 450,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: '#0d1b2e',
    borderWidth: 1,
    borderColor: '#21334a',
  },
  status: {
    marginTop: 10,
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '800',
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    marginBottom: 10,
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minWidth: 44,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a3d55',
    backgroundColor: '#0d1b2e',
  },
  chipSelected: {
    borderColor: '#38bdf8',
    backgroundColor: '#123658',
  },
  chipText: {
    color: '#a9b7c9',
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextSelected: {
    color: '#e0f2fe',
  },
  toggle: {
    marginTop: 24,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
  },
  toggleText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
  },
  pressed: {
    opacity: 0.8,
  },
});
