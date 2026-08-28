import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodFocusAppGate from '@/components/BuklodFocusAppGate';
import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { Card, shared } from '@/components/UI';
import type { BuklodFocusApp } from '@/lib/buklodFoundation';
import {
  getIntegrationApp,
  integrationAvailabilityLabel,
  type BuklodIntegrationAppId,
} from '@/lib/buklodFocusAppIntegration';
import { colors } from '@/lib/theme';

type Props = {
  integrationAppId: BuklodIntegrationAppId;
  title?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  description?: string;
  focusApp?: BuklodFocusApp;
};

export default function BuklodFoundationPortalShell({
  integrationAppId,
  title,
  icon,
  description,
  focusApp,
}: Props) {
  const integration = getIntegrationApp(integrationAppId);
  const resolvedTitle = title ?? integration.displayName;
  const resolvedIcon = icon ?? 'apps';
  const resolvedDescription =
    description ?? integration.fallbackMessage;
  const gateApp = focusApp ?? integration.foundationApp ?? undefined;
  const availabilityLabel = integrationAvailabilityLabel(
    integration.availability
  );

  const body = (
    <>
      <Stack.Screen options={{ title: resolvedTitle }} />

      <BuklodPortalScrollView
        style={shared.screen}
        contentContainerStyle={[
          shared.content,
          styles.content,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.icon}>
            <MaterialCommunityIcons
              name={resolvedIcon}
              size={28}
              color={colors.green}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              BUKLOD INTEGRATION PORTAL
            </Text>
            <Text style={styles.title}>
              {resolvedTitle}
            </Text>
          </View>
        </View>

        <Card>
          <Text style={styles.status}>
            {availabilityLabel}
          </Text>
          <Text style={styles.description}>
            {resolvedDescription}
          </Text>
          <Text style={styles.note}>
            Shared BUKLOD identity only — no duplicate login or organization
            system. Deep links and notifications use namespace{' '}
            {integration.notificationNamespace}.
          </Text>
          {integration.availability === 'INTEGRATION_READY' ? (
            <Text style={styles.note}>
              This portal is integration-ready. Full focus-app features are
              intentionally not built inside the main app update yet.
            </Text>
          ) : null}
        </Card>
      </BuklodPortalScrollView>
    </>
  );

  if (gateApp) {
    return (
      <BuklodFocusAppGate app={gateApp}>
        {body}
      </BuklodFocusAppGate>
    );
  }

  return body;
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 6,
  },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#EAF4EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  title: {
    marginTop: 2,
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  status: {
    color: colors.green,
    fontSize: 16,
    fontWeight: '900',
  },
  description: {
    marginTop: 5,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  note: {
    marginTop: 9,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});