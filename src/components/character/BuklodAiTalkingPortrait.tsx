import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  VideoView,
  useVideoPlayer,
} from 'expo-video';

import {
  createBuklodTalkingCharacter,
  waitForBuklodTalkingCharacter,
} from '@/lib/buklodAiCharacter';

type Props = {
  sourceUrl: string;
  fallbackImage: ImageSourcePropType;
  accessToken?: string | null;
  defaultText?: string;
  width?: number;
  height?: number;
  autoPlayText?: string | null;
  onError?: (message: string) => void;
};

export default function BuklodAiTalkingPortrait({
  sourceUrl,
  fallbackImage,
  accessToken,
  defaultText = 'Hello! Ako ang iyong BUKLOD character.',
  width = 220,
  height = 300,
  autoPlayText = null,
  onError,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    if (!videoUrl) {
      return;
    }

    let active = true;

    void player.replaceAsync({
      uri: videoUrl,
      useCaching: true,
    }).then(() => {
      if (active) {
        player.play();
      }
    }).catch((error: unknown) => {
      const message = error instanceof Error
        ? error.message
        : 'Unable to play character animation.';
      setStatus(message);
      onError?.(message);
    });

    return () => {
      active = false;
    };
  }, [onError, player, videoUrl]);

  const replay = () => {
    if (!videoUrl) {
      return false;
    }

    player.currentTime = 0;
    player.play();
    return true;
  };

  const speak = async (text: string) => {
    if (busy) {
      return;
    }

    if (!accessToken) {
      const message = 'Sign in is required before the character can speak.';
      setStatus(message);
      onError?.(message);
      return;
    }

    try {
      setBusy(true);
      setStatus('Binubuhay ang character...');

      const created = await createBuklodTalkingCharacter({
        sourceUrl,
        text,
        accessToken,
      });

      if (!created.id) {
        throw new Error('Avatar provider did not return a job id.');
      }

      const completed = await waitForBuklodTalkingCharacter(
        created.id,
        accessToken,
      );

      if (!completed.resultUrl) {
        throw new Error('Character animation finished without a video URL.');
      }

      setVideoUrl(completed.resultUrl);
      setStatus('');
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : 'Character animation failed.';
      setStatus(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  };

  const activate = () => {
    if (busy) {
      return;
    }

    if (replay()) {
      return;
    }

    void speak(defaultText);
  };

  useEffect(() => {
    if (!autoPlayText || !accessToken) {
      return;
    }

    if (replay()) {
      return;
    }

    void speak(autoPlayText);
    // Intentionally key autoplay to the requested text/session. When the
    // generated video arrives, the video effect starts it once; reopening the
    // parent with a new autoPlayText transition replays the cached clip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayText, accessToken]);

  return (
    <View style={{ width }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Animate BUKLOD character"
        disabled={busy}
        onPress={activate}
        style={({ pressed }) => [
          styles.stage,
          { width, height },
          pressed && styles.stagePressed,
          busy && styles.stageBusy,
        ]}
      >
        {videoUrl ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <Image
            source={fallbackImage}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
        )}

        {busy ? (
          <View style={styles.busyOverlay}>
            <ActivityIndicator size="large" />
            <Text style={styles.busyText}>AI character animation...</Text>
          </View>
        ) : null}
      </Pressable>

      {status ? (
        <Text style={styles.status}>{status}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#111',
  },
  stagePressed: {
    transform: [{ scale: 1.06 }],
  },
  stageBusy: {
    opacity: 0.92,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  busyText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  status: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 15,
    color: '#a33',
  },
});
