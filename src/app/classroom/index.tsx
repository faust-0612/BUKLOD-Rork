import { Image, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { BUKLOD_APP_IDENTITY } from '@/lib/appIdentity';

export default function ClassroomHomeScreen() {
  const { session, loading, profile } = useAuth();

  if (loading && !session && !profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1f7a3f" />
        <Text style={styles.loadingText}>Opening BUKLOD Classroom...</Text>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.brandRow}>
        <Image
          source={require('../../../assets/classroom/app-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>SEPARATE LEARNING APP</Text>
          <Text style={styles.title}>{BUKLOD_APP_IDENTITY.displayName}</Text>
          <Text style={styles.subtitle}>
            Classes, learning activities, live sessions, attendance, submissions and grades.
          </Text>
        </View>
      </View>

      <View style={styles.identityCard}>
        <MaterialCommunityIcons name="shield-check-outline" size={22} color="#1f7a3f" />
        <View style={{ flex: 1 }}>
          <Text style={styles.identityTitle}>Classroom workspace</Text>
          <Text style={styles.identityText}>
            Your BUKLOD account is shared where intended, but this app stays inside the Classroom experience.
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Enter your workspace</Text>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={() => router.push('/profile/buklod-classrooms' as any)}
      >
        <View style={[styles.cardIcon, styles.studentIcon]}>
          <MaterialCommunityIcons name="account-school-outline" size={30} color="#1f7a3f" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Student Classroom</Text>
          <Text style={styles.cardText}>
            Open enrolled classes, discussions, activities, materials, live class, attendance and grades.
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={25} color="#708077" />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={() => router.push('/profile/buklod-faculty' as any)}
      >
        <View style={[styles.cardIcon, styles.facultyIcon]}>
          <MaterialCommunityIcons name="teach" size={30} color="#815b13" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Faculty Classroom</Text>
          <Text style={styles.cardText}>
            Manage classes, roster, attendance, assessments, submissions, grading, resources and live sessions.
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={25} color="#708077" />
      </Pressable>

      <Pressable onPress={() => void signOut()} style={styles.signOut}>
        <MaterialCommunityIcons name="logout" size={18} color="#5c6b62" />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f6f1' },
  content: { padding: 20, paddingTop: 44, paddingBottom: 64, width: '100%', maxWidth: 760, alignSelf: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f6f1' },
  loadingText: { marginTop: 10, color: '#627067', fontWeight: '700' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 22 },
  logo: { width: 78, height: 78, borderRadius: 20 },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 30, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#68736b', lineHeight: 19, marginTop: 4 },
  identityCard: { flexDirection: 'row', gap: 11, backgroundColor: '#e7f4e9', borderRadius: 18, padding: 15, marginBottom: 24 },
  identityTitle: { color: '#17311f', fontWeight: '900' },
  identityText: { color: '#5d6e63', lineHeight: 18, marginTop: 3 },
  sectionTitle: { color: '#17311f', fontSize: 17, fontWeight: '900', marginBottom: 11 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#fff', borderRadius: 20, padding: 17, marginBottom: 11 },
  cardIcon: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  studentIcon: { backgroundColor: '#e8f4ea' },
  facultyIcon: { backgroundColor: '#fff1cd' },
  cardTitle: { color: '#203328', fontSize: 17, fontWeight: '900' },
  cardText: { color: '#68736b', lineHeight: 18, marginTop: 4 },
  pressed: { opacity: 0.84 },
  signOut: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 12, marginTop: 12 },
  signOutText: { color: '#5c6b62', fontWeight: '800' },
});
