import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export type BuklodActionStatus = 'idle' | 'pending' | 'success' | 'warning' | 'error';

type Props = {
  status: BuklodActionStatus;
  message: string;
};

/** Persistent, cross-platform confirmation for server-backed form actions. */
export default function BuklodActionFeedback({ status, message }: Props) {
  if (status === 'idle' || !message) return null;

  const color = status === 'success' ? '#176B4A' :
    status === 'error' ? '#A12828' :
    status === 'warning' ? '#825500' : '#235B7B';

  return (
    <View
      accessibilityRole={status === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[styles.box, { borderColor: color }]}
    >
      {status === 'pending' ? <ActivityIndicator size="small" color={color} /> : null}
      <Text style={[styles.message, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginVertical: 6,
  },
  message: { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 18 },
});
