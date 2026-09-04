import React from 'react';

import {
  Pressable,
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


  const isPublic =
    activeScope?.scope_type ===
      'PUBLIC';


  const showFaithContent =
    Boolean(
      activeScope
        ?.show_faith_content
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
   * Preserve previous faith-content behavior for the Word tile.
   *
   * My Classroom is account-scoped rather than faith/scope-gated, so it
   * remains available to every signed-in student from BUKLOD Main.
   */
  const showWord =
    Boolean(activeScope) &&
    (isPublic || showFaithContent);


  const inspire =
    isPublic &&
    !showFaithContent;

  const label = inspire
    ? 'Inspire'
    : 'Word';


  return (
    <View
      style={{
        width: 68,
        minHeight: 92,
        gap: 5,
        justifyContent: 'center',
      }}
    >
      {showWord ? (
        <Pressable
          accessibilityRole="button"
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
            width: '100%',
            minHeight: 42,
            paddingHorizontal: 5,
            borderRadius: 12,
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
            size={16}
            color={
              colors.greenDark
            }
          />

          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              marginTop: 1,
              fontSize: 8.5,
              lineHeight: 10,
              fontWeight: '900',
              color:
                colors.greenDark,
            }}
          >
            {label}
          </Text>

        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open My Classroom"
        onPress={() =>
          router.push(
            '/profile/buklod-classrooms' as any
          )
        }
        style={({
          pressed,
        }) => ({
          width: '100%',
          minHeight: showWord ? 45 : 92,
          paddingHorizontal: 4,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.greenSoft,
          borderWidth: 1,
          borderColor: colors.line,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <MaterialCommunityIcons
          name="school-outline"
          size={showWord ? 17 : 22}
          color={colors.greenDark}
        />

        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={{
            marginTop: 1,
            width: '100%',
            textAlign: 'center',
            fontSize: showWord ? 7.8 : 9.5,
            lineHeight: showWord ? 9 : 11,
            fontWeight: '900',
            color: colors.greenDark,
          }}
        >
          MY CLASSROOM
        </Text>
      </Pressable>
    </View>
  );
}
