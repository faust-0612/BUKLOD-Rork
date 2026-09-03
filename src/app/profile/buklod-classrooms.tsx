import { useCallback, useState } from 'react';
import {
  Alert,
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

export default function BuklodClassroomsScreen() {
  const [rows, setRows] = useState<ClassroomRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('buklod_classroom_my_classes_v1');
    if (error) {
      Alert.alert('BUKLOD Classroom', error.message);
      return;
    }
    setRows((data ?? []) as ClassroomRow[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const facultyCount = rows.filter(row => row.role_key === 'FACULTY').length;
  const studentCount = rows.filter(row => row.role_key === 'STUDENT').length;

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
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>BUKLOD</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="google-classroom" size={30} color="#1f7a3f" />
        </View>
        <Text style={styles.eyebrow}>LEARN • TEACH • INTERACT</Text>
        <Text style={styles.title}>My Classrooms</Text>
        <Text style={styles.subtitle}>
          Discussions, live classes, messages, activities, submissions, materials, presentations and academic monitoring in one classroom.
        </Text>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.metricValue}>{rows.length}</Text><Text style={styles.metricLabel}>Active</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{facultyCount}</Text><Text style={styles.metricLabel}>Teaching</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{studentCount}</Text><Text style={styles.metricLabel}>Enrolled</Text></View>
      </View>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="school-outline" size={34} color="#6b786e" />
          <Text style={styles.emptyTitle}>No active classroom yet</Text>
          <Text style={styles.emptyText}>
            Faculty can create a class from BUKLOD Faculty. Students will see a classroom here as soon as they are actively enrolled.
          </Text>
          <Pressable style={styles.primary} onPress={() => router.push('/profile/buklod-faculty' as any)}>
            <Text style={styles.primaryText}>Open BUKLOD Faculty</Text>
          </Pressable>
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
                name={row.role_key === 'FACULTY' ? 'human-male-board' : 'account-school-outline'}
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
                <View style={styles.pill}><Text style={styles.pillText}>{row.role_key}</Text></View>
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
  metrics: { flexDirection: 'row', gap: 9, marginBottom: 18 },
  metric: { flex: 1, backgroundColor: '#fff', borderRadius: 15, padding: 12, alignItems: 'center' },
  metricValue: { color: '#17311f', fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#758078', fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 19, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  primary: { backgroundColor: '#1f7a3f', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, marginTop: 16 },
  primaryText: { color: '#fff', fontWeight: '900' },
  pressed: { opacity: 0.84 },
});
