import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import BuklodOfficeOrganizer from '@/components/BuklodOfficeOrganizer';
import { colors } from '@/lib/theme';

export default function BuklodOfficeRoute() {
  const params = useLocalSearchParams<{
    scopeId?: string | string[];
  }>();

  const scopeId = Array.isArray(params.scopeId)
    ? params.scopeId[0]
    : params.scopeId;

  if (!scopeId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Office unavailable</Text>
        <Text style={styles.copy}>
          The organization or cluster scope was not provided.
        </Text>
      </View>
    );
  }

  return <BuklodOfficeOrganizer scopeId={scopeId} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  copy: {
    marginTop: 6,
    textAlign: 'center',
    color: colors.muted,
  },
});
