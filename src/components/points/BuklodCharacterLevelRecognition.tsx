/* Server-confirmed Character V2 level-up recognition. No points or grants client-side. */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHARACTER_DISPLAY_NAME,
  type BuklodCharacterSelectionV2State,
} from '@/lib/buklodCharacterSelectionV2';

type Props = {
  userId: string | null | undefined;
  selection: BuklodCharacterSelectionV2State | null;
};

export default function BuklodCharacterLevelRecognition({ userId, selection }: Props) {
  const [unlocked, setUnlocked] = useState<{ name: string; level: number } | null>(null);
  const revision = useRef(0);
  const characterId = selection?.active_character_id;
  const baseline = selection?.baseline_lifetime_points;
  const rawLevel = selection?.character_level;

  useEffect(() => {
    const id = ++revision.current;
    if (!userId || !characterId || !Number.isFinite(Number(baseline))) return;
    const level = Math.floor(Number(rawLevel));
    if (!Number.isFinite(level) || level < 1 || level > 20) return;

    // The selection baseline isolates separate Level-1 resets of the same character.
    // A new device/first visit records the level silently instead of inventing an unlock.
    const key = `buklod:character-level:last-seen:v1:${userId}:${characterId}:${baseline}`;
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(key);
        if (id !== revision.current) return;
        const previous = saved === null ? null : Number(saved);
        if (saved === null || (Number.isFinite(previous) && level > previous)) {
          await AsyncStorage.setItem(key, String(level));
        }
        if (id === revision.current && saved !== null &&
            Number.isFinite(previous) && level > previous) {
          setUnlocked({
            name: CHARACTER_DISPLAY_NAME[characterId],
            level,
          });
        }
      } catch {
        // Recognition is optional; never interrupt Character display or selection.
      }
    })();
    return () => { revision.current += 1; };
  }, [userId, characterId, baseline, rawLevel]);

  return (
    <Modal visible={Boolean(unlocked)} transparent animationType="fade"
      statusBarTranslucent onRequestClose={() => setUnlocked(null)}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.medal}>
            <MaterialCommunityIcons name="star-four-points" size={43} color="#FBEAA2" />
          </View>
          <Text style={s.eyebrow}>CHARACTER MILESTONE</Text>
          <Text style={s.title}>Character Level Up!</Text>
          <Text style={s.level}>{unlocked?.name} · Level {unlocked?.level}</Text>
          <Text style={s.detail}>
            Bagong level na ang iyong Character! Nananatiling hiwalay ang permanenteng
            Circle Rank at lifetime points mo.
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close Character recognition"
            style={s.button} onPress={() => setUnlocked(null)}>
            <Text style={s.buttonText}>NICE! CONTINUE</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, justifyContent: 'center', paddingHorizontal: 25,
    backgroundColor: 'rgba(22,17,44,0.76)',
  },
  card: {
    borderRadius: 26, padding: 25, alignItems: 'center',
    borderWidth: 2, borderColor: '#B5A4EB', backgroundColor: '#FFFFFF',
  },
  medal: {
    height: 86, width: 86, borderRadius: 43, justifyContent: 'center',
    alignItems: 'center', backgroundColor: '#6542A1',
    borderWidth: 6, borderColor: '#DECAFF',
  },
  eyebrow: {
    color: '#7B5A9F', marginTop: 15, letterSpacing: 1.1,
    fontSize: 10, fontWeight: '900',
  },
  title: { color: '#352A57', fontSize: 24, fontWeight: '900', marginTop: 9 },
  level: { color: '#6C40A2', fontSize: 20, fontWeight: '900', marginTop: 5 },
  detail: {
    color: '#5E596B', fontSize: 13, lineHeight: 20,
    marginTop: 13, textAlign: 'center',
  },
  button: {
    backgroundColor: '#67469C', paddingVertical: 13,
    width: '100%', borderRadius: 13, marginTop: 22, alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
