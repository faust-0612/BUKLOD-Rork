import { useCallback,useEffect,useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';

type ReleasedQuizResult = {
  attempt_id: string;
  exam_id: string;
  exam_title: string;
  section_id: string | null;
  section_name: string | null;
  student_user_id: string;
  student_name: string;
  student_no: string | null;
  attempt_no: number;
  total_score: number | null;
  max_score: number | null;
  score_percent: number | null;
  released_at: string;
  integrity_events: number;
};

function scoreText(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '-';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function whenText(value: string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export default function BuklodFacultyQuizResultsScreen() {
  const [rows,setRows] = useState<ReleasedQuizResult[]>([]);
  const [refreshing,setRefreshing] = useState(false);
  const [loading,setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data,error } = await supabase.rpc(
        'buklod_quiz_faculty_released_results_v1',
        { p_limit: 1000 },
      );

      if (error) throw error;
      setRows((data ?? []) as ReleasedQuizResult[]);
    } catch (e: any) {
      setRows([]);
      Alert.alert(
        'BUKLOD Quiz Results',
        String(
          e?.message ??
          'Could not load released BUKLOD Quiz results.',
        ),
      );
    } finally {
      setLoading(false);
    }
  },[]);

  useEffect(() => {
    void load();
  },[load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  },[load]);

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
      }
    >
      <View style={s.top}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#17311f" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>BUKLOD FACULTY</Text>
          <Text style={s.title}>Released Quiz Results</Text>
        </View>
      </View>

      <View style={s.notice}>
        <MaterialCommunityIcons name="check-decagram-outline" size={22} color="#1f7a3f" />
        <Text style={s.noticeText}>
          Only results already RELEASED by the examiner are shown here. Draft,
          pending-review, and unreleased scores are not exposed in this Faculty view.
        </Text>
      </View>

      <Pressable
        style={s.webButton}
        onPress={() => void Linking.openURL('https://buklod-quiz.expo.app/records')}
      >
        <MaterialCommunityIcons name="open-in-new" size={19} color="#fff" />
        <Text style={s.webButtonText}>OPEN FULL BUKLOD QUIZ CLASS RECORDS</Text>
      </Pressable>

      <Text style={s.count}>
        {loading ? 'Loading released results...' : `${rows.length} released result(s)`}
      </Text>

      {!loading && rows.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No released Quiz results yet</Text>
          <Text style={s.emptyText}>
            Once a BUKLOD Quiz attempt is released, it will appear here automatically
            for the faculty owner of that exam.
          </Text>
        </View>
      ) : (
        rows.map(item => (
          <View key={item.attempt_id} style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.exam}>{item.exam_title}</Text>
                <Text style={s.meta}>
                  {item.section_name || 'No section'} • Attempt {item.attempt_no}
                </Text>
              </View>
              <View style={s.scoreBox}>
                <Text style={s.score}>
                  {item.total_score == null
                    ? '-'
                    : `${scoreText(item.total_score)}/${scoreText(item.max_score)}`}
                </Text>
                <Text style={s.percent}>
                  {item.score_percent == null ? '-' : `${scoreText(item.score_percent)}%`}
                </Text>
              </View>
            </View>

            <Text style={s.student}>{item.student_name}</Text>
            {!!item.student_no && (
              <Text style={s.meta}>Student no.: {item.student_no}</Text>
            )}
            <Text style={s.meta}>Released: {whenText(item.released_at)}</Text>
            <Text style={s.integrity}>
              Integrity incidents recorded: {Number(item.integrity_events ?? 0)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:{ flex:1,backgroundColor:'#f4f7f2' },
  content:{ padding:18,paddingTop:44,paddingBottom:60 },
  top:{ flexDirection:'row',alignItems:'center',gap:12,marginBottom:16 },
  eyebrow:{ color:'#1f7a3f',fontSize:10,fontWeight:'900',letterSpacing:1.2 },
  title:{ color:'#17311f',fontSize:25,fontWeight:'900',marginTop:2 },
  notice:{ flexDirection:'row',gap:10,backgroundColor:'#e8f4ea',borderRadius:15,padding:14,marginBottom:12 },
  noticeText:{ flex:1,color:'#425249',fontSize:12,lineHeight:18 },
  webButton:{ flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#1f7a3f',borderRadius:13,paddingVertical:12,paddingHorizontal:14,marginBottom:16 },
  webButtonText:{ color:'#fff',fontWeight:'900',fontSize:12 },
  count:{ color:'#6a756d',fontWeight:'800',marginBottom:10 },
  empty:{ backgroundColor:'#fff',borderRadius:17,padding:18 },
  emptyTitle:{ color:'#203328',fontWeight:'900',fontSize:16 },
  emptyText:{ color:'#68736b',marginTop:5,lineHeight:18 },
  card:{ backgroundColor:'#fff',borderRadius:17,padding:15,marginBottom:10 },
  cardTop:{ flexDirection:'row',gap:12,alignItems:'flex-start' },
  exam:{ color:'#203328',fontWeight:'900',fontSize:15 },
  student:{ color:'#17311f',fontWeight:'900',fontSize:14,marginTop:10 },
  meta:{ color:'#68736b',fontSize:11,marginTop:3 },
  scoreBox:{ alignItems:'flex-end' },
  score:{ color:'#17311f',fontWeight:'900',fontSize:16 },
  percent:{ color:'#1f7a3f',fontWeight:'900',fontSize:12,marginTop:2 },
  integrity:{ color:'#7b6145',fontSize:10,fontWeight:'700',marginTop:7 },
});