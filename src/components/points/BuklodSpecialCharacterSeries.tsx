/* BUKLOD_R40_SPECIAL_CHARACTER_JOURNEY_V2_FORWARD_PORT */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { supabase } from '@/lib/supabase';
import {
  CHARACTER_DISPLAY_NAME,
  SPECIAL_CHARACTER_ORDER,
  getMyBuklodCharacterSelectionV2,
  setMyBuklodCharacterActiveV2,
  type BuklodCharacterSelectionV2State,
  type BuklodSpecialCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import { getBuklodSpecialCharacterAsset } from '@/lib/buklodSpecialCharacterAssets';

type SpecialCollectibleRow = {
  character_id?: string | null;
  collectible_name?: string | null;
  collectible_id?: string | null;
  unlocked?: boolean | null;
  earned?: boolean | null;
};

type SpecialCollectiblePayload = {
  character_id?: string | null;
  collectibles?: SpecialCollectibleRow[] | null;
};

type Props = {
  userId?: string | null;
  selectionState?: BuklodCharacterSelectionV2State | null;
  onSelectionStateChange?: (state: BuklodCharacterSelectionV2State) => void;
};

export default function BuklodSpecialCharacterSeries({
  userId,
  selectionState,
  onSelectionStateChange,
}: Props) {
  const { theme } = useBuklodPresentation();
  const [state, setState] = useState<BuklodCharacterSelectionV2State | null>(selectionState ?? null);
  const [busyId, setBusyId] = useState<BuklodSpecialCharacterId | null>(null);
  const [collectibles, setCollectibles] = useState<SpecialCollectibleRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => setState(selectionState ?? null), [selectionState]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const selection = await getMyBuklodCharacterSelectionV2(userId, true);
      setState(selection);
      onSelectionStateChange?.(selection);

      const collectibleGroups = await Promise.all(
        selection.visible_special_character_ids.map(async (characterId) => {
          const result = await (supabase as any).rpc(
            'get_my_buklod_special_collectibles_v2',
            { p_character_id: characterId },
          );
          if (result?.error) {
            console.warn(
              `BUKLOD Special collectibles ${characterId}:`,
              result.error.message ?? result.error,
            );
            return [] as SpecialCollectibleRow[];
          }
          const payload = (result?.data ?? {}) as SpecialCollectiblePayload;
          return (Array.isArray(payload.collectibles) ? payload.collectibles : []).map((row) => ({
            ...row,
            character_id: characterId,
          }));
        }),
      );
      setCollectibles(collectibleGroups.flat());
    } finally {
      setLoading(false);
    }
  }, [onSelectionStateChange, userId]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(
    () => new Set(state?.visible_special_character_ids ?? []),
    [state?.visible_special_character_ids],
  );

  const visibleCharacters = SPECIAL_CHARACTER_ORDER.filter((id) => visible.has(id));

  const choose = async (id: BuklodSpecialCharacterId) => {
    if (!userId || busyId || state?.active_character_id === id || !visible.has(id)) return;
    setBusyId(id);
    try {
      // V2 is the sole activation authority. It atomically enforces Circle Rank and
      // resets the newly selected character's independent progression to Level 1.
      const next = await setMyBuklodCharacterActiveV2(userId, id);
      setState(next);
      onSelectionStateChange?.(next);

      // Preserve the R40 pursuit signal, but never let this auxiliary write undo a
      // successful V2 activation.
      const pursuit = await (supabase as any).rpc(
        'set_my_buklod_special_character_pursuit_v1',
        { p_character_id: id },
      );
      if (pursuit?.error) {
        console.warn('BUKLOD Special pursuit:', pursuit.error.message ?? pursuit.error);
      }
    } finally {
      setBusyId(null);
    }
  };

  const collectibleCount = (id: BuklodSpecialCharacterId) => collectibles.filter((row) => {
    const same = String(row.character_id ?? '').toLowerCase() === id;
    return same && Boolean(row.earned ?? row.unlocked);
  }).length;

  if (!userId) return null;

  return (
    <View style={[styles.shell, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
      <View style={styles.headingRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>R40 SPECIAL SERIES</Text>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Special Character Journey</Text>
        </View>
        {loading ? <ActivityIndicator size="small" color={theme.accent} /> : null}
      </View>
      <Text style={[styles.helper, { color: theme.textSecondary }]}>
        ACE · MITCH · NIEL · ANGEL · VHEN · TRUDICE · JAWO · ELESUR unlock only through canonical Circle Rank. Locked characters stay hidden.
      </Text>

      {visibleCharacters.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {visibleCharacters.map((id) => {
            const active = state?.active_character_id === id;
            const level = active ? state?.character_level ?? 1 : 1;
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={`Use special character ${CHARACTER_DISPLAY_NAME[id]}`}
                disabled={Boolean(busyId) || active}
                onPress={() => void choose(id)}
                style={[
                  styles.card,
                  {
                    borderColor: active ? theme.accent : theme.border,
                    backgroundColor: theme.surface,
                  },
                ]}
              >
                <Image source={getBuklodSpecialCharacterAsset(id, level)} resizeMode="contain" style={styles.art} />
                <Text style={[styles.name, { color: theme.textPrimary }]}>{CHARACTER_DISPLAY_NAME[id]}</Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>Level {level} · {collectibleCount(id)} collectibles</Text>
                <Text style={[styles.action, { color: active ? theme.accent : theme.textSecondary }]}>
                  {active ? 'ACTIVE' : busyId === id ? 'SWITCHING…' : 'Use This Character'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={[styles.empty, { color: theme.textMuted }]}>Reach the next eligible Circle Rank to reveal your first Special Character.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 7 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 2, fontSize: 16, fontWeight: '900' },
  helper: { fontSize: 11, lineHeight: 16 },
  row: { gap: 10, paddingVertical: 8, paddingRight: 12 },
  card: { width: 128, borderWidth: 1, borderRadius: 14, padding: 9, alignItems: 'center', gap: 4 },
  art: { width: 92, height: 116 },
  name: { fontSize: 12, fontWeight: '900' },
  meta: { fontSize: 9, fontWeight: '800', textAlign: 'center' },
  action: { marginTop: 3, fontSize: 9, fontWeight: '900' },
  empty: { fontSize: 11, lineHeight: 16, paddingVertical: 5 },
});
