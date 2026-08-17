import {
  useEffect,
} from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';

import {
  configurePreachingAudioMode,
} from '@/lib/preachingAudio';

type Props = {
  sourceUrl: string;
  title: string;
  preacher?: string;
  albumTitle?: string;
  artworkUrl?: string;
};

function formatTime(
  seconds: number
) {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return '0:00';
  }

  const total =
    Math.floor(seconds);

  const minutes =
    Math.floor(
      total / 60
    );

  const remaining =
    total % 60;

  return (
    `${minutes}:` +
    remaining
      .toString()
      .padStart(
        2,
        '0'
      )
  );
}

export function PreachingAudioPlayer({
  sourceUrl,
  title,
  preacher = 'BUKLOD',
  albumTitle = 'Preaching',
  artworkUrl,
}: Props) {

  const player =
    useAudioPlayer(
      sourceUrl,
      {
        updateInterval: 500,
      }
    );

  const status =
    useAudioPlayerStatus(
      player
    );

  useEffect(
    () => {
      void configurePreachingAudioMode()
        .catch(error => {
          console.warn(
            'BUKLOD background audio configuration:',
            error
          );
        });
    },
    []
  );

  useEffect(
    () => {
      return () => {
        try {
          player
            .setActiveForLockScreen(
              false
            );
        }
        catch {
          // Player may already be released.
        }
      };
    },
    [
      player,
    ]
  );

  const activateLockScreen =
    () => {

      player
        .setActiveForLockScreen(
          true,
          {
            title,
            artist:
              preacher,
            albumTitle,
            artworkUrl,
          },
          {
            showSeekBackward:
              true,

            showSeekForward:
              true,
          }
        );
    };

  const handlePlay =
    async () => {

      await configurePreachingAudioMode();

      activateLockScreen();

      player.play();
    };

  const handlePause =
    () => {

      player.pause();

      /*
       * Keep media controls active while paused
       * so the listener can resume from the
       * lock screen / notification.
       */
    };

  const handleRestart =
    async () => {

      await player
        .seekTo(0);

      activateLockScreen();

      player.play();
    };

  return (
    <View
      style={
        styles.container
      }
    >
      <View
        style={
          styles.textArea
        }
      >
        <Text
          style={
            styles.title
          }
          numberOfLines={2}
        >
          {title}
        </Text>

        <Text
          style={
            styles.preacher
          }
          numberOfLines={1}
        >
          {preacher}
        </Text>

        <Text
          style={
            styles.time
          }
        >
          {formatTime(
            status.currentTime
          )}
          {' / '}
          {formatTime(
            status.duration
          )}
        </Text>
      </View>

      <View
        style={
          styles.controls
        }
      >
        <Pressable
          onPress={
            status.playing
              ? handlePause
              : () => {
                  void handlePlay()
                    .catch(error => {
                      console.warn(
                        'BUKLOD preaching play:',
                        error
                      );
                    });
                }
          }
          style={
            styles.button
          }
        >
          <Text
            style={
              styles.buttonText
            }
          >
            {
              status.playing
                ? 'Pause'
                : 'Play'
            }
          </Text>
        </Pressable>

        <Pressable
          onPress={
            () => {
              void handleRestart()
                .catch(error => {
                  console.warn(
                    'BUKLOD preaching restart:',
                    error
                  );
                });
            }
          }
          style={
            styles.button
          }
        >
          <Text
            style={
              styles.buttonText
            }
          >
            Restart
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      width: '100%',
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      gap: 12,
    },

    textArea: {
      gap: 3,
    },

    title: {
      fontSize: 16,
      fontWeight: '700',
    },

    preacher: {
      fontSize: 13,
      opacity: 0.72,
    },

    time: {
      marginTop: 4,
      fontSize: 12,
      opacity: 0.65,
    },

    controls: {
      flexDirection: 'row',
      gap: 10,
    },

    button: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1,
      borderRadius: 10,
    },

    buttonText: {
      fontSize: 14,
      fontWeight: '600',
    },
  });