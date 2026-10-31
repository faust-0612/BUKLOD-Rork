import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAudioPlayerStatus } from 'expo-audio';

import {
  getDzasPlayer,
  pauseDzasRadio,
  playDzasRadio,
} from '@/lib/buklodDzasRadio';
import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import { DZAS_LOGO_IMAGE, DZAS_PORTRAIT_IMAGE } from '@/assets/dzasImages';

const DZAS_WEBSITE_URL =
  'https://listenonlineradio.com/ph/702-dzas-febc-radio';
const DZAS_FAVORITE_KEY = 'buklod.radio.favorite.702dzas';

export default function BuklodRadioScreen() {
  const player = useMemo(() => getDzasPlayer(), []);
  const status = useAudioPlayerStatus(player);

  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const playing = Boolean(status?.playing);

  useEffect(() => {
    let mounted = true;

    void AsyncStorage.getItem(DZAS_FAVORITE_KEY).then((value) => {
      if (mounted) setFavorite(value === '1');
    });

    return () => {
      mounted = false;
    };
  }, []);

  const play = async (forceReload = false) => {
    setBusy(true);
    setError('');

    try {
      await playDzasRadio(forceReload);
    } catch (playError: any) {
      const message =
        String(
          playError?.message ??
          ''
        ).trim();

      setError(
        message ||
          'Hindi mabuksan ang DZAS stream ngayon.'
      );
    } finally {
      setBusy(false);
    }
  };

  const pause = () => {
    pauseDzasRadio();
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
    void Linking.openURL(
      DZAS_WEBSITE_URL
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* BUKLOD_RADIO_ADMOB_R1 */}
      <View style={{ flex: 1 }}>
        <View style={styles.screen}>
      <ScrollView style={styles.radioScroll} contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color="#173626"
            />
          </Pressable>

          <View style={styles.brandBlock}>
            <Text style={styles.brandEyebrow}>
              BUKLOD RADIO
            </Text>

            <Text style={styles.brandTitle}>
              DZAS Signal Deck
            </Text>
          </View>

          <View style={styles.signalMini}>
            <View style={[styles.signalBar, { height: 7 }]} />
            <View style={[styles.signalBar, { height: 13 }]} />
            <View style={[styles.signalBar, { height: 19 }]} />
            <View style={[styles.signalBar, { height: 25 }]} />
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View style={styles.onAirBadge}>
              <View style={styles.liveDot} />

              <Text style={styles.onAirText}>
                ON AIR
              </Text>
            </View>

            <Text style={styles.networkText}>
              FEBC PHILIPPINES
            </Text>
          </View>

          <View style={styles.heroBody}>
            <View style={styles.ringOuter}>
              <View style={styles.ringMiddle}>
                <View style={styles.ringInner}>
                  <Text style={styles.frequencyNumber}>
                    702
                  </Text>

                  <Text style={styles.frequencyUnit}>
                    AM
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.stationSide}>
              <Text style={styles.stationName}>
                DZAS
              </Text>

              <Text style={styles.stationTagline}>
                Agapay ng Sambayanan
              </Text>

              <View style={styles.waveRow}>
                <View style={[styles.wave, { height: 10 }]} />
                <View style={[styles.wave, { height: 21 }]} />
                <View style={[styles.wave, { height: 14 }]} />
                <View style={[styles.wave, { height: 29 }]} />
                <View style={[styles.wave, { height: 18 }]} />
                <View style={[styles.wave, { height: 24 }]} />
                <View style={[styles.wave, { height: 11 }]} />
              </View>

              <View style={styles.streamStatus}>
                <MaterialCommunityIcons
                  name={
                    playing
                      ? 'broadcast'
                      : status?.isBuffering
                        ? 'loading'
                        : 'access-point'
                  }
                  size={15}
                  color="#DCEADF"
                />

                <Text style={styles.streamStatusText}>
                  {playing
                    ? 'LIVE STREAM ACTIVE'
                    : status?.isBuffering
                      ? 'CONNECTING…'
                      : 'READY TO RECEIVE'}
                </Text>
              </View>
            </View>
          </View>

          {!!error && (
            <View style={styles.errorLine}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={16}
                color="#FFD6D1"
              />

              <Text
                style={styles.errorText}
                numberOfLines={2}
              >
                {error}
              </Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              playing
                ? 'Pause 702 DZAS'
                : 'Play 702 DZAS live'
            }
            disabled={busy}
            onPress={() => {
              if (playing) {
                pause();
              } else {
                void play(false);
              }
            }}
            style={({ pressed }) => [
              styles.listenButton,
              playing && styles.listenButtonActive,
              busy && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.listenIcon}>
              <MaterialCommunityIcons
                name={
                  busy
                    ? 'loading'
                    : playing
                      ? 'pause'
                      : 'play'
                }
                size={27}
                color="#173626"
              />
            </View>

            <View style={styles.listenCopy}>
              <Text style={styles.listenPrimary}>
                {busy
                  ? 'CONNECTING…'
                  : playing
                    ? 'PAUSE RADIO'
                    : 'LISTEN LIVE'}
              </Text>

              <Text style={styles.listenSecondary}>
                702 DZAS · Live Internet Radio
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.visualGallery}>
          <View style={styles.photoCard}>
            <Image source={DZAS_LOGO_IMAGE} style={styles.stationPhoto} resizeMode="contain"
              accessibilityLabel="DZAS 702 AM station logo" />
            <Text style={styles.photoLabel}>702 DZAS AM</Text>
          </View>
          <View style={styles.photoCard}>
            <Image source={DZAS_PORTRAIT_IMAGE} style={styles.stationPhoto} resizeMode="cover"
              accessibilityLabel="Photo provided for DZAS radio view" />
            <Text style={styles.photoLabel}>DZAS Community</Text>
          </View>
        </View>

        <View style={styles.quickPanel}>
          <Pressable
            onPress={() => void play(true)}
            disabled={busy}
            style={({ pressed }) => [
              styles.quickButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              name="refresh"
              size={20}
              color="#214B34"
            />
            <Text style={styles.quickLabel}>
              Retry
            </Text>
          </Pressable>

          <View style={styles.quickDivider} />

          <Pressable
            onPress={toggleFavorite}
            style={({ pressed }) => [
              styles.quickButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              name={favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={favorite ? '#AA4550' : '#214B34'}
            />
            <Text style={styles.quickLabel}>
              Favorite
            </Text>
          </Pressable>

          <View style={styles.quickDivider} />

          <Pressable
            onPress={openOfficialSite}
            style={({ pressed }) => [
              styles.quickButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              name="web"
              size={20}
              color="#214B34"
            />
            <Text style={styles.quickLabel}>
              Source
            </Text>
          </Pressable>
        </View>

        <View style={styles.sponsoredArea}>
          <BuklodAdMobBanner
            placement="content"
            placementId="dzas_radio_medium_rectangle"
            format="mediumRectangle"
            requireViewport
            showLabel
          />
        </View>

        <View style={styles.bottomInfo}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={17}
            color="#52705D"
          />

          <Text
            style={styles.bottomText}
            numberOfLines={2}
          >
            Direct DZAS live audio · BUKLOD does not record or restream the station.
          </Text>
        </View>
      </ScrollView>
    </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F1E8',
  },

  radioScroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 35,
    justifyContent: 'flex-start',
  },

  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE2D9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandBlock: {
    flex: 1,
    marginLeft: 11,
  },

  brandEyebrow: {
    color: '#68806F',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  brandTitle: {
    marginTop: 1,
    color: '#173626',
    fontSize: 19,
    fontWeight: '900',
  },

  signalMini: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  signalBar: {
    width: 4,
    marginLeft: 3,
    borderRadius: 3,
    backgroundColor: '#315940',
  },

  hero: {
    backgroundColor: '#173C29',
    borderRadius: 24,
    padding: 15,
    marginTop: 8,
  },

  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  onAirBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#FFF6EF',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
    backgroundColor: '#D9464E',
  },

  onAirText: {
    color: '#B63D45',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },

  networkText: {
    color: '#A9C1B0',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  heroBody: {
    marginTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },

  ringOuter: {
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 1,
    borderColor: '#315C42',
    alignItems: 'center',
    justifyContent: 'center',
  },

  ringMiddle: {
    width: 105,
    height: 105,
    borderRadius: 53,
    borderWidth: 1,
    borderColor: '#4A755B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  ringInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#F5F0E3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  frequencyNumber: {
    color: '#173C29',
    fontSize: 31,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -1.5,
  },

  frequencyUnit: {
    color: '#B48942',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  stationSide: {
    flex: 1,
    marginLeft: 16,
  },

  stationName: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  stationTagline: {
    marginTop: 2,
    color: '#B8CDBE',
    fontSize: 10,
    fontWeight: '700',
  },

  waveRow: {
    height: 31,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  wave: {
    width: 4,
    marginRight: 4,
    borderRadius: 4,
    backgroundColor: '#D8B568',
  },

  streamStatus: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },

  streamStatusText: {
    marginLeft: 5,
    color: '#D3E0D6',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  listenButton: {
    marginTop: 12,
    minHeight: 55,
    borderRadius: 17,
    backgroundColor: '#F6F0E2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  listenButtonActive: {
    backgroundColor: '#E2F0E5',
  },

  listenIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  listenCopy: {
    flex: 1,
    marginLeft: 10,
  },

  listenPrimary: {
    color: '#173626',
    fontSize: 11,
    fontWeight: '900',
  },

  listenSecondary: {
    marginTop: 2,
    color: '#78867D',
    fontSize: 8.5,
    fontWeight: '700',
  },

  errorLine: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#713D38',
  },

  errorText: {
    flex: 1,
    marginLeft: 6,
    color: '#FFE9E6',
    fontSize: 8.5,
    fontWeight: '700',
  },

  visualGallery: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 12,
    alignItems: 'stretch',
  },
  photoCard: {
    flex: 1,
    minWidth: 0,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderColor: '#DFE6DB',
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationPhoto: {
    width: '100%',
    height: 124,
    borderRadius: 13,
    backgroundColor: '#F8F8F5',
  },
  photoLabel: {
    marginTop: 7,
    color: '#1F4932',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '900',
  },
  sponsoredArea: {
    marginTop: 16,
    minHeight: 289,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    overflow: 'hidden',
  },
  quickPanel: {
    minHeight: 58,
    marginTop: 9,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1E4DC',
    flexDirection: 'row',
    alignItems: 'center',
  },

  quickButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E9ECE5',
  },

  quickLabel: {
    marginTop: 3,
    color: '#365742',
    fontSize: 8.5,
    fontWeight: '800',
  },

  bottomInfo: {
    minHeight: 38,
    marginTop: 8,
    borderRadius: 13,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7EEE6',
  },

  bottomText: {
    flex: 1,
    marginLeft: 7,
    color: '#66766B',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '600',
  },

  disabled: {
    opacity: 0.5,
  },

  pressed: {
    opacity: 0.7,
  },
});