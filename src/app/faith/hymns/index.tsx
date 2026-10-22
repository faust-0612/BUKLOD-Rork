/* PATCH_191A_SHOW_FAITH_ABC_HYMNS_ALL_ACCESS */
import React, {
  useMemo,
  useState,
} from 'react';

import {
  FlatList,
  Pressable,
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

import {
  router,
} from 'expo-router';

import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';

import {
  BUKLOD_HYMNS,
  HYMN_SOURCE,
  type BuklodHymn,
} from '@/data/faith/hymns';

export default function
BuklodHymnLibraryScreen() {
  const insets =
    useSafeAreaInsets();

  const [
    query,
    setQuery,
  ] =
    useState('');

  const filtered =
    useMemo(
      () => {
        const needle =
          query
            .trim()
            .toLocaleLowerCase();

        if (!needle) {
          return BUKLOD_HYMNS;
        }

        return BUKLOD_HYMNS
          .filter(
            hymn =>
              [
                String(
                  hymn.number
                ),
                hymn.title,
                hymn.subtitle ?? '',
                hymn.lyrics,
              ]
                .join(' ')
                .toLocaleLowerCase()
                .includes(
                  needle
                )
          );
      },
      [query]
    );

  const openHymn =
    (
      hymn:
        BuklodHymn
    ) => {
      router.push({
        pathname:
          '/faith/hymns/[songId]',
        params: {
          songId:
            hymn.id,
        },
      } as any);
    };

  return (
    <View
      style={
        styles.screen
      }
    >
      <FlatList
        data={
          filtered
        }
        keyExtractor={
          item =>
            item.id
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={
          styles.listContent
        }
        ListHeaderComponent={
          <View
            style={{
              paddingTop:
                insets.top + 16,
            }}
          >
      <View
        style={
          styles.header
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
            styles.backButton
          }
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color="#3E3150"
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
            SHOW FAITH · ALL USERS
          </Text>

          <Text
            style={
              styles.title
            }
          >
            Hymns
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Select a song, search the hymnbook, and read at the size you prefer.
          </Text>
        </View>
      </View>

      <View
        style={
          styles.sourceCard
        }
      >
        <View
          style={
            styles.sourceIcon
          }
        >
          <MaterialCommunityIcons
            name="music-note"
            size={26}
            color="#6B5680"
          />
        </View>

        <View
          style={
            styles.sourceCopy
          }
        >
          <Text
            style={
              styles.sourceTitle
            }
          >
            {HYMN_SOURCE.title}
          </Text>

          <Text
            style={
              styles.sourceBody
            }
          >
            {HYMN_SOURCE.organization} · {BUKLOD_HYMNS.length} song entries
          </Text>

          <Text
            style={
              styles.sourceNote
            }
          >
            Pages 98–100 of the source are ministry reference/covenant material, so they are not listed as songs. The final song is on source page 101.
          </Text>
        </View>
      </View>

      <View
        style={
          styles.searchBox
        }
      >
        <MaterialCommunityIcons
          name="magnify"
          size={22}
          color="#71667B"
        />

        <TextInput
          accessibilityLabel="Search hymns"
          value={query}
          onChangeText={
            setQuery
          }
          placeholder="Search number, title, or lyrics..."
          placeholderTextColor="#958D9B"
          autoCorrect={false}
          style={
            styles.searchInput
          }
        />

        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear hymn search"
            hitSlop={10}
            onPress={() =>
              setQuery('')
            }
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={20}
              color="#948C99"
            />
          </Pressable>
        ) : null}
      </View>

      <View
        style={
          styles.resultRow
        }
      >
        <Text
          style={
            styles.resultText
          }
        >
          {filtered.length} {filtered.length === 1 ? 'song' : 'songs'}
        </Text>

        <Text
          style={
            styles.resultHint
          }
        >
          Tap to open
        </Text>
      </View>

      <View
        style={
          styles.adBanner
        }
      >
        <BuklodAdMobBanner
          placement="content"
          placementId="hymnbook_banner"
          format="adaptive"
          showLabel
        />
      </View>
          </View>
        }
        renderItem={({
          item,
        }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open hymn ${item.number}: ${item.title}`}
            onPress={() =>
              openHymn(
                item
              )
            }
            style={({
              pressed,
            }) => [
              styles.hymnCard,
              pressed &&
                styles.pressed,
            ]}
          >
            <View
              style={
                styles.numberBox
              }
            >
              <Text
                style={
                  styles.numberText
                }
              >
                {item.number}
              </Text>
            </View>

            <View
              style={
                styles.hymnCopy
              }
            >
              <Text
                numberOfLines={2}
                style={
                  styles.hymnTitle
                }
              >
                {item.title}
              </Text>

              {item.subtitle ? (
                <Text
                  numberOfLines={1}
                  style={
                    styles.hymnSubtitle
                  }
                >
                  {item.subtitle}
                </Text>
              ) : null}

              <Text
                numberOfLines={2}
                style={
                  styles.preview
                }
              >
                {item.lyrics.replace(
                  /\n+/g,
                  ' '
                )}
              </Text>
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={25}
              color="#988EA0"
            />
          </Pressable>
        )}
        ListEmptyComponent={
          <View
            style={
              styles.empty
            }
          >
            <MaterialCommunityIcons
              name="music-note-off-outline"
              size={34}
              color="#8D8393"
            />

            <Text
              style={
                styles.emptyTitle
              }
            >
              No song found
            </Text>

            <Text
              style={
                styles.emptyBody
              }
            >
              Search another title, hymn number, or word from the lyrics.
            </Text>
          </View>
        }
      />
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
      marginTop: 4,
      marginBottom: 8,
    },

    header: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      paddingHorizontal:
        16,
      paddingTop: 10,
      paddingBottom: 10,
    },

    backButton: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E7E0EA',
    },

    headerCopy: {
      flex: 1,
    },

    eyebrow: {
      color:
        '#755A8A',
      fontSize: 10,
      fontWeight:
        '900',
      letterSpacing:
        0.8,
    },

    title: {
      marginTop: 3,
      color:
        '#392C48',
      fontSize: 25,
      fontWeight:
        '900',
    },

    subtitle: {
      marginTop: 4,
      color:
        '#766D7D',
      fontSize: 12,
      lineHeight: 18,
    },

    sourceCard: {
      marginHorizontal:
        16,
      padding: 14,
      borderRadius: 19,
      flexDirection:
        'row',
      backgroundColor:
        '#F1EAF5',
      borderWidth: 1,
      borderColor:
        '#E4D9EB',
    },

    sourceIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FFFFFF',
      marginRight: 11,
    },

    sourceCopy: {
      flex: 1,
    },

    sourceTitle: {
      color:
        '#523F64',
      fontSize: 14,
      fontWeight:
        '900',
    },

    sourceBody: {
      marginTop: 3,
      color:
        '#75647F',
      fontSize: 10,
      fontWeight:
        '800',
    },

    sourceNote: {
      marginTop: 6,
      color:
        '#84798A',
      fontSize: 9,
      lineHeight: 14,
    },

    searchBox: {
      minHeight: 50,
      marginTop: 10,
      marginHorizontal:
        16,
      paddingHorizontal:
        13,
      borderRadius: 17,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E7E0EA',
    },

    searchInput: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal:
        10,
      color:
        '#44384E',
      fontSize: 14,
    },

    resultRow: {
      paddingHorizontal:
        18,
      paddingTop: 10,
      paddingBottom: 3,
      flexDirection:
        'row',
      justifyContent:
        'space-between',
    },

    resultText: {
      color:
        '#62576A',
      fontSize: 10,
      fontWeight:
        '900',
    },

    resultHint: {
      color:
        '#988FA0',
      fontSize: 9,
      fontWeight:
        '700',
    },

    listContent: {
      padding: 16,
      paddingTop: 6,
      paddingBottom: 36,
    },

    hymnCard: {
      minHeight: 88,
      marginBottom: 9,
      padding: 12,
      borderRadius: 18,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E8E1EA',
    },

    pressed: {
      opacity: 0.78,
      transform: [
        {
          scale: 0.995,
        },
      ],
    },

    numberBox: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#F1EAF5',
      marginRight: 12,
    },

    numberText: {
      color:
        '#674E79',
      fontSize: 15,
      fontWeight:
        '900',
    },

    hymnCopy: {
      flex: 1,
      minWidth: 0,
    },

    hymnTitle: {
      color:
        '#43354E',
      fontSize: 14,
      lineHeight: 19,
      fontWeight:
        '900',
    },

    hymnSubtitle: {
      marginTop: 2,
      color:
        '#7D6E86',
      fontSize: 10,
      fontWeight:
        '700',
    },

    preview: {
      marginTop: 5,
      color:
        '#8A818F',
      fontSize: 10,
      lineHeight: 14,
    },

    empty: {
      padding: 28,
      alignItems:
        'center',
      borderRadius: 20,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E7E0EA',
    },

    emptyTitle: {
      marginTop: 8,
      color:
        '#55475E',
      fontSize: 15,
      fontWeight:
        '900',
    },

    emptyBody: {
      marginTop: 5,
      color:
        '#8B828F',
      fontSize: 10,
      lineHeight: 15,
      textAlign:
        'center',
    },
  });
