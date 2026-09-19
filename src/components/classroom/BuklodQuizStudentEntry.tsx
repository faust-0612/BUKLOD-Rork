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

import { openBuklodQuizFromMain } from '@/lib/buklodQuizEntry';

export default function BuklodQuizStudentEntry() {
  const [opening, setOpening] = React.useState(false);
  const inFlight = React.useRef(false);

  const openQuiz = React.useCallback(async () => {
    if (inFlight.current || opening) return;

    inFlight.current = true;
    setOpening(true);

    try {
      /*
       * BUKLOD_QUIZ_UNIFIED_MAIN_ENTRY_R21
       * Do not open the bare Quiz URL and do not place Main credentials in the
       * address bar. The shared launcher validates/refreshes Main once, mints
       * the one-time Quiz handoff, then opens the dedicated Quiz session.
       */
      await openBuklodQuizFromMain({
        source: 'buklod-main-classroom-student',
      });
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
  }, [opening]);

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
            Your signed-in BUKLOD Main account is your identity proof. Open Quiz
            directly, then enter only the live class code given by your examiner.
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
        Secure one-time Main-to-Quiz handoff. Your Main refresh token is never
        passed to the Quiz app, and no second password or OTP entry is required.
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
