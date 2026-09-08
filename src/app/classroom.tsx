import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { IS_BUKLOD_CLASSROOM } from '@/lib/appTarget';
import { useAuth } from '@/providers/AuthProvider';

const CLASSROOM_ICON = require('../../assets/classroom/app-icon.png');

type ClassroomEntry = {
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  href: string;
};

const ENTRIES: ClassroomEntry[] = [
  {
    title: 'My Classroom',
    description: 'Open enrolled classes, live sessions, activities, materials, submissions and grades.',
    icon: 'account-school-outline',
    href: '/profile/buklod-classrooms',
  },
  {
    title: 'Faculty Dashboard',
    description: 'Manage classes, roster, attendance, assessments, grading, resources and live-class operations.',
    icon: 'google-classroom',
    href: '/profile/buklod-faculty',
  },
  {
    title: 'Notifications',
    description: 'Open Classroom and account updates delivered through BUKLOD services.',
    icon: 'bell-outline',
    href: '/notifications',
  },
  {
    title: 'Account & Security',
    description: 'Manage the BUKLOD account shared securely across approved BUKLOD apps.',
    icon: 'shield-account-outline',
    href: '/account/security',
  },
];

export default function ClassroomHomeScreen() {
  const { session, profile } = useAuth();

  if (!IS_BUKLOD_CLASSROOM) {
    return <Redirect href="/(tabs)/messages" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const displayName =
    String(
      profile?.full_name ||
      profile?.display_name ||
      profile?.username ||
      ''
    ).trim();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <View style={styles.brandRow}>
        <Image source={CLASSROOM_ICON} style={styles.logo} />
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>DEDICATED CLASSROOM APP</Text>
          <Text style={styles.title}>BUKLOD Classroom</Text>
          <Text style={styles.subtitle}>
            {displayName ? `Welcome, ${displayName}. ` : ''}
            Classes, teaching, learning and academic operations stay in this Classroom workspace.
          </Text>
        </View>
      </View>

      <View style={styles.identityCard}>
        <MaterialCommunityIcons
          name="link-variant"
          size={22}
          color="#1f7a3f"
        />
        <Text style={styles.identityText}>
          Your BUKLOD account may be shared across the BUKLOD ecosystem, but this installed app is BUKLOD Classroom and uses the Classroom navigation shell.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Classroom</Text>

      {ENTRIES.map(entry => (
        <Pressable
          key={entry.title}
          accessibilityRole="button"
          accessibilityLabel={entry.title}
          onPress={() => router.push(entry.href as any)}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.cardIcon}>
            <MaterialCommunityIcons
              name={entry.icon}
              size={26}
              color="#1f7a3f"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{entry.title}</Text>
            <Text style={styles.cardText}>{entry.description}</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#7b897f"
          />
        </Pressable>
      ))}

      <Text style={styles.footer}>
        BUKLOD Classroom • Separate app identity • Shared BUKLOD account where intentionally integrated
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f2f6f1',
  },
  content: {
    padding: 20,
    paddingTop: 42,
    paddingBottom: 56,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  eyebrow: {
    color: '#1f7a3f',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  title: {
    color: '#17311f',
    fontSize: 27,
    fontWeight: '900',
    marginTop: 2,
  },
  subtitle: {
    color: '#66736a',
    lineHeight: 19,
    marginTop: 5,
    fontSize: 13,
  },
  identityCard: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    backgroundColor: '#e8f4e9',
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
  },
  identityText: {
    flex: 1,
    color: '#35513e',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#17311f',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 22,
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#e8f4e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#203328',
    fontSize: 16,
    fontWeight: '900',
  },
  cardText: {
    color: '#6d796f',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  pressed: {
    opacity: 0.82,
  },
  footer: {
    color: '#7a867d',
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 18,
  },
});
