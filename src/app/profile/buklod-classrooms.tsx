import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import BuklodQuizStudentEntry from '@/components/classroom/BuklodQuizStudentEntry';
import { isBuklodClassroomApp } from '@/lib/buklodAppTarget';
import {
  getBuklodClassroomLauncherAccess,
  type BuklodClassroomLauncherAccess,
} from '@/lib/classroomLauncherAccess';

type ClassroomRow = {
  classroom_id: string;
  classroom_name: string;
  subject_code: string | null;
  section_name: string | null;
  school_year: string | null;
  term: string | null;
  classroom_mode: string;
  classroom_plan: string;
  role_key: 'FACULTY' | 'STUDENT';
  status: string;
  updated_at: string;
};

type ClassroomMode = 'STUDENT' | 'FACULTY';

function MainClassroomDoor() {
  const { user } = useAuth();
  const [access, setAccess] = useState<BuklodClassroomLauncherAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<ClassroomMode | null>(null);

  const loadAccess = useCallback(async () => {
    if (!user?.id) {
      setAccess(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setAccess(await getBuklodClassroomLauncherAccess());
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadAccess();
    }, [loadAccess])
  );

  const openClassroom = async (mode: ClassroomMode) => {
    if (opening) return;
    setOpening(mode);

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      const accessToken = data.session?.access_token;
      const refreshToken = data.session?.refresh_token;
      if (!accessToken || !refreshToken) {
        throw new Error('Your BUKLOD session is not available. Please sign in again.');
      }

      const query = [
        'buklod_handoff=1',
        `access_token=${encodeURIComponent(accessToken)}`,
        `refresh_token=${encodeURIComponent(refreshToken)}`,
        `classroom_mode=${encodeURIComponent(mode)}`,
      ].join('&');

      if (Platform.OS !== 'web') {
        try {
          const nativeUrl = `buklod-classroom://?${query}`;
          if (await Linking.canOpenURL(nativeUrl)) {
            await Linking.openURL(nativeUrl);
            return;
          }
        } catch {
          // Fall through to the canonical Classroom web app.
        }
      }

      await Linking.openURL(`https://buklod-classroom.expo.app/?${query}`);
    } catch (error: any) {
      Alert.alert(
        'BUKLOD Classroom',
        String(error?.message ?? 'Could not open BUKLOD Classroom.')
      );
    } finally {
      setOpening(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>BUKLOD Main</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="google-classroom" size={30} color="#1f7a3f" />
        </View>
        <Text style={styles.eyebrow}>BUKLOD EXTENSION</Text>
        <Text style={styles.title}>My Classroom</Text>
        <Text style={styles.subtitle}>
          BUKLOD Main is your account and session doorway. Classroom opens as its focused extension using this same BUKLOD account and connected academic records.
        </Text>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color="#1f7a3f" />
          <Text style={styles.emptyText}>Checking Classroom access…</Text>
        </View>
      ) : !access?.can_open ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="school-outline" size={34} color="#6b786e" />
          <Text style={styles.emptyTitle}>My Classroom unavailable</Text>
          <Text style={styles.emptyText}>
            My Classroom is available only to an actively enrolled Student or an active BUKLOD Faculty user.
          </Text>
        </View>
      ) : (
        <>
          {access.is_student ? (
            <Pressable
              style={({ pressed }) => [styles.launchCard, pressed && styles.pressed]}
              disabled={!!opening}
              onPress={() => void openClassroom('STUDENT')}
            >
              <View style={styles.cardIcon}>
                <MaterialCommunityIcons name="account-school-outline" size={25} color="#1f7a3f" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Enter as Student</Text>
                <Text style={styles.cardMeta}>
                  {access.student_class_count} active enrollment{access.student_class_count === 1 ? '' : 's'} • no second login
                </Text>
              </View>
              {opening === 'STUDENT' ? (
                <ActivityIndicator color="#1f7a3f" />
              ) : (
                <MaterialCommunityIcons name="open-in-new" size={22} color="#839087" />
              )}
            </Pressable>
          ) : null}

          {access.is_faculty ? (
            <Pressable
              style={({ pressed }) => [styles.launchCard, pressed && styles.pressed]}
              disabled={!!opening}
              onPress={() => void openClassroom('FACULTY')}
            >
              <View style={styles.cardIcon}>
                <MaterialCommunityIcons name="human-male-board" size={25} color="#1f7a3f" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Enter as Faculty</Text>
                <Text style={styles.cardMeta}>
                  {access.faculty_class_count} active class{access.faculty_class_count === 1 ? '' : 'es'} • same BUKLOD session
                </Text>
              </View>
              {opening === 'FACULTY' ? (
                <ActivityIndicator color="#1f7a3f" />
              ) : (
                <MaterialCommunityIcons name="open-in-new" size={22} color="#839087" />
              )}
            </Pressable>
          ) : null}

          {access.is_student && access.is_faculty ? (
            <Text style={styles.dualNote}>
              Dual-role account: choose Student or Faculty here. The role changes the Classroom context, not your BUKLOD account.
            </Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

export default function BuklodClassroomsScreen() {
  const classroomTarget = isBuklodClassroomApp();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [rows, setRows] = useState<ClassroomRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  /*
   * BUKLOD_CLASSROOM_ACCOUNT_ISOLATION_R2
   *
   * In the Classroom target, My Classroom is the STUDENT doorway only.
   * Faculty-owned classrooms live in BUKLOD Faculty -> My Class and must never
   * leak into the student list. In Main, this route is only a zero-login door
   * to the extension app; Main does not own Classroom feature screens.
   */
  const activeUserIdRef = useRef<string | null>(userId);

  useEffect(() => {
    activeUserIdRef.current = userId;
    setRows([]);
    setRefreshing(false);
  }, [userId]);

  const load = useCallback(async () => {
    const requestedUserId = userId;

    if (!classroomTarget || !requestedUserId) {
      setRows([]);
      return;
    }

    const { data, error } = await supabase.rpc('buklod_classroom_my_classes_v1');

    if (activeUserIdRef.current !== requestedUserId) {
      return;
    }

    const { data: authCheck } = await supabase.auth.getUser();

    if (
      activeUserIdRef.current !== requestedUserId ||
      authCheck.user?.id !== requestedUserId
    ) {
      setRows([]);
      return;
    }

    if (error) {
      Alert.alert('BUKLOD Classroom', error.message);
      return;
    }

    const studentRows = ((data ?? []) as ClassroomRow[]).filter(
      row => row.role_key === 'STUDENT'
    );

    setRows(studentRows);
  }, [classroomTarget, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!classroomTarget) {
    return <MainClassroomDoor />;
  }

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
            if (activeUserIdRef.current === userId) {
              setRefreshing(false);
            }
          }}
        />
      }
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>BUKLOD Classroom</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="google-classroom" size={30} color="#1f7a3f" />
        </View>
        <Text style={styles.eyebrow}>LEARN • INTERACT</Text>
        <Text style={styles.title}>My Classroom</Text>
        <Text style={styles.subtitle}>
          Your enrolled classes, discussions, live sessions, activities, submissions, materials, grades and BUKLOD Quiz entry in one student doorway.
        </Text>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{rows.length}</Text>
          <Text style={styles.metricLabel}>Enrolled Classes</Text>
        </View>
        <View style={styles.metric}>
          <MaterialCommunityIcons name="account-school-outline" size={24} color="#1f7a3f" />
          <Text style={styles.metricLabel}>Student View</Text>
        </View>
      </View>

      <BuklodQuizStudentEntry />

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="school-outline" size={34} color="#6b786e" />
          <Text style={styles.emptyTitle}>No enrolled classroom yet</Text>
          <Text style={styles.emptyText}>
            You can still enter BUKLOD Quiz above and use the live class code provided by your examiner. Your classroom will appear here once you are actively enrolled.
          </Text>
        </View>
      ) : (
        rows.map(row => (
          <Pressable
            key={row.classroom_id}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() =>
              router.push({
                pathname: '/profile/buklod-classroom' as any,
                params: { id: row.classroom_id, name: row.classroom_name },
              })
            }
          >
            <View style={styles.cardIcon}>
              <MaterialCommunityIcons
                name="account-school-outline"
                size={25}
                color="#1f7a3f"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{row.classroom_name}</Text>
              <Text style={styles.cardMeta}>
                {[row.subject_code, row.section_name, row.term].filter(Boolean).join(' • ') || 'Active classroom'}
              </Text>
              <View style={styles.pills}>
                <View style={styles.pill}><Text style={styles.pillText}>ENROLLED</Text></View>
                <View style={styles.pill}><Text style={styles.pillText}>{row.classroom_mode}</Text></View>
                <View style={[styles.pill, row.classroom_plan === 'PREMIUM' && styles.premiumPill]}>
                  <Text style={styles.pillText}>{row.classroom_plan}</Text>
                </View>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={23} color="#839087" />
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f6f1' },
  content: { padding: 20, paddingTop: 44, paddingBottom: 70 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
  backText: { color: '#17311f', fontWeight: '900' },
  hero: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 14 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#e7f4e9', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#17311f', fontSize: 30, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#68736b', lineHeight: 20, marginTop: 7 },
  metrics: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  metric: { flex: 1, minHeight: 70, backgroundColor: '#fff', borderRadius: 15, padding: 12, alignItems: 'center', justifyContent: 'center' },
  metricValue: { color: '#17311f', fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#758078', fontSize: 11, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 19, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  launchCard: { backgroundColor: '#fff', borderRadius: 19, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#e7f4e9', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#203328', fontWeight: '900', fontSize: 16 },
  cardMeta: { color: '#6f7b72', marginTop: 3, fontSize: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  pill: { backgroundColor: '#eef4ef', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  premiumPill: { backgroundColor: '#fff1cd' },
  pillText: { color: '#526159', fontWeight: '900', fontSize: 9 },
  empty: { backgroundColor: '#fff', borderRadius: 20, padding: 22, alignItems: 'center' },
  emptyTitle: { color: '#24362b', fontWeight: '900', fontSize: 17, marginTop: 10 },
  emptyText: { color: '#6c786f', textAlign: 'center', lineHeight: 19, marginTop: 6 },
  dualNote: { color: '#68736b', fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 10, marginTop: 4 },
  pressed: { opacity: 0.84 },
});
