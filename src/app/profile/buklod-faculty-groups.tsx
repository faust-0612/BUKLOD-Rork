import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { FacultyGate } from '@/components/faculty/FacultyGate';

type StudentRow = {
  id: string;
  student_user_id: string;
  display_name: string | null;
  username: string | null;
};

type Activity = {
  id: string;
  title: string;
  points_possible: number;
  group_weight_percent: number;
  individual_weight_percent: number;
};

export default function FacultyGroupsScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupScore, setGroupScore] = useState('');
  const [individualScore, setIndividualScore] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [savedScores, setSavedScores] = useState<Array<{
    id: string;
    student_user_id: string;
    group_name: string | null;
    group_score: number | null;
    individual_score: number | null;
    final_score: number | null;
    status: string;
    activity_id: string;
  }>>([]);

  const load = async () => {
    const [rosterRes, activityRes, scoreRes] = await Promise.all([
      supabase.rpc('buklod_education_roster_v1', { p_classroom_id: classroomId }),
      supabase
        .from('buklod_education_group_activities')
        .select('id,title,points_possible,group_weight_percent,individual_weight_percent')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false }),
      supabase
        .from('buklod_education_group_activity_scores')
        .select('id,activity_id,student_user_id,group_name,group_score,individual_score,final_score,status')
        .eq('classroom_id', classroomId)
        .order('updated_at', { ascending: false }),
    ]);

    if (rosterRes.error) Alert.alert('Roster', rosterRes.error.message);
    if (activityRes.error) Alert.alert('Groups', activityRes.error.message);

    setStudents((rosterRes.data ?? []) as StudentRow[]);
    setActivities((activityRes.data ?? []) as Activity[]);
    setSavedScores((scoreRes.data ?? []) as typeof savedScores);
  };

  useEffect(() => {
    load();
  }, [classroomId]);

  const createActivity = async () => {
    if (!newTitle.trim()) return Alert.alert('Group Activity', 'Enter an activity title.');

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;

    const { error } = await supabase
      .from('buklod_education_group_activities')
      .insert({
        classroom_id: classroomId,
        title: newTitle.trim(),
        points_possible: 100,
        group_weight_percent: 70,
        individual_weight_percent: 30,
        created_by: uid,
      });

    if (error) return Alert.alert('Group Activity', error.message);
    setNewTitle('');
    load();
  };

  const saveScore = async () => {
    const g = Number(groupScore);
    const i = Number(individualScore);

    if (!selectedActivity || !selectedStudent || !Number.isFinite(g) || !Number.isFinite(i)) {
      return Alert.alert('Group Score', 'Select activity/student and enter valid scores.');
    }

    const { error } = await supabase.rpc('buklod_education_set_group_score_v1', {
      p_activity_id: selectedActivity,
      p_student_user_id: selectedStudent,
      p_group_name: groupName.trim() || null,
      p_group_score: g,
      p_individual_score: i,
    });

    if (error) return Alert.alert('Group Score', error.message);
    Alert.alert('Group Activity', 'Group and individual contribution saved as draft.');
    setGroupScore('');
    setIndividualScore('');
  };

  const releaseScore = async () => {
    if (!selectedActivity || !selectedStudent) {
      return Alert.alert('Release Group Score', 'Select an activity and student first.');
    }

    const { error } = await supabase.rpc('buklod_education_release_group_score_v1', {
      p_activity_id: selectedActivity,
      p_student_user_id: selectedStudent,
    });

    if (error) return Alert.alert('Release Group Score', error.message);
    Alert.alert('Group Activity', 'Score released to the student.');
  };

  return (
    <FacultyGate>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>{classroomName}</Text>
      </Pressable>

      <Text style={styles.eyebrow}>GROUP CONTRIBUTION</Text>
      <Text style={styles.title}>Group Activities</Text>

      <View style={styles.createCard}>
        <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="New group activity" style={styles.input} />
        <Pressable style={styles.primary} onPress={createActivity}>
          <Text style={styles.primaryText}>Create 70% Group / 30% Individual</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>1. Select Activity</Text>
      {activities.map(item => (
        <Pressable
          key={item.id}
          style={[styles.choice, selectedActivity === item.id && styles.choiceSelected]}
          onPress={() => setSelectedActivity(item.id)}
        >
          <Text style={styles.choiceTitle}>{item.title}</Text>
          <Text style={styles.choiceMeta}>
            {item.group_weight_percent}% group • {item.individual_weight_percent}% individual • {item.points_possible} pts
          </Text>
        </Pressable>
      ))}

      <Text style={styles.sectionTitle}>2. Select Student</Text>
      {students.map(item => (
        <Pressable
          key={item.id}
          style={[styles.choice, selectedStudent === item.student_user_id && styles.choiceSelected]}
          onPress={() => setSelectedStudent(item.student_user_id)}
        >
          <Text style={styles.choiceTitle}>{item.display_name || item.username || 'BUKLOD Student'}</Text>
          {!!item.username && <Text style={styles.choiceMeta}>@{item.username}</Text>}
        </Pressable>
      ))}

      <Text style={styles.sectionTitle}>3. Record Contribution</Text>
      <View style={styles.scoreCard}>
        <TextInput value={groupName} onChangeText={setGroupName} placeholder="Group name" style={styles.input} />
        <TextInput value={groupScore} onChangeText={setGroupScore} placeholder="Group score" keyboardType="decimal-pad" style={styles.input} />
        <TextInput value={individualScore} onChangeText={setIndividualScore} placeholder="Individual contribution score" keyboardType="decimal-pad" style={styles.input} />
        <Pressable style={styles.primary} onPress={saveScore}>
          <Text style={styles.primaryText}>Save Draft Score</Text>
        </Pressable>
        <Pressable style={styles.releaseButton} onPress={releaseScore}>
          <Text style={styles.releaseButtonText}>Release Selected Score</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Saved contribution scores</Text>
      {savedScores.length === 0 ? (
        <View style={styles.choice}>
          <Text style={styles.choiceMeta}>No group/individual scores saved in this class yet.</Text>
        </View>
      ) : (
        savedScores.map(item => {
          const student = students.find(row => row.student_user_id === item.student_user_id);
          const activity = activities.find(row => row.id === item.activity_id);
          return (
            <View key={item.id} style={styles.choice}>
              <Text style={styles.choiceTitle}>
                {student?.display_name || student?.username || 'Student'}
                {item.group_name ? ` • ${item.group_name}` : ''}
              </Text>
              <Text style={styles.choiceMeta}>
                {activity?.title || 'Activity'} • group {item.group_score ?? '—'} • individual {item.individual_score ?? '—'} • final {item.final_score ?? '—'} • {item.status}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  content: { padding: 20, paddingTop: 42, paddingBottom: 60 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  backText: { color: '#17311f', fontWeight: '800' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 27, fontWeight: '900', marginBottom: 18 },
  createCard: { backgroundColor: '#fff', borderRadius: 17, padding: 15, marginBottom: 20 },
  input: { backgroundColor: '#f3f6f2', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 9 },
  primary: { backgroundColor: '#1f7a3f', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  releaseButton: { marginTop: 9, backgroundColor: '#e8f4ea', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  releaseButtonText: { color: '#1f7a3f', fontWeight: '900' },
  sectionTitle: { color: '#17311f', fontSize: 16, fontWeight: '900', marginTop: 5, marginBottom: 9 },
  choice: { backgroundColor: '#fff', borderRadius: 14, padding: 13, marginBottom: 7, borderWidth: 1, borderColor: 'transparent' },
  choiceSelected: { borderColor: '#1f7a3f', backgroundColor: '#edf7ef' },
  choiceTitle: { color: '#25372c', fontWeight: '900' },
  choiceMeta: { color: '#748078', marginTop: 3, fontSize: 12 },
  scoreCard: { backgroundColor: '#fff', borderRadius: 17, padding: 15 },
});