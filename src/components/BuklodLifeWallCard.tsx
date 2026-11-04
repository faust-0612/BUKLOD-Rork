import React, { useMemo } from 'react';

import {
  Pressable,
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
  detectBuklodPublicLanguage,
} from '@/lib/buklodPublicDailyContent';

import {
  getBuklodLifeWallCopy,
  normalizeBuklodLifeLanguage,
} from '@/lib/buklodLifeContent';

import {
  useAuth,
} from '@/providers/AuthProvider';


export default function BuklodLifeWallCard() {

  const {
    profile,
  } = useAuth();

  const language =
    useMemo(
      () =>
        normalizeBuklodLifeLanguage(
          detectBuklodPublicLanguage(
            (
              profile as any
            )?.preferred_language,
            (
              profile as any
            )?.country,
            (
              profile as any
            )?.province,
          )
        ),
      [
        profile,
      ]
    );

  const copy =
    useMemo(
      () =>
        getBuklodLifeWallCopy(
          language
        ),
      [
        language,
      ]
    );


  return (
    <Pressable
      onPress={() =>
        router.push(
          '/life' as any
        )
      }
      accessibilityRole="button"
      accessibilityLabel={
        language === 'fil'
          ? 'Buksan ang BUKLOD LIFE'
          : 'Open BUKLOD LIFE'
      }
      style={({ pressed }) => [
        styles.wrap,
        pressed && {
          opacity: 0.94,
          transform: [
            {
              scale: 0.995,
            },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={[
          '#F6F1DD',
          '#E5F0DF',
          '#D5E7D0',
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
          styles.card
        }
      >
        <View
          pointerEvents="none"
          style={
            styles.glowA
          }
        />

        <View
          pointerEvents="none"
          style={
            styles.glowB
          }
        />

        <View
          style={
            styles.icon
          }
        >
          <MaterialCommunityIcons
            name="sprout"
            size={24}
            color="#2E6737"
          />
        </View>

        <View
          style={
            styles.copy
          }
        >
          <View
            style={
              styles.titleRow
            }
          >
            <Text
              style={
                styles.title
              }
            >
              {copy.title}
            </Text>

            <Text
              style={
                styles.language
              }
            >
              {
                language === 'fil'
                  ? 'FILIPINO'
                  : 'ENGLISH'
              }
            </Text>
          </View>

          <Text
            style={
              styles.subtitle
            }
          >
            {copy.subtitle}
          </Text>

          <Text
            numberOfLines={2}
            style={
              styles.body
            }
          >
            {copy.body}
          </Text>
        </View>

        <View
          style={
            styles.cta
          }
        >
          <Text
            style={
              styles.ctaText
            }
          >
            {copy.cta}
          </Text>

          <MaterialCommunityIcons
            name="arrow-right"
            size={16}
            color="#FFFFFF"
          />
        </View>
      </LinearGradient>
    </Pressable>
  );
}


const styles =
  StyleSheet.create({

    wrap: {
      marginBottom:
        8,
    },

    card: {
      minHeight:
        100,

      borderRadius:
        20,

      overflow:
        'hidden',

      borderWidth:
        1,

      borderColor:
        'rgba(47,109,58,0.16)',

      padding:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        9,
    },

    glowA: {
      position:
        'absolute',

      width:
        150,

      height:
        150,

      borderRadius:
        75,

      backgroundColor:
        'rgba(255,255,255,0.32)',

      top:
        -75,

      right:
        -30,
    },

    glowB: {
      position:
        'absolute',

      width:
        90,

      height:
        90,

      borderRadius:
        45,

      backgroundColor:
        'rgba(214,166,54,0.10)',

      bottom:
        -30,

      left:
        80,
    },

    icon: {
      width:
        44,

      height:
        44,

      borderRadius:
        18,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(255,255,255,0.78)',

      borderWidth:
        1,

      borderColor:
        'rgba(47,109,58,0.14)',
    },

    copy: {
      flex:
        1,

      minWidth:
        0,
    },

    titleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        7,

      marginBottom:
        3,
    },

    title: {
      fontSize:
        19,

      fontWeight:
        '900',

      color:
        '#173D22',

      letterSpacing:
        0.2,
    },

    language: {
      fontSize:
        7,

      fontWeight:
        '900',

      letterSpacing:
        0.8,

      color:
        '#376941',

      backgroundColor:
        'rgba(255,255,255,0.62)',

      paddingHorizontal:
        6,

      paddingVertical:
        4,

      borderRadius:
        999,
    },

    subtitle: {
      fontSize:
        11,

      fontWeight:
        '800',

      color:
        '#4B694F',

      marginBottom:
        4,
    },

    body: {
      fontSize:
        12,

      lineHeight:
        17,

      color:
        '#334C38',
    },

    cta: {
      alignSelf:
        'flex-end',

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        5,

      paddingHorizontal:
        9,

      paddingVertical:
        7,

      borderRadius:
        999,

      backgroundColor:
        '#2F6D3A',
    },

    ctaText: {
      fontSize:
        10,

      fontWeight:
        '900',

      color:
        '#FFFFFF',
    },

  });
