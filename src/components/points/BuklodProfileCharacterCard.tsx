/* BUKLOD_CHARACTER_STUDIO3_REAL_ART_R1 */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import BuklodCharacterCustomizeSheet
  from '@/components/points/BuklodCharacterCustomizeSheet';

import BuklodCharacterLayeredArt
  from '@/components/points/BuklodCharacterLayeredArt';

import {
  ProfileMotionFadeUp,
} from '@/components/BuklodProfileMotion';

import {
  useBuklodCharacterEventsOptional,
} from '@/components/character/BuklodCharacterEventProvider';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  DEFAULT_CHARACTER,
  loadBuklodCharacter,
  reconcileCharacterForPoints,
  type BuklodCharacterState,
} from '@/lib/buklodCharacter';

import {
  formatPoints,
} from '@/lib/character-lab-core/tiers';

import {
  CharacterEventType,
} from '@/lib/buklodCharacterEvents';

import {
  withAlpha,
} from '@/lib/buklodContrast';

type Props = {
  lifetimePoints?: number;
  rankName?: string | null;
};

export default function
BuklodProfileCharacterCard({
  lifetimePoints = 0,
  rankName = null,
}: Props) {
  const {
    theme,
  } = useBuklodPresentation();

  const {
    session,
  } = useAuth();

  const [
    focused,
    setFocused,
  ] = useState(false);

  const characterEvents =
    useBuklodCharacterEventsOptional();

  const greetedRef =
    useRef(false);

  const userId =
    session?.user?.id ??
    null;

  const [
    config,
    setConfig,
  ] =
    useState<BuklodCharacterState>({
      ...DEFAULT_CHARACTER,
    });

  const [
    customizeOpen,
    setCustomizeOpen,
  ] =
    useState(false);

  useEffect(() => {
    void loadBuklodCharacter(
      userId,
    ).then(
      (loaded) => {
        const reconciled =
          reconcileCharacterForPoints(
            loaded,
            lifetimePoints,
          );

        setConfig(
          reconciled,
        );
      },
    );
  }, [
    lifetimePoints,
    userId,
  ]);

  useFocusEffect(
    useCallback(
      () => {
        setFocused(true);

        return () =>
          setFocused(false);
      },
      [],
    ),
  );

  useEffect(() => {
    if (
      !focused ||
      greetedRef.current
    ) {
      return;
    }

    greetedRef.current =
      true;

    characterEvents?.emit({
      type:
        CharacterEventType
          .PROFILE_CHARACTER_VISIBLE,
      success: true,
    });
  }, [
    characterEvents,
    focused,
  ]);

  const rankLabel =
    String(
      rankName ?? '',
    ).trim();

  const styles =
    StyleSheet.create({
      wrap: {
        marginHorizontal: 12,
        marginBottom: 6,
      },

      card: {
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 13,
        borderRadius: 18,
        borderWidth: 1,
        borderColor:
          theme.border,
        backgroundColor:
          withAlpha(
            theme.cardSurface,
            0.88,
          ),
      },

      eyebrow: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.15,
        color:
          theme.textMuted,
        marginBottom: 5,
      },

      body: {
        minHeight: 132,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
      },

      artPress: {
        width: 82,
        height: 130,
        alignItems: 'center',
        justifyContent:
          'flex-end',
        overflow: 'visible',
      },

      copyCol: {
        flex: 1,
        minWidth: 0,
        justifyContent:
          'center',
      },

      rankTitle: {
        fontSize: 16,
        fontWeight: '900',
        color:
          theme.textPrimary,
      },

      pointsMeta: {
        marginTop: 3,
        fontSize: 12,
        fontWeight: '800',
        color:
          theme.textSecondary,
      },

      helper: {
        marginTop: 5,
        fontSize: 10,
        lineHeight: 14,
        color:
          theme.textMuted,
      },

      customize: {
        alignSelf: 'flex-start',
        marginTop: 10,
        minHeight: 38,
        paddingHorizontal: 13,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent:
          'center',
        gap: 6,
        backgroundColor:
          theme.accentSoft,
        borderWidth: 1,
        borderColor:
          withAlpha(
            theme.accent,
            0.25,
          ),
      },

      customizeText: {
        fontSize: 11,
        fontWeight: '900',
        color:
          theme.accent,
      },
    });

  return (
    <>
      <ProfileMotionFadeUp
        delay={55}
      >
        <View
          style={
            styles.wrap
          }
        >
          <View
            style={
              styles.card
            }
          >
            <Text
              style={
                styles.eyebrow
              }
            >
              MY BUKLOD CHARACTER
            </Text>

            <View
              style={
                styles.body
              }
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open ranking and BUKLOD Points"
                onPress={() =>
                  router.push(
                    '/points',
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.artPress,
                  pressed && {
                    opacity: 0.92,
                  },
                ]}
              >
                <BuklodCharacterLayeredArt
                  body={
                    config.body
                  }
                  equipment={
                    config.equipment
                  }
                  height={124}
                  showStage={
                    false
                  }
                  showEffects
                />
              </Pressable>

              <View
                style={
                  styles.copyCol
                }
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open ranking and BUKLOD Points"
                  onPress={() =>
                    router.push(
                      '/points',
                    )
                  }
                >
                  <Text
                    style={
                      styles.rankTitle
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {rankLabel ||
                      'BUKLOD Character'}
                  </Text>

                  <Text
                    style={
                      styles.pointsMeta
                    }
                  >
                    {formatPoints(
                      lifetimePoints,
                    )}{' '}
                    lifetime pts
                  </Text>

                  <Text
                    style={
                      styles.helper
                    }
                  >
                    Your whole character
                    grows with BUKLOD
                    rank and points.
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    setCustomizeOpen(
                      true,
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Customize character"
                  style={({
                    pressed,
                  }) => [
                    styles.customize,
                    pressed && {
                      opacity: 0.88,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="palette-outline"
                    size={16}
                    color={
                      theme.accent
                    }
                  />

                  <Text
                    style={
                      styles.customizeText
                    }
                  >
                    Customize
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </ProfileMotionFadeUp>

      <BuklodCharacterCustomizeSheet
        visible={
          customizeOpen
        }
        onClose={() =>
          setCustomizeOpen(
            false,
          )
        }
        userId={userId}
        lifetimePoints={
          lifetimePoints
        }
        onSaved={
          setConfig
        }
      />
    </>
  );
}