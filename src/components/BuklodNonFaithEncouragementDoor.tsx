import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

/** Non-religious alternative when a member opts out of Show Faith. */
export default function BuklodNonFaithEncouragementDoor() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open Today's Encouragement and Life Lessons"
      onPress={() => router.push('/inspire' as any)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name="lightbulb-on-outline" size={26} color="#27694D" />
      <View style={styles.copy}>
        <Text style={styles.title}>TODAY'S ENCOURAGEMENT</Text>
        <Text style={styles.subtitle}>Motivational thoughts and practical life lessons</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color="#27694D" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1, borderColor: '#D5E5DC',
    backgroundColor: '#EFF7F2', flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12, marginVertical: 8,
  },
  copy: { flex: 1, gap: 4 },
  title: { color: '#174B32', fontSize: 13, fontWeight: '900' },
  subtitle: { color: '#506A5B', fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.75 },
});
