import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, SectionTitle, shared } from '@/components/UI';

type Assignment = {
  id: string;
  reading_date: string;
  bible_reference: string;
  instruction_fil: string | null;
  reflection_question_fil: string;
  reflection_question_en: string;
};

type Submission = {
  id: string;
  assignment_id: string;
  answer_text: string;
  answer_language: 'fil' | 'en';
  status: 'pending_admin' | 'approved' | 'rejected';
  submitted_at: string;
  submitted_on_time: boolean;
  admin_note: string | null;
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const fromIso = (s: string) => {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y,m-1,d);
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate()+n);
  return x;
};

const monday = () => {
  const d = new Date();
  d.setHours(12,0,0,0);
  d.setDate(d.getDate() - ((d.getDay()+6)%7));
  return d;
};

export default function DailyBibleScreen() {
  const weekStart = useMemo(monday, []);
  const days = useMemo(
    () => Array.from({length:7},(_,i)=>iso(addDays(weekStart,i))),
    [weekStart]
  );

  const today = iso(new Date());
  const [assignments,setAssignments] = useState<Assignment[]>([]);
  const [submissions,setSubmissions] = useState<Submission[]>([]);
  const [selectedDate,setSelectedDate] = useState(today);
  const [answer,setAnswer] = useState('');
  const [language,setLanguage] = useState<'fil'|'en'>('fil');
  const [points,setPoints] = useState(10);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [busy,setBusy] = useState(false);

  const load = useCallback(async () => {
    const {data:a,error:ae} = await supabase
      .from('daily_bible_assignments')
      .select('id,reading_date,bible_reference,instruction_fil,reflection_question_fil,reflection_question_en')
      .gte('reading_date',days[0])
      .lte('reading_date',days[6])
      .eq('is_published',true)
      .order('reading_date');

    if (ae) throw ae;
    const aa = (a ?? []) as Assignment[];
    setAssignments(aa);

    if (aa.length) {
      const {data:s,error:se} = await supabase
        .from('daily_bible_submissions')
        .select('id,assignment_id,answer_text,answer_language,status,submitted_at,submitted_on_time,admin_note')
        .in('assignment_id',aa.map(x=>x.id));
      if (se) throw se;
      setSubmissions((s ?? []) as Submission[]);
    } else {
      setSubmissions([]);
    }

    const {data:r} = await supabase
      .from('buklod_point_rules')
      .select('base_points')
      .eq('activity_type','daily_bible')
      .eq('is_active',true)
      .maybeSingle();

    if (r?.base_points != null) setPoints(Number(r.base_points));
  }, [days]);

  useEffect(()=>{
    load()
      .catch((e:any)=>Alert.alert('Daily Bible Reading',e?.message ?? 'Unable to load.'))
      .finally(()=>setLoading(false));
  },[load]);

  const byDate = useMemo(
    ()=>Object.fromEntries(assignments.map(x=>[x.reading_date,x])) as Record<string,Assignment>,
    [assignments]
  );
  const subByAssignment = useMemo(
    ()=>Object.fromEntries(submissions.map(x=>[x.assignment_id,x])) as Record<string,Submission>,
    [submissions]
  );

  const selected = byDate[selectedDate];
  const submission = selected ? subByAssignment[selected.id] : undefined;

  useEffect(()=>{
    setAnswer(submission?.answer_text ?? '');
    setLanguage(submission?.answer_language ?? 'fil');
  },[selectedDate,submission?.id]);

  const approved = submissions.filter(x=>x.status==='approved').length;
  const pending = submissions.filter(x=>x.status==='pending_admin').length;

  const submit = async () => {
    if (!selected) return;
    if (answer.trim().length < 20) {
      Alert.alert('Reflection Required','Write a meaningful reflection of at least 20 characters.');
      return;
    }

    setBusy(true);
    try {
      const {error} = await supabase.rpc('submit_daily_bible_reflection',{
        p_assignment_id:selected.id,
        p_answer:answer.trim(),
        p_language:language,
      });
      if (error) throw error;
      Alert.alert('Submitted','Your reflection is awaiting validation.');
      await load();
    } catch(e:any) {
      Alert.alert('Submission',e?.message ?? 'Unable to submit.');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    !!selected &&
    selectedDate <= today &&
    submission?.status !== 'approved' &&
    submission?.status !== 'pending_admin';

  if (loading) {
    return <View style={[shared.screen,styles.center]}><ActivityIndicator size="large"/></View>;
  }

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={[shared.content,styles.content]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async()=>{
            setRefreshing(true);
            try { await load(); } finally { setRefreshing(false); }
          }}
        />
      }
    >
      <View style={styles.header}>
        <View style={{flex:1}}>
          <Text style={shared.h1}>Daily Bible Reading</Text>
          <Text style={shared.muted}>Read · Reflect · Submit · Grow</Text>
        </View>
        <Pressable onPress={()=>router.back()} style={styles.outline}>
          <Text style={styles.outlineText}>BACK</Text>
        </Pressable>
      </View>

      <Card>
        <Text style={styles.eyebrow}>THIS WEEK</Text>
        <Text style={styles.big}>{approved}/7 valid</Text>
        <Text style={styles.meta}>{pending} pending · +{points} BUKLOD Points per approved reading</Text>
        <View style={styles.dots}>
          {days.map(date=>{
            const a=byDate[date];
            const s=a?subByAssignment[a.id]:undefined;
            return <View key={date} style={[
              styles.dot,
              s?.status==='approved' && styles.dotApproved,
              s?.status==='pending_admin' && styles.dotPending,
              s?.status==='rejected' && styles.dotRejected
            ]}/>;
          })}
        </View>
      </Card>

      <SectionTitle>WEEKLY PLAN</SectionTitle>
      <View style={styles.dayRow}>
        {days.map(date=>{
          const a=byDate[date];
          const s=a?subByAssignment[a.id]:undefined;
          const active=selectedDate===date;
          return (
            <Pressable
              key={date}
              onPress={()=>setSelectedDate(date)}
              style={[styles.day,active&&styles.dayActive]}
            >
              <Text style={[styles.dayName,active&&styles.white]}>
                {fromIso(date).toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()}
              </Text>
              <Text style={[styles.dayNum,active&&styles.white]}>{fromIso(date).getDate()}</Text>
              <Text style={[styles.dayState,active&&styles.white]}>
                {!a?'—':s?.status==='approved'?'VALID':s?.status==='pending_admin'?'PEND':s?.status==='rejected'?'REVISE':'OPEN'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>READ & REFLECT</SectionTitle>

      {!selected ? (
        <Card>
          <Text style={shared.h2}>No reading published for this day yet.</Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text style={styles.dateText}>
              {fromIso(selected.reading_date).toLocaleDateString(undefined,{
                weekday:'long',month:'long',day:'numeric',year:'numeric'
              })}
            </Text>
            <Text style={styles.reference}>{selected.bible_reference}</Text>
            {!!selected.instruction_fil && <Text style={styles.body}>{selected.instruction_fil}</Text>}

            <Text style={styles.eyebrow}>REFLECTION QUESTION</Text>
            <Text style={styles.question}>
              {language==='fil' ? selected.reflection_question_fil : selected.reflection_question_en}
            </Text>

            <View style={styles.langRow}>
              {(['fil','en'] as const).map(l=>(
                <Pressable key={l} onPress={()=>setLanguage(l)} style={[styles.lang,language===l&&styles.langActive]}>
                  <Text style={[styles.langText,language===l&&styles.white]}>{l==='fil'?'FILIPINO':'ENGLISH'}</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <Card>
            <Text style={styles.eyebrow}>MY REFLECTION</Text>
            <TextInput
              value={answer}
              onChangeText={setAnswer}
              multiline
              textAlignVertical="top"
              editable={submission?.status!=='approved' && submission?.status!=='pending_admin'}
              placeholder="What did you learn, and how will you apply it?"
              placeholderTextColor="#89958E"
              style={styles.input}
            />

            <Text style={styles.meta}>{answer.trim().length} characters · minimum 20</Text>

            {selectedDate>today && <Text style={styles.warning}>This reading is not open yet.</Text>}
            {submission?.status==='pending_admin' && <Text style={styles.warning}>Awaiting validation.</Text>}
            {submission?.status==='approved' && <Text style={styles.valid}>✓ Validated · +{points} BUKLOD Points</Text>}
            {submission?.status==='rejected' && (
              <Text style={styles.reject}>
                Revision requested{submission.admin_note?`: ${submission.admin_note}`:''}
              </Text>
            )}

            <Pressable
              disabled={!canSubmit || busy}
              onPress={submit}
              style={[styles.submit,(!canSubmit||busy)&&styles.disabled]}
            >
              <Text style={styles.submitText}>
                {busy?'SUBMITTING...':submission?.status==='rejected'?'RESUBMIT REFLECTION':'SUBMIT READING'}
              </Text>
            </Pressable>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  content:{paddingBottom:40,gap:14},
  center:{flex:1,alignItems:'center',justifyContent:'center'},
  header:{flexDirection:'row',gap:12,alignItems:'flex-start'},
  outline:{paddingHorizontal:12,paddingVertical:9,borderWidth:1,borderColor:'#D7DFDA',borderRadius:12},
  outlineText:{fontSize:11,fontWeight:'900',color:'#275D45'},
  eyebrow:{marginTop:8,fontSize:10.5,fontWeight:'900',color:'#6E7B74'},
  big:{marginTop:5,fontSize:25,fontWeight:'900',color:'#23382E'},
  meta:{marginTop:6,fontSize:11.5,color:'#728078'},
  dots:{flexDirection:'row',gap:7,marginTop:12},
  dot:{width:20,height:8,borderRadius:99,backgroundColor:'#E0E6E2'},
  dotApproved:{backgroundColor:'#275D45'},
  dotPending:{backgroundColor:'#D4A84F'},
  dotRejected:{backgroundColor:'#9B4A4A'},
  dayRow:{flexDirection:'row',gap:5},
  day:{flex:1,minWidth:0,alignItems:'center',paddingVertical:9,borderRadius:13,borderWidth:1,borderColor:'#DDE4E0',backgroundColor:'#FFF'},
  dayActive:{backgroundColor:'#275D45',borderColor:'#275D45'},
  dayName:{fontSize:8.5,fontWeight:'900',color:'#738078'},
  dayNum:{fontSize:16,fontWeight:'900',color:'#26382F'},
  dayState:{fontSize:7,fontWeight:'900',color:'#849089'},
  white:{color:'#FFF'},
  dateText:{fontSize:12,fontWeight:'800',color:'#748078'},
  reference:{marginTop:7,fontSize:24,lineHeight:31,fontWeight:'900',color:'#21372C'},
  body:{marginTop:10,fontSize:15,lineHeight:22,color:'#44534B'},
  question:{marginTop:7,fontSize:18,lineHeight:27,fontWeight:'700',color:'#24382E'},
  langRow:{flexDirection:'row',gap:8,marginTop:12},
  lang:{paddingHorizontal:12,paddingVertical:8,borderRadius:999,backgroundColor:'#EEF2F0'},
  langActive:{backgroundColor:'#275D45'},
  langText:{fontSize:9.5,fontWeight:'900',color:'#617068'},
  input:{marginTop:9,minHeight:145,borderWidth:1,borderColor:'#D8E0DB',borderRadius:15,padding:14,fontSize:16,lineHeight:24,color:'#23372D',backgroundColor:'#FBFCFB'},
  warning:{marginTop:10,fontSize:12.5,fontWeight:'800',color:'#7D652C'},
  valid:{marginTop:10,fontSize:12.5,fontWeight:'900',color:'#275D45'},
  reject:{marginTop:10,fontSize:12.5,fontWeight:'800',color:'#8A3F3F'},
  submit:{marginTop:14,minHeight:50,borderRadius:15,backgroundColor:'#275D45',alignItems:'center',justifyContent:'center'},
  disabled:{opacity:.38},
  submitText:{color:'#FFF',fontSize:11.5,fontWeight:'900'},
});
