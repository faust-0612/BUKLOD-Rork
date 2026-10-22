import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Stack,
  useLocalSearchParams,
} from 'expo-router';

function firstString(value: unknown) {
  if (typeof value === 'string') return value;

  if (
    Array.isArray(value) &&
    typeof value[0] === 'string'
  ) {
    return value[0];
  }

  return '';
}

export default function BuklodGivingBridgeScreen() {
  const params = useLocalSearchParams();
  const [errorText, setErrorText] = useState('');

  const scopeId =
    firstString(params.scopeId) ||
    firstString(params.scope_id) ||
    firstString(params.organizationId) ||
    firstString(params.organization_id) ||
    firstString(params.clusterId) ||
    firstString(params.cluster_id) ||
    firstString(params.id);

  const scopeName =
    firstString(params.scopeName) ||
    firstString(params.scope_name) ||
    firstString(params.organizationName) ||
    firstString(params.clusterName);

  const scopeType =
    firstString(params.scopeType) ||
    firstString(params.scope_type) ||
    firstString(params.type) ||
    'ORGANIZATION';

  const givingUrl = useMemo(() => {
    const query = [
      scopeId
        ? 'scopeId=' + encodeURIComponent(scopeId)
        : '',
      scopeName
        ? 'scopeName=' + encodeURIComponent(scopeName)
        : '',
      scopeType
        ? 'scopeType=' + encodeURIComponent(scopeType)
        : '',
      'source=main-buklod',
    ]
      .filter(Boolean)
      .join('&');

    return 'buklodgiving://give?' + query;
  }, [scopeId, scopeName, scopeType]);

  const openGiving = useCallback(async () => {
    setErrorText('');

    try {
      await Linking.openURL(givingUrl);
    } catch {
      setErrorText(
        'BUKLOD Giving could not be opened. Install or update the standalone BUKLOD Giving APK, then try again.',
      );
    }
  }, [givingUrl]);

  useEffect(() => {
    void openGiving();
  }, [openGiving]);

  return (
    <>
      <Stack.Screen
        options={{ title: 'BUKLOD Giving' }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>
            BUKLOD GIVING
          </Text>

          <Text style={styles.title}>
            Open Giving App
          </Text>

          {scopeName ? (
            <Text style={styles.scope}>
              For: {scopeName}
            </Text>
          ) : null}

          <Text style={styles.body}>
            Giving is handled by the standalone BUKLOD
            Giving app. Your selected Organization,
            Sub-organization, or Cluster is passed to
            the Giving app when available.
          </Text>

          <Pressable
            onPress={() => void openGiving()}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.buttonText}>
              OPEN BUKLOD GIVING
            </Text>
          </Pressable>

          {errorText ? (
            <Text style={styles.error}>
              {errorText}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 46,
    backgroundColor: '#F4F7F5',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 10,
  },
  eyebrow: {
    color: '#61766C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    color: '#173B2F',
    fontSize: 24,
    fontWeight: '900',
  },
  scope: {
    color: '#176B4A',
    fontSize: 13,
    fontWeight: '900',
  },
  body: {
    color: '#687970',
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    minHeight: 50,
    borderRadius: 13,
    backgroundColor: '#176B4A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  error: {
    color: '#8B3D32',
    fontSize: 11,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.72,
  },
});