/* BUKLOD_DEVOTIONAL_POINTS_UI_R1 — read-only presentation. No award or mutation. */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type SubmissionState =
  | { kind: 'loading' }
  | { kind: 'not_submitted' }
  | { kind: 'unavailable' }
  | { kind: 'loaded'; status: string; note: string | null };

/** Actual validation is read from the user's own RLS-protected submission row. */
export default function BuklodDevotionalRewardStatus({ devotionalId }: { devotionalId: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<SubmissionState>({ kind: 'loading' });

  useFocusEffect(useCallback(() => {
    let mounted = true;
    if (!user?.id || !devotionalId) {
      setState({ kind: 'not_submitted' });
      return () => { mounted = false; };
    }
    setState({ kind: 'loading' });
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('devotional_reward_submissions')
          .select('status,admin_note')
          .eq('user_id', user.id)
          .eq('devotional_id', devotionalId)
          .maybeSingle();
        if (!mounted) return;
        if (error) {
          setState({ kind: 'unavailable' });
        } else if (!data) {
          setState({ kind: 'not_submitted' });
        } else {
          setState({
            kind: 'loaded',
            status: String(data.status ?? '').toLowerCase(),
            note: typeof data.admin_note === 'string' ? data.admin_note : null,
          });
        }
      } catch {
        if (mounted) setState({ kind: 'unavailable' });
      }
    })();
    return () => { mounted = false; };
  }, [devotionalId, user?.id]));

  let validation = 'Checking validation status…';
  let detail = 'Points are credited only after approval, never merely on submission.';
  if (state.kind === 'not_submitted') {
    validation = user?.id ? 'NOT YET SUBMITTED' : 'SIGN IN TO VIEW STATUS';
  } else if (state.kind === 'unavailable') {
    validation = 'STATUS UNAVAILABLE';
    detail = 'Could not verify validation. Check again when online.';
  } else if (state.kind === 'loaded') {
    if (state.status === 'approved') {
      validation = 'APPROVED';
      detail = 'See BUKLOD Points for the actual claim/credited state.';
    } else if (state.status === 'pending_admin') {
      validation = 'PENDING VALIDATION';
      detail = 'Waiting for the existing validation process; no points are granted by this screen.';
    } else if (state.status === 'rejected') {
      validation = 'NEEDS REVISION';
      detail = state.note?.trim() || 'Review the response and resubmit if needed.';
    } else {
      validation = `STATUS: ${state.status || 'UNKNOWN'}`;
      detail = 'This is the recorded validation state, not a points claim state.';
    }
  }

  return (
    <View style={{ marginTop: 12, marginBottom: 14, padding: 12, borderWidth: 1,
      borderColor: '#B7D6C2', borderRadius: 12, backgroundColor: '#F2F9F4' }}>
      <Text style={{ fontWeight: '800', color: '#17663C', fontSize: 15 }}>
        +12 points upon approval
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
        {state.kind === 'loading' ? <ActivityIndicator size="small" color="#17663C" /> : null}
        <Text style={{ marginLeft: state.kind === 'loading' ? 7 : 0,
          fontWeight: '700', color: '#203B2B' }}>Validation: {validation}</Text>
      </View>
      <Text style={{ color: '#4C6153', marginTop: 4, fontSize: 12 }}>{detail}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Open BUKLOD Points"
        onPress={() => router.push('/points')}
        style={{ alignSelf: 'flex-start', marginTop: 9, paddingVertical: 7, paddingHorizontal: 12,
          backgroundColor: '#17663C', borderRadius: 8 }}>
        <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>OPEN BUKLOD POINTS  →</Text>
      </Pressable>
    </View>
  );
}
