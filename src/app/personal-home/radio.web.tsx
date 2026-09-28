import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const DZAS_STREAM_URL = String(
  process.env.EXPO_PUBLIC_DZAS_STREAM_URL ||
    'https://sg-icecast.eradioportal.com:8443/febc_dzas',
).trim();

const DZAS_WEBSITE_URL = 'https://dzas.febc.ph';
const DZAS_FAVORITE_KEY = 'buklod.radio.favorite.702dzas';

/*
 * BUKLOD_DZAS_WEB_NATIVE_AUDIO_R2
 *
 * Web/PWA intentionally uses the browser's HTMLAudioElement for the raw
 * Icecast audio/mpeg stream. The shared radio.tsx remains the native APK/iOS
 * implementation with expo-audio.
 */
export default function BuklodRadioWebScreen() {
  const audioRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const [favorite, setFavorite] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('Ready');

  const streamLabel = useMemo(
    () => (DZAS_STREAM_URL ? 'Browser live stream' : 'Stream unavailable'),
    [],
  );

  useEffect(() => {
    mountedRef.current = true;

    void AsyncStorage.getItem(DZAS_FAVORITE_KEY).then((value) => {
      if (mountedRef.current) {
        setFavorite(value === '1');
      }
    });

    const audio =
      typeof window !== 'undefined' &&
      typeof window.Audio === 'function'
        ? new window.Audio()
        : null;

    if (!audio) {
      setError('Hindi available ang browser audio player sa device na ito.');
      return () => {
        mountedRef.current = false;
      };
    }

    audioRef.current = audio;
    audio.preload = 'none';
    audio.volume = 1;
    audio.muted = false;

    const onPlaying = () => {
      if (!mountedRef.current) return;
      setPlaying(true);
      setBusy(false);
      setError('');
      setStatusText('LIVE');
    };

    const onPause = () => {
      if (!mountedRef.current) return;
      setPlaying(false);
      setBusy(false);
      setStatusText('Paused');
    };

    const onWaiting = () => {
      if (!mountedRef.current) return;
      setBusy(true);
      setStatusText('Buffering...');
    };

    const onCanPlay = () => {
      if (!mountedRef.current) return;
      setStatusText(current =>
        current === 'LIVE' ? current : 'Connected',
      );
    };

    const onStalled = () => {
      if (!mountedRef.current) return;
      setBusy(true);
      setStatusText('Reconnecting...');
    };

    const onError = () => {
      if (!mountedRef.current) return;

      const mediaError = audio.error;
      const code = Number(mediaError?.code || 0);

      setPlaying(false);
      setBusy(false);
      setStatusText('Stream error');

      setError(
        code
          ? `Hindi ma-play ng browser ang DZAS stream ngayon (media error ${code}). Tap Retry.`
          : 'Hindi ma-play ng browser ang DZAS stream ngayon. Tap Retry.',
      );
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('error', onError);

    return () => {
      mountedRef.current = false;

      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('error', onError);

      try {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch {
        // Best-effort browser cleanup.
      }

      audioRef.current = null;
    };
  }, []);

  const setMediaSession = () => {
    try {
      const mediaSession =
        typeof navigator !== 'undefined'
          ? (navigator as any).mediaSession
          : null;

      const MediaMetadataCtor =
        typeof window !== 'undefined'
          ? (window as any).MediaMetadata
          : null;

      if (mediaSession && MediaMetadataCtor) {
        mediaSession.metadata =
          new MediaMetadataCtor({
            title: '702 DZAS',
            artist: 'FEBC Philippines',
            album: 'BUKLOD Radio Live',
          });
      }
    } catch {
      // Media Session metadata is optional.
    }
  };

  const play = async (forceReload = false) => {
    const audio = audioRef.current;

    if (!audio || !DZAS_STREAM_URL) {
      setError('Walang available DZAS browser stream.');
      return;
    }

    setBusy(true);
    setError('');
    setStatusText('Connecting...');

    try {
      /*
       * Keep play() directly inside the user-triggered action so Android/iOS
       * browser/PWA autoplay policies recognize this as an intentional start.
       */
      const needsSource =
        forceReload ||
        !audio.src ||
        !String(audio.src).includes('febc_dzas');

      if (needsSource) {
        try {
          audio.pause();
        } catch {
          // no-op
        }

        audio.src = DZAS_STREAM_URL;
        audio.preload = 'none';
        audio.volume = 1;
        audio.muted = false;
        audio.load();
      } else {
        audio.volume = 1;
        audio.muted = false;
      }

      setMediaSession();

      const promise = audio.play();

      if (
        promise &&
        typeof promise.then === 'function'
      ) {
        await promise;
      }

      if (mountedRef.current) {
        setPlaying(!audio.paused);
        setBusy(false);
        setStatusText(audio.paused ? 'Ready' : 'LIVE');
      }
    } catch (playError: any) {
      if (!mountedRef.current) return;

      const message = String(playError?.message || '').trim();

      setPlaying(false);
      setBusy(false);
      setStatusText('Could not play');
      setError(
        message ||
          'Hindi mabuksan ang DZAS audio stream. Tap Retry o buksan ang official DZAS site.',
      );
    }
  };

  const pause = () => {
    const audio = audioRef.current;

    if (!audio) return;

    try {
      audio.pause();
      setPlaying(false);
      setBusy(false);
      setStatusText('Paused');
    } catch {
      // no-op
    }
  };

  const toggleFavorite = () => {
    const next = !favorite;
    setFavorite(next);

    void AsyncStorage.setItem(
      DZAS_FAVORITE_KEY,
      next ? '1' : '0',
    );
  };

  const openOfficialSite = () => {
    void Linking.openURL(DZAS_WEBSITE_URL);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color="#244331"
          />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>
            BUKLOD RADIO
          </Text>

          <Text style={styles.title}>
            Makinig. Manatiling konektado.
          </Text>

          <Text style={styles.subtitle}>
            Live Christian radio inside BUKLOD. Tap Play to start the browser audio stream.
          </Text>
        </View>
      </View>

      <View style={styles.stationCard}>
        <View style={styles.stationTop}>
          <View style={styles.stationIcon}>
            <MaterialCommunityIcons
              name="radio-tower"
              size={34}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.stationCopy}>
            <View style={styles.liveRow}>
              <View
                style={[
                  styles.liveDot,
                  playing && styles.liveDotOn,
                ]}
              />

              <Text style={styles.liveText}>
                {playing ? 'LIVE' : statusText.toUpperCase()}
              </Text>

              <Text style={styles.frequency}>
                702 AM
              </Text>
            </View>

            <Text style={styles.stationName}>
              702 DZAS
            </Text>

            <Text style={styles.stationTagline}>
              Agapay ng Sambayanan
            </Text>

            <Text style={styles.stationMeta}>
              FEBC Philippines · {streamLabel}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              favorite
                ? 'Remove DZAS from favorites'
                : 'Add DZAS to favorites'
            }
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
            accessibilityLabel={
              playing
                ? 'Pause DZAS'
                : 'Play DZAS'
            }
            disabled={busy}
            onPress={() => {
              if (playing) {
                pause();
              } else {
                void play(false);
              }
            }}
            style={[
              styles.primaryButton,
              busy && styles.buttonDisabled,
            ]}
          >
            <MaterialCommunityIcons
              name={playing ? 'pause' : 'play'}
              size={28}
              color="#FFFFFF"
            />

            <Text style={styles.primaryButtonText}>
              {busy
                ? 'CONNECTING...'
                : playing
                  ? 'PAUSE'
                  : 'PLAY LIVE'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry DZAS live stream"
            disabled={busy}
            onPress={() => void play(true)}
            style={[
              styles.secondaryButton,
              busy && styles.buttonDisabled,
            ]}
          >
            <MaterialCommunityIcons
              name="refresh"
              size={20}
              color="#31543E"
            />

            <Text style={styles.secondaryButtonText}>
              RETRY
            </Text>
          </Pressable>
        </View>

        <View style={styles.statusBox}>
          <MaterialCommunityIcons
            name={
              playing
                ? 'volume-high'
                : busy
                  ? 'loading'
                  : 'volume-medium'
            }
            size={18}
            color="#31543E"
          />

          <Text style={styles.statusText}>
            {statusText}
          </Text>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={18}
              color="#8B3D32"
            />

            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open official DZAS website"
          onPress={openOfficialSite}
          style={styles.officialLink}
        >
          <MaterialCommunityIcons
            name="open-in-new"
            size={18}
            color="#31543E"
          />

          <View style={styles.linkCopy}>
            <Text style={styles.linkTitle}>
              Open official DZAS site
            </Text>

            <Text style={styles.linkSub}>
              Fallback kapag pansamantalang unavailable ang direct stream.
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.noteCard}>
        <MaterialCommunityIcons
          name="web"
          size={22}
          color="#31543E"
        />

        <View style={styles.noteCopy}>
          <Text style={styles.noteTitle}>
            Web/PWA audio mode
          </Text>

          <Text style={styles.noteText}>
            Sa web shortcut, BUKLOD uses the browser audio engine directly for the DZAS Icecast stream. Hindi nito nire-restream o nire-record ang station audio.
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
    backgroundColor: '#87948B',
  },
  liveDotOn: {
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
  statusBox: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5EF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    flex: 1,
    color: '#31543E',
    fontSize: 11,
    fontWeight: '800',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFF3F0',
  },
  errorText: {
    flex: 1,
    color: '#8B3D32',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
  },
  officialLink: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#F3F5EE',
    borderWidth: 1,
    borderColor: '#D8E1D7',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkCopy: {
    flex: 1,
  },
  linkTitle: {
    color: '#31543E',
    fontSize: 12,
    fontWeight: '900',
  },
  linkSub: {
    marginTop: 2,
    color: '#758179',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '600',
  },
  noteCard: {
    borderRadius: 18,
    backgroundColor: '#EAF1E8',
    borderWidth: 1,
    borderColor: '#D4E1D2',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
    marginTop: 3,
    color: '#607166',
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '600',
  },
});
