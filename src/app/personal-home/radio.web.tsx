import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const DZAS_ZENO_PLAYER_URL =
  'https://zeno.fm/player/dzas-702-am';

const DZAS_ZENO_PAGE_URL =
  'https://zeno.fm/radio/dzas-702-am/';

const DZAS_WEBSITE_URL =
  'https://dzas.febc.ph';

const DZAS_YOUTUBE_PAGE_URL =
  'https://www.youtube.com/@702dzasfebcradyotv/live';

const DZAS_FAVORITE_KEY =
  'buklod.radio.favorite.702dzas';

/*
 * BUKLOD_DZAS_WEB_AUDIO_ONLY_R6
 *
 * Phone web/PWA uses Zeno's embeddable audio player for the DZAS 702 AM
 * listing. This avoids the broken legacy Icecast endpoint and avoids video
 * playback inside BUKLOD. Native APK/iOS radio.tsx remains untouched.
 */
export default function BuklodRadioWebScreen() {
  const mountedRef =
    useRef(true);

  const [favorite, setFavorite] =
    useState(false);

  const [playerReady, setPlayerReady] =
    useState(false);

  useEffect(() => {
    mountedRef.current = true;

    void AsyncStorage
      .getItem(
        DZAS_FAVORITE_KEY,
      )
      .then(value => {
        if (
          mountedRef.current
        ) {
          setFavorite(
            value === '1',
          );
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, []);

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
      DZAS_WEBSITE_URL,
    );
  };

  const openOfficialYouTube = () => {
    void Linking.openURL(
      DZAS_YOUTUBE_PAGE_URL,
    );
  };

  const openZenoPage = () => {
    void Linking.openURL(
      DZAS_ZENO_PAGE_URL,
    );
  };

  const audioPlayer =
    React.createElement(
      'iframe',
      {
        src: DZAS_ZENO_PLAYER_URL,
        title: 'DZAS 702 AM audio player',
        loading: 'eager',
        allow: 'autoplay',
        frameBorder: '0',
        scrolling: 'no',
        onLoad: () => {
          if (
            mountedRef.current
          ) {
            setPlayerReady(true);
          }
        },
        style: {
          display: 'block',
          width: '100%',
          height: '250px',
          border: '0',
          backgroundColor:
            '#FFFFFF',
        },
      },
    );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.content
      }
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() =>
            router.back()
          }
          style={styles.iconButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color="#244331"
          />
        </Pressable>

        <View
          style={
            styles.headerCopy
          }
        >
          <Text
            style={
              styles.eyebrow
            }
          >
            BUKLOD RADIO
          </Text>

          <Text
            style={
              styles.title
            }
          >
            Makinig. Manatiling konektado.
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Audio-only live radio inside BUKLOD.
          </Text>
        </View>
      </View>

      <View
        style={
          styles.stationCard
        }
      >
        <View
          style={
            styles.stationTop
          }
        >
          <View
            style={
              styles.stationIcon
            }
          >
            <MaterialCommunityIcons
              name="radio-tower"
              size={34}
              color="#FFFFFF"
            />
          </View>

          <View
            style={
              styles.stationCopy
            }
          >
            <View
              style={
                styles.liveRow
              }
            >
              <View
                style={[
                  styles.liveDot,
                  playerReady &&
                    styles.liveDotOn,
                ]}
              />

              <Text
                style={
                  styles.liveText
                }
              >
                {playerReady
                  ? 'AUDIO PLAYER READY'
                  : 'LOADING AUDIO'}
              </Text>

              <Text
                style={
                  styles.frequency
                }
              >
                702 AM
              </Text>
            </View>

            <Text
              style={
                styles.stationName
              }
            >
              702 DZAS
            </Text>

            <Text
              style={
                styles.stationTagline
              }
            >
              Agapay ng Sambayanan
            </Text>

            <Text
              style={
                styles.stationMeta
              }
            >
              FEBC Philippines · audio-only web player
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              favorite
                ? 'Remove DZAS from favorites'
                : 'Add DZAS to favorites'
            }
            onPress={
              toggleFavorite
            }
            style={
              styles.favoriteButton
            }
          >
            <MaterialCommunityIcons
              name={
                favorite
                  ? 'heart'
                  : 'heart-outline'
              }
              size={24}
              color={
                favorite
                  ? '#A73C46'
                  : '#31543E'
              }
            />
          </Pressable>
        </View>

        <View
          style={
            styles.playerIntro
          }
        >
          <MaterialCommunityIcons
            name="volume-high"
            size={20}
            color="#31543E"
          />

          <View
            style={
              styles.playerIntroCopy
            }
          >
            <Text
              style={
                styles.playerIntroTitle
              }
            >
              LIVE AUDIO
            </Text>

            <Text
              style={
                styles.playerIntroText
              }
            >
              Tap the Play button in the audio player below.
            </Text>
          </View>
        </View>

        <View
          style={
            styles.audioFrame
          }
        >
          {audioPlayer}
        </View>

        <View
          style={
            styles.providerNote
          }
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color="#64756A"
          />

          <Text
            style={
              styles.providerText
            }
          >
            Audio player provided through the DZAS 702 AM listing on Zeno.FM.
          </Text>
        </View>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open DZAS audio player page"
          onPress={
            openZenoPage
          }
          style={
            styles.secondaryLink
          }
        >
          <MaterialCommunityIcons
            name="radio"
            size={18}
            color="#31543E"
          />

          <View
            style={
              styles.linkCopy
            }
          >
            <Text
              style={
                styles.linkTitle
              }
            >
              Open audio player separately
            </Text>

            <Text
              style={
                styles.linkSub
              }
            >
              Backup if your phone blocks the embedded player.
            </Text>
          </View>
        </Pressable>
      </View>

      <View
        style={
          styles.fallbackCard
        }
      >
        <Text
          style={
            styles.fallbackTitle
          }
        >
          Official DZAS links
        </Text>

        <Text
          style={
            styles.fallbackText
          }
        >
          If the audio listing is temporarily unavailable, use the official DZAS sources below.
        </Text>

        <Pressable
          accessibilityRole="link"
          onPress={
            openOfficialSite
          }
          style={
            styles.officialLink
          }
        >
          <MaterialCommunityIcons
            name="open-in-new"
            size={18}
            color="#31543E"
          />

          <Text
            style={
              styles.officialLinkText
            }
          >
            Official DZAS website
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="link"
          onPress={
            openOfficialYouTube
          }
          style={
            styles.officialLink
          }
        >
          <MaterialCommunityIcons
            name="youtube"
            size={19}
            color="#B3261E"
          />

          <Text
            style={
              styles.officialLinkText
            }
          >
            Official DZAS RadyoTV Live
          </Text>
        </Pressable>
      </View>

      <View
        style={
          styles.noteCard
        }
      >
        <MaterialCommunityIcons
          name="headphones"
          size={22}
          color="#31543E"
        />

        <View
          style={
            styles.noteCopy
          }
        >
          <Text
            style={
              styles.noteTitle
            }
          >
            Audio-only mode
          </Text>

          <Text
            style={
              styles.noteText
            }
          >
            Walang video sa BUKLOD Radio web screen. The station audio player stays inside this page while you listen.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#F3F5EE',
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
      alignItems:
        'flex-start',
      gap: 12,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#D8E1D7',
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
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#D8E1D7',
      gap: 16,
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
      justifyContent:
        'center',
      backgroundColor:
        '#4E7D5B',
    },
    stationCopy: {
      flex: 1,
      minWidth: 0,
    },
    liveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor:
        '#87948B',
    },
    liveDotOn: {
      backgroundColor:
        '#4E7D5B',
    },
    liveText: {
      color: '#4E7D5B',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.7,
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
      justifyContent:
        'center',
      backgroundColor:
        '#F3F5EE',
    },
    playerIntro: {
      minHeight: 54,
      borderRadius: 14,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor:
        '#EEF4EC',
    },
    playerIntroCopy: {
      flex: 1,
    },
    playerIntroTitle: {
      color: '#31543E',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    playerIntroText: {
      marginTop: 2,
      color: '#65746A',
      fontSize: 10,
      lineHeight: 15,
      fontWeight: '600',
    },
    audioFrame: {
      width: '100%',
      minHeight: 250,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#D8E1D7',
    },
    providerNote: {
      flexDirection: 'row',
      alignItems:
        'flex-start',
      gap: 8,
      paddingHorizontal: 2,
    },
    providerText: {
      flex: 1,
      color: '#64756A',
      fontSize: 9.5,
      lineHeight: 14,
      fontWeight: '600',
    },
    secondaryLink: {
      minHeight: 52,
      borderRadius: 14,
      paddingHorizontal: 13,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor:
        '#F3F5EE',
      borderWidth: 1,
      borderColor:
        '#D8E1D7',
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
    fallbackCard: {
      borderRadius: 18,
      padding: 14,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#D8E1D7',
      gap: 9,
    },
    fallbackTitle: {
      color: '#31543E',
      fontSize: 13,
      fontWeight: '900',
    },
    fallbackText: {
      color: '#68776E',
      fontSize: 10,
      lineHeight: 16,
      fontWeight: '600',
    },
    officialLink: {
      minHeight: 42,
      borderRadius: 12,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor:
        '#F6F8F4',
    },
    officialLinkText: {
      color: '#31543E',
      fontSize: 11,
      fontWeight: '900',
    },
    noteCard: {
      borderRadius: 18,
      backgroundColor:
        '#EAF1E8',
      borderWidth: 1,
      borderColor:
        '#D4E1D2',
      padding: 14,
      flexDirection: 'row',
      alignItems:
        'flex-start',
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
