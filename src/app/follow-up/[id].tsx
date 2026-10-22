import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, SectionTitle, shared } from '@/components/UI';
import { colors } from '@/lib/theme';

type FollowUp = {
  id: string;
  leader_id: string;
  leader_name: string | null;
  group_id: string | null;
  group_name: string | null;
  reason: string;
  status: string;
  created_at: string;
  completed_at: string | null;
};

function statusLabel(status: string) {
  if (status === 'contacted') return 'Leader contacted you';
  if (status === 'awaiting_response') return 'Awaiting response';
  if (status === 'completed') return 'Completed';
  return 'Open';
}

export default function MemberFollowUpScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<FollowUp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  const load = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setErrorText('');

    const { data, error } = await supabase.rpc('get_my_follow_up', {
      p_follow_up_id: id,
    });

    if (error) {
      setErrorText(error.message);
      setLoading(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : null;

    if (!row) {
      setErrorText('This pastoral check-in is not available.');
      setLoading(false);
      return;
    }

    setItem(row);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading pastoral check-in...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[shared.content, styles.center]}>
        <Text style={shared.h1}>Pastoral Check-in</Text>
        <Text style={styles.error}>{errorText}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={shared.content}>
      <Text style={shared.h1}>Pastoral Check-in</Text>
      <Text style={styles.intro}>
        Your BUKLOD leader reached out as part of member care.
      </Text>

      <Card>
        <Text style={styles.label}>From</Text>
        <Text style={styles.value}>
          {item.leader_name || 'Your BUKLOD leader'}
        </Text>

        <Text style={styles.label}>BUKLOD Cluster</Text>
        <Text style={styles.value}>
          {item.group_name || 'BUKLOD'}
        </Text>

        <Text style={styles.label}>Status</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {statusLabel(item.status)}
          </Text>
        </View>
      </Card>

      <SectionTitle>MESSAGE / REASON</SectionTitle>

      <Card>
        <Text style={styles.reason}>{item.reason}</Text>
      </Card>

      <SectionTitle>CHECK-IN DETAILS</SectionTitle>

      <Card>
        <Text style={styles.label}>Opened</Text>
        <Text style={styles.value}>
          {new Date(item.created_at).toLocaleString()}
        </Text>

        {item.completed_at ? (
          <>
            <Text style={styles.label}>Completed</Text>
            <Text style={styles.value}>
              {new Date(item.completed_at).toLocaleString()}
            </Text>
          </>
        ) : null}
      </Card>

      <Text style={styles.privacy}>
        Internal pastoral notes and care records remain private to authorized
        ministry leaders.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  intro: {
    color: '#64748b',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 20,
  },
  label: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 2,
  },
  value: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  reason: {
    color: '#0f172a',
    fontSize: 16,
    lineHeight: 23,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  statusText: {
    color: '#166534',
    fontWeight: '900',
    fontSize: 12,
  },
  privacy: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    marginBottom: 20,
  },
  muted: {
    color: '#64748b',
  },
  error: {
    color: '#b91c1c',
    textAlign: 'center',
    marginTop: 12,
  },
});
