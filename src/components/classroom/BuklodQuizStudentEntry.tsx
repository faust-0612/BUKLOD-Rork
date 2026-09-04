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

const QUIZ_WEB_URL = 'https://buklod-quiz.expo.app';

function buildQuizSessionUrl(input: {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number | null;
}) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt =
    typeof input.expiresAt === 'number' && input.expiresAt > nowSeconds
      ? Math.floor(input.expiresAt)
      : nowSeconds + 3600;
  const expiresIn = Math.max(1, expiresAt - nowSeconds);

  // BUKLOD Quiz R12+/R14 uses the same BUKLOD Connect Supabase project.
  // Send the central session directly to the Quiz login route instead of the
  // site root. The root route can redirect unauthenticated visitors to /login;
  // that redirect may discard the URL fragment before Supabase can consume it.
  // A URL fragment is not sent to the Expo hosting server in the HTTP request.
  const fragment = [
    `access_token=${encodeURIComponent(input.accessToken)}`,
    `refresh_token=${encodeURIComponent(input.refreshToken)}`,
    `expires_in=${expiresIn}`,
    `expires_at=${expiresAt}`,
    'token_type=bearer',
    'buklod_handoff=classroom',
  ].join('&');

  return `${QUIZ_WEB_URL}/login#${fragment}`;
}

export default function BuklodQuizStudentEntry() {
  const { session } = useAuth();
  const [opening, setOpening] = React.useState(false);
  const inFlight = React.useRef(false);

  const openQuiz = React.useCallback(async () => {
    if (inFlight.current || opening) return;

    const accessToken = session?.access_token;
    const refreshToken = session?.refresh_token;

    if (!accessToken || !refreshToken) {
      Alert.alert(
        'BUKLOD session required',
        'Please sign in to BUKLOD Main again before opening BUKLOD Quiz.',
      );
      return;
    }

    inFlight.current = true;
    setOpening(true);

    try {
      const launchUrl = buildQuizSessionUrl({
        accessToken,
        refreshToken,
        expiresAt: session?.expires_at,
      });

      await Linking.openURL(launchUrl);
    } catch (error: any) {
      Alert.alert(
        'Cannot open BUKLOD Quiz',
        error?.message ||
          'The Quiz page could not be opened. Check your connection, then tap once again.',
      );
    } finally {
      inFlight.current = false;
      setOpening(false);
    }
  }, [opening, session?.access_token, session?.expires_at, session?.refresh_token]);

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
            Your signed-in BUKLOD Main account is already your identity proof.
            Open Quiz directly, then enter only the live class code given by your examiner.
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
          {opening ? 'OPENING BUKLOD QUIZ...' : 'ENTER BUKLOD QUIZ'}
        </Text>
      </Pressable>

      <Text style={styles.notice}>
        Direct central-session handoff. No email/SMS OTP, no one-time-code request,
        no second password check, and no automatic retry loop.
      </Text>
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
});
