/* DEV-only UI for server-verified evolution materials. Item receipts, not BP, change visible art. */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import type { BuklodCharacterId } from '@/lib/buklodCharacterSelectionV2';
import { BUKLOD_CHARACTER_COLLECTIBLE_ITEMS } from '@/lib/buklodCharacterWorldCatalog';
import {
  claimMyBuklodCharacterEvolutionItemV1,
  getMyBuklodCharacterEvolutionV1,
  type BuklodEvolutionGate,
} from '@/lib/buklodCharacterEvolutionV1';

const TASKS: Record<string, string> = {
  character_public_post: 'Verified meaningful public Wall posts',
  character_public_comment: 'Verified helpful public Wall comments',
  character_public_reaction: 'Verified eligible public Wall reactions',
  character_public_share: 'Verified qualifying public Wall shares',
  character_public_active_week: 'Verified active weeks in BUKLOD',
};

type Props = {
  userId?: string | null;
  activeCharacterId: BuklodCharacterId | null;
  onProgressRefresh: () => Promise<void> | void;
};

export default function BuklodCharacterEvolutionGate({
  userId, activeCharacterId, onProgressRefresh,
}: Props) {
  const { theme } = useBuklodPresentation();
  const [gate, setGate] = useState<BuklodEvolutionGate | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const claimInFlight = useRef(false);

  useEffect(() => {
    let alive = true;
    setGate(null);
    setError(null);
    if (!userId || !activeCharacterId) return () => { alive = false; };
    setLoading(true);
    void getMyBuklodCharacterEvolutionV1()
      .then(value => {
        if (!alive) return;
        if (value.characterId !== activeCharacterId) {
          setError('Character changed. Refresh to view the correct tasks.');
          return;
        }
        setGate(value);
      })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause.message : 'Could not load Character tasks.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, activeCharacterId]);

  if (!userId || !activeCharacterId) return null;
  const s = StyleSheet.create({
    panel: { marginHorizontal: 12, marginTop: 6, marginBottom: 10, padding: 12, borderRadius: 16,
      borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceElevated },
    heading: { fontSize: 13, fontWeight: '900', color: theme.textPrimary },
    caption: { marginTop: 5, fontSize: 11, lineHeight: 17, color: theme.textSecondary },
    row: { marginTop: 9, paddingVertical: 8, borderTopWidth: 1, borderColor: theme.border, gap: 4 },
    rowTitle: { fontSize: 11, fontWeight: '800', color: theme.textPrimary },
    rowText: { fontSize: 10, lineHeight: 16, color: theme.textSecondary },
    button: { marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 10, backgroundColor: theme.accent },
    buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 10 },
    alert: { fontSize: 10, lineHeight: 15, color: theme.warning, marginTop: 7 },
  });
  const claim = async (fromLevel: number, itemIndex: number) => {
    if (claimInFlight.current) return;
    claimInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await claimMyBuklodCharacterEvolutionItemV1(fromLevel, itemIndex);
      if (next.characterId !== activeCharacterId) throw new Error('Character switched. Reload tasks.');
      setGate(next);
      await onProgressRefresh();
      // The RPC may advance several previously completed steps. Refresh canonical snapshot.
      setGate(await getMyBuklodCharacterEvolutionV1());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Item claim could not be verified.');
    } finally {
      claimInFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={s.panel}>
      <Text style={s.heading}>CHARACTER EVOLUTION · BP + VERIFIED ITEMS</Text>
      <Text style={s.caption}>
        BP opens level eligibility. Your Character changes only after its required items are
        earned through verified tasks. Show Faith is optional; Kingdom mastery can substitute
        for qualifying social tasks.
      </Text>
      {loading ? <ActivityIndicator style={{ marginTop: 10 }} /> : null}
      {gate ? (
        <>
          <Text style={s.caption}>
            Actual Level {gate.visibleLevel} · BP-eligible Level {gate.bpEligibleLevel}
            {gate.visibleLevel === 20 ? ' · Maximum evolution' :
              gate.bpReady ? ' · BP ready, complete the items' : ' · Keep earning BP'}
          </Text>
          {gate.items.map(item => {
            const label = BUKLOD_CHARACTER_COLLECTIBLE_ITEMS[gate.characterId]
              ?.[gate.visibleLevel - 1]?.[item.itemIndex - 1] ?? `Evolution Item ${item.itemIndex}`;
            return (
              <View key={item.itemIndex} style={s.row}>
                <Text style={s.rowTitle}>
                  {item.obtained ? '✓ ' : ''}{label}
                </Text>
                <Text style={s.rowText}>
                  {TASKS[item.taskMetric] ?? 'Verified BUKLOD activity'}:
                  {' '}{item.verifiedCount}/{item.requiredCount}
                  {item.itemIndex <= 4 ? ' · Or verified Kingdom first mastery' : ''}
                </Text>
                {item.obtained ? (
                  <Text style={s.rowText}>Acquired · permanently saved for this Character</Text>
                ) : item.readyToClaim ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Claim verified ${label}`}
                    onPress={() => { void claim(gate.visibleLevel, item.itemIndex); }}
                    disabled={busy}
                    style={s.button}
                  >
                    <Text style={s.buttonText}>{busy ? 'VERIFYING...' : 'CLAIM VERIFIED ITEM'}</Text>
                  </Pressable>
                ) : (
                  <Text style={s.rowText}>Not yet earned · tasks remain available with Show Faith OFF</Text>
                )}
              </View>
            );
          })}
        </>
      ) : null}
      {error ? <Text style={s.alert}>{error}</Text> : null}
    </View>
  );
}
