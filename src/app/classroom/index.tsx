import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/AuthProvider';

const DOORS = [
  {
    key: 'student',
    title: 'My Classroom',
    description: 'Open your enrolled classes, live sessions, activities, submissions, materials, attendance and grades.',
    icon: 'account-school-outline' as const,
    route: '/profile/buklod-classrooms',
  },
  {
    key: 'faculty',
    title: 'Faculty',
    description: 'Manage classes, students, roster, attendance, assessments, grading, resources and live classroom tools.',
    icon: 'school-outline' as const,
    route: '/profile/buklod-faculty',
  },
  {
    key: 'notifications',
    title: 'Classroom Notifications',
    description: 'Review class updates, deadlines and activity notifications tied to your BUKLOD account.',
    icon: 'bell-outline' as const,
    route: '/notifications',
  },
];

export default function ClassroomHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const displayName = String(
    user?.user_metadata?.full_name ||
      user?.user_metadata?.display_name ||
      user?.user_metadata?.name ||
      ''
  ).trim();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 32),
        },
      ]}
    >
      <View style={styles.brandRow}>
        <View style={styles.brandIcon}>
          <MaterialCommunityIcons name="google-classroom" size={30} color="#ffffff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>STANDALONE LEARNING APP</Text>
          <Text style={styles.brand}>BUKLOD Classroom</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>
          {displayName ? `Welcome, ${displayName}` : 'Welcome to your classroom'}
        </Text>
        <Text style={styles.heroText}>
          Enter the student or faculty workspace without opening the BUKLOD Main home or Main navigation shell.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Classroom</Text>

      {DOORS.map(door => (
        <Pressable
          key={door.key}
          accessibilityRole="button"
          accessibilityLabel={door.title}
          onPress={() => router.push(door.route as any)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.cardIcon}>
            <MaterialCommunityIcons name={door.icon} size={25} color="#176b36" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{door.title}</Text>
            <Text style={styles.cardText}>{door.description}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#819086" />
        </Pressable>
      ))}

      <View style={styles.accountNote}>
        <MaterialCommunityIcons name="account-key-outline" size={20} color="#176b36" />
        <Text style={styles.accountNoteText}>
          Your BUKLOD account may be shared across BUKLOD apps. This app remains the separate BUKLOD Classroom workspace.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef4ef' },
  content: { paddingHorizontal: 20, maxWidth: 760, width: '100%', alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  brandIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#176b36', alignItems: 'center', justifyContent: 'center' },
  kicker: { color: '#4e6856', fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  brand: { color: '#17311f', fontSize: 25, fontWeight: '900', marginTop: 1 },
  hero: { backgroundColor: '#176b36', borderRadius: 24, padding: 22, marginBottom: 22 },
  heroTitle: { color: '#ffffff', fontSize: 27, fontWeight: '900' },
  heroText: { color: '#e4f4e8', marginTop: 7, lineHeight: 20, fontSize: 14 },
  sectionTitle: { color: '#17311f', fontWeight: '900', fontSize: 18, marginBottom: 10 },
  card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 13 },
  cardIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#e7f3e9', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#203328', fontWeight: '900', fontSize: 16 },
  cardText: { color: '#66756b', fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  pressed: { opacity: 0.82 },
  accountNote: { marginTop: 12, backgroundColor: '#dfece2', borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  accountNoteText: { flex: 1, color: '#405849', fontSize: 12.5, lineHeight: 18 },
});
