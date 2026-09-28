import React, {
  useEffect,
  useMemo,
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
  useLocalSearchParams,
} from 'expo-router';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  normalizeBuklodLifeLanguage,
} from '@/lib/buklodLifeContent';

import {
  markMyBuklodLifeStage,
  recordBuklodLifeReferralFunnel,
} from '@/lib/buklodLifeImpact';

import {
  useAuth,
} from '@/providers/AuthProvider';


export default function BuklodLifeInviteWelcomeScreen() {

  const insets =
    useSafeAreaInsets();

  const params =
    useLocalSearchParams<{
      ref?: string;
    }>();

  const {
    profile,
  } =
    useAuth();

  const language =
    useMemo(
      () =>
        normalizeBuklodLifeLanguage(
          (
            profile as any
          )?.preferred_language
        ),
      [
        profile,
      ]
    );

  const copy =
    language === 'fil'
      ? {
        welcome:
          'Welcome sa BUKLOD!',
        invited:
          'Inimbitahan ka ng isang BUKLOD member.',
        discover:
          'Kilalanin si Jesus',
        discoverSub:
          'Opsyonal na paglalakbay upang malaman kung sino si Jesus at bakit Siya mahalaga.',
        explore:
          'Tuklasin ang BUKLOD',
        exploreSub:
          'Sumali sa community, matuto, makipag-connect, at gamitin ang normal na BUKLOD features.',
        later:
          'Baka Mamaya',
        laterSub:
          'Maaari mong balikan ang LIFE anumang oras. Walang pressure.',
        optional:
          'OPSyonal',
      }
      : {
        welcome:
          'Welcome to BUKLOD!',
        invited:
          'Someone shared BUKLOD with you.',
        discover:
          'Discover Jesus',
        discoverSub:
          'An optional journey to learn who Jesus is and why He matters.',
        explore:
          'Explore BUKLOD',
        exploreSub:
          'Join the community, learn, connect, and use normal BUKLOD features.',
        later:
          'Maybe Later',
        laterSub:
          'You can return to LIFE anytime. There is no pressure.',
        optional:
          'OPTIONAL',
      };


  useEffect(() => {

    void recordBuklodLifeReferralFunnel(
      'LINK_OPEN',
      'LIFE_INVITE'
    );

  }, []);


  const discover =
    async () => {

      await markMyBuklodLifeStage(
        'JESUS_SHARED'
      );

      router.replace({
        pathname:
          '/life/topic' as any,

        params: {
          topic:
            'jesus',
          lang:
            language,
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
            router.replace(
              '/(tabs)/buklod' as any
            )
          }
          style={
            styles.back
          }
          accessibilityRole="button"
          accessibilityLabel={
            language === 'fil'
              ? 'Pumunta sa Community'
              : 'Go to Community'
          }
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={23}
            color="#24442B"
          />
        </Pressable>

        <Text
          style={
            styles.headerTitle
          }
        >
          {copy.welcome}
        </Text>
      </View>

      <LinearGradient
        colors={[
          '#E8F7FF',
          '#F3F7FF',
          '#FFF1DF',
        ]}
        start={{
          x:
            0,
          y:
            0,
        }}
        end={{
          x:
            1,
          y:
            1,
        }}
        style={
          styles.hero
        }
      >
        <View
          style={
            styles.logo
          }
        >
          <MaterialCommunityIcons
            name="leaf"
            size={45}
            color="#FFFFFF"
          />
        </View>

        <View
          style={
            styles.people
          }
        >
          {
            [
              '#2D84C9',
              '#4C9E6A',
              '#F0A438',
              '#8C6DD6',
              '#D66472',
            ].map(
              (
                color,
                index
              ) => (
                <View
                  key={
                    color
                  }
                  style={[
                    styles.person,
                    {
                      backgroundColor:
                        color,
                      marginLeft:
                        index === 0
                          ? 0
                          : -8,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="account"
                    size={27}
                    color="#FFFFFF"
                  />
                </View>
              )
            )
          }
        </View>
      </LinearGradient>

      <View
        style={
          styles.invitedCard
        }
      >
        <Text
          style={
            styles.invitedTitle
          }
        >
          {
            language === 'fil'
              ? 'Imbitado Ka!'
              : 'You’re Invited!'
          }
        </Text>

        <Text
          style={
            styles.invitedSub
          }
        >
          {copy.invited}
        </Text>

        {!!params.ref && (
          <View
            style={
              styles.codePill
            }
          >
            <MaterialCommunityIcons
              name="ticket-confirmation-outline"
              size={15}
              color="#61706A"
            />

            <Text
              style={
                styles.codeText
              }
            >
              {
                String(
                  params.ref
                )
                  .slice(
                    0,
                    12
                  )
                  .toUpperCase()
              }
            </Text>
          </View>
        )}
      </View>

      <Pressable
        onPress={() =>
          void discover()
        }
        style={({ pressed }) => [
          styles.option,
          styles.discoverOption,
          pressed &&
            styles.pressed,
        ]}
      >
        <View
          style={[
            styles.optionIcon,
            {
              backgroundColor:
                '#FFF2D8',
            },
          ]}
        >
          <MaterialCommunityIcons
            name="cross"
            size={30}
            color="#E69123"
          />
        </View>

        <View
          style={{
            flex:
              1,
          }}
        >
          <View
            style={
              styles.optionTitleRow
            }
          >
            <Text
              style={
                styles.optionTitle
              }
            >
              {copy.discover}
            </Text>

            <Text
              style={
                styles.optional
              }
            >
              {copy.optional}
            </Text>
          </View>

          <Text
            style={
              styles.optionSub
            }
          >
            {copy.discoverSub}
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={23}
          color="#D38524"
        />
      </Pressable>

      <Pressable
        onPress={() =>
          router.replace(
            '/(tabs)/buklod' as any
          )
        }
        style={({ pressed }) => [
          styles.option,
          pressed &&
            styles.pressed,
        ]}
      >
        <View
          style={[
            styles.optionIcon,
            {
              backgroundColor:
                '#E4F3FF',
            },
          ]}
        >
          <MaterialCommunityIcons
            name="account-group-outline"
            size={29}
            color="#2784C5"
          />
        </View>

        <View
          style={{
            flex:
              1,
          }}
        >
          <Text
            style={
              styles.optionTitle
            }
          >
            {copy.explore}
          </Text>

          <Text
            style={
              styles.optionSub
            }
          >
            {copy.exploreSub}
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={23}
          color="#76817A"
        />
      </Pressable>

      <Pressable
        onPress={() =>
          router.replace(
            '/life' as any
          )
        }
        style={({ pressed }) => [
          styles.option,
          pressed &&
            styles.pressed,
        ]}
      >
        <View
          style={[
            styles.optionIcon,
            {
              backgroundColor:
                '#ECEBFA',
            },
          ]}
        >
          <MaterialCommunityIcons
            name="star-outline"
            size={29}
            color="#6765BD"
          />
        </View>

        <View
          style={{
            flex:
              1,
          }}
        >
          <Text
            style={
              styles.optionTitle
            }
          >
            {copy.later}
          </Text>

          <Text
            style={
              styles.optionSub
            }
          >
            {copy.laterSub}
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={23}
          color="#76817A"
        />
      </Pressable>

      <View
        style={
          styles.privacy
        }
      >
        <MaterialCommunityIcons
          name="shield-lock-outline"
          size={18}
          color="#5F7564"
        />

        <Text
          style={
            styles.privacyText
          }
        >
          {
            language === 'fil'
              ? 'Hindi ipinapakita sa inviter ang iyong identity o personal faith response nang walang malinaw mong consent.'
              : 'Your identity and personal faith response are not shown to the inviter without your explicit consent.'
          }
        </Text>
      </View>
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
        12,

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
        '#E2E7E1',
    },

    headerTitle: {
      flex:
        1,

      textAlign:
        'center',

      paddingRight:
        42,

      fontSize:
        18,

      fontWeight:
        '900',

      color:
        '#1F2D4A',
    },

    hero: {
      minHeight:
        225,

      borderRadius:
        24,

      alignItems:
        'center',

      justifyContent:
        'center',

      overflow:
        'hidden',

      borderWidth:
        1,

      borderColor:
        '#DCE9F0',

      marginBottom:
        -36,
    },

    logo: {
      width:
        92,

      height:
        92,

      borderRadius:
        46,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#2287E8',

      shadowColor:
        '#2287E8',

      shadowOpacity:
        0.22,

      shadowRadius:
        18,

      shadowOffset: {
        width:
          0,
        height:
          8,
      },

      elevation:
        4,
    },

    people: {
      flexDirection:
        'row',

      marginTop:
        24,
    },

    person: {
      width:
        44,

      height:
        44,

      borderRadius:
        22,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderWidth:
        3,

      borderColor:
        '#FFFFFF',
    },

    invitedCard: {
      marginHorizontal:
        10,

      padding:
        18,

      borderRadius:
        22,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E5E8E3',

      alignItems:
        'center',

      marginBottom:
        13,

      shadowColor:
        '#000000',

      shadowOpacity:
        0.08,

      shadowRadius:
        12,

      shadowOffset: {
        width:
          0,
        height:
          4,
      },

      elevation:
        3,
    },

    invitedTitle: {
      fontSize:
        23,

      fontWeight:
        '900',

      color:
        '#151B5B',
    },

    invitedSub: {
      marginTop:
        5,

      fontSize:
        12,

      color:
        '#65706A',
    },

    codePill: {
      marginTop:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        6,

      paddingHorizontal:
        10,

      paddingVertical:
        6,

      borderRadius:
        999,

      backgroundColor:
        '#F3F5F2',
    },

    codeText: {
      fontSize:
        9,

      fontWeight:
        '900',

      letterSpacing:
        1,

      color:
        '#61706A',
    },

    option: {
      minHeight:
        104,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        12,

      padding:
        14,

      borderRadius:
        19,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E3E7E2',

      marginBottom:
        10,
    },

    discoverOption: {
      backgroundColor:
        '#FFFBF3',

      borderColor:
        '#F1E2C4',
    },

    optionIcon: {
      width:
        56,

      height:
        56,

      borderRadius:
        18,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    optionTitleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        6,
    },

    optionTitle: {
      fontSize:
        15,

      fontWeight:
        '900',

      color:
        '#253243',
    },

    optional: {
      fontSize:
        8,

      fontWeight:
        '900',

      color:
        '#D47B20',
    },

    optionSub: {
      marginTop:
        4,

      fontSize:
        10.5,

      lineHeight:
        15,

      color:
        '#68736C',
    },

    privacy: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap:
        8,

      padding:
        13,

      borderRadius:
        15,

      backgroundColor:
        '#EFF4EC',

      marginTop:
        3,
    },

    privacyText: {
      flex:
        1,

      fontSize:
        9.5,

      lineHeight:
        14,

      color:
        '#5D695F',
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

  });
