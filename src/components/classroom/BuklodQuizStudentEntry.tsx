import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '@/providers/AuthProvider';

const QUIZ_ENTRY_ENDPOINT =
  'https://cjtehbfspgimyhifnjon.supabase.co/functions/v1/buklod-quiz-main-entry-v1';

const QUIZ_PUBLISHABLE_KEY =
  'sb_publishable_06d3QBjV_26E8Rk9rS4GMw_SCJ6P8sO';

type QuizEntryPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  launch_url?: string;
  quiz_url?: string;
  one_time_code?: string | null;
};

export default function BuklodQuizStudentEntry() {
  const { session } = useAuth();
  const [opening, setOpening] = React.useState(false);
  const [fallbackCode, setFallbackCode] = React.useState<string | null>(null);
  const inFlight = React.useRef(false);

  const openQuiz = React.useCallback(async () => {
    if (inFlight.current || opening) return;

    const accessToken = session?.access_token;
    if (!accessToken) {
      Alert.alert(
        'BUKLOD session required',
        'Please sign in to BUKLOD Main again.',
      );
      return;
    }

    inFlight.current = true;
    setOpening(true);
    setFallbackCode(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(QUIZ_ENTRY_ENDPOINT, {
        method: 'POST',
        headers: {
          apikey: QUIZ_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source: 'buklod_main_my_classroom' }),
        signal: controller.signal,
      });

      const payload =
        (await response.json().catch(() => ({}))) as QuizEntryPayload;

      if (!response.ok || !payload.ok || !payload.launch_url) {
        if (
          response.status === 409 &&
          payload.error === 'entry_already_in_progress'
        ) {
          Alert.alert(
            'Quiz entry already in progress',
            'Tap only once. Your previous entry request is still being processed.',
          );
          return;
        }

        throw new Error(
          payload.message || 'BUKLOD Quiz entry could not be created.',
        );
      }

      try {
        await Linking.openURL(payload.launch_url);
      } catch (linkError) {
        if (payload.one_time_code) {
          setFallbackCode(String(payload.one_time_code));
        }

        if (payload.quiz_url) {
          await Linking.openURL(payload.quiz_url);
          return;
        }

        throw linkError;
      }
    } catch (error: any) {
      const timedOut =
        error?.name === 'AbortError' ||
        String(error?.message ?? '').toLowerCase().includes('abort');

      Alert.alert(
        timedOut ? 'Quiz entry timed out' : 'Cannot enter BUKLOD Quiz',
        timedOut
          ? 'No repeated request was sent. Check your connection, then tap Enter BUKLOD Quiz once.'
          : error?.message || 'Please check your connection and try once again.',
      );
    } finally {
      clearTimeout(timeoutId);
      inFlight.current = false;
      setOpening(false);
    }
  }, [opening, session?.access_token]);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons
            name="clipboard-text-clock-outline"
            size={25}
            color="#1f7a3f"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>LIVE EXAM</Text>
          <Text style={styles.title}>BUKLOD Quiz</Text>
          <Text style={styles.body}>
            Your signed-in BUKLOD Main account is your identity proof. Inside BUKLOD Quiz, enter the live class code given by your examiner.
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enter BUKLOD Quiz"
        disabled={opening}
        onPress={() => void openQuiz()}
        style={({ pressed }) => [
          styles.button,
          (pressed || opening) && styles.buttonPressed,
        ]}
      >
        {opening ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <MaterialCommunityIcons name="login-variant" size={20} color="#fff" />
        )}
        <Text style={styles.buttonText}>
          {opening ? 'VERIFYING MAIN SESSION...' : 'ENTER BUKLOD QUIZ'}
        </Text>
      </Pressable>

      <Text style={styles.notice}>
        One tap = one handoff request. No email/SMS OTP send, no Quiz password re-check, and no automatic retry loop.
      </Text>

      {fallbackCode ? (
        <View style={styles.fallback}>
          <Text style={styles.fallbackLabel}>ONE-TIME QUIZ CODE</Text>
          <Text selectable style={styles.fallbackCode}>{fallbackCode}</Text>
          <Text style={styles.fallbackHelp}>
            Use this only if the one-tap handoff could not open automatically.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#dfe8e1',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#e7f4e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#1f7a3f',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: '#203328',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  body: {
    color: '#6f7b72',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    marginTop: 14,
    backgroundColor: '#1f7a3f',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.25,
  },
  notice: {
    color: '#758078',
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 8,
  },
  fallback: {
    backgroundColor: '#eef7f0',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  fallbackLabel: {
    color: '#6f7b72',
    fontSize: 9,
    fontWeight: '900',
  },
  fallbackCode: {
    color: '#1f7a3f',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 4,
  },
  fallbackHelp: {
    color: '#758078',
    fontSize: 9.5,
    lineHeight: 14,
    marginTop: 4,
  },
});
