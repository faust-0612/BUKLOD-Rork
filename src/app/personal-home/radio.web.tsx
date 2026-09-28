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
const DZAS_YOUTUBE_CHANNEL_ID = 'UCFYknqXTqheggqJ2JCPy28w';
const DZAS_YOUTUBE_PAGE_URL =
  'https://www.youtube.com/@702dzasfebcradyotv/live';
const DZAS_YOUTUBE_LIVE_EMBED =
  'https://www.youtube.com/embed/live_stream?channel=' +
  DZAS_YOUTUBE_CHANNEL_ID +
  '&autoplay=1&playsinline=1&rel=0';
const DZAS_FAVORITE_KEY = 'buklod.radio.favorite.702dzas';

/*
 * BUKLOD_DZAS_WEB_OFFICIAL_LIVE_R3
 *
 * The legacy Icecast endpoint currently fails in phone browsers with
 * "no supported source". Web/PWA therefore uses the official 702 DZAS
 * FEBC RadyoTV YouTube live player as the primary source. The direct audio
 * endpoint stays available as a secondary retry for future recovery.
 * Native APK/iOS remains on radio.tsx and is untouched.
 */
export default function BuklodRadioWebScreen() {
  const audioRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const [favorite, setFavorite] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('Ready');
  const [youtubeOpen, setYoutubeOpen] = useState(false);

  const streamLabel = useMemo(
    () => 'Official DZAS RadyoTV live',
    [],
  );

  useEffect(() => {
    mountedRef.current = true;

    void AsyncStorage.getItem(DZAS_FAVORITE_KEY).then((value) => {
      if (mountedRef.current) {
        setFavorite(value === '1');
      }
    });

    const AudioCtor =
      typeof window !== 'undefined'
        ? (window as any).Audio
        : null;

    const audio =
      typeof AudioCtor === 'function'
        ? new AudioCtor()
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
      setYoutubeOpen(true);
      setStatusText('Official DZAS live ready');

      setError(
        code
          ? `Direct audio unavailable (media error ${code}). Gamitin ang official DZAS live player sa ibaba.`
          : 'Direct audio unavailable. Gamitin ang official DZAS live player sa ibaba.',
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
        audio.getAttribute('src') !==
          DZAS_STREAM_URL;

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
      setYoutubeOpen(true);
      setStatusText('Official DZAS live ready');
      setError(
        message
          ? `${message} Gamitin ang official DZAS live player sa ibaba.`
          : 'Direct audio unavailable. Gamitin ang official DZAS live player sa ibaba.',
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

  const openOfficialYouTube = () => {
    void Linking.openURL(DZAS_YOUTUBE_PAGE_URL);
  };

  const startOfficialLive = () => {
    try {
      audioRef.current?.pause?.();
    } catch {
      // Direct stream may already be unavailable.
    }

    setPlaying(false);
    setBusy(false);
    setError('');
    setYoutubeOpen(true);
    setStatusText('Official DZAS live');
  };

  const youtubeFrame =
    youtubeOpen
      ? React.createElement(
          'iframe',
          {
            src: DZAS_YOUTUBE_LIVE_EMBED,
            title: '702 DZAS FEBC RadyoTV Live',
            allow:
              'autoplay; encrypted-media; picture-in-picture',
            allowFullScreen: true,
            style: {
              display: 'block',
              width: '100%',
              height: '100%',
              border: '0',
              backgroundColor: '#000000',
            },
          },
        )
      : null;

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
            Live Christian radio inside BUKLOD. Web/PWA uses the official 702 DZAS FEBC RadyoTV live source.
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
            accessibilityLabel="Open official DZAS live player"
            onPress={startOfficialLive}
            style={styles.primaryButton}
          >
            <MaterialCommunityIcons
              name="television-play"
              size={28}
              color="#FFFFFF"
            />

            <Text style={styles.primaryButtonText}>
              PLAY LIVE
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try direct DZAS audio stream"
            disabled={busy}
            onPress={() => void play(true)}
            style={[
              styles.secondaryButton,
              busy && styles.buttonDisabled,
            ]}
          >
            <MaterialCommunityIcons
              name="radio"
              size={20}
              color="#31543E"
            />

            <Text style={styles.secondaryButtonText}>
              TRY DIRECT AUDIO
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

        {youtubeOpen ? (
          <View style={styles.youtubeCard}>
            <View style={styles.youtubeHeader}>
              <MaterialCommunityIcons
                name="youtube"
                size={22}
                color="#B3261E"
              />
              <View style={styles.youtubeHeaderCopy}>
                <Text style={styles.youtubeTitle}>
                  Official 702 DZAS FEBC RadyoTV Live
                </Text>
                <Text style={styles.youtubeHint}>
                  Kung hindi mag-autoplay ang tunog, tap Play sa official player.
                </Text>
              </View>
            </View>

            <View style={styles.youtubeFrame}>
              {youtubeFrame}
            </View>

            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Open official DZAS YouTube live page"
              onPress={openOfficialYouTube}
              style={styles.youtubeLink}
            >
              <MaterialCommunityIcons
                name="youtube"
                size={18}
                color="#B3261E"
              />
              <Text style={styles.youtubeLinkText}>
                OPEN OFFICIAL DZAS YOUTUBE
              </Text>
            </Pressable>
          </View>
        ) : null}

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
              Official station website at listening information.
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
            Web/PWA official live mode
          </Text>

          <Text style={styles.noteText}>
            Sa web shortcut, ang primary live source ay official 702 DZAS FEBC RadyoTV. Ang direct Icecast audio ay secondary retry lamang habang unavailable ang lumang stream endpoint.
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
  youtubeCard: {
    borderRadius: 16,
    padding: 10,
    backgroundColor: '#F8FAF7',
    borderWidth: 1,
    borderColor: '#D8E1D7',
    gap: 10,
  },
  youtubeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  youtubeHeaderCopy: {
    flex: 1,
  },
  youtubeTitle: {
    color: '#1F3629',
    fontSize: 12,
    fontWeight: '900',
  },
  youtubeHint: {
    marginTop: 2,
    color: '#6B786F',
    fontSize: 9.5,
    lineHeight: 14,
    fontWeight: '600',
  },
  youtubeFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  youtubeLink: {
    minHeight: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#FFF1F0',
  },
  youtubeLinkText: {
    color: '#8F241F',
    fontSize: 10,
    fontWeight: '900',
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
