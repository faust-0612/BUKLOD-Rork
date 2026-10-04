import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

/* BUKLOD_PTT_WEB_ROUTE_R2 */
export default function BuklodPttWebRoute() {
  return (
    <View style={s.screen}>
      <Text style={s.title}>BUKLOD PTT</Text>
      <Text style={s.body}>
        Push-to-Talk is currently available in the BUKLOD Android app.
      </Text>
      <Pressable onPress={() => router.back()} style={s.button}>
        <Text style={s.buttonText}>BACK</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: 480,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#030A10',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  body: {
    color: '#9EB2BA',
    marginTop: 12,
    textAlign: 'center',
    maxWidth: 520,
  },
  button: {
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#55E0E8',
  },
  buttonText: {
    color: '#071725',
    fontWeight: '900',
  },
});