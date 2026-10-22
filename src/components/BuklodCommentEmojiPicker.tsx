import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
const EMOJI = ['😀', '😊', '❤️', '👍', '🙏', '🎉', '😂', '😢'];
export default function BuklodCommentEmojiPicker({ onSelect, disabled = false }: {
  onSelect: (emoji: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <View style={{ maxWidth: 160 }}>
    <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel="Choose comment emoji"
      accessibilityState={{ expanded: open, disabled }} onPress={() => setOpen(value => !value)}
      style={{ padding: 8 }}><Text style={{ fontSize: 20 }}>☺️</Text></Pressable>
    {open && !disabled ? <ScrollView horizontal keyboardShouldPersistTaps="always"
      style={{ maxHeight: 44 }} contentContainerStyle={{ alignItems: 'center' }}>
      {EMOJI.map(emoji => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={'Insert ' + emoji}
        onPress={() => { onSelect(emoji); setOpen(false); }} style={{ padding: 7 }}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text></Pressable>)}
    </ScrollView> : null}
  </View>;
}
