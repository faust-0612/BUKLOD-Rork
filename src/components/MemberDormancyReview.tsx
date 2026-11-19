import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';

type MyDormancyCase = {
  id: string;
  required_action: 'RECOVER_OR_CONFIRM' | 'IDENTITY_REVIEW' | 'SUPPORT_REVIEW';
  notice_at: string;
  status: string;
};

/** Sign-in itself is evidence of action, but this allows explicit immediate cancellation. */
export default function MemberDormancyReview() {
  const [review, setReview] = useState<MyDormancyCase | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let active = true;
    void supabase.rpc('buklod_my_dormancy_case_v1' as any)
      .then(({ data, error }) => {
        if (!active || error || !data || typeof data !== 'object') return;
        const value = data as unknown as MyDormancyCase;
        if (value.status === 'PENDING' && typeof value.id === 'string') setReview(value);
      });
    return () => { active = false; };
  }, []);

  if (!review) return null;
  return (
    <Card>
      <Text style={shared.h2}>Protect your BUKLOD account</Text>
      <Text style={shared.body}>
        Your account was flagged for a possible inactivity review. It has not been
        deleted. Confirm that you still use it; the verification and recovery
        services remain available when necessary.
      </Text>
      {review.required_action === 'IDENTITY_REVIEW' && (
        <Text style={shared.body}>
          Identity review may require a valid government ID and live selfie through
          BUKLOD's protected verification process. Never send these in public posts.
        </Text>
      )}
      {!!errorText && <Text accessibilityRole="alert" style={{ color: '#A34229' }}>{errorText}</Text>}
      <View style={{ marginTop: 8 }}>
        <Button
          title={busy ? 'CONFIRMING...' : 'I STILL USE THIS ACCOUNT'}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setErrorText('');
            try {
              const { error } = await supabase.rpc('buklod_my_dormancy_response_v1' as any, {
                p_case_id: review.id,
              });
              if (error) throw error;
              setReview(null);
              Alert.alert('Account protected', 'Your inactivity review has been cancelled.');
            } catch (err: any) {
              setErrorText(String(err?.message || 'Could not confirm. Please retry.'));
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </Card>
  );
}
