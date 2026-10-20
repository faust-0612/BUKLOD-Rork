import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';

/** Standalone, read-only entry preview. Backend publication and rewards remain disabled. */
export default function KabihasnangLigawScreen() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Kabihasnang Ligaw' }} />
      <Text style={styles.kicker}>UNANG AKLAT · KABANATA 01</Text>
      <Text style={styles.title}>Ang Gabi ng Pag-ahon</Text>
      <Text style={styles.by}>Likha ni Faustino Jr. M. Gabut</Text>
      <Text style={styles.p}>Ang unang tahanang gumuho ay hindi nagkaroon ng pagkakataong sumigaw.</Text>
      <Text style={styles.p}>Sa pinakadulong bahagi ng Lunawen, biglang lumubog ang lupa sa ilalim ng isang lumang pintuan. Dahan-dahang tumagilid ang buong bahay, waring napagod sa maraming taong pagtayo, bago tuluyang nawala sa isang hukay na wala roon ilang sandali lamang ang nakararaan.</Text>
      <Text style={styles.p}>Nakatayo si Phan sa gitna ng makitid na daan, may pasan na sisidlan ng tubig at nanginginig na mga daliri. Hindi siya agad nakagalaw. Sa kabila ng nagkakagulong mga tao, malinaw niyang narinig ang munting tunog ng isang kahoy na laruan na paulit-ulit na tumatama sa gilid ng hukay.</Text>
      <View style={styles.notice}><Text style={styles.noticeText}>Story preview lamang. Hindi pa aktibo ang daily release, points, at season completion rewards. Walang automatic points mula sa page na ito.</Text></View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101a20' },
  content: { padding: 24, paddingBottom: 70 },
  kicker: { color: '#e5c891', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#f6dfb0', fontSize: 34, fontWeight: '800', marginTop: 14 },
  by: { color: '#c5c9c6', marginTop: 10, marginBottom: 24 },
  p: { color: '#f1ece3', fontSize: 18, lineHeight: 30, marginBottom: 22 },
  notice: { padding: 16, borderWidth: 1, borderColor: '#78613c', borderRadius: 12 },
  noticeText: { color: '#d6c8ad', lineHeight: 21 },
});
