/* PATCH_173I_R3_PUBLIC_WORD_SCREEN */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
} from 'expo-router';

import {
  Card,
  shared,
} from '@/components/UI';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

type WordItem = {
  id: string;
  title: string | null;
  bible_passage: string | null;
  publish_date: string | null;
  reflection_text: string | null;
};

export default function
PublicChristianWordScreen() {
  const [
    items,
    setItems,
  ] =
    useState<WordItem[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    errorText,
    setErrorText,
  ] =
    useState('');

  const load =
    useCallback(
      async (
        refresh = false,
      ) => {
        if (refresh) {
          setRefreshing(true);
        }
        else {
          setLoading(true);
        }

        setErrorText('');

        try {
          const {
            data,
            error,
          } =
            await supabase
              .from(
                'devotionals',
              )
              .select(
                'id,title,bible_passage,publish_date,reflection_text',
              )
              .eq(
                'is_published',
                true,
              )
              .order(
                'publish_date',
                {
                  ascending:
                    false,
                },
              )
              .limit(50);

          if (error) {
            throw error;
          }

          const today =
            new Date()
              .toISOString()
              .slice(
                0,
                10,
              );

          const visible =
            (
              (data ?? []) as
                WordItem[]
            )
              .filter(
                item =>
                  !item
                    .publish_date ||
                  item
                    .publish_date <=
                    today,
              );

          setItems(
            visible,
          );
        }
        catch (
          error: any
        ) {
          console.warn(
            'Public Word:',
            error,
          );

          setItems([]);

          setErrorText(
            String(
              error?.message ??
                'The Word could not be loaded right now.',
            ),
          );
        }
        finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ],
  );

  const emptyCopy =
    useMemo(
      () =>
        errorText
          ? 'The devotional list is temporarily unavailable.'
          : 'No published devotional is available yet.',
      [
        errorText,
      ],
    );

  if (loading) {
    return (
      <View
        style={[
          shared.screen,
          styles.loading,
        ]}
      >
        <ActivityIndicator
          size="small"
          color={
            colors.greenDark
          }
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading the Word...
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={
        shared.screen
      }
      contentContainerStyle={
        styles.content
      }
      data={
        items
      }
      keyExtractor={
        item =>
          item.id
      }
      refreshControl={
        <RefreshControl
          refreshing={
            refreshing
          }
          onRefresh={() =>
            void load(true)
          }
        />
      }
      ListHeaderComponent={
        <View
          style={
            styles.header
          }
        >
          <Text
            style={
              styles.eyebrow
            }
          >
            PUBLIC CHRISTIAN
          </Text>

          <Text
            style={
              shared.h1
            }
          >
            The Word
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Devotional teaching, Scripture, reflection and practical application.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Card>
          <View
            style={
              styles.emptyIcon
            }
          >
            <MaterialCommunityIcons
              name="book-open-page-variant-outline"
              size={26}
              color={
                colors.greenDark
              }
            />
          </View>

          <Text
            style={
              styles.emptyTitle
            }
          >
            {
              errorText
                ? 'Word unavailable'
                : 'No devotional yet'
            }
          </Text>

          <Text
            style={
              styles.emptyBody
            }
          >
            {emptyCopy}
          </Text>

          {!!errorText && (
            <Text
              style={
                styles.errorDetails
              }
            >
              {errorText}
            </Text>
          )}

          <View
            style={
              styles.emptyActions
            }
          >
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                void load()
              }
              style={({ pressed }) => [
                styles.secondary,
                pressed && {
                  opacity:
                    0.72,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={17}
                color={
                  colors.greenDark
                }
              />

              <Text
                style={
                  styles.secondaryText
                }
              >
                RETRY
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(
                  '/bible' as any,
                )
              }
              style={({ pressed }) => [
                styles.primary,
                pressed && {
                  opacity:
                    0.76,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="book-open-variant"
                size={17}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.primaryText
                }
              >
                DAILY BIBLE READING
              </Text>
            </Pressable>
          </View>
        </Card>
      }
      renderItem={({
        item,
      }) => {
        const reflection =
          String(
            item
              .reflection_text ??
              '',
          ).trim();

        return (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push(
                `/devotional/${item.id}` as any,
              )
            }
            style={({ pressed }) => ({
              opacity:
                pressed
                  ? 0.74
                  : 1,
            })}
          >
            <Card>
              <View
                style={
                  styles.cardTop
                }
              >
                <View
                  style={
                    styles.cardIcon
                  }
                >
                  <MaterialCommunityIcons
                    name="book-open-page-variant-outline"
                    size={19}
                    color={
                      colors.greenDark
                    }
                  />
                </View>

                <View
                  style={{
                    flex:
                      1,
                  }}
                >
                  <Text
                    numberOfLines={2}
                    style={
                      styles.cardTitle
                    }
                  >
                    {
                      item.title ||
                      'Devotional'
                    }
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={
                      styles.passage
                    }
                  >
                    {
                      item.bible_passage ||
                      'Scripture & reflection'
                    }
                  </Text>
                </View>

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={21}
                  color={
                    colors.greenDark
                  }
                />
              </View>

              {!!reflection && (
                <Text
                  numberOfLines={3}
                  style={
                    styles.preview
                  }
                >
                  {reflection}
                </Text>
              )}

              <Text
                style={
                  styles.date
                }
              >
                {
                  item.publish_date ||
                  'Devotional series'
                }
              </Text>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}

const styles =
  StyleSheet.create({
    content: {
      padding:
        16,
      paddingBottom:
        44,
      gap:
        10,
    },

    loading: {
      flex:
        1,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        9,
    },

    loadingText: {
      fontSize:
        11,
      fontWeight:
        '800',
      color:
        colors.greenDark,
    },

    header: {
      marginBottom:
        4,
    },

    eyebrow: {
      marginBottom:
        4,
      fontSize:
        9,
      fontWeight:
        '900',
      letterSpacing:
        0.8,
      color:
        colors.greenDark,
    },

    subtitle: {
      marginTop:
        5,
      marginBottom:
        8,
      fontSize:
        11,
      lineHeight:
        17,
      color:
        colors.muted,
    },

    emptyIcon: {
      width:
        46,
      height:
        46,
      borderRadius:
        15,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenSoft,
    },

    emptyTitle: {
      marginTop:
        12,
      fontSize:
        16,
      fontWeight:
        '900',
      color:
        colors.text,
    },

    emptyBody: {
      marginTop:
        5,
      fontSize:
        11,
      lineHeight:
        17,
      color:
        colors.muted,
    },

    errorDetails: {
      marginTop:
        7,
      fontSize:
        9.5,
      lineHeight:
        14,
      color:
        '#8B3D3D',
    },

    emptyActions: {
      marginTop:
        14,
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        8,
    },

    primary: {
      minHeight:
        40,
      paddingHorizontal:
        12,
      borderRadius:
        12,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        6,
      backgroundColor:
        colors.greenDark,
    },

    primaryText: {
      fontSize:
        9,
      fontWeight:
        '900',
      color:
        '#FFFFFF',
    },

    secondary: {
      minHeight:
        40,
      paddingHorizontal:
        12,
      borderRadius:
        12,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        6,
      backgroundColor:
        colors.greenSoft,
    },

    secondaryText: {
      fontSize:
        9,
      fontWeight:
        '900',
      color:
        colors.greenDark,
    },

    cardTop: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        10,
    },

    cardIcon: {
      width:
        38,
      height:
        38,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenSoft,
    },

    cardTitle: {
      fontSize:
        13,
      lineHeight:
        17,
      fontWeight:
        '900',
      color:
        colors.text,
    },

    passage: {
      marginTop:
        2,
      fontSize:
        9.5,
      fontWeight:
        '700',
      color:
        colors.greenDark,
    },

    preview: {
      marginTop:
        10,
      fontSize:
        10.5,
      lineHeight:
        16,
      color:
        colors.text,
    },

    date: {
      marginTop:
        8,
      fontSize:
        8.5,
      fontWeight:
        '700',
      color:
        colors.muted,
    },
  });