import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';

const CLASSROOM_ICON = require('../../../assets/classroom/app-icon.png');

export default function BuklodClassroomHomeScreen() {
  const { profile, signOut } = useAuth();
  const displayName = profile?.full_name?.trim() || profile?.username?.trim() || 'BUKLOD learner';

  const logout = async () => {
    await signOut();
    router.replace('/(auth)/login' as any);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.brandRow}>
        <Image source={CLASSROOM_ICON} style={styles.logo} />
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>STANDALONE LEARNING APP</Text>
          <Text style={styles.title}>BUKLOD Classroom</Text>
          <Text style={styles.subtitle}>Classes, live learning, attendance, submissions, assessments and results.</Text>
        </View>
      </View>

      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeKicker}>SIGNED IN</Text>
        <Text style={styles.welcomeName}>{displayName}</Text>
        <Text style={styles.welcomeText}>
          Your BUKLOD account is shared across the ecosystem, but this app stays inside Classroom.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Classroom</Text>

      <Pressable
        style={({ pressed }) => [styles.primaryCard, pressed && styles.pressed]}
        onPress={() => router.push('/profile/buklod-classrooms' as any)}
      >
        <View style={styles.primaryIcon}>
          <MaterialCommunityIcons name="account-school-outline" size={28} color="#1f7a3f" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>My Classroom</Text>
          <Text style={styles.cardText}>Open enrolled classes, live sessions, materials, activities, attendance and grades.</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#718078" />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.primaryCard, pressed && styles.pressed]}
        onPress={() => router.push('/profile/buklod-faculty' as any)}
      >
        <View style={styles.primaryIcon}>
          <MaterialCommunityIcons name="teach" size={28} color="#1f7a3f" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Faculty</Text>
          <Text style={styles.cardText}>Manage classes, roster, files, attendance, assessments, grading, reports and live teaching.</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#718078" />
      </Pressable>

      <View style={styles.utilityRow}>
        <Pressable style={({ pressed }) => [styles.utilityCard, pressed && styles.pressed]} onPress={() => router.push('/notifications' as any)}>
          <MaterialCommunityIcons name="bell-outline" size={23} color="#1f7a3f" />
          <Text style={styles.utilityTitle}>Notifications</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.utilityCard, pressed && styles.pressed]} onPress={() => router.push('/profile/buklod-classroom-settings' as any)}>
          <MaterialCommunityIcons name="cog-outline" size={23} color="#1f7a3f" />
          <Text style={styles.utilityTitle}>Settings</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.utilityCard, pressed && styles.pressed]} onPress={() => router.push('/profile/buklod-classroom-about' as any)}>
          <MaterialCommunityIcons name="information-outline" size={23} color="#1f7a3f" />
          <Text style={styles.utilityTitle}>About</Text>
        </Pressable>
      </View>

      <Pressable style={({ pressed }) => [styles.logout, pressed && styles.pressed]} onPress={() => void logout()}>
        <MaterialCommunityIcons name="logout" size={20} color="#8a3131" />
        <Text style={styles.logoutText}>Sign out of BUKLOD Classroom</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f6f1' },
  content: { padding: 20, paddingTop: 44, paddingBottom: 64 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 18 },
  logo: { width: 66, height: 66, borderRadius: 18 },
  kicker: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 29, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#68736b', lineHeight: 19, marginTop: 4 },
  welcomeCard: { backgroundColor: '#17311f', borderRadius: 22, padding: 18, marginBottom: 22 },
  welcomeKicker: { color: '#9fd2aa', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  welcomeName: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 3 },
  welcomeText: { color: '#dfe9e1', lineHeight: 19, marginTop: 6 },
  sectionTitle: { color: '#17311f', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  primaryCard: { backgroundColor: '#fff', borderRadius: 19, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  primaryIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e7f4e9' },
  cardTitle: { color: '#203328', fontWeight: '900', fontSize: 16 },
  cardText: { color: '#69766e', lineHeight: 18, marginTop: 3, fontSize: 12 },
  utilityRow: { flexDirection: 'row', gap: 9, marginTop: 5 },
  utilityCard: { flex: 1, minHeight: 84, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 10 },
  utilityTitle: { color: '#405047', fontSize: 11, fontWeight: '800', marginTop: 7, textAlign: 'center' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, paddingVertical: 13, borderRadius: 14, backgroundColor: '#f7e9e9' },
  logoutText: { color: '#8a3131', fontWeight: '900' },
  pressed: { opacity: 0.82 },
});
