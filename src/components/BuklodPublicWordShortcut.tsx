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
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';


export default function BuklodPublicWordShortcut() {
  const { colors } = useBuklodPresentation();

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
   *   -> Word
   *   -> /word
   *
   * Show Faith OFF
   *   -> Inspire
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

  const label = inspire
    ? 'Inspire'
    : 'Word';


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
        minWidth: 58,
        height: 44,
        paddingHorizontal: 8,
        borderRadius: 14,
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
        size={18}
        color={
          colors.greenDark
        }
      />

      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={{
          marginTop: 1,
          fontSize: 9,
          lineHeight: 11,
          fontWeight: '900',
          color:
            colors.greenDark,
        }}
      >
        {label}
      </Text>

    </Pressable>
  );
}
