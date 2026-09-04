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
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ClassroomDrawer } from '@/components/classroom/ClassroomDrawer';
import { useClassroomTheme } from '@/hooks/useClassroomTheme';
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
  short: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  route: string;
  tone: 'primary' | 'secondary' | 'accent' | 'neutral';
};

const MODULES: ModuleCard[] = [
  { key: 'discuss', title: 'Discussions', short: 'Feed', description: 'Announcements, questions, recitation threads and reactions.', icon: 'forum-outline', route: '/profile/buklod-classroom-discuss', tone: 'secondary' },
  { key: 'chat', title: 'Class Messages', short: 'Talk', description: 'Fast classroom messaging for the people inside this class.', icon: 'message-text-outline', route: '/profile/buklod-classroom-chat', tone: 'primary' },
  { key: 'work', title: 'Activities', short: 'Work', description: 'Tasks, rubrics, deadlines, submissions and faculty feedback.', icon: 'clipboard-text-outline', route: '/profile/buklod-classroom-work', tone: 'accent' },
  { key: 'materials', title: 'Materials', short: 'Library', description: 'Files, videos, links, readings and class resources.', icon: 'bookshelf', route: '/profile/buklod-classroom-materials', tone: 'neutral' },
  { key: 'attendance', title: 'Attendance', short: 'Time in', description: 'Open class sessions, verified time-in and attendance history.', icon: 'calendar-check-outline', route: '/profile/buklod-classroom-attendance', tone: 'secondary' },
  { key: 'grades', title: 'My Grades', short: 'Standing', description: 'Prelim to Finals, released components and consultation.', icon: 'school-outline', route: '/profile/buklod-classroom-grades', tone: 'accent' },
  { key: 'monitor', title: 'Class Monitor', short: 'Pulse', description: 'Participation, recitation, presentation and engagement trail.', icon: 'chart-timeline-variant-shimmer', route: '/profile/buklod-classroom-monitor', tone: 'primary' },
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
  const { theme, themeId, setThemeId } = useClassroomTheme();

  const [context, setContext] = useState<Context | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [liveTitle, setLiveTitle] = useState('Live Class');
  const [liveBusy, setLiveBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
  const role = context?.role ?? 'STUDENT';
  const isFaculty = role === 'FACULTY';

  const meta = useMemo(
    () => [context?.subject_code, context?.section_name, context?.term].filter(Boolean).join('  /  '),
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

  const toneFor = (tone: ModuleCard['tone']) => {
    if (tone === 'primary') return theme.primary;
    if (tone === 'secondary') return theme.secondary;
    if (tone === 'accent') return theme.accent;
    return theme.muted;
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => setDrawerOpen(true)}
            style={[styles.menuButton, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
          >
            <MaterialCommunityIcons name="menu" size={22} color={theme.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.topKicker, { color: theme.muted }]}>MY CLASSROOM</Text>
            <Text numberOfLines={1} style={[styles.topName, { color: theme.ink }]}>{className}</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            style={[styles.exitButton, { borderColor: theme.border }]}
          >
            <MaterialCommunityIcons name="arrow-left" size={18} color={theme.ink} />
            <Text style={[styles.exitText, { color: theme.ink }]}>Classes</Text>
          </Pressable>
        </View>

        <LinearGradient
          colors={[theme.heroStart, theme.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTape} />
          <View style={styles.heroTop}>
            <View style={[styles.bookMark, { backgroundColor: theme.accent }]}>
              <MaterialCommunityIcons name="book-open-page-variant-outline" size={25} color={theme.drawer} />
            </View>
            <View style={styles.roleBlock}>
              <Text style={styles.heroSmall}>{role}</Text>
              <Text style={styles.heroSmall}>{context?.classroom_mode ?? 'HYBRID'}</Text>
            </View>
          </View>
          <Text style={styles.heroKicker}>BUKLOD CLASSROOM</Text>
          <Text style={styles.heroTitle}>{className}</Text>
          {!!meta && <Text style={styles.heroMeta}>{meta}</Text>}
          <Text style={styles.heroDescription}>
            {context?.description || 'Live learning, discussions, submissions, resources and grade consultation in one class space.'}
          </Text>

          <View style={styles.heroBottom}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{overview?.students ?? 0}</Text>
              <Text style={styles.heroStatLabel}>people</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{overview?.assignments ?? 0}</Text>
              <Text style={styles.heroStatLabel}>activities</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{overview?.posts ?? 0}</Text>
              <Text style={styles.heroStatLabel}>posts</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.liveCard, { backgroundColor: theme.surfaceRaised, borderColor: activeLive ? theme.secondary : theme.border }]}>
          <View style={[styles.liveFlag, { backgroundColor: activeLive ? theme.secondary : theme.primary }]}>
            <MaterialCommunityIcons name={activeLive ? 'broadcast' : 'video-outline'} size={19} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.liveTitle, { color: theme.ink }]}>{activeLive ? activeLive.title : 'Live room'}</Text>
            <Text style={[styles.liveMeta, { color: theme.muted }]}>
              {activeLive ? formatRemaining(activeLive.hard_stop_at) : 'Video class, presentation and recitation space'}
            </Text>
          </View>
          {activeLive ? (
            <Pressable onPress={joinLive} style={[styles.liveAction, { backgroundColor: theme.secondary }]}>
              <Text style={styles.liveActionText}>{isFaculty ? 'Return' : 'Join'}</Text>
              <MaterialCommunityIcons name="arrow-right" size={17} color="#fff" />
            </Pressable>
          ) : isFaculty ? (
            <Pressable onPress={startLive} disabled={liveBusy} style={[styles.liveAction, { backgroundColor: theme.primary }, liveBusy && styles.disabled]}>
              <Text style={styles.liveActionText}>{liveBusy ? 'Starting' : 'Start'}</Text>
              <MaterialCommunityIcons name="video-plus-outline" size={17} color="#fff" />
            </Pressable>
          ) : (
            <View style={[styles.offlinePill, { backgroundColor: theme.chip }]}>
              <Text style={[styles.offlineText, { color: theme.muted }]}>OFFLINE</Text>
            </View>
          )}
        </View>

        {!activeLive && isFaculty && (
          <TextInput
            value={liveTitle}
            onChangeText={setLiveTitle}
            placeholder="Name the next live class"
            placeholderTextColor={theme.muted}
            style={[styles.liveInput, { backgroundColor: theme.surface, color: theme.ink, borderColor: theme.border }]}
          />
        )}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionKicker, { color: theme.secondary }]}>CLASS DESK</Text>
            <Text style={[styles.sectionTitle, { color: theme.ink }]}>Pick up where you left off</Text>
          </View>
          <Pressable onPress={() => setDrawerOpen(true)} style={[styles.customize, { backgroundColor: theme.chip }]}>
            <MaterialCommunityIcons name="palette-outline" size={16} color={theme.ink} />
            <Text style={[styles.customizeText, { color: theme.ink }]}>Theme</Text>
          </Pressable>
        </View>

        <View style={styles.moduleGrid}>
          {MODULES.filter(module => {
            if (module.key === 'grades' || module.key === 'attendance') return !isFaculty;
            return true;
          }).map((module, index) => {
            const tone = toneFor(module.tone);
            const wide = index === 0 || index % 4 === 3;
            return (
              <Pressable
                key={module.key}
                onPress={() => openModule(module.route)}
                style={({ pressed }) => [
                  styles.moduleCard,
                  wide ? styles.moduleWide : styles.moduleHalf,
                  { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
                  index % 3 === 1 && { transform: [{ rotate: '0.6deg' }] },
                  pressed && { opacity: 0.76, transform: [{ scale: 0.985 }] },
                ]}
              >
                <View style={styles.moduleTop}>
                  <View style={[styles.moduleIcon, { backgroundColor: `${tone}1A` }]}>
                    <MaterialCommunityIcons name={module.icon} size={24} color={tone} />
                  </View>
                  <Text style={[styles.moduleShort, { color: tone }]}>{module.short.toUpperCase()}</Text>
                </View>
                <Text style={[styles.moduleTitle, { color: theme.ink }]}>{module.title}</Text>
                <Text style={[styles.moduleText, { color: theme.muted }]}>{module.description}</Text>
                <View style={styles.moduleFooter}>
                  <View style={[styles.moduleLine, { backgroundColor: tone }]} />
                  <MaterialCommunityIcons name="arrow-top-right" size={17} color={theme.muted} />
                </View>
              </Pressable>
            );
          })}
        </View>

        {isFaculty && (
          <Pressable
            onPress={() => router.push({ pathname: '/profile/buklod-faculty-class' as any, params: { id: classroomId, classroomId, name: className } })}
            style={[styles.facultyStrip, { backgroundColor: theme.drawer }]}
          >
            <View style={[styles.facultyNumber, { backgroundColor: theme.accent }]}>
              <Text style={[styles.facultyNumberText, { color: theme.drawer }]}>F</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.facultyKicker, { color: theme.accent }]}>FACULTY ONLY</Text>
              <Text style={[styles.facultyTitle, { color: theme.drawerInk }]}>Command Center</Text>
              <Text style={[styles.facultyText, { color: theme.muted }]}>Roster, attendance, Quiz sync, grading setup, reports and final grades.</Text>
            </View>
            <MaterialCommunityIcons name="arrow-right" size={22} color={theme.drawerInk} />
          </Pressable>
        )}

        <View style={[styles.themeNote, { borderColor: theme.border }]}>
          <View style={[styles.themeDot, { backgroundColor: theme.primary }]} />
          <View style={[styles.themeDot, { backgroundColor: theme.secondary }]} />
          <View style={[styles.themeDot, { backgroundColor: theme.accent }]} />
          <Text style={[styles.themeNoteText, { color: theme.muted }]}>Using {theme.name}. Change it anytime from the drawer.</Text>
        </View>
      </ScrollView>

      <ClassroomDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        classroomId={classroomId}
        classroomName={className}
        role={role}
        theme={theme}
        themeId={themeId}
        onThemeChange={setThemeId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 42, paddingBottom: 72 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  menuButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  topName: { fontSize: 15, fontWeight: '900', marginTop: 1 },
  exitButton: { height: 40, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  exitText: { fontSize: 10, fontWeight: '900' },
  hero: { borderRadius: 26, padding: 20, overflow: 'hidden', position: 'relative' },
  heroTape: { position: 'absolute', width: 86, height: 20, top: 9, right: -17, backgroundColor: 'rgba(255,255,255,0.13)', transform: [{ rotate: '15deg' }] },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookMark: { width: 46, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  roleBlock: { alignItems: 'flex-end', gap: 2 },
  heroSmall: { color: 'rgba(255,255,255,0.72)', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  heroKicker: { color: 'rgba(255,255,255,0.70)', fontSize: 9, fontWeight: '900', letterSpacing: 1.7, marginTop: 22 },
  heroTitle: { color: '#fff', fontSize: 29, fontWeight: '900', lineHeight: 33, marginTop: 2 },
  heroMeta: { color: 'rgba(255,255,255,0.80)', fontSize: 10, fontWeight: '800', marginTop: 5 },
  heroDescription: { color: 'rgba(255,255,255,0.78)', lineHeight: 18, fontSize: 11, marginTop: 10, maxWidth: '94%' },
  heroBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  heroStat: { minWidth: 68 },
  heroStatValue: { color: '#fff', fontWeight: '900', fontSize: 18 },
  heroStatLabel: { color: 'rgba(255,255,255,0.60)', fontSize: 8, marginTop: 1 },
  heroDivider: { height: 28, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.24)', marginHorizontal: 13 },
  liveCard: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 11, marginTop: 12 },
  liveFlag: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  liveTitle: { fontWeight: '900', fontSize: 14 },
  liveMeta: { fontSize: 9, marginTop: 2 },
  liveAction: { minHeight: 36, borderRadius: 11, paddingHorizontal: 11, flexDirection: 'row', gap: 5, alignItems: 'center' },
  liveActionText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  offlinePill: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10 },
  offlineText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  liveInput: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10, marginTop: 7 },
  disabled: { opacity: 0.45 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  sectionKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { fontSize: 19, fontWeight: '900', marginTop: 2 },
  customize: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10 },
  customizeText: { fontSize: 9, fontWeight: '900' },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  moduleCard: { borderRadius: 17, borderWidth: 1, padding: 13, minHeight: 144 },
  moduleWide: { width: '100%' },
  moduleHalf: { width: '48.5%' },
  moduleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moduleIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  moduleShort: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  moduleTitle: { fontSize: 15, fontWeight: '900', marginTop: 11 },
  moduleText: { fontSize: 10, lineHeight: 15, marginTop: 4, flex: 1 },
  moduleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  moduleLine: { width: 34, height: 3, borderRadius: 3 },
  facultyStrip: { borderRadius: 18, padding: 15, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  facultyNumber: { width: 43, height: 51, borderRadius: 7, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-2deg' }] },
  facultyNumberText: { fontWeight: '900', fontSize: 22 },
  facultyKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  facultyTitle: { fontWeight: '900', fontSize: 15, marginTop: 2 },
  facultyText: { fontSize: 9, lineHeight: 13, marginTop: 3 },
  themeNote: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 15, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  themeDot: { width: 8, height: 8, borderRadius: 3 },
  themeNoteText: { marginLeft: 4, fontSize: 9 },
});
