import React from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
} from 'expo-router';

import { useBuklodScope } from '@/providers/BuklodScopeProvider';

import type {
  BuklodLifeLanguage,
} from '@/lib/buklodLifeContent';

export type BuklodLifeTab =
  | 'my-life'
  | 'share'
  | 'impact';

export default function BuklodLifeTabs({
  active,
  language,
}: {
  active: BuklodLifeTab;
  language: BuklodLifeLanguage;
}) {
  const { activeScope } = useBuklodScope();

  const showFaithContent =
    Boolean(activeScope?.show_faith_content);

  const visibleTabs: readonly BuklodLifeTab[] =
    showFaithContent
      ? ['my-life', 'share', 'impact']
      : ['my-life'];

  const labels =
    language === 'fil'
      ? {
        'my-life':
          'My Life',
        share:
          'Ibahagi si Jesus',
        impact:
          'Impact',
      }
      : {
        'my-life':
          'My Life',
        share:
          'Share Jesus',
        impact:
          'Impact',
      };

  const open =
    (
      tab:
        BuklodLifeTab
    ) => {

      if (
        tab === active
      ) {
        return;
      }

      if (
        tab === 'share'
      ) {
        router.replace(
          '/life/share' as any
        );
        return;
      }

      if (
        tab === 'impact'
      ) {
        router.replace(
          '/life/impact' as any
        );
        return;
      }

      router.replace(
        '/life' as any
      );
    };

  return (
    <View
      style={
        styles.tabs
      }
    >
      {visibleTabs.map(
        tab => {

          const on =
            active === tab;

          return (
            <Pressable
              key={
                tab
              }
              onPress={() =>
                open(tab)
              }
              accessibilityRole="tab"
              accessibilityState={{
                selected:
                  on,
              }}
              style={[
                styles.tab,
                on &&
                  styles.tabOn,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.tabText,
                  on &&
                    styles.tabTextOn,
                ]}
              >
                {
                  labels[
                    tab
                  ]
                }
              </Text>
            </Pressable>
          );
        }
      )}
    </View>
  );
}


const styles =
  StyleSheet.create({

    tabs: {
      flexDirection:
        'row',

      padding:
        4,

      borderRadius:
        16,

      backgroundColor:
        '#E7F0F5',

      marginBottom:
        14,
    },

    tab: {
      flex:
        1,

      minHeight:
        40,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        12,

      paddingHorizontal:
        8,
    },

    tabOn: {
      backgroundColor:
        '#FFFFFF',

      shadowColor:
        '#000000',

      shadowOpacity:
        0.08,

      shadowRadius:
        4,

      shadowOffset: {
        width:
          0,
        height:
          1,
      },

      elevation:
        1,
    },

    tabText: {
      fontSize:
        11,

      fontWeight:
        '800',

      color:
        '#33506C',
    },

    tabTextOn: {
      color:
        '#0F5699',
    },

  });
