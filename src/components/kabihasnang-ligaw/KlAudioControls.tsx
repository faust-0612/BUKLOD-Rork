import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveAudioChannel } from '@/lib/kabihasnang-ligaw/audioPolicy';
import { klCopy } from '@/lib/kabihasnang-ligaw/copy';
import type { AssetClass } from '@/lib/kabihasnang-ligaw/types';

type Props = {
  musicStatus: AssetClass;
  ambientStatus: AssetClass;
  otherAudioPlaying: boolean;
  musicMuted: boolean;
  ambientMuted: boolean;
  musicVolume: number;
  ambientVolume: number;
  onToggleMute: (channel: 'music' | 'ambient') => void;
  onCycleVolume: (channel: 'music' | 'ambient') => void;
  onUnavailable: (channel: 'music' | 'ambient') => void;
};

function Channel({
  title,
  status,
  muted,
  volume,
  otherAudioPlaying,
  missingLabel,
  onToggleMute,
  onCycleVolume,
  onUnavailable,
}: {
  title: string;
  status: AssetClass;
  muted: boolean;
  volume: number;
  otherAudioPlaying: boolean;
  missingLabel: string;
  onToggleMute: () => void;
  onCycleVolume: () => void;
  onUnavailable: () => void;
}) {
  const decision = resolveAudioChannel({
    channel: title === klCopy.music ? 'music' : 'ambient',
    assetStatus: status,
    userIntentPlaying: false,
    otherAudioPlaying,
    failed: false,
  });

  return (
    <View style={styles.channel}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.status}>
        {decision.message === 'silent_missing' || decision.message === 'silent_unapproved'
          ? missingLabel
          : decision.message === 'yielded'
            ? klCopy.yielded
            : klCopy.pause}
      </Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} ${klCopy.play}`}
          onPress={onUnavailable}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{klCopy.play}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onToggleMute} style={styles.button}>
          <Text style={styles.buttonText}>{muted ? klCopy.unmute : klCopy.mute}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCycleVolume} style={styles.button}>
          <Text style={styles.buttonText}>{klCopy.volume} {Math.round(volume * 100)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function KlAudioControls(props: Props) {
  if (props.musicStatus !== 'APPROVED' && props.ambientStatus !== 'APPROVED') return null;
  return (
    <View style={styles.wrap}>
      <Channel
        title={klCopy.music}
        status={props.musicStatus}
        muted={props.musicMuted}
        volume={props.musicVolume}
        otherAudioPlaying={props.otherAudioPlaying}
        missingLabel={klCopy.noMusic}
        onToggleMute={() => props.onToggleMute('music')}
        onCycleVolume={() => props.onCycleVolume('music')}
        onUnavailable={() => props.onUnavailable('music')}
      />
      <Channel
        title={klCopy.ambient}
        status={props.ambientStatus}
        muted={props.ambientMuted}
        volume={props.ambientVolume}
        otherAudioPlaying={props.otherAudioPlaying}
        missingLabel={klCopy.noAmbient}
        onToggleMute={() => props.onToggleMute('ambient')}
        onCycleVolume={() => props.onCycleVolume('ambient')}
        onUnavailable={() => props.onUnavailable('ambient')}
      />
      {props.otherAudioPlaying ? <Text style={styles.yield}>{klCopy.yielded}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  channel: { gap: 6 },
  title: { color: '#f6dfb0', fontSize: 14, fontWeight: '700' },
  status: { color: '#d6c8ad', fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#78613c',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a2c2a',
  },
  buttonText: { color: '#f1d39b', fontSize: 13, fontWeight: '700' },
  yield: { color: '#f1ece3', fontSize: 14, lineHeight: 21 },
});
