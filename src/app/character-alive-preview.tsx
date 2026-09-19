import React from 'react';

import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodAiTalkingPortrait
  from '@/components/character/BuklodAiTalkingPortrait';

import {
  useAuth,
} from '@/providers/AuthProvider';

const PHAN_SOURCE_URL =
  'https://buklod.expo.app/assets/images/characters/phan_r26.1d7b0bb56aafa03b0f1d2a67f7367985.jpg';

export default function CharacterAlivePreview() {
  const { session } = useAuth();

  return (
    <ScrollView
      contentContainerStyle={styles.page}
    >
      <Text style={styles.eyebrow}>
        BUKLOD AI CHARACTER LAB
      </Text>
      <Text style={styles.title}>
        Phan — Alive Portrait
      </Text>
      <Text style={styles.copy}>
        Flat character artwork is sent to the server-side character animator.
        The generated talking portrait is then played with the existing Expo
        video runtime. The provider API key never ships inside the app.
      </Text>

      <View style={styles.stageWrap}>
        <BuklodAiTalkingPortrait
          sourceUrl={PHAN_SOURCE_URL}
          fallbackImage={require('../../assets/images/characters/phan_r26.jpg')}
          accessToken={session?.access_token ?? null}
          defaultText="Hello! Ako si Phan. Welcome sa BUKLOD!"
          width={260}
          height={340}
        />
      </View>

      <Text style={styles.note}>
        Requires the Supabase function buklod-character-alive and secret
        DID_API_KEY. Until those are configured, the original flat image stays
        visible and safe as fallback.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 60,
    alignItems: 'center',
    backgroundColor: '#f6f7fb',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#64748b',
  },
  title: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
  },
  copy: {
    width: '100%',
    maxWidth: 620,
    marginTop: 10,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
  },
  stageWrap: {
    marginTop: 24,
  },
  note: {
    width: '100%',
    maxWidth: 620,
    marginTop: 20,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: '#64748b',
  },
});
