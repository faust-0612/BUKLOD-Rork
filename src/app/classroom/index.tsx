import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type ClassroomRow = {
  classroom_id: string;
  role_key: 'FACULTY' | 'STUDENT';
  status: string;
};

type ClassroomContext = 'STUDENT' | 'FACULTY' | 'DUAL ROLE';

export default function ClassroomExtensionHome() {
  const { user, profile, signOut } = useAuth();
  const userId = user?.id ?? null;
  const [studentClasses, setStudentClasses] = useState(0);
  const [facultyClasses, setFacultyClasses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setStudentClasses(0);
      setFacultyClasses(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [studentRes, facultyRes] = await Promise.all([
        supabase.rpc('buklod_classroom_my_classes_v1'),
        supabase
          .from('buklod_education_classrooms')
          .select('id', { count: 'exact', head: true })
          .eq('faculty_user_id', userId)
          .eq('status', 'ACTIVE'),
      ]);

      if (!studentRes.error) {
        const rows = (studentRes.data ?? []) as ClassroomRow[];
        setStudentClasses(
          rows.filter(row => row.role_key === 'STUDENT' && row.status === 'ACTIVE').length
        );
      }

      if (!facultyRes.error) {
        setFacultyClasses(facultyRes.count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const context: ClassroomContext = useMemo(() => {
    if (facultyClasses > 0 && studentClasses > 0) return 'DUAL ROLE';
    if (facultyClasses > 0) return 'FACULTY';
    return 'STUDENT';
  }, [facultyClasses, studentClasses]);

  const openMain = async () => {
    if (Platform.OS === 'web') {
      await Linking.openURL('https://buklod.expo.app/');
      return;
    }

    try {
      const nativeUrl = 'buklod://';
      if (await Linking.canOpenURL(nativeUrl)) {
        await Linking.openURL(nativeUrl);
        return;
      }
    } catch {
      // Fall through to the canonical BUKLOD Main web doorway.
    }

    await Linking.openURL('https://buklod.expo.app/');
  };

  const openReports = () => {
    if (context === 'FACULTY') {
      router.push('/profile/buklod-faculty' as any);
      return;
    }

    router.push('/profile/buklod-classrooms' as any);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={styles.brandRow}>
        <Image
          source={require('../../../assets/classroom/app-icon.png')}
          style={styles.logo}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>BUKLOD EXTENSION APP</Text>
          <Text style={styles.title}>BUKLOD Classroom</Text>
          <Text style={styles.subtitle}>
            Same BUKLOD account and connected academic records, with a focused Classroom workspace.
          </Text>
        </View>
      </View>

      <View style={styles.accountCard}>
        <View style={styles.accountIcon}>
          <MaterialCommunityIcons name="account-circle-outline" size={28} color="#1f7a3f" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.accountName}>{profile?.full_name || 'BUKLOD Account'}</Text>
          <Text style={styles.accountMeta}>{context}</Text>
        </View>
        <View style={styles.connectedPill}>
          <View style={styles.connectedDot} />
          <Text style={styles.connectedText}>CONNECTED</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>CONTINUE</Text>

      {context !== 'FACULTY' && (
        <Pressable
          onPress={() => router.push('/profile/buklod-classrooms' as any)}
          style={({ pressed }) => [styles.primaryCard, pressed && styles.pressed]}
        >
          <View style={styles.primaryIcon}>
            <MaterialCommunityIcons name="account-school-outline" size={27} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.primaryTitle}>Student Classroom</Text>
            <Text style={styles.primaryText}>
              {studentClasses > 0
                ? `${studentClasses} enrolled ${studentClasses === 1 ? 'class' : 'classes'} • resume activities, live class, materials and results`
                : 'Your enrolled classes will appear here automatically.'}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
        </Pressable>
      )}

      {context !== 'STUDENT' && (
        <Pressable
          onPress={() => router.push('/profile/buklod-faculty' as any)}
          style={({ pressed }) => [styles.facultyCard, pressed && styles.pressed]}
        >
          <View style={styles.secondaryIcon}>
            <MaterialCommunityIcons name="human-male-board" size={26} color="#17311f" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.secondaryTitle}>Faculty Classroom</Text>
            <Text style={styles.secondaryText}>
              {facultyClasses} active {facultyClasses === 1 ? 'class' : 'classes'} • roster, attendance, assessments, grading and monitoring
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#17311f" />
        </Pressable>
      )}

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#1f7a3f" />
          <Text style={styles.loadingText}>Syncing Classroom access…</Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>MORE</Text>

      <Pressable
        onPress={openReports}
        style={({ pressed }) => [styles.moreCard, pressed && styles.pressed]}
      >
        <View style={styles.moreIcon}>
          <MaterialCommunityIcons name="file-chart-outline" size={24} color="#1f7a3f" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.moreTitle}>Reports & Results</Text>
          <Text style={styles.moreText}>
            Attendance, released grades, assessments and submissions stay tied to the same BUKLOD records.
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color="#819087" />
      </Pressable>

      <Pressable
        onPress={() => void openMain()}
        style={({ pressed }) => [styles.moreCard, pressed && styles.pressed]}
      >
        <View style={styles.moreIcon}>
          <MaterialCommunityIcons name="link-variant" size={24} color="#1f7a3f" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.moreTitle}>Open BUKLOD Main</Text>
          <Text style={styles.moreText}>
            Return to the main BUKLOD app without converting Classroom into the Main navigation shell.
          </Text>
        </View>
        <MaterialCommunityIcons name="open-in-new" size={21} color="#819087" />
      </Pressable>

      <Pressable
        onPress={async () => {
          await signOut();
          router.replace('/(auth)/login' as any);
        }}
        style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="logout" size={19} color="#6b786f" />
        <Text style={styles.logoutText}>Sign out of this BUKLOD session</Text>
      </Pressable>

      <Text style={styles.footer}>
        BUKLOD Main remains the ecosystem doorway and account authority. Classroom owns the focused classroom experience.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f6f1' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingTop: 36, paddingBottom: 54 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 18 },
  logo: { width: 72, height: 72, borderRadius: 20 },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 29, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#68756c', lineHeight: 19, marginTop: 4 },
  accountCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20 },
  accountIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#e8f4e9', alignItems: 'center', justifyContent: 'center' },
  accountName: { color: '#213429', fontWeight: '900', fontSize: 15 },
  accountMeta: { color: '#7a867d', fontSize: 11, fontWeight: '800', marginTop: 2 },
  connectedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#edf8ef', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
  connectedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2c9d4d' },
  connectedText: { color: '#287e41', fontSize: 9, fontWeight: '900' },
  sectionLabel: { color: '#66756b', fontSize: 10, fontWeight: '900', letterSpacing: 1.25, marginBottom: 8, marginTop: 4 },
  primaryCard: { backgroundColor: '#1f7a3f', borderRadius: 21, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  primaryIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  primaryTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  primaryText: { color: '#e3f3e6', lineHeight: 18, fontSize: 12, marginTop: 3 },
  facultyCard: { backgroundColor: '#dcebdc', borderRadius: 21, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  secondaryIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#f4faf4', alignItems: 'center', justifyContent: 'center' },
  secondaryTitle: { color: '#17311f', fontSize: 17, fontWeight: '900' },
  secondaryText: { color: '#4f6556', lineHeight: 18, fontSize: 12, marginTop: 3 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  loadingText: { color: '#6c786f', fontSize: 12 },
  moreCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 },
  moreIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: '#edf5ed', alignItems: 'center', justifyContent: 'center' },
  moreTitle: { color: '#24372b', fontSize: 14, fontWeight: '900' },
  moreText: { color: '#6f7b73', fontSize: 11, lineHeight: 16, marginTop: 2 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 48, marginTop: 8 },
  logoutText: { color: '#6b786f', fontWeight: '800', fontSize: 12 },
  footer: { color: '#8a948d', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12, paddingHorizontal: 14 },
  pressed: { opacity: 0.83 },
});
