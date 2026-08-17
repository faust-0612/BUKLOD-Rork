import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type BuklodCelebrationType =
  | 'points'
  | 'rank_up'
  | 'bayanihan'
  | 'lesson'
  | 'achievement'
  | 'generic';

type Props = {
  visible: boolean;
  onClose: () => void;

  type?: BuklodCelebrationType;

  title?: string;
  message?: string;
  points?: number | null;
  bayanihanAmount?: number | null;

  rankName?: string | null;

  characterSource?: ImageSourcePropType | null;
  soundSource?: any;
  soundEnabled?: boolean;
  hapticsEnabled?: boolean;
};

const ENCOURAGEMENTS = [
  'Great progress! Keep going.',
  'Another meaningful step completed.',
  'Consistency builds momentum.',
  'Keep building the BUKLOD.',
  'Your progress is moving forward.',
  'Well done! Continue the journey.',
  'One step at a time. Keep growing.',
  'Nice work! Your effort is adding up.',
];

function peso(value: number) {
  return `₱${Number(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function defaultTitle(
  type: BuklodCelebrationType
) {
  switch (type) {
    case 'points':
      return 'BUKLOD Points Earned!';

    case 'rank_up':
      return 'Rank Up!';

    case 'bayanihan':
      return 'Bayanihan Reward!';

    case 'lesson':
      return 'Lesson Completed!';

    case 'achievement':
      return 'Achievement Unlocked!';

    default:
      return 'Great Progress!';
  }
}

export default function BuklodClaimCelebration({
  visible,
  onClose,

  type = 'generic',

  title,
  message,
  points,
  bayanihanAmount,
  rankName,

  characterSource = null,
  soundSource = null,
  soundEnabled = true,
  hapticsEnabled = true,
}: Props) {
  const [encouragement, setEncouragement] =
    useState(ENCOURAGEMENTS[0]);

  const overlayOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const cardScale = useRef(
    new Animated.Value(0.72)
  ).current;

  const cardY = useRef(
    new Animated.Value(45)
  ).current;

  const characterScale = useRef(
    new Animated.Value(0.5)
  ).current;

  const ringScale = useRef(
    new Animated.Value(0.4)
  ).current;

  const ringOpacity = useRef(
    new Animated.Value(0.8)
  ).current;

  const player = useAudioPlayer(
    soundSource ?? null
  );

  const displayTitle = useMemo(
    () => title || defaultTitle(type),
    [title, type]
  );

  const rewardText = useMemo(() => {
    if (
      type === 'points' &&
      Number(points ?? 0) > 0
    ) {
      return `◉ ${Number(
        points
      ).toLocaleString('en-PH')} BUKLOD Points`;
    }

    if (
      type === 'bayanihan' &&
      Number(bayanihanAmount ?? 0) > 0
    ) {
      return peso(Number(bayanihanAmount));
    }

    if (
      type === 'rank_up' &&
      rankName
    ) {
      return rankName;
    }

    if (
      type === 'lesson' &&
      Number(points ?? 0) > 0
    ) {
      return `+◉ ${Number(
        points
      ).toLocaleString('en-PH')}`;
    }

    return null;
  }, [
    type,
    points,
    bayanihanAmount,
    rankName,
  ]);
  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextMessage =
      ENCOURAGEMENTS[
        Math.floor(
          Math.random() *
            ENCOURAGEMENTS.length
        )
      ];

    setEncouragement(nextMessage);

    overlayOpacity.setValue(0);
    cardScale.setValue(0.72);
    cardY.setValue(45);
    characterScale.setValue(0.5);
    ringScale.setValue(0.4);
    ringOpacity.setValue(0.8);

    Animated.parallel([
      Animated.timing(
        overlayOpacity,
        {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }
      ),

      Animated.spring(cardScale, {
        toValue: 1,
        friction: 6,
        tension: 75,
        useNativeDriver: true,
      }),

      Animated.spring(cardY, {
        toValue: 0,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }),

      Animated.sequence([
        Animated.delay(120),

        Animated.spring(
          characterScale,
          {
            toValue: 1.08,
            friction: 5,
            tension: 90,
            useNativeDriver: true,
          }
        ),

        Animated.spring(
          characterScale,
          {
            toValue: 1,
            friction: 6,
            tension: 70,
            useNativeDriver: true,
          }
        ),
      ]),

      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 2.2,
          duration: 950,
          easing: Easing.out(
            Easing.cubic
          ),
          useNativeDriver: true,
        }),

        Animated.timing(
          ringOpacity,
          {
            toValue: 0,
            duration: 950,
            easing: Easing.out(
              Easing.ease
            ),
            useNativeDriver: true,
          }
        ),
      ]),
    ]).start();

    if (hapticsEnabled) {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType
          .Success
      ).catch(() => {});
    }

    if (
      soundEnabled &&
      soundSource
    ) {
      try {
        player.seekTo(0);
        player.play();
      } catch {
        // Celebration still works without SFX.
      }
    }
  }, [
    visible,
    type,
    points,
    bayanihanAmount,
    rankName,
    soundEnabled,
    hapticsEnabled,
    soundSource,
  ]);

  const close = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: overlayOpacity,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                {
                  scale: cardScale,
                },
                {
                  translateY: cardY,
                },
              ],
            },
          ]}
        >
          <View style={styles.celebrationArea}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.expandingRing,
                {
                  opacity: ringOpacity,
                  transform: [
                    {
                      scale: ringScale,
                    },
                  ],
                },
              ]}
            />

            <View
              style={[
                styles.spark,
                styles.sparkOne,
              ]}
            />

            <View
              style={[
                styles.spark,
                styles.sparkTwo,
              ]}
            />

            <View
              style={[
                styles.spark,
                styles.sparkThree,
              ]}
            />

            <Animated.View
              style={[
                styles.characterWrap,
                {
                  transform: [
                    {
                      scale:
                        characterScale,
                    },
                  ],
                },
              ]}
            >
              {characterSource ? (
                <Image
                  source={characterSource}
                  style={styles.character}
                  resizeMode="contain"
                />
              ) : (
                <View
                  style={
                    styles.fallbackCharacter
                  }
                >
                  <View
                    style={
                      styles.fallbackHead
                    }
                  >
                    <View
                      style={
                        styles.fallbackEyes
                      }
                    >
                      <View
                        style={
                          styles.fallbackEye
                        }
                      />

                      <View
                        style={
                          styles.fallbackEye
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.fallbackSmile
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.fallbackBody
                    }
                  >
                    <Text
                      style={
                        styles.fallbackSymbol
                      }
                    >
                      ◉
                    </Text>
                  </View>
                </View>
              )}
            </Animated.View>
          </View>

          <Text style={styles.eyebrow}>
            BUKLOD CELEBRATION
          </Text>

          <Text style={styles.title}>
            {displayTitle}
          </Text>

          {!!rewardText && (
            <View
              style={styles.rewardPill}
            >
              <Text
                style={styles.rewardText}
              >
                {rewardText}
              </Text>
            </View>
          )}

          <Text
            style={
              styles.encouragement
            }
          >
            {message ||
              encouragement}
          </Text>

          <View style={styles.guideBubble}>
            <View
              style={styles.guideIcon}
            >
              <MaterialCommunityIcons
                name="message-text-outline"
                size={18}
                color="#275D45"
              />
            </View>

            <Text style={styles.guideText}>
              Your BUKLOD guide can speak
              reward messages, rank-ups,
              reminders and encouragements.
            </Text>
          </View>

          <Pressable
            onPress={close}
            style={({ pressed }) => [
              styles.continueButton,
              pressed &&
                styles.continuePressed,
            ]}
          >
            <Text
              style={
                styles.continueText
              }
            >
              CONTINUE
            </Text>

            <MaterialCommunityIcons
              name="arrow-right"
              size={18}
              color="#FFFFFF"
            />
          </Pressable>

          <Text style={styles.disclaimer}>
            Celebrations recognize recorded
            BUKLOD app participation and
            progress. They do not measure
            spiritual maturity, holiness,
            faith or personal worth.
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor:
      'rgba(10,22,16,0.78)',
  },

  card: {
    width: '100%',
    maxWidth: 410,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },

  celebrationArea: {
    height: 205,
    alignItems: 'center',
    justifyContent: 'center',
  },

  expandingRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: '#5F9479',
  },

  characterWrap: {
    width: 148,
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
  },

  character: {
    width: 148,
    height: 148,
  },

  fallbackCharacter: {
    width: 112,
    height: 145,
    alignItems: 'center',
  },

  fallbackHead: {
    width: 72,
    height: 72,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: '#D8AD82',
  },

  fallbackEyes: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 3,
  },

  fallbackEye: {
    width: 6,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#24332B',
  },

  fallbackSmile: {
    width: 20,
    height: 10,
    marginTop: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#4F3529',
    borderRadius: 10,
  },

  fallbackBody: {
    width: 94,
    height: 84,
    marginTop: -8,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: '#275D45',
  },

  fallbackSymbol: {
    marginTop: 6,
    fontSize: 29,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  spark: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#8CB49D',
  },

  sparkOne: {
    top: 40,
    left: 45,
  },

  sparkTwo: {
    top: 68,
    right: 42,
  },

  sparkThree: {
    bottom: 38,
    right: 76,
  },

  eyebrow: {
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: '#7B8981',
  },

  title: {
    marginTop: 5,
    textAlign: 'center',
    fontSize: 27,
    fontWeight: '900',
    color: '#1D2B23',
  },

  rewardPill: {
    alignSelf: 'center',
    marginTop: 11,
    paddingHorizontal: 17,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor:
      'rgba(39,93,69,0.09)',
  },

  rewardText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#275D45',
  },

  encouragement: {
    marginTop: 13,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: '#5A685F',
  },

  guideBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 17,
    padding: 12,
    borderRadius: 15,
    backgroundColor:
      'rgba(39,93,69,0.055)',
  },

  guideIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },

  guideText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#68766E',
  },

  continueButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 17,
    borderRadius: 15,
    backgroundColor: '#275D45',
  },

  continuePressed: {
    opacity: 0.86,
  },

  continueText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#FFFFFF',
  },

  disclaimer: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 8.5,
    lineHeight: 12,
    color: '#919C95',
  },
});
