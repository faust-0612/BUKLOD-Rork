import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';

/**
 * Status updates stay inside this one small mounted row: never re-render the
 * entire Wall/FlashList every second to update an audio clock.
 */
function formatTime(seconds: unknown): string {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0');
}

export default function BuklodWallPostAudioMeter({ player }: { player: AudioPlayer }) {
  const status = useAudioPlayerStatus(player);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ flex: 1, fontSize: 10, color: '#416b5b' }} accessibilityLabel="Music playback progress">
        {formatTime(status.currentTime)} / {formatTime(status.duration)}
      </Text>
      <Pressable
        accessibilityRole="button" accessibilityLabel="Music volume down"
        onPress={() => { player.volume = Math.max(0, player.volume - .15); }}>
        <MaterialCommunityIcons name="volume-minus" size={19} color="#195d47" />
      </Pressable>
      <Pressable
        accessibilityRole="button" accessibilityLabel="Music volume up"
        onPress={() => { player.volume = Math.min(1, player.volume + .15); }}>
        <MaterialCommunityIcons name="volume-plus" size={19} color="#195d47" />
      </Pressable>
    </View>
  );
}
