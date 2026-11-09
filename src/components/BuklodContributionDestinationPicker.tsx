import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type Destination = { id: string; name: string; scope_type: 'CLUSTER' | 'ORGANIZATION'; parent_scope_id: string | null };
type Props = {
  userId: string;
  selectedScopeId: string | null;
  lockedUntil: string | null;
  eligibleToSelect: boolean;
  onChanged: () => void;
};

export default function BuklodContributionDestinationPicker({
  userId, selectedScopeId, lockedUntil, eligibleToSelect, onChanged,
}: Props) {
  const generation = useRef(0);
  const savingRef = useRef(false);
  const [choices, setChoices] = useState<Destination[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reloadEpoch, setReloadEpoch] = useState(0);
  const lockActive = !!(selectedScopeId && lockedUntil && Date.parse(lockedUntil) > Date.now());

  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError('');
    try {
      // Query only this member's active memberships; final entitlement is
      // rechecked server-side by set_my_buklod_community_destination_v3.
      const member = await supabase.from('buklod_scope_memberships')
        .select('scope_id').eq('user_id', userId)
        .eq('membership_status', 'ACTIVE').is('left_at', null).limit(250);
      if (member.error) throw member.error;
      const ids = Array.from(new Set((member.data ?? []).map(row => row.scope_id).filter(Boolean)));
      if (ids.length === 0) {
        if (request === generation.current) setChoices([]);
        return;
      }
      const scopes = await supabase.from('buklod_scopes')
        .select('id,name,scope_type,parent_scope_id,status')
        .in('id', ids).eq('status', 'ACTIVE')
        .in('scope_type', ['CLUSTER', 'ORGANIZATION']);
      if (scopes.error) throw scopes.error;
      if (request !== generation.current) return;
      setChoices((scopes.data ?? []).filter(row =>
        row.scope_type === 'CLUSTER' || (row.scope_type === 'ORGANIZATION' && !row.parent_scope_id)
      ).map(row => ({ id: row.id, name: row.name, scope_type: row.scope_type as Destination['scope_type'], parent_scope_id: row.parent_scope_id }))
        .sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      if (request === generation.current) {
        setChoices([]);
        setError('Could not load your eligible communities. Please retry.');
      }
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setChoices([]);
    setPendingId(null);
    void reload();
    return () => { ++generation.current; };
  }, [reload, reloadEpoch]);

  const save = useCallback(async () => {
    if (savingRef.current || !eligibleToSelect || lockActive || !pendingId || pendingId === selectedScopeId
      || !choices.some(item => item.id === pendingId)) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await (supabase as any).rpc('set_my_buklod_community_destination_v3', { p_scope_id: pendingId });
      if (result.error || result.data?.scope_id !== pendingId) {
        throw result.error ?? new Error('Destination could not be verified.');
      }
      setPendingId(null);
      onChanged();
    } catch (nextError: any) {
      setError(String(nextError?.message ?? 'Unable to save destination. No change was made.'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [choices, eligibleToSelect, lockActive, pendingId, selectedScopeId, onChanged]);

  return (
    <View style={s.shell}>
      <Text style={s.heading}>CHOOSE MY CONTRIBUTION DESTINATION</Text>
      <Text style={s.note}>Select one eligible Organization or Cluster you are an active member of. This directs future community-fund allocation only; your personal earnings are separate.</Text>
      {selectedScopeId ? <Text style={s.current}>Active destination is shown above. {lockActive ? 'Switching is locked until ' + new Date(lockedUntil as string).toLocaleDateString() + '.' : 'You can choose another eligible community.'}</Text>
        : <Text style={s.current}>No community destination selected yet.</Text>}
      {!eligibleToSelect ? <Text style={s.error}>Community destination selection requires an eligible, active earnings account.</Text> : null}
      {loading ? <Text style={s.note}>Loading your joined communities…</Text> : null}
      {!loading && !error && choices.length === 0 ? (
        <Text style={s.note}>No eligible active Cluster or root Organization membership found.</Text>
      ) : null}
      {choices.map(item => {
        const current = item.id === selectedScopeId;
        const chosen = item.id === pendingId;
        return (
          <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Select ' + item.name}
            disabled={saving || (lockActive && !current) || !eligibleToSelect}
            onPress={() => setPendingId(item.id)}
            style={[s.choice, (chosen || current) && s.selected, (saving || (lockActive && !current) || !eligibleToSelect) && s.disabled]}>
            <MaterialCommunityIcons name={chosen || current ? 'radiobox-marked' : 'radiobox-blank'}
              size={21} color="#276448" />
            <View style={s.textCol}>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.type}>{item.scope_type === 'CLUSTER' ? 'Cluster' : 'Organization'}{current ? ' · Current destination' : ''}</Text>
            </View>
          </Pressable>
        );
      })}
      {error ? <Text style={s.error}>{error}</Text> : null}
      {error ? <Pressable accessibilityRole="button" onPress={() => setReloadEpoch(i => i + 1)}><Text style={s.retry}>RETRY COMMUNITY LIST</Text></Pressable> : null}
      {pendingId && pendingId !== selectedScopeId && !lockActive ? (
        <>
          <Text style={s.note}>Confirm this choice. Changing the destination may lock further changes for 30 days. Past finalized allocations are not moved.</Text>
          <Pressable accessibilityRole="button" disabled={saving || !eligibleToSelect}
            onPress={() => void save()} style={[s.save, saving && s.disabled]}>
            <Text style={s.saveText}>{saving ? 'SAVING…' : 'CONFIRM CONTRIBUTION DESTINATION'}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  shell: { marginTop: 13, padding: 12, borderWidth: 1, borderRadius: 13, borderColor: '#D0DED4', gap: 9, backgroundColor: '#F7FAF8' },
  heading: { color: '#22533B', fontSize: 13, fontWeight: '900' },
  note: { fontSize: 11, lineHeight: 17, color: '#526A5E' },
  current: { fontSize: 11, fontWeight: '800', color: '#245A3E' },
  choice: { padding: 10, borderColor: '#DAE4DC', borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF' },
  selected: { borderColor: '#2A754C', backgroundColor: '#EAF5ED' },
  disabled: { opacity: 0.5 },
  textCol: { flex: 1 },
  name: { color: '#204B36', fontSize: 13, fontWeight: '800' },
  type: { color: '#6A8073', fontSize: 10 },
  error: { color: '#A23D30', fontSize: 11, lineHeight: 17 },
  retry: { color: '#216842', fontWeight: '800', fontSize: 11 },
  save: { borderRadius: 10, backgroundColor: '#1F6A44', padding: 13, alignItems: 'center' },
  saveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
});
