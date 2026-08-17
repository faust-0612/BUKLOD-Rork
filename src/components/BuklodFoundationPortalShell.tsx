import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Card, shared } from '@/components/UI';
import { colors } from '@/lib/theme';

type Props = {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  description: string;
};

export default function BuklodFoundationPortalShell({
  title,
  icon,
  description,
}: Props) {
  return (
    <>
      <Stack.Screen options={{ title }} />

      <ScrollView
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
              name={icon}
              size={28}
              color={colors.green}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              BUKLOD FOUNDATION PORTAL
            </Text>
            <Text style={styles.title}>
              {title}
            </Text>
          </View>
        </View>

        <Card>
          <Text style={styles.status}>
            Foundation linked
          </Text>
          <Text style={styles.description}>
            {description}
          </Text>
          <Text style={styles.note}>
            The portal route is connected to the shared
            BUKLOD Foundation. Full portal features are
            intentionally not being built yet.
          </Text>
        </Card>
      </ScrollView>
    </>
  );
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