/* PATCH_191A_SHOW_FAITH_ABC_HYMNS_ALL_ACCESS */
import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';

import {
  BUKLOD_HYMNS,
  HYMN_SOURCE,
} from '@/data/faith/hymns';

const READER_KEY =
  'buklod.faith.hymn.reader.v1';

function escapeRegExp(
  value: string
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function countMatches(
  text: string,
  query: string
) {
  const needle =
    query.trim();

  if (!needle) {
    return 0;
  }

  try {
    return (
      text.match(
        new RegExp(
          escapeRegExp(
            needle
          ),
          'gi'
        )
      ) ?? []
    ).length;
  }
  catch {
    return 0;
  }
}

function HighlightedLyrics({
  text,
  query,
  fontSize,
}: {
  text: string;
  query: string;
  fontSize: number;
}) {
  const needle =
    query.trim();

  if (!needle) {
    return (
      <Text
        selectable
        style={[
          styles.lyrics,
          {
            fontSize,
            lineHeight:
              Math.round(
                fontSize *
                  1.58
              ),
          },
        ]}
      >
        {text}
      </Text>
    );
  }

  let parts:
    string[] = [
      text,
    ];

  try {
    parts =
      text.split(
        new RegExp(
          `(${escapeRegExp(
            needle
          )})`,
          'gi'
        )
      );
  }
  catch {
    parts = [
      text,
    ];
  }

  return (
    <Text
      selectable
      style={[
        styles.lyrics,
        {
          fontSize,
          lineHeight:
            Math.round(
              fontSize *
                1.58
            ),
        },
      ]}
    >
      {parts.map(
        (
          part,
          index
        ) => {
          const hit =
            part
              .toLocaleLowerCase() ===
            needle
              .toLocaleLowerCase();

          return (
            <Text
              key={`${index}-${part.slice(0, 12)}`}
              style={
                hit
                  ? styles.highlight
                  : undefined
              }
            >
              {part}
            </Text>
          );
        }
      )}
    </Text>
  );
}

export default function
BuklodHymnDetailScreen() {
  const params =
    useLocalSearchParams<{
      songId?:
        | string
        | string[];
    }>();

  const songId =
    Array.isArray(
      params.songId
    )
      ? params.songId[0]
      : params.songId;

  const insets =
    useSafeAreaInsets();

  const index =
    useMemo(
      () =>
        BUKLOD_HYMNS
          .findIndex(
            item =>
              item.id ===
              songId
          ),
      [songId]
    );

  const hymn =
    index >= 0
      ? BUKLOD_HYMNS[
          index
        ]
      : null;

  const [
    baseFont,
    setBaseFont,
  ] =
    useState(19);

  const [
    zoom,
    setZoom,
  ] =
    useState(1);

  const [
    findText,
    setFindText,
  ] =
    useState('');

  useEffect(
    () => {
      let active =
        true;

      void AsyncStorage
        .getItem(
          READER_KEY
        )
        .then(raw => {
          if (
            !active ||
            !raw
          ) {
            return;
          }

          try {
            const parsed =
              JSON.parse(raw);

            const nextFont =
              Number(
                parsed
                  ?.baseFont
              );

            const nextZoom =
              Number(
                parsed
                  ?.zoom
              );

            if (
              Number.isFinite(
                nextFont
              ) &&
              nextFont >= 14 &&
              nextFont <= 30
            ) {
              setBaseFont(
                nextFont
              );
            }

            if (
              Number.isFinite(
                nextZoom
              ) &&
              nextZoom >= 0.75 &&
              nextZoom <= 1.6
            ) {
              setZoom(
                nextZoom
              );
            }
          }
          catch {
            // Ignore malformed reader settings.
          }
        });

      return () => {
        active =
          false;
      };
    },
    []
  );

  useEffect(
    () => {
      void AsyncStorage
        .setItem(
          READER_KEY,
          JSON.stringify({
            baseFont,
            zoom,
          })
        );
    },
    [
      baseFont,
      zoom,
    ]
  );

  const effectiveFont =
    Math.round(
      Math.max(
        12,
        Math.min(
          46,
          baseFont *
            zoom
        )
      ) *
        10
    ) / 10;

  const matchCount =
    hymn
      ? countMatches(
          hymn.lyrics,
          findText
        )
      : 0;

  const openIndex =
    (
      nextIndex:
        number
    ) => {
      const target =
        BUKLOD_HYMNS[
          nextIndex
        ];

      if (!target) {
        return;
      }

      setFindText('');

      router.replace({
        pathname:
          '/faith/hymns/[songId]',
        params: {
          songId:
            target.id,
        },
      } as any);
    };

  if (!hymn) {
    return (
      <View
        style={
          styles.screen
        }
      >
        <View
          style={[
            styles.missing,
            {
              marginTop:
                insets.top + 16,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="music-note-off-outline"
            size={42}
            color="#7A687F"
          />

          <Text
            style={
              styles.missingTitle
            }
          >
            Hymn not found
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace(
                '/faith/hymns' as any
              )
            }
            style={
              styles.backToLibrary
            }
          >
            <Text
              style={
                styles.backToLibraryText
              }
            >
              Back to Hymns
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={
        styles.screen
      }
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:
              insets.top + 16,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
      <View
        style={
          styles.topBar
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={() =>
            router.back()
          }
          style={
            styles.iconButton
          }
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color="#44334F"
          />
        </Pressable>

        <View
          style={
            styles.topCopy
          }
        >
          <Text
            style={
              styles.topEyebrow
            }
          >
            HYMN {hymn.number}
          </Text>

          <Text
            numberOfLines={1}
            style={
              styles.topTitle
            }
          >
            {hymn.title}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open hymn library"
          onPress={() =>
            router.push(
              '/faith/hymns' as any
            )
          }
          style={
            styles.iconButton
          }
        >
          <MaterialCommunityIcons
            name="playlist-music-outline"
            size={24}
            color="#6B5680"
          />
        </Pressable>
      </View>

      <View
        style={
          styles.adBanner
        }
      >
        <BuklodAdMobBanner
          placement="content"
          placementId="hymn_banner"
          format="adaptive"
          showLabel
        />
      </View>

        <View
          style={
            styles.hero
          }
        >
          <Text
            style={
              styles.heroNumber
            }
          >
            {hymn.number}
          </Text>

          <Text
            style={
              styles.heroTitle
            }
          >
            {hymn.title}
          </Text>

          {hymn.subtitle ? (
            <Text
              style={
                styles.heroSubtitle
              }
            >
              {hymn.subtitle}
            </Text>
          ) : null}

          <Text
            style={
              styles.heroSource
            }
          >
            {HYMN_SOURCE.organization} · Source page {hymn.sourcePage}
          </Text>
        </View>

        <View
          style={
            styles.readerToolbar
          }
        >
          <View
            style={
              styles.toolbarGroup
            }
          >
            <Text
              style={
                styles.toolbarLabel
              }
            >
              LETTER SIZE
            </Text>

            <View
              style={
                styles.controlRow
              }
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease hymn letter size"
                onPress={() =>
                  setBaseFont(
                    value =>
                      Math.max(
                        14,
                        value - 1
                      )
                  )
                }
                style={
                  styles.controlButton
                }
              >
                <Text
                  style={
                    styles.controlText
                  }
                >
                  A−
                </Text>
              </Pressable>

              <Text
                style={
                  styles.controlValue
                }
              >
                {baseFont}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase hymn letter size"
                onPress={() =>
                  setBaseFont(
                    value =>
                      Math.min(
                        30,
                        value + 1
                      )
                  )
                }
                style={
                  styles.controlButton
                }
              >
                <Text
                  style={
                    styles.controlText
                  }
                >
                  A+
                </Text>
              </Pressable>
            </View>
          </View>

          <View
            style={
              styles.toolbarDivider
            }
          />

          <View
            style={
              styles.toolbarGroup
            }
          >
            <Text
              style={
                styles.toolbarLabel
              }
            >
              ZOOM
            </Text>

            <View
              style={
                styles.controlRow
              }
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom hymn out"
                onPress={() =>
                  setZoom(
                    value =>
                      Math.max(
                        0.75,
                        Math.round(
                          (value -
                            0.1) *
                            10
                        ) / 10
                      )
                  )
                }
                style={
                  styles.controlButton
                }
              >
                <MaterialCommunityIcons
                  name="magnify-minus-outline"
                  size={20}
                  color="#654D76"
                />
              </Pressable>

              <Text
                style={
                  styles.controlValue
                }
              >
                {Math.round(
                  zoom * 100
                )}%
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom hymn in"
                onPress={() =>
                  setZoom(
                    value =>
                      Math.min(
                        1.6,
                        Math.round(
                          (value +
                            0.1) *
                            10
                        ) / 10
                      )
                  )
                }
                style={
                  styles.controlButton
                }
              >
                <MaterialCommunityIcons
                  name="magnify-plus-outline"
                  size={20}
                  color="#654D76"
                />
              </Pressable>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset hymn reader size"
          onPress={() => {
            setBaseFont(
              19
            );
            setZoom(1);
          }}
          style={
            styles.resetButton
          }
        >
          <MaterialCommunityIcons
            name="restore"
            size={17}
            color="#6D5B76"
          />

          <Text
            style={
              styles.resetText
            }
          >
            Reset reader to 100%
          </Text>
        </Pressable>

        <View
          style={
            styles.findBox
          }
        >
          <MaterialCommunityIcons
            name="text-search"
            size={21}
            color="#705B7E"
          />

          <TextInput
            accessibilityLabel="Find text in this hymn"
            value={
              findText
            }
            onChangeText={
              setFindText
            }
            placeholder="Find a word in this song..."
            placeholderTextColor="#978D9B"
            autoCorrect={false}
            style={
              styles.findInput
            }
          />

          {findText ? (
            <Text
              style={
                styles.matchCount
              }
            >
              {matchCount}
            </Text>
          ) : null}

          {findText ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear text search"
              hitSlop={10}
              onPress={() =>
                setFindText('')
              }
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color="#9B929F"
              />
            </Pressable>
          ) : null}
        </View>

        <View
          style={
            styles.lyricsCard
          }
        >
          <Text
            style={
              styles.readerSizeHint
            }
          >
            READER SIZE · {effectiveFont}px
          </Text>

          <HighlightedLyrics
            text={
              hymn.lyrics
            }
            query={
              findText
            }
            fontSize={
              effectiveFont
            }
          />
        </View>

        <View
          style={
            styles.navRow
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous hymn"
            disabled={
              index <= 0
            }
            onPress={() =>
              openIndex(
                index - 1
              )
            }
            style={[
              styles.navButton,
              index <= 0 &&
                styles.navButtonDisabled,
            ]}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={22}
              color="#665470"
            />

            <Text
              style={
                styles.navText
              }
            >
              Previous
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next hymn"
            disabled={
              index >=
              BUKLOD_HYMNS.length -
                1
            }
            onPress={() =>
              openIndex(
                index + 1
              )
            }
            style={[
              styles.navButton,
              index >=
                BUKLOD_HYMNS.length -
                  1 &&
                styles.navButtonDisabled,
            ]}
          >
            <Text
              style={
                styles.navText
              }
            >
              Next
            </Text>

            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color="#665470"
            />
          </Pressable>
        </View>

        <View
          style={
            styles.citationCard
          }
        >
          <Text
            style={
              styles.citationLabel
            }
          >
            SOURCE / CITATION
          </Text>

          <Text
            selectable
            style={
              styles.citationText
            }
          >
            {HYMN_SOURCE.organization}. {HYMN_SOURCE.title}. Hymn no. {hymn.number}, uploaded source page {hymn.sourcePage}.
          </Text>

          <Text
            style={
              styles.citationNote
            }
          >
            Lyrics and title are displayed from the uploaded hymnbook source.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#F7F5F9',
    },

    adBanner: {
      marginTop: 12,
      marginBottom: 4,
    },

    topBar: {
      minHeight: 62,
      paddingHorizontal:
        10,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        '#E6DFE9',
    },

    iconButton: {
      width: 46,
      height: 46,
      borderRadius: 15,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    topCopy: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal:
        4,
    },

    topEyebrow: {
      color:
        '#765B89',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing:
        0.6,
    },

    topTitle: {
      marginTop: 2,
      color:
        '#45354E',
      fontSize: 13,
      fontWeight:
        '900',
    },

    content: {
      padding: 16,
      paddingBottom: 42,
    },

    hero: {
      padding: 18,
      borderRadius: 22,
      backgroundColor:
        '#554064',
    },

    heroNumber: {
      color:
        '#D8C9E2',
      fontSize: 12,
      fontWeight:
        '900',
      letterSpacing:
        0.8,
    },

    heroTitle: {
      marginTop: 5,
      color:
        '#FFFFFF',
      fontSize: 24,
      lineHeight: 30,
      fontWeight:
        '900',
    },

    heroSubtitle: {
      marginTop: 5,
      color:
        '#E8E0ED',
      fontSize: 12,
      fontWeight:
        '700',
    },

    heroSource: {
      marginTop: 9,
      color:
        '#D9CFE0',
      fontSize: 10,
      lineHeight: 15,
    },

    readerToolbar: {
      marginTop: 10,
      padding: 12,
      borderRadius: 18,
      flexDirection:
        'row',
      alignItems:
        'stretch',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E7DFEA',
    },

    toolbarGroup: {
      flex: 1,
      alignItems:
        'center',
    },

    toolbarDivider: {
      width: 1,
      marginHorizontal:
        8,
      backgroundColor:
        '#EEE8F0',
    },

    toolbarLabel: {
      color:
        '#85788C',
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing:
        0.7,
    },

    controlRow: {
      marginTop: 7,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 7,
    },

    controlButton: {
      minWidth: 44,
      height: 44,
      paddingHorizontal:
        8,
      borderRadius: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#F2EDF5',
      borderWidth: 1,
      borderColor:
        '#E6DDEB',
    },

    controlText: {
      color:
        '#624B73',
      fontSize: 14,
      fontWeight:
        '900',
    },

    controlValue: {
      minWidth: 42,
      textAlign:
        'center',
      color:
        '#5C4D64',
      fontSize: 11,
      fontWeight:
        '900',
    },

    resetButton: {
      minHeight: 42,
      marginTop: 8,
      borderRadius: 14,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 7,
      backgroundColor:
        '#F2EDF5',
      borderWidth: 1,
      borderColor:
        '#E6DDEB',
    },

    resetText: {
      color:
        '#705E79',
      fontSize: 10,
      fontWeight:
        '900',
    },

    findBox: {
      minHeight: 50,
      marginTop: 8,
      paddingHorizontal:
        12,
      borderRadius: 16,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E5DDE8',
    },

    findInput: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal:
        9,
      color:
        '#4C3E54',
      fontSize: 13,
    },

    matchCount: {
      minWidth: 26,
      marginRight: 7,
      paddingHorizontal:
        6,
      paddingVertical:
        3,
      borderRadius: 999,
      textAlign:
        'center',
      color:
        '#6A5378',
      fontSize: 9,
      fontWeight:
        '900',
      backgroundColor:
        '#F0E9F4',
    },

    lyricsCard: {
      marginTop: 10,
      paddingHorizontal:
        18,
      paddingTop: 15,
      paddingBottom: 24,
      borderRadius: 20,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E7E0EA',
    },

    readerSizeHint: {
      marginBottom: 13,
      color:
        '#978B9C',
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing:
        0.7,
      textAlign:
        'right',
    },

    lyrics: {
      color:
        '#332B38',
      fontWeight:
        '500',
    },

    highlight: {
      backgroundColor:
        '#EFE2A9',
      color:
        '#2F2733',
      fontWeight:
        '800',
    },

    navRow: {
      marginTop: 10,
      flexDirection:
        'row',
      gap: 8,
    },

    navButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 15,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 4,
      backgroundColor:
        '#F1EAF5',
      borderWidth: 1,
      borderColor:
        '#E4D9EA',
    },

    navButtonDisabled: {
      opacity: 0.35,
    },

    navText: {
      color:
        '#665470',
      fontSize: 11,
      fontWeight:
        '900',
    },

    citationCard: {
      marginTop: 10,
      padding: 14,
      borderRadius: 17,
      backgroundColor:
        '#F5F1F6',
      borderWidth: 1,
      borderColor:
        '#E5DCE8',
    },

    citationLabel: {
      color:
        '#77627D',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing:
        0.7,
    },

    citationText: {
      marginTop: 6,
      color:
        '#5F5364',
      fontSize: 11,
      lineHeight: 17,
      fontWeight:
        '700',
    },

    citationNote: {
      marginTop: 5,
      color:
        '#8A7F8E',
      fontSize: 9,
      lineHeight: 14,
    },

    missing: {
      margin: 20,
      padding: 28,
      borderRadius: 22,
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E5DDE8',
    },

    missingTitle: {
      marginTop: 9,
      color:
        '#55475D',
      fontSize: 18,
      fontWeight:
        '900',
    },

    backToLibrary: {
      minHeight: 48,
      marginTop: 16,
      paddingHorizontal:
        18,
      borderRadius: 15,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#6B5680',
    },

    backToLibraryText: {
      color:
        '#FFFFFF',
      fontWeight:
        '900',
    },
  });
