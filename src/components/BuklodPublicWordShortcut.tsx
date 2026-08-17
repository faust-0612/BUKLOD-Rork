import React from 'react';

import {
  Pressable,
  Text,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
} from 'expo-router';

import {
  colors,
} from '@/lib/theme';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';


export default function BuklodPublicWordShortcut() {

  const {
    activeScope,
  } =
    useBuklodScope();


  if (!activeScope) {
    return null;
  }


  const isPublic =
    activeScope.scope_type ===
      'PUBLIC';


  const showFaithContent =
    Boolean(
      activeScope
        .show_faith_content
    );


  /*
   * PUBLIC:
   *
   * Show Faith ON
   *   -> WORD
   *   -> /word
   *
   * Show Faith OFF
   *   -> INSPIRE
   *   -> /inspire
   *
   * NON-PUBLIC:
   * Preserve previous faith-content behavior.
   */
  if (
    !isPublic &&
    !showFaithContent
  ) {
    return null;
  }


  const inspire =
    isPublic &&
    !showFaithContent;


  return (
    <Pressable
      accessibilityLabel={
        inspire
          ? 'Daily Inspire'
          : 'Word devotional and Bible'
      }
      onPress={() =>
        router.push(
          (
            inspire
              ? '/inspire'
              : '/word'
          ) as any
        )
      }
      style={({
        pressed,
      }) => ({
        width: 50,
        height: 50,
        borderRadius: 15,
        alignItems:
          'center',
        justifyContent:
          'center',
        backgroundColor:
          colors.greenSoft,
        borderWidth: 1,
        borderColor:
          colors.line,
        opacity:
          pressed
            ? 0.65
            : 1,
      })}
    >

      <MaterialCommunityIcons
        name={
          inspire
            ? 'book-open-outline'
            : 'book-open-page-variant-outline'
        }
        size={20}
        color={
          colors.greenDark
        }
      />

      <Text
        style={{
          marginTop: 1,
          fontSize: 7,
          lineHeight: 8,
          fontWeight: '900',
          letterSpacing: 0.25,
          color:
            colors.greenDark,
        }}
      >
        {
          inspire
            ? 'INSPIRE'
            : 'WORD'
        }
      </Text>

    </Pressable>
  );
}