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
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  LinearGradient,
} from 'expo-linear-gradient';

import {
  router,
} from 'expo-router';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  supabase,
} from '@/lib/supabase';

import {
  detectBuklodPublicLanguage,
} from '@/lib/buklodPublicDailyContent';

import {
  getBuklodLifeCopy,
  normalizeBuklodLifeLanguage,
  type BuklodLifeTopicKey,
} from '@/lib/buklodLifeContent';

import {
  useAuth,
} from '@/providers/AuthProvider';


export default function BuklodLifeScreen() {

  const insets =
    useSafeAreaInsets();

  const {
    user,
    profile,
  } =
    useAuth();

  const [
    address,
    setAddress,
  ] =
    useState<{
      country?: string | null;
      province?: string | null;
    }>({});


  useEffect(() => {

    let alive = true;

    const load =
      async () => {

        if (!user?.id) {
          return;
        }

        const {
          data,
        } =
          await supabase
            .from(
              'buklod_user_addresses'
            )
            .select(
              'country,province'
            )
            .eq(
              'user_id',
              user.id
            )
            .maybeSingle();

        if (
          alive &&
          data
        ) {
          setAddress(
            data
          );
        }
      };

    void load();

    return () => {
      alive = false;
    };

  }, [
    user?.id,
  ]);


  const language =
    useMemo(
      () =>
        normalizeBuklodLifeLanguage(
          detectBuklodPublicLanguage(
            (
              profile as any
            )?.preferred_language,
            address.country ??
              (
                profile as any
              )?.country,
            address.province ??
              (
                profile as any
              )?.province,
          )
        ),
      [
        profile,
        address.country,
        address.province,
      ]
    );


  const copy =
    useMemo(
      () =>
        getBuklodLifeCopy(
          language
        ),
      [
        language,
      ]
    );


  const openTopic =
    (
      topic: BuklodLifeTopicKey,
      question?: string,
    ) => {

      router.push({
        pathname:
          '/life/topic' as any,

        params: {
          topic,
          lang:
            language,
          ...(question
            ? {
              question,
            }
            : {}),
        },
      });
    };


  return (
    <ScrollView
      style={
        styles.screen
      }
      contentContainerStyle={[
        styles.content,
        {
          paddingTop:
            Math.max(
              insets.top,
              14
            ),
          paddingBottom:
            Math.max(
              insets.bottom + 28,
              42
            ),
        },
      ]}
      showsVerticalScrollIndicator={
        false
      }
    >

      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          accessibilityRole="button"
          accessibilityLabel={
            language === 'fil'
              ? 'Bumalik'
              : 'Back'
          }
          style={
            styles.back
          }
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={23}
            color="#24442B"
          />
        </Pressable>

        <View
          style={
            styles.headerCopy
          }
        >
          <Text
            style={
              styles.brand
            }
          >
            BUKLOD
            <Text
              style={
                styles.lifeWord
              }
            >
              {' '}Life
            </Text>
          </Text>

          <Text
            style={
              styles.brandSubtitle
            }
          >
            {copy.brandSubtitle}
          </Text>
        </View>

        <View
          style={
            styles.languageBadge
          }
        >
          <Text
            style={
              styles.languageText
            }
          >
            {copy.languageLabel}
          </Text>
        </View>
      </View>


      <LinearGradient
        colors={[
          '#F5EEDB',
          '#E7F0DF',
          '#D6E8D0',
        ]}
        start={{
          x: 0,
          y: 0,
        }}
        end={{
          x: 1,
          y: 1,
        }}
        style={
          styles.hero
        }
      >
        <View
          style={
            styles.heroSprout
          }
        >
          <MaterialCommunityIcons
            name="sprout"
            size={30}
            color="#2F6D3A"
          />
        </View>

        <Text
          style={
            styles.heroEyebrow
          }
        >
          {copy.eyebrow}
        </Text>

        <Text
          style={
            styles.heroTitle
          }
        >
          {copy.needTitle}
        </Text>

        <Text
          style={
            styles.heroBody
          }
        >
          {copy.needSubtitle}
        </Text>

        <View
          style={
            styles.privacyPill
          }
        >
          <MaterialCommunityIcons
            name="shield-lock-outline"
            size={14}
            color="#365D3E"
          />

          <Text
            style={
              styles.privacyText
            }
          >
            {
              language === 'fil'
                ? 'Pribado bilang default • Walang pressure'
                : 'Private by default • No pressure'
            }
          </Text>
        </View>
      </LinearGradient>


      <View
        style={
          styles.topicGrid
        }
      >
        {
          copy.primaryTopics.map(
            topic => (
              <Pressable
                key={
                  topic.key
                }
                onPress={() =>
                  openTopic(
                    topic.key
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={
                  topic.title
                }
                style={({ pressed }) => [
                  styles.topicCard,
                  {
                    backgroundColor:
                      topic.soft,
                    borderColor:
                      `${topic.accent}22`,
                  },
                  pressed &&
                    styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.topicIcon,
                    {
                      backgroundColor:
                        topic.accent,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      topic.icon
                    }
                    size={22}
                    color="#FFFFFF"
                  />
                </View>

                <Text
                  style={[
                    styles.topicTitle,
                    {
                      color:
                        topic.accent,
                    },
                  ]}
                >
                  {topic.title}
                </Text>

                <Text
                  numberOfLines={3}
                  style={
                    styles.topicSubtitle
                  }
                >
                  {topic.subtitle}
                </Text>

                <MaterialCommunityIcons
                  name="arrow-top-right"
                  size={16}
                  color={
                    topic.accent
                  }
                  style={
                    styles.topicArrow
                  }
                />
              </Pressable>
            )
          )
        }
      </View>


      <Text
        style={
          styles.sectionTitle
        }
      >
        {copy.forYouTitle}
      </Text>

      <Pressable
        onPress={() =>
          openTopic(
            'hope'
          )
        }
        style={({ pressed }) => [
          styles.featureCard,
          pressed &&
            styles.pressed,
        ]}
      >
        <LinearGradient
          colors={[
            '#233D2B',
            '#49664E',
            '#8C7A4D',
          ]}
          start={{
            x: 0,
            y: 0,
          }}
          end={{
            x: 1,
            y: 1,
          }}
          style={
            styles.featureGradient
          }
        >
          <MaterialCommunityIcons
            name="weather-sunset-up"
            size={31}
            color="#F4D98B"
          />

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.featureTitle
              }
            >
              {copy.forYouHeadline}
            </Text>

            <Text
              style={
                styles.featureBody
              }
            >
              {copy.forYouBody}
            </Text>
          </View>

          <View
            style={
              styles.roundArrow
            }
          >
            <MaterialCommunityIcons
              name="arrow-right"
              size={18}
              color="#1F4529"
            />
          </View>
        </LinearGradient>
      </Pressable>


      <View
        style={
          styles.sectionRow
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          {copy.strugglesTitle}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.horizontalRow
        }
      >
        {
          copy.commonStruggles.map(
            item => (
              <Pressable
                key={
                  item.label
                }
                onPress={() =>
                  openTopic(
                    item.target
                  )
                }
                style={({ pressed }) => [
                  styles.struggleCard,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <View
                  style={
                    styles.struggleIcon
                  }
                >
                  <MaterialCommunityIcons
                    name={
                      item.icon
                    }
                    size={23}
                    color="#335C3D"
                  />
                </View>

                <Text
                  style={
                    styles.struggleText
                  }
                >
                  {item.label}
                </Text>
              </Pressable>
            )
          )
        }
      </ScrollView>


      <View
        style={
          styles.sectionRow
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          {copy.questionsTitle}
        </Text>

        <Pressable
          onPress={() =>
            openTopic(
              'questions'
            )
          }
        >
          <Text
            style={
              styles.seeAll
            }
          >
            {copy.seeAll} →
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.horizontalRow
        }
      >
        {
          copy.questions
            .slice(
              0,
              4
            )
            .map(
              (
                question,
                index
              ) => (
                <Pressable
                  key={
                    question
                  }
                  onPress={() =>
                    openTopic(
                      'questions',
                      question
                    )
                  }
                  style={({ pressed }) => [
                    styles.questionCard,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.questionIcon,
                      index === 2 && {
                        backgroundColor:
                          '#F5E6D7',
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        index === 2
                          ? 'cross'
                          : 'help-circle-outline'
                      }
                      size={24}
                      color={
                        index === 2
                          ? '#9B5B2F'
                          : '#365D3E'
                      }
                    />
                  </View>

                  <Text
                    numberOfLines={4}
                    style={
                      styles.questionText
                    }
                  >
                    {question}
                  </Text>
                </Pressable>
              )
            )
        }
      </ScrollView>


      <Text
        style={
          styles.sectionTitle
        }
      >
        {copy.exploreTitle}
      </Text>

      <Pressable
        onPress={() =>
          openTopic(
            'jesus'
          )
        }
        style={({ pressed }) => [
          styles.bigCard,
          pressed &&
            styles.pressed,
        ]}
      >
        <LinearGradient
          colors={[
            '#F5E7D3',
            '#EED0A8',
            '#E9B97D',
          ]}
          start={{
            x: 0,
            y: 0,
          }}
          end={{
            x: 1,
            y: 1,
          }}
          style={
            styles.bigGradient
          }
        >
          <View
            style={
              styles.bigIcon
            }
          >
            <MaterialCommunityIcons
              name="book-open-page-variant-outline"
              size={28}
              color="#7C4A26"
            />
          </View>

          <Text
            style={
              styles.bigTitle
            }
          >
            {copy.exploreHeadline}
          </Text>

          <Text
            style={
              styles.bigBody
            }
          >
            {copy.exploreBody}
          </Text>

          <View
            style={
              styles.bigCta
            }
          >
            <Text
              style={
                styles.bigCtaText
              }
            >
              {copy.exploreCta}
            </Text>

            <MaterialCommunityIcons
              name="arrow-right"
              size={17}
              color="#FFFFFF"
            />
          </View>
        </LinearGradient>
      </Pressable>


      <Text
        style={
          styles.sectionTitle
        }
      >
        {copy.helpTitle}
      </Text>

      <Pressable
        onPress={() =>
          openTopic(
            'help'
          )
        }
        style={({ pressed }) => [
          styles.bigCard,
          pressed &&
            styles.pressed,
        ]}
      >
        <LinearGradient
          colors={[
            '#E8F0DF',
            '#D7E7CE',
            '#C6D9B8',
          ]}
          start={{
            x: 0,
            y: 0,
          }}
          end={{
            x: 1,
            y: 1,
          }}
          style={
            styles.bigGradient
          }
        >
          <View
            style={[
              styles.bigIcon,
              {
                backgroundColor:
                  'rgba(255,255,255,0.72)',
              },
            ]}
          >
            <MaterialCommunityIcons
              name="hand-heart-outline"
              size={29}
              color="#355D3D"
            />
          </View>

          <Text
            style={[
              styles.bigTitle,
              {
                color:
                  '#24482D',
              },
            ]}
          >
            {copy.helpHeadline}
          </Text>

          <Text
            style={[
              styles.bigBody,
              {
                color:
                  '#3E5C45',
              },
            ]}
          >
            {copy.helpBody}
          </Text>

          <View
            style={[
              styles.bigCta,
              {
                backgroundColor:
                  '#2F6D3A',
              },
            ]}
          >
            <Text
              style={
                styles.bigCtaText
              }
            >
              {copy.helpCta}
            </Text>

            <MaterialCommunityIcons
              name="arrow-right"
              size={17}
              color="#FFFFFF"
            />
          </View>
        </LinearGradient>
      </Pressable>


      <Text
        style={
          styles.footer
        }
      >
        {
          language === 'fil'
            ? 'Ang LIFE ay pribado bilang default. Ikaw ang magpapasya kung magpapatuloy, magtatanong, o hihinto muna.'
            : 'LIFE is private by default. You choose whether to continue, ask a question, or stop for now.'
        }
      </Text>

    </ScrollView>
  );
}


const styles =
  StyleSheet.create({

    screen: {
      flex:
        1,

      backgroundColor:
        '#FAFAF7',
    },

    content: {
      paddingHorizontal:
        14,
    },

    header: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        10,

      marginBottom:
        12,
    },

    back: {
      width:
        42,

      height:
        42,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E3E8E1',
    },

    headerCopy: {
      flex:
        1,
    },

    brand: {
      fontSize:
        22,

      fontWeight:
        '900',

      color:
        '#173D22',
    },

    lifeWord: {
      color:
        '#6C8B2A',

      fontStyle:
        'italic',
    },

    brandSubtitle: {
      marginTop:
        1,

      fontSize:
        10,

      fontWeight:
        '800',

      color:
        '#6C756B',
    },

    languageBadge: {
      paddingHorizontal:
        8,

      paddingVertical:
        6,

      borderRadius:
        999,

      backgroundColor:
        '#E7F0DF',
    },

    languageText: {
      fontSize:
        7,

      letterSpacing:
        0.7,

      fontWeight:
        '900',

      color:
        '#365D3E',
    },

    hero: {
      padding:
        18,

      borderRadius:
        24,

      overflow:
        'hidden',

      borderWidth:
        1,

      borderColor:
        'rgba(47,109,58,0.12)',

      marginBottom:
        14,
    },

    heroSprout: {
      width:
        54,

      height:
        54,

      borderRadius:
        18,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(255,255,255,0.74)',

      marginBottom:
        14,
    },

    heroEyebrow: {
      fontSize:
        9,

      fontWeight:
        '900',

      letterSpacing:
        1.1,

      color:
        '#477250',

      marginBottom:
        5,
    },

    heroTitle: {
      fontSize:
        25,

      lineHeight:
        30,

      fontWeight:
        '900',

      color:
        '#1F3926',
    },

    heroBody: {
      marginTop:
        5,

      fontSize:
        13,

      lineHeight:
        19,

      color:
        '#506455',
    },

    privacyPill: {
      alignSelf:
        'flex-start',

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        6,

      marginTop:
        14,

      paddingHorizontal:
        9,

      paddingVertical:
        7,

      borderRadius:
        999,

      backgroundColor:
        'rgba(255,255,255,0.62)',
    },

    privacyText: {
      fontSize:
        9,

      fontWeight:
        '800',

      color:
        '#365D3E',
    },

    topicGrid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        10,

      marginBottom:
        18,
    },

    topicCard: {
      width:
        '48.4%',

      minHeight:
        156,

      borderRadius:
        20,

      borderWidth:
        1,

      padding:
        13,

      position:
        'relative',
    },

    topicIcon: {
      width:
        42,

      height:
        42,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginBottom:
        11,
    },

    topicTitle: {
      fontSize:
        18,

      fontWeight:
        '900',

      marginBottom:
        5,
    },

    topicSubtitle: {
      paddingRight:
        18,

      fontSize:
        11,

      lineHeight:
        16,

      color:
        '#46534A',
    },

    topicArrow: {
      position:
        'absolute',

      right:
        11,

      bottom:
        11,
    },

    pressed: {
      opacity:
        0.9,

      transform: [
        {
          scale:
            0.99,
        },
      ],
    },

    sectionRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    sectionTitle: {
      marginBottom:
        9,

      fontSize:
        18,

      fontWeight:
        '900',

      color:
        '#1F3325',
    },

    seeAll: {
      marginBottom:
        9,

      fontSize:
        10,

      fontWeight:
        '800',

      color:
        '#59705F',
    },

    featureCard: {
      marginBottom:
        18,

      borderRadius:
        20,

      overflow:
        'hidden',
    },

    featureGradient: {
      minHeight:
        142,

      borderRadius:
        20,

      padding:
        16,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        12,
    },

    featureTitle: {
      fontSize:
        19,

      fontWeight:
        '900',

      color:
        '#FFFFFF',

      marginBottom:
        4,
    },

    featureBody: {
      fontSize:
        11,

      lineHeight:
        16,

      color:
        'rgba(255,255,255,0.84)',
    },

    roundArrow: {
      width:
        36,

      height:
        36,

      borderRadius:
        18,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F7F1DF',
    },

    horizontalRow: {
      gap:
        9,

      paddingBottom:
        17,
    },

    struggleCard: {
      width:
        116,

      minHeight:
        118,

      borderRadius:
        18,

      padding:
        12,

      justifyContent:
        'space-between',

      backgroundColor:
        '#EEF2EB',

      borderWidth:
        1,

      borderColor:
        '#E1E8DE',
    },

    struggleIcon: {
      width:
        42,

      height:
        42,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',
    },

    struggleText: {
      fontSize:
        12,

      lineHeight:
        16,

      fontWeight:
        '900',

      color:
        '#293E30',
    },

    questionCard: {
      width:
        135,

      minHeight:
        148,

      borderRadius:
        18,

      padding:
        12,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E5E8E2',
    },

    questionIcon: {
      width:
        42,

      height:
        42,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#E8F0E4',

      marginBottom:
        12,
    },

    questionText: {
      fontSize:
        12,

      lineHeight:
        17,

      fontWeight:
        '800',

      color:
        '#2A3B30',
    },

    bigCard: {
      marginBottom:
        18,

      borderRadius:
        22,

      overflow:
        'hidden',
    },

    bigGradient: {
      minHeight:
        220,

      padding:
        18,

      borderRadius:
        22,
    },

    bigIcon: {
      width:
        52,

      height:
        52,

      borderRadius:
        17,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(255,255,255,0.58)',

      marginBottom:
        15,
    },

    bigTitle: {
      maxWidth:
        270,

      fontSize:
        22,

      lineHeight:
        27,

      fontWeight:
        '900',

      color:
        '#633D23',
    },

    bigBody: {
      maxWidth:
        310,

      marginTop:
        7,

      fontSize:
        12,

      lineHeight:
        18,

      color:
        '#71533A',
    },

    bigCta: {
      alignSelf:
        'flex-start',

      marginTop:
        18,

      paddingHorizontal:
        13,

      paddingVertical:
        9,

      borderRadius:
        999,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        6,

      backgroundColor:
        '#8B5731',
    },

    bigCtaText: {
      fontSize:
        11,

      fontWeight:
        '900',

      color:
        '#FFFFFF',
    },

    footer: {
      marginTop:
        2,

      paddingHorizontal:
        10,

      textAlign:
        'center',

      fontSize:
        10,

      lineHeight:
        15,

      color:
        '#788078',
    },

  });
