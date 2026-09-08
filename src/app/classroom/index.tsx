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

import {
  getBuklodClassroomLauncherAccess,
  type BuklodClassroomLauncherAccess,
} from '@/lib/classroomLauncherAccess';
import { useAuth } from '@/providers/AuthProvider';

type ClassroomMode = 'STUDENT' | 'FACULTY';

export default function ClassroomExtensionHome() {
  const { user, profile, signOut } = useAuth();
  const userId = user?.id ?? null;
  const [access, setAccess] = useState<BuklodClassroomLauncherAccess | null>(null);
  const [selectedMode, setSelectedMode] = useState<ClassroomMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setAccess(null);
      setSelectedMode(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const next = await getBuklodClassroomLauncherAccess();
      setAccess(next);

      if (next.default_mode === 'FACULTY') {
        setSelectedMode('FACULTY');
      } else if (next.default_mode === 'STUDENT') {
        setSelectedMode('STUDENT');
      } else if (!next.is_faculty && next.is_student) {
        setSelectedMode('STUDENT');
      } else if (next.is_faculty && !next.is_student) {
        setSelectedMode('FACULTY');
      } else {
        setSelectedMode(null);
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

  const roleLabel = useMemo(() => {
    if (!access?.can_open) return 'CLASSROOM ACCESS';
    if (access.is_faculty && access.is_student) return 'DUAL ROLE';
    if (access.is_faculty) return 'FACULTY';
    return 'STUDENT';
  }, [access]);

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

  const openMode = (mode: ClassroomMode) => {
    setSelectedMode(mode);
    router.push(
      mode === 'FACULTY'
        ? '/profile/buklod-faculty' as any
        : '/profile/buklod-classrooms' as any
    );
  };

  const openReports = () => {
    const mode =
      selectedMode ??
      (access?.is_faculty && !access?.is_student ? 'FACULTY' : 'STUDENT');
    openMode(mode);
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
          <Text style={styles.accountMeta}>{roleLabel}</Text>
        </View>
        <View style={styles.connectedPill}>
          <View style={styles.connectedDot} />
          <Text style={styles.connectedText}>SAME ACCOUNT</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#1f7a3f" />
          <Text style={styles.loadingText}>Checking Classroom access…</Text>
        </View>
      ) : !access?.can_open ? (
        <View style={styles.deniedCard}>
          <MaterialCommunityIcons name="school-outline" size={34} color="#647269" />
          <Text style={styles.deniedTitle}>My Classroom is not available for this account</Text>
          <Text style={styles.deniedText}>
            Classroom opens only for an actively enrolled Student or an active BUKLOD Faculty user. Your BUKLOD Main account remains unchanged.
          </Text>
          <Pressable onPress={() => void openMain()} style={styles.mainButton}>
            <Text style={styles.mainButtonText}>OPEN BUKLOD MAIN</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>
            {access.is_faculty && access.is_student ? 'CHOOSE WORKSPACE' : 'CONTINUE'}
          </Text>

          {access.is_student ? (
            <Pressable
              onPress={() => openMode('STUDENT')}
              style={({ pressed }) => [
                styles.primaryCard,
                selectedMode === 'STUDENT' && styles.selectedCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.primaryIcon}>
                <MaterialCommunityIcons name="account-school-outline" size={27} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.primaryTitle}>Student Classroom</Text>
                <Text style={styles.primaryText}>
                  {access.student_class_count} enrolled {access.student_class_count === 1 ? 'class' : 'classes'} • resume work, live class, materials, attendance and results
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
            </Pressable>
          ) : null}

          {access.is_faculty ? (
            <Pressable
              onPress={() => openMode('FACULTY')}
              style={({ pressed }) => [
                styles.facultyCard,
                selectedMode === 'FACULTY' && styles.selectedFacultyCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.secondaryIcon}>
                <MaterialCommunityIcons name="human-male-board" size={26} color="#17311f" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.secondaryTitle}>Faculty Classroom</Text>
                <Text style={styles.secondaryText}>
                  {access.faculty_class_count} active {access.faculty_class_count === 1 ? 'class' : 'classes'} • roster, attendance, assessments, grading and monitoring
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#17311f" />
            </Pressable>
          ) : null}

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
                Classroom reads the same connected BUKLOD attendance, released grades, assessments and submissions; it does not create a second account or reset academic records.
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
                Return to the Main BUKLOD ecosystem while keeping this app focused on Classroom work.
              </Text>
            </View>
            <MaterialCommunityIcons name="open-in-new" size={21} color="#819087" />
          </Pressable>
        </>
      )}

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
        BUKLOD Main is the structure, doorway and session authority. BUKLOD Classroom owns the focused classroom experience.
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
  selectedCard: { borderWidth: 2, borderColor: '#bce0c3' },
  primaryIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  primaryTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  primaryText: { color: '#e3f3e6', lineHeight: 18, fontSize: 12, marginTop: 3 },
  facultyCard: { backgroundColor: '#dcebdc', borderRadius: 21, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  selectedFacultyCard: { borderWidth: 2, borderColor: '#6faf7a' },
  secondaryIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#f4faf4', alignItems: 'center', justifyContent: 'center' },
  secondaryTitle: { color: '#17311f', fontSize: 17, fontWeight: '900' },
  secondaryText: { color: '#4f6556', lineHeight: 18, fontSize: 12, marginTop: 3 },
  loadingCard: { backgroundColor: '#fff', borderRadius: 18, minHeight: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 14 },
  loadingText: { color: '#6c786f', fontSize: 12 },
  deniedCard: { backgroundColor: '#fff', borderRadius: 20, padding: 22, alignItems: 'center', marginBottom: 14 },
  deniedTitle: { color: '#24362b', fontWeight: '900', fontSize: 17, textAlign: 'center', marginTop: 10 },
  deniedText: { color: '#6c786f', textAlign: 'center', lineHeight: 19, marginTop: 6, maxWidth: 520 },
  mainButton: { backgroundColor: '#1f7a3f', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, marginTop: 16 },
  mainButtonText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  moreCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 },
  moreIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: '#edf5ed', alignItems: 'center', justifyContent: 'center' },
  moreTitle: { color: '#24372b', fontSize: 14, fontWeight: '900' },
  moreText: { color: '#6f7b73', fontSize: 11, lineHeight: 16, marginTop: 2 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 48, marginTop: 8 },
  logoutText: { color: '#6b786f', fontWeight: '800', fontSize: 12 },
  footer: { color: '#8a948d', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12, paddingHorizontal: 14 },
  pressed: { opacity: 0.83 },
});
