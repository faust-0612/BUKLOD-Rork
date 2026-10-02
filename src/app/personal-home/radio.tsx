import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  setIsAudioActiveAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';

import { configurePreachingAudioMode } from '@/lib/preachingAudio';

const DZAS_STREAM_URL =
  'https://sg-icecast.eradioportal.com:8443/febc_dzas';

const DZAS_WEBSITE_URL = 'https://dzas.febc.ph';
const DZAS_FAVORITE_KEY = 'buklod.radio.favorite.702dzas';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export default function BuklodRadioScreen() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState('');
  const [error, setError] = useState('');

  const playing = Boolean(status?.playing);

  useEffect(() => {
    let mounted = true;

    void AsyncStorage.getItem(DZAS_FAVORITE_KEY).then((value) => {
      if (mounted) setFavorite(value === '1');
    });

    return () => {
      mounted = false;
      try {
        player.pause();
        player.setActiveForLockScreen(false);
      } catch {
        // Player may already be released.
      }
    };
  }, [player]);

  const streamLabel = useMemo(
    () => (DZAS_STREAM_URL ? 'Internet live stream' : 'Stream unavailable'),
    [],
  );

  const waitUntilLoaded = async () => {
    const startedAt = Date.now();

    while (!player.isLoaded && Date.now() - startedAt < 7000) {
      await sleep(120);
    }
  };

  const activateMediaControls = () => {
    try {
      player.setActiveForLockScreen(
        true,
        {
          title: '702 DZAS',
          artist: 'FEBC Philippines',
          albumTitle: 'BUKLOD Radio · Live',
        },
        {
          isLiveStream: true,
          showSeekBackward: false,
          showSeekForward: false,
        },
      );
    } catch {
      // Lock-screen controls are an enhancement; playback remains primary.
    }
  };

  const play = async (forceReload = false) => {
    if (!DZAS_STREAM_URL) {
      setError('Walang configured DZAS stream URL.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await setIsAudioActiveAsync(true);
      await configurePreachingAudioMode();

      if (forceReload || loadedUrl !== DZAS_STREAM_URL || !player.isLoaded) {
        try {
          player.pause();
        } catch {
          // no-op
        }

        player.replace(DZAS_STREAM_URL);
        setLoadedUrl(DZAS_STREAM_URL);
        await waitUntilLoaded();
      }

      player.volume = 1;
      activateMediaControls();
      player.play();
    } catch (playError: any) {
      const message = String(playError?.message || '').trim();
      setError(
        message ||
          'Hindi mabuksan ang DZAS stream ngayon. Pindutin ang Retry o buksan ang official DZAS site.',
      );
    } finally {
      setBusy(false);
    }
  };

  const pause = () => {
    try {
      player.pause();
    } catch {
      // no-op
    }
  };

  const toggleFavorite = () => {
    const next = !favorite;
    setFavorite(next);
    void AsyncStorage.setItem(DZAS_FAVORITE_KEY, next ? '1' : '0');
  };

  const openOfficialSite = () => {
    void Linking.openURL(DZAS_WEBSITE_URL);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#244331" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD RADIO</Text>
          <Text style={styles.title}>Makinig. Manatiling konektado.</Text>
          <Text style={styles.subtitle}>
            Live Christian radio inside BUKLOD. Playback starts only when you tap Play.
          </Text>
        </View>
      </View>

      <View style={styles.stationCard}>
        <View style={styles.stationTop}>
          <View style={styles.stationIcon}>
            <MaterialCommunityIcons name="radio-tower" size={34} color="#FFFFFF" />
          </View>
          <View style={styles.stationCopy}>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
              <Text style={styles.frequency}>702 AM</Text>
            </View>
            <Text style={styles.stationName}>702 DZAS</Text>
            <Text style={styles.stationTagline}>Agapay ng Sambayanan</Text>
            <Text style={styles.stationMeta}>FEBC Philippines · {streamLabel}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={favorite ? 'Remove DZAS from favorites' : 'Add DZAS to favorites'}
            onPress={toggleFavorite}
            style={styles.favoriteButton}
          >
            <MaterialCommunityIcons
              name={favorite ? 'heart' : 'heart-outline'}
              size={24}
              color={favorite ? '#A73C46' : '#31543E'}
            />
          </Pressable>
        </View>

        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause DZAS' : 'Play DZAS'}
            disabled={busy}
            onPress={() => {
              if (playing) pause();
              else void play(false);
            }}
            style={[styles.primaryButton, busy && styles.buttonDisabled]}
          >
            <MaterialCommunityIcons
              name={playing ? 'pause' : 'play'}
              size={28}
              color="#FFFFFF"
            />
            <Text style={styles.primaryButtonText}>
              {busy ? 'CONNECTING…' : playing ? 'PAUSE' : 'PLAY LIVE'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry DZAS live stream"
            disabled={busy}
            onPress={() => void play(true)}
            style={[styles.secondaryButton, busy && styles.buttonDisabled]}
          >
            <MaterialCommunityIcons name="refresh" size={20} color="#31543E" />
            <Text style={styles.secondaryButtonText}>RETRY</Text>
          </Pressable>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#8B3D32" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open official DZAS website"
          onPress={openOfficialSite}
          style={styles.officialLink}
        >
          <MaterialCommunityIcons name="open-in-new" size={18} color="#31543E" />
          <View style={styles.linkCopy}>
            <Text style={styles.linkTitle}>Open official DZAS site</Text>
            <Text style={styles.linkSub}>
              Fallback kapag pansamantalang unavailable ang in-app live stream.
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.noteCard}>
        <MaterialCommunityIcons name="shield-check-outline" size={22} color="#31543E" />
        <View style={styles.noteCopy}>
          <Text style={styles.noteTitle}>BUKLOD Radio source policy</Text>
          <Text style={styles.noteText}>
            BUKLOD does not record or restream DZAS through its own server. The player connects
            directly to the configured station stream, and the URL can be changed through
            EXPO_PUBLIC_DZAS_STREAM_URL without changing this screen.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F5EE',
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 18,
    paddingBottom: 42,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E1D7',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: '#4E7D5B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 4,
    color: '#1F3629',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 5,
    color: '#6B786F',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  stationCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E1D7',
    gap: 18,
  },
  stationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  stationIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4E7D5B',
  },
  stationCopy: {
    flex: 1,
    minWidth: 0,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#B33A3A',
  },
  liveText: {
    color: '#B33A3A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  frequency: {
    color: '#6B786F',
    fontSize: 10,
    fontWeight: '800',
  },
  stationName: {
    marginTop: 3,
    color: '#1F3629',
    fontSize: 22,
    fontWeight: '900',
  },
  stationTagline: {
    marginTop: 1,
    color: '#31543E',
    fontSize: 13,
    fontWeight: '800',
  },
  stationMeta: {
    marginTop: 3,
    color: '#7A877E',
    fontSize: 10,
    fontWeight: '700',
  },
  favoriteButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F5EE',
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    flexGrow: 1,
    minWidth: 190,
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#31543E',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  secondaryButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#EDF3EC',
    borderWidth: 1,
    borderColor: '#D8E1D7',
  },
  secondaryButtonText: {
    color: '#31543E',
    fontSize: 12,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.58,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFF3F0',
    borderWidth: 1,
    borderColor: '#F0CEC8',
  },
  errorText: {
    flex: 1,
    color: '#8B3D32',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  officialLink: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7F8F4',
    borderWidth: 1,
    borderColor: '#E1E7DF',
  },
  linkCopy: {
    flex: 1,
    minWidth: 0,
  },
  linkTitle: {
    color: '#31543E',
    fontSize: 12,
    fontWeight: '900',
  },
  linkSub: {
    marginTop: 2,
    color: '#7A877E',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  noteCard: {
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EAF1E8',
    borderWidth: 1,
    borderColor: '#D5E0D3',
  },
  noteCopy: {
    flex: 1,
  },
  noteTitle: {
    color: '#31543E',
    fontSize: 12,
    fontWeight: '900',
  },
  noteText: {
    marginTop: 4,
    color: '#617065',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
  },
});
