import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { configurePreachingAudioMode } from '@/lib/preachingAudio';

const DZAS_STREAM_URL =
  'https://sg-icecast.eradioportal.com:8443/febc_dzas';

const DZAS_WEBSITE_URL =
  'https://dzas.febc.ph/';

const RADIO_GARDEN_URL =
  'https://radio.garden/';

export default function PersonalHomeRadioScreen() {
  const [error, setError] = useState('');

  const player = useAudioPlayer(
    DZAS_STREAM_URL,
    {
      updateInterval: 1000,
    }
  );

  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    void configurePreachingAudioMode()
      .catch((audioError) => {
        console.warn(
          'BUKLOD Radio audio configuration:',
          audioError
        );
      });

    return () => {
      try {
        player.setActiveForLockScreen(false);
      } catch {
        // Player may already be released.
      }
    };
  }, [player]);

  const activateLockScreen = () => {
    try {
      player.setActiveForLockScreen(
        true,
        {
          title: '702 DZAS',
          artist: 'FEBC Philippines',
          albumTitle: 'BUKLOD Radio',
        },
        {
          showSeekBackward: false,
          showSeekForward: false,
        }
      );
    } catch {
      // Lock-screen metadata is best-effort on unsupported platforms.
    }
  };

  const togglePlayback = async () => {
    setError('');

    if (status.playing) {
      player.pause();
      return;
    }

    try {
      await configurePreachingAudioMode();
      activateLockScreen();
      player.play();
    } catch (playError) {
      console.warn(
        'BUKLOD Radio DZAS playback:',
        playError
      );
      setError(
        'Hindi ma-play ang DZAS stream ngayon. Subukan ang Official DZAS o Radio Garden.'
      );
    }
  };

  const openUrl = async (url: string) => {
    setError('');

    try {
      await Linking.openURL(url);
    } catch {
      setError(
        'Hindi mabuksan ang link sa device na ito.'
      );
    }
  };

  const liveLabel = status.playing
    ? 'LIVE • Playing'
    : status.isLoaded
      ? 'Ready to listen'
      : 'Connecting when you press play';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={23}
            color="#234434"
          />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.title}>
            BUKLOD Radio
          </Text>
          <Text style={styles.subtitle}>
            Makinig sa live Christian radio nang hindi umaalis sa BUKLOD.
          </Text>
        </View>
      </View>

      {error ? (
        <Text style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.stationCard}>
        <View style={styles.stationTop}>
          <View style={styles.stationIcon}>
            <MaterialCommunityIcons
              name="radio"
              size={34}
              color="#2D6B4F"
            />
          </View>

          <View style={styles.stationCopy}>
            <Text style={styles.stationName}>
              702 DZAS
            </Text>
            <Text style={styles.stationMeta}>
              Agapay ng Sambayanan • FEBC Philippines
            </Text>
          </View>

          <View
            style={[
              styles.livePill,
              status.playing && styles.livePillOn,
            ]}
          >
            <View
              style={[
                styles.liveDot,
                status.playing && styles.liveDotOn,
              ]}
            />
            <Text
              style={[
                styles.liveText,
                status.playing && styles.liveTextOn,
              ]}
            >
              {status.playing ? 'LIVE' : 'RADIO'}
            </Text>
          </View>
        </View>

        <Text style={styles.nowText}>
          {liveLabel}
        </Text>

        <Pressable
          onPress={() => {
            void togglePlayback();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            status.playing
              ? 'Pause 702 DZAS'
              : 'Play 702 DZAS live'
          }
        >
          <MaterialCommunityIcons
            name={
              status.playing
                ? 'pause'
                : 'play'
            }
            size={25}
            color="#FFFFFF"
          />
          <Text style={styles.primaryText}>
            {status.playing
              ? 'I-pause'
              : 'Makinig Live'}
          </Text>
        </Pressable>

        <Text style={styles.note}>
          Live stream availability depends on the station/stream provider and your internet connection.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          More ways to listen
        </Text>

        <Pressable
          onPress={() => {
            void openUrl(DZAS_WEBSITE_URL);
          }}
          style={({ pressed }) => [
            styles.linkCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.linkIcon}>
            <MaterialCommunityIcons
              name="web"
              size={22}
              color="#2D6B4F"
            />
          </View>
          <View style={styles.linkCopy}>
            <Text style={styles.linkTitle}>
              Official DZAS
            </Text>
            <Text style={styles.linkSub}>
              Open the official 702 DZAS website.
            </Text>
          </View>
          <MaterialCommunityIcons
            name="open-in-new"
            size={18}
            color="#718077"
          />
        </Pressable>

        <Pressable
          onPress={() => {
            void openUrl(RADIO_GARDEN_URL);
          }}
          style={({ pressed }) => [
            styles.linkCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.linkIcon}>
            <MaterialCommunityIcons
              name="earth"
              size={22}
              color="#2D6B4F"
            />
          </View>
          <View style={styles.linkCopy}>
            <Text style={styles.linkTitle}>
              More radio stations
            </Text>
            <Text style={styles.linkSub}>
              Discover other live stations through Radio Garden.
            </Text>
          </View>
          <MaterialCommunityIcons
            name="open-in-new"
            size={18}
            color="#718077"
          />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F0E6',
  },
  content: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    padding: 16,
    paddingBottom: 42,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  headerCopy: {
    flex: 1,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D6D7CB',
  },
  title: {
    fontSize: 23,
    fontWeight: '900',
    color: '#22382C',
  },
  subtitle: {
    marginTop: 3,
    color: '#66756A',
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFF2EF',
    color: '#9B4038',
    fontWeight: '700',
  },
  stationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DADBCF',
    padding: 18,
  },
  stationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stationIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#EAF3EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationCopy: {
    flex: 1,
  },
  stationName: {
    fontSize: 21,
    fontWeight: '900',
    color: '#243C2E',
  },
  stationMeta: {
    marginTop: 3,
    color: '#68766D',
    fontSize: 12,
    lineHeight: 17,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#EEF1ED',
  },
  livePillOn: {
    backgroundColor: '#E7F5EA',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#8B9790',
  },
  liveDotOn: {
    backgroundColor: '#2D6B4F',
  },
  liveText: {
    color: '#718077',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  liveTextOn: {
    color: '#2D6B4F',
  },
  nowText: {
    marginTop: 18,
    color: '#5F6F65',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#2D6B4F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  note: {
    marginTop: 11,
    color: '#7B857F',
    fontSize: 10.5,
    lineHeight: 15,
  },
  section: {
    marginTop: 18,
    gap: 10,
  },
  sectionTitle: {
    color: '#31483A',
    fontSize: 14,
    fontWeight: '900',
  },
  linkCard: {
    minHeight: 76,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#DADBCF',
    backgroundColor: '#FFFFFF',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  linkIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EEF4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCopy: {
    flex: 1,
  },
  linkTitle: {
    color: '#2D4234',
    fontSize: 13,
    fontWeight: '900',
  },
  linkSub: {
    marginTop: 2,
    color: '#718077',
    fontSize: 10.5,
    lineHeight: 15,
  },
  pressed: {
    opacity: 0.72,
  },
});
