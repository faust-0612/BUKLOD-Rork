import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

/** Community Wall Dashboard feature entry. No posting, media or points side effects. */
export default function KabihasnangLigawWallCard() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Buksan ang Kabihasnang Ligaw story library"
      onPress={() => router.push('/kabihasnang-ligaw' as never)}
      style={styles.card}
    >
      <Text style={styles.eyebrow}>KABIHASNANG LIGAW · DAILY STORY</Text>
      <Text style={styles.title}>Ang Gabi ng Pag-ahon</Text>
      <Text style={styles.description}>Isang bagong kabanata araw-araw · 6:00 AM</Text>
      <Text style={styles.credit}>Likha ni Faustino Jr. M. Gabut</Text>
      <Text style={styles.action}>Tuklasin ang kuwento →</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: { marginHorizontal: 10, marginVertical: 12, borderRadius: 24, padding: 22, backgroundColor: '#142a28', borderWidth: 1, borderColor: '#a28b5a' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#e3c990' },
  title: { fontSize: 26, fontWeight: '800', color: '#fff4df', marginTop: 13 },
  description: { fontSize: 14, color: '#e2e9df', marginTop: 9 },
  credit: { fontSize: 12, color: '#c3cbbb', marginTop: 8 },
  action: { color: '#f1d39b', fontSize: 15, fontWeight: '800', marginTop: 20 },
});
