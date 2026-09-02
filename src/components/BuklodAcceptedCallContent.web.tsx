import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function BuklodAcceptedCallContent() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>
        BUKLOD Call
      </Text>

      <Text style={styles.message}>
        Video calling is currently available in the BUKLOD mobile app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F6F8F7',
  },

  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#173B2F',
  },

  message: {
    marginTop: 8,
    maxWidth: 420,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: '#687970',
  },
});
