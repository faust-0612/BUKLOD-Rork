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
   * Show Faith ON  -> Word
   * Show Faith OFF -> Inspire
   *
   * My Classroom remains account-scoped and is always available.
   * HOME_IDENTITY_ACTION_ROW_R1 keeps these as equal horizontal tiles so
   * the member name can use the full width above the action row.
   */
  const showWord =
    Boolean(activeScope) &&
    (isPublic || showFaithContent);


  const inspire =
    isPublic &&
    !showFaithContent;

  const label = inspire
    ? 'INSPIRE'
    : 'WORD';

  const tileStyle = ({ pressed }: { pressed: boolean }) => ({
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    paddingHorizontal: 5,
    paddingVertical: 7,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.greenSoft,
    borderWidth: 1,
    borderColor: colors.line,
    opacity: pressed ? 0.65 : 1,
  });


  return (
    <View
      style={{
        flex: showWord ? 2 : 1,
        minWidth: 0,
        flexDirection: 'row',
        gap: 6,
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
          style={tileStyle}
        >
          <MaterialCommunityIcons
            name={
              inspire
                ? 'book-open-outline'
                : 'book-open-page-variant-outline'
            }
            size={20}
            color={colors.greenDark}
          />

          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              marginTop: 3,
              width: '100%',
              textAlign: 'center',
              fontSize: 8.5,
              lineHeight: 10,
              fontWeight: '900',
              color: colors.greenDark,
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
        style={tileStyle}
      >
        <MaterialCommunityIcons
          name="school-outline"
          size={20}
          color={colors.greenDark}
        />

        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={{
            marginTop: 3,
            width: '100%',
            textAlign: 'center',
            fontSize: 8.2,
            lineHeight: 10,
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
