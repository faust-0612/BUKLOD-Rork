/* Character Evolution progress for all 13 Characters, independent of Circle Rank. */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import BuklodCharacterEvolutionGate from '@/components/points/BuklodCharacterEvolutionGate';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { useAuth } from '@/providers/AuthProvider';
import {
  CHARACTER_DISPLAY_NAME,
  getMyBuklodCharacterSelectionV2,
  type BuklodCharacterSelectionV2State,
} from '@/lib/buklodCharacterSelectionV2';

export default function CharacterEvolutionScreen() {
  const { theme } = useBuklodPresentation();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [state, setState] = useState<BuklodCharacterSelectionV2State | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!userId) {
      setState(null);
      setError('Please sign in to view Character evolution.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const next = await getMyBuklodCharacterSelectionV2(userId, true);
      setState(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not refresh Character progress.');
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useFocusEffect(useCallback(() => {
    setLoading(true);
    void refresh();
  }, [refresh]));
  useEffect(() => { setState(null); }, [userId]);
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.canvas },
    content: { paddingVertical: 20, paddingBottom: 48 },
    headingRow: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { flex: 1, fontSize: 18, fontWeight: '900', color: theme.textPrimary },
    link: { fontSize: 12, fontWeight: '800', color: theme.accent },
    sub: { marginTop: 8, marginHorizontal: 16, fontSize: 12, color: theme.textSecondary },
    error: { marginHorizontal: 16, marginTop: 12, fontSize: 11, color: theme.warning },
  });
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.headingRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Profile" onPress={() => router.back()}>
          <Text style={s.link}>Back</Text>
        </Pressable>
        <Text style={s.title}>My Character Evolution</Text>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
      {state ? (
        <>
          <Text style={s.sub}>
            {CHARACTER_DISPLAY_NAME[state.active_character_id]} · Actual Level {state.character_level}
            {' '}· Circle Rank remains independent
          </Text>
          <BuklodCharacterEvolutionGate
            userId={userId}
            activeCharacterId={state.active_character_id}
            onProgressRefresh={refresh}
          />
        </>
      ) : null}
      {error ? (
        <View>
          <Text style={s.error}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry Character evolution"
            style={{ margin: 16 }} onPress={() => { void refresh(); }}>
            <Text style={s.link}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}
