import React, { useEffect, useRef } from 'react';

import {
  Animated,
  Pressable,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

/* BUKLOD_CHARACTER_V2_WEB_RELEASE_TRIGGER_R1 */
/* BUKLOD_HOME_IDENTITY_R23_EQUAL_SHORTCUTS */
/* BUKLOD_KINGDOM_HOME_DOOR_R1 */
/* BUKLOD_KINGDOM_PREMIUM_DOOR_R2 */

function KingdomDoor() {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1900, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.34] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open BUKLOD Kingdom Games"
      accessibilityHint="Opens the interactive BUKLOD Kingdom world map"
      onPress={() => router.push('/games' as any)}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        minHeight: 76,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: pressed ? '#f2cd68' : '#c69b3d',
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.975 : 1 }],
        shadowColor: '#6b4b12',
        shadowOpacity: pressed ? 0.12 : 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      })}
    >
      <LinearGradient
        colors={['#fff8d8', '#f2d58b', '#d9a844']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 7 }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: '#fff5b0',
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          }}
        />
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#163d67',
            borderWidth: 1.5,
            borderColor: '#f5d474',
          }}
        >
          <MaterialCommunityIcons name="castle" size={21} color="#f7d778" />
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{ marginTop: 4, fontSize: 8.5, lineHeight: 10, fontWeight: '900', letterSpacing: 0.45, color: '#573c12' }}
        >
          BUKLOD KINGDOM
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{ marginTop: 1, fontSize: 6.8, lineHeight: 8, fontWeight: '800', letterSpacing: 0.7, color: '#7c5b25' }}
        >
          EXPLORE • PLAY • GROW
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

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
        flex: showWord ? 3 : 2,
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

      <KingdomDoor />

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
