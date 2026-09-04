import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';

type Context = {
  id: string;
  name: string;
  subject_code: string | null;
  section_name: string | null;
  school_year: string | null;
  term: string | null;
  description: string | null;
  classroom_mode: string;
  classroom_plan: 'FREE' | 'PREMIUM';
  free_live_minutes: number;
  allow_student_posts: boolean;
  allow_student_chat: boolean;
  allow_student_uploads: boolean;
  role: 'FACULTY' | 'STUDENT';
};

type LiveSession = {
  id: string;
  title: string;
  call_id: string;
  started_at: string | null;
  hard_stop_at: string | null;
  plan_key: string;
  free_limit_minutes: number;
};

type Overview = {
  posts: number;
  assignments: number;
  materials: number;
  students: number;
  live_session: LiveSession | null;
};

type ModuleCard = {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  route: string;
};

const MODULES: ModuleCard[] = [
  { key: 'discuss', title: 'Discussions', description: 'Announcements, questions, recitation threads and asynchronous class conversations.', icon: 'forum-outline', route: '/profile/buklod-classroom-discuss' },
  { key: 'chat', title: 'Class Messages', description: 'General classroom messaging with room for group and activity threads.', icon: 'message-text-outline', route: '/profile/buklod-classroom-chat' },
  { key: 'work', title: 'Activities & Submissions', description: 'Activities, rubrics, deadlines, student submissions, feedback and grading.', icon: 'clipboard-text-outline', route: '/profile/buklod-classroom-work' },
  { key: 'materials', title: 'Materials & Media', description: 'Files, photos, videos, links and learning resources for this class.', icon: 'folder-multiple-image', route: '/profile/buklod-classroom-materials' },
  { key: 'grades', title: 'My Grades', description: 'Prelim, Midterm, Semifinals, Finals, released category grades and final grade consultation.', icon: 'school-outline', route: '/profile/buklod-classroom-grades' },
  { key: 'monitor', title: 'Class Monitor', description: 'Track participation, recitation, presentations, live presence and asynchronous engagement.', icon: 'chart-timeline-variant-shimmer', route: '/profile/buklod-classroom-monitor' },
];

function formatRemaining(hardStopAt: string | null) {
  if (!hardStopAt) return 'Premium session';
  const ms = new Date(hardStopAt).getTime() - Date.now();
  if (ms <= 0) return 'Ending now';
  const minutes = Math.ceil(ms / 60000);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m remaining`;
  return `${minutes}m remaining`;
}

export default function BuklodClassroomScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const fallbackName = String(params.name ?? 'Classroom');

  const [context, setContext] = useState<Context | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [liveTitle, setLiveTitle] = useState('Live Class');
  const [liveBusy, setLiveBusy] = useState(false);

  const load = useCallback(async () => {
    if (!classroomId) return;
    const [contextRes, overviewRes] = await Promise.all([
      supabase.rpc('buklod_classroom_context_v1', { p_classroom_id: classroomId }),
      supabase.rpc('buklod_classroom_overview_v1', { p_classroom_id: classroomId }),
    ]);
    if (contextRes.error) {
      Alert.alert('BUKLOD Classroom', contextRes.error.message);
      return;
    }
    if (overviewRes.error) {
      Alert.alert('BUKLOD Classroom', overviewRes.error.message);
      return;
    }
    setContext(contextRes.data as Context);
    setOverview(overviewRes.data as Overview);
  }, [classroomId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const activeLive = overview?.live_session ?? null;
  const className = context?.name || fallbackName;
  const isFaculty = context?.role === 'FACULTY';

  const meta = useMemo(
    () => [context?.subject_code, context?.section_name, context?.term].filter(Boolean).join(' • '),
    [context]
  );

  const startLive = async () => {
    if (!isFaculty || liveBusy) return;
    setLiveBusy(true);
    try {
      const { data, error } = await supabase.rpc('buklod_classroom_start_live_v1', {
        p_classroom_id: classroomId,
        p_title: liveTitle.trim() || 'Live Class',
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.session_id) throw new Error('Live session was created without a session id.');
      await load();
      router.push({
        pathname: '/profile/buklod-classroom-live' as any,
        params: { id: classroomId, sessionId: String(row.session_id), name: className },
      });
    } catch (error) {
      Alert.alert('Start Live Class', error instanceof Error ? error.message : 'Could not start the live class.');
    } finally {
      setLiveBusy(false);
    }
  };

  const joinLive = () => {
    if (!activeLive) return;
    router.push({
      pathname: '/profile/buklod-classroom-live' as any,
      params: { id: classroomId, sessionId: activeLive.id, name: className },
    });
  };

  const openModule = (route: string) => {
    router.push({ pathname: route as any, params: { id: classroomId, classroomId, name: className } });
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
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        <Text style={styles.backText}>My Classrooms</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="google-classroom" size={31} color="#1f7a3f" />
          </View>
          <View style={styles.rolePill}><Text style={styles.roleText}>{context?.role ?? 'CLASSROOM'}</Text></View>
        </View>
        <Text style={styles.eyebrow}>BUKLOD CLASSROOM</Text>
        <Text style={styles.title}>{className}</Text>
        {!!meta && <Text style={styles.meta}>{meta}</Text>}
        <Text style={styles.subtitle}>
          {context?.description || 'One place for live and asynchronous learning, class interaction, activities, materials and monitoring.'}
        </Text>
        <View style={styles.planRow}>
          <View style={styles.planPill}><Text style={styles.planText}>{context?.classroom_mode ?? 'HYBRID'}</Text></View>
          <View style={[styles.planPill, context?.classroom_plan === 'PREMIUM' && styles.premiumPlan]}>
            <Text style={styles.planText}>{context?.classroom_plan ?? 'FREE'}</Text>
          </View>
          {context?.classroom_plan !== 'PREMIUM' && (
            <Text style={styles.freeNote}>Live room: up to {context?.free_live_minutes ?? 120} min/session</Text>
          )}
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.metricValue}>{overview?.students ?? 0}</Text><Text style={styles.metricLabel}>Students</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{overview?.posts ?? 0}</Text><Text style={styles.metricLabel}>Posts</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{overview?.assignments ?? 0}</Text><Text style={styles.metricLabel}>Activities</Text></View>
      </View>

      <View style={[styles.liveCard, activeLive ? styles.liveActive : null]}>
        <View style={styles.liveHeader}>
          <View style={[styles.liveDot, activeLive && styles.liveDotActive]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.liveTitle}>{activeLive ? activeLive.title : 'Live Classroom'}</Text>
            <Text style={styles.liveMeta}>
              {activeLive ? formatRemaining(activeLive.hard_stop_at) : 'Video class, presentation and recitation room'}
            </Text>
          </View>
          <MaterialCommunityIcons name="video-outline" size={26} color={activeLive ? '#b62828' : '#1f7a3f'} />
        </View>

        {activeLive ? (
          <Pressable style={styles.liveButton} onPress={joinLive}>
            <MaterialCommunityIcons name="video" size={20} color="#fff" />
            <Text style={styles.liveButtonText}>{isFaculty ? 'Return to Live Class' : 'Join Live Class'}</Text>
          </Pressable>
        ) : isFaculty ? (
          <>
            <TextInput value={liveTitle} onChangeText={setLiveTitle} placeholder="Live class title" style={styles.liveInput} />
            <Pressable disabled={liveBusy} style={[styles.liveButton, liveBusy && styles.disabled]} onPress={startLive}>
              <MaterialCommunityIcons name="video-plus" size={20} color="#fff" />
              <Text style={styles.liveButtonText}>{liveBusy ? 'Starting…' : 'Start Live Class'}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.waitingText}>No live class right now. You can continue with discussions, messages and activities asynchronously.</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Classroom Spaces</Text>
      {MODULES.filter(module => module.key !== 'grades' || !isFaculty).map(module => (
        <Pressable key={module.key} style={({ pressed }) => [styles.moduleCard, pressed && styles.pressed]} onPress={() => openModule(module.route)}>
          <View style={styles.moduleIcon}>
            <MaterialCommunityIcons name={module.icon} size={25} color="#1f7a3f" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.moduleTitle}>{module.title}</Text>
            <Text style={styles.moduleText}>{module.description}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#839087" />
        </Pressable>
      ))}

      {isFaculty && (
        <>
          <Text style={styles.sectionTitle}>Faculty Connection</Text>
          <Pressable
            style={styles.facultyCard}
            onPress={() => router.push({ pathname: '/profile/buklod-faculty-class' as any, params: { id: classroomId, classroomId, name: className } })}
          >
            <MaterialCommunityIcons name="human-male-board" size={25} color="#1f7a3f" />
            <View style={{ flex: 1 }}>
              <Text style={styles.moduleTitle}>Open Faculty Command Center</Text>
              <Text style={styles.moduleText}>Roster, attendance, assessments, BUKLOD Quiz, grading setup, gradebook and final grades stay connected to this same class.</Text>
            </View>
            <MaterialCommunityIcons name="open-in-new" size={20} color="#1f7a3f" />
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#123d24' },
  content: { padding: 20, paddingTop: 44, paddingBottom: 80 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
  backText: { color: '#fff', fontWeight: '900' },
  hero: { backgroundColor: '#fff', borderRadius: 26, padding: 20 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  heroIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#e7f4e9', alignItems: 'center', justifyContent: 'center' },
  rolePill: { backgroundColor: '#eef5ef', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 },
  roleText: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 28, fontWeight: '900', marginTop: 2 },
  meta: { color: '#526159', fontWeight: '800', marginTop: 4 },
  subtitle: { color: '#6a756d', lineHeight: 19, marginTop: 7 },
  planRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 13 },
  planPill: { backgroundColor: '#edf4ee', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  premiumPlan: { backgroundColor: '#fff0c9' },
  planText: { color: '#4f6055', fontSize: 9, fontWeight: '900' },
  freeNote: { color: '#758078', fontSize: 10, marginLeft: 4 },
  metrics: { flexDirection: 'row', gap: 9, marginTop: 12 },
  metric: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, alignItems: 'center' },
  metricValue: { color: '#17311f', fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#718077', fontSize: 10, fontWeight: '800' },
  liveCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginTop: 12 },
  liveActive: { borderWidth: 2, borderColor: '#e9b0b0' },
  liveHeader: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#9ba89e' },
  liveDotActive: { backgroundColor: '#d93535' },
  liveTitle: { color: '#203328', fontWeight: '900', fontSize: 16 },
  liveMeta: { color: '#748078', fontSize: 11, marginTop: 2 },
  liveInput: { backgroundColor: '#f2f6f2', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginTop: 13, color: '#24362b' },
  liveButton: { backgroundColor: '#1f7a3f', borderRadius: 12, paddingVertical: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  liveButtonText: { color: '#fff', fontWeight: '900' },
  disabled: { opacity: 0.55 },
  waitingText: { color: '#6e7a71', lineHeight: 18, marginTop: 12 },
  sectionTitle: { color: '#fff', fontWeight: '900', fontSize: 17, marginTop: 22, marginBottom: 10 },
  moduleCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 },
  moduleIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#e7f4e9', alignItems: 'center', justifyContent: 'center' },
  moduleTitle: { color: '#25372b', fontWeight: '900' },
  moduleText: { color: '#6b776e', lineHeight: 17, marginTop: 3, fontSize: 11 },
  facultyCard: { backgroundColor: '#e8f4ea', borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  pressed: { opacity: 0.84 },
});
