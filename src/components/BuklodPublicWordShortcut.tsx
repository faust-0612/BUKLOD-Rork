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

/* BUKLOD_CHARACTER_V2_WEB_RELEASE_TRIGGER_R1 */
/* BUKLOD_HOME_IDENTITY_R23_EQUAL_SHORTCUTS */
/* BUKLOD_KINGDOM_PROFILE_RELOCATION_R1 */
export default function BuklodPublicWordShortcut() {
  const { colors } = useBuklodPresentation();
  const { activeScope } = useBuklodScope();

  const isPublic = activeScope?.scope_type === 'PUBLIC';
  const showFaithContent = Boolean(activeScope?.show_faith_content);
  const showWord = Boolean(activeScope) && (isPublic || showFaithContent);
  const inspire = isPublic && !showFaithContent;
  const label = inspire ? 'INSPIRE' : 'WORD';

  const tileStyle = ({ pressed }: { pressed: boolean }) => ({
    flex: 1,
    minWidth: 0,
    minHeight: 70,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.greenSoft,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden' as const,
    opacity: pressed ? 0.65 : 1,
  });

  return (
    <View
      style={{
        flex: showWord ? 2 : 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 7,
      }}
    >
      {showWord ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={inspire ? 'Daily Inspire' : 'Word devotional and Bible'}
          onPress={() => router.push((inspire ? '/inspire' : '/word') as any)}
          style={tileStyle}
        >
          <MaterialCommunityIcons
            name={inspire ? 'book-open-outline' : 'book-open-page-variant-outline'}
            size={22}
            color={colors.greenDark}
          />
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              marginTop: 4,
              width: '100%',
              textAlign: 'center',
              fontSize: 8.6,
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
        onPress={() => router.push('/profile/buklod-classrooms' as any)}
        style={tileStyle}
      >
        <MaterialCommunityIcons
          name="school-outline"
          size={22}
          color={colors.greenDark}
        />
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={{
            marginTop: 4,
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