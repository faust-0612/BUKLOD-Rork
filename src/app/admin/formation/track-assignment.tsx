import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { assignFormationRoleTrack } from '@/lib/buklodFormationProgress';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type RoleTrack = {
  id: string;
  track_code: string;
  title_en: string;
  title_fil: string;
  is_active: boolean;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default function AdminFormationTrackAssignmentScreen() {
  const { hasRole } = useAuth();
  const canAssign = hasRole('system_admin') || hasRole('pastor');

  const [tracks, setTracks] = useState<RoleTrack[]>([]);
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!canAssign) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [{ data: trackRows }, { data: profileRows }] = await Promise.all([
      supabase
        .from('buklod_formation_role_tracks')
        .select('id, track_code, title_en, title_fil, is_active')
        .eq('is_active', true)
        .order('track_code'),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name')
        .limit(200),
    ]);

    setTracks((trackRows ?? []) as RoleTrack[]);
    setMembers((profileRows ?? []) as ProfileRow[]);
    setLoading(false);
  }, [canAssign]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = members.filter((m) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (m.full_name ?? '').toLowerCase().includes(q) ||
      (m.email ?? '').toLowerCase().includes(q)
    );
  });

  const assign = async () => {
    if (!selectedMemberId || !selectedTrackId) {
      return Alert.alert('Assign Track', 'Select a member and formation track.');
    }

    setBusy(true);
    try {
      await assignFormationRoleTrack({
        memberId: selectedMemberId,
        roleTrackId: selectedTrackId,
        validationNote: note.trim() || null,
      });

      Alert.alert(
        'Track Assigned',
        'Formation track assignment recorded. Previous assignments are preserved in history.',
      );
      setNote('');
    } catch (e: unknown) {
      Alert.alert(
        'Assignment failed',
        e instanceof Error ? e.message : 'Not authorized or invalid selection.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!canAssign) {
    return (
      <View style={[shared.screen, shared.content]}>
        <Text style={shared.h1}>Assign Formation Track</Text>
        <Card>
          <Text>Pastor or System Admin access is required.</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={shared.screen} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>BUKLOD 106</Text>
        <Text style={shared.h1}>Assign Formation Track</Text>
        <Text style={shared.muted}>
          Members cannot self-certify a ministry role. Assign the validated formation track
          for Kamanggagawa (106).
        </Text>

        {loading && <ActivityIndicator color={colors.green} />}

        <TextInput
          style={styles.search}
          placeholder="Search member..."
          value={search}
          onChangeText={setSearch}
        />

        <SectionTitle>MEMBER</SectionTitle>
        {filtered.slice(0, 12).map((member) => (
          <Button
            key={member.id}
            title={`${member.full_name ?? 'Member'} · ${member.email ?? member.id.slice(0, 8)}`}
            onPress={() => setSelectedMemberId(member.id)}
          />
        ))}

        <SectionTitle>FORMATION TRACK</SectionTitle>
        {tracks.map((track) => (
          <Button
            key={track.id}
            title={`${track.title_en} (${track.track_code})`}
            onPress={() => setSelectedTrackId(track.id)}
          />
        ))}

        <SectionTitle>NOTE (OPTIONAL)</SectionTitle>
        <TextInput
          style={styles.note}
          multiline
          value={note}
          onChangeText={setNote}
          placeholder="Assignment note..."
        />

        <Card>
          <Text style={shared.muted}>
            Selected member: {selectedMemberId ? selectedMemberId.slice(0, 8) : '—'}
          </Text>
          <Text style={shared.muted}>
            Selected track:{' '}
            {tracks.find((t) => t.id === selectedTrackId)?.title_en ?? '—'}
          </Text>
        </Card>

        <Button
          title={busy ? 'ASSIGNING...' : 'ASSIGN FORMATION TRACK'}
          onPress={assign}
        />
      </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 48 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
    marginBottom: 4,
  },
  search: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.white,
  },
  note: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: colors.white,
  },
});
