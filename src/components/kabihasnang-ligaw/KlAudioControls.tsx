import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
  musicIntent: boolean;
  onTogglePlay: (channel: 'music' | 'ambient') => void;
  onToggleMute: (channel: 'music' | 'ambient') => void;
  onCycleVolume: (channel: 'music' | 'ambient') => void;
};

function IconButton({
  icon,
  label,
  onPress,
  disabled,
  active,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, active && styles.buttonOn, disabled && styles.buttonOff]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={disabled ? '#8d8374' : '#f1d39b'} />
    </Pressable>
  );
}

function Channel({
  title,
  channel,
  status,
  muted,
  volume,
  intent,
  otherAudioPlaying,
  missingLabel,
  onTogglePlay,
  onToggleMute,
  onCycleVolume,
}: {
  title: string;
  channel: 'music' | 'ambient';
  status: AssetClass;
  muted: boolean;
  volume: number;
  intent: boolean;
  otherAudioPlaying: boolean;
  missingLabel: string;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onCycleVolume: () => void;
}) {
  const decision = resolveAudioChannel({
    channel,
    assetStatus: status,
    userIntentPlaying: intent && !muted,
    otherAudioPlaying,
    failed: false,
  });
  const available = decision.message === 'playing' || decision.message === 'paused' || decision.message === 'yielded';
  const playing = decision.message === 'playing';

  return (
    <View style={styles.channel}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.status}>
        {!available
          ? missingLabel
          : decision.message === 'yielded'
            ? klCopy.yielded
            : playing
              ? klCopy.pause
              : klCopy.play}
      </Text>
      <View style={styles.row}>
        <IconButton
          icon={playing ? 'pause' : 'play'}
          label={playing ? klCopy.pause : klCopy.play}
          disabled={!available}
          active={playing}
          onPress={onTogglePlay}
        />
        <IconButton
          icon={muted ? 'volume-off' : 'volume-high'}
          label={muted ? klCopy.unmute : klCopy.mute}
          disabled={!available}
          active={muted}
          onPress={onToggleMute}
        />
        <IconButton
          icon="volume-medium"
          label={`${klCopy.volume} ${Math.round(volume * 100)}`}
          disabled={!available}
          onPress={onCycleVolume}
        />
      </View>
    </View>
  );
}

export default function KlAudioControls(props: Props) {
  return (
    <View style={styles.wrap}>
      <Channel
        title={klCopy.hymnTitle}
        channel="music"
        status={props.musicStatus}
        muted={props.musicMuted}
        volume={props.musicVolume}
        intent={props.musicIntent}
        otherAudioPlaying={props.otherAudioPlaying}
        missingLabel={klCopy.audioOff}
        onTogglePlay={() => props.onTogglePlay('music')}
        onToggleMute={() => props.onToggleMute('music')}
        onCycleVolume={() => props.onCycleVolume('music')}
      />
      {props.ambientStatus === 'APPROVED' ? (
        <Channel
          title={klCopy.ambient}
          channel="ambient"
          status={props.ambientStatus}
          muted={props.ambientMuted}
          volume={props.ambientVolume}
          intent={false}
          otherAudioPlaying={props.otherAudioPlaying}
          missingLabel={klCopy.noAmbient}
          onTogglePlay={() => props.onTogglePlay('ambient')}
          onToggleMute={() => props.onToggleMute('ambient')}
          onCycleVolume={() => props.onCycleVolume('ambient')}
        />
      ) : null}
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
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#78613c',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a2c2a',
  },
  buttonOn: { backgroundColor: '#3d3422', borderColor: '#e5c891' },
  buttonOff: { opacity: 0.45 },
  yield: { color: '#f1ece3', fontSize: 14, lineHeight: 21 },
});
