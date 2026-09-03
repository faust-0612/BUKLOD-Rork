import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { FacultyGate } from '@/components/faculty/FacultyGate';
import { supabase } from '@/lib/supabase';

type WeightedRow = { key: string; label: string; weight: string; type?: string };

type Attention = {
  students?: number;
  students_with_overdue?: number;
  overdue_requirements?: number;
  submissions_to_review?: number;
  open_interventions?: number;
  students_with_rle_hour_gap?: number;
};

const PROGRAMS = ['GENERAL','NURSING','EDUCATION','IT','ENGINEERING','BUSINESS','THEOLOGY','RESEARCH','OJT','VOCATIONAL'];
const SUBJECT_TYPES = ['LECTURE','LAB','RLE','OJT','PRACTICUM','THESIS','CAPSTONE','MIXED'];
const FLOW_MODES = ['MANUAL','SCHEDULED','SEQUENTIAL','CONTINUOUS'];
const DEFAULT_TERMS: WeightedRow[] = [
  { key: 'PRELIM', label: 'Prelim', weight: '25' },
  { key: 'MIDTERM', label: 'Midterm', weight: '25' },
  { key: 'SEMIFINALS', label: 'Semifinals', weight: '25' },
  { key: 'FINALS', label: 'Finals', weight: '25' },
];
const DEFAULT_CATEGORIES: WeightedRow[] = [
  { key: 'ATTENDANCE', label: 'Attendance', weight: '10', type: 'ATTENDANCE' },
  { key: 'PARTICIPATION', label: 'Class Participation / Recitation', weight: '10', type: 'PARTICIPATION' },
  { key: 'QUIZZES', label: 'Quizzes', weight: '20', type: 'QUIZ' },
  { key: 'ACTIVITY', label: 'Activity / Seatworks', weight: '10', type: 'ACTIVITY' },
  { key: 'ATTITUDE', label: 'Attitude / Professionalism', weight: '10', type: 'CONDUCT' },
  { key: 'MAJOR_EXAM', label: 'Major Exam', weight: '40', type: 'EXAM' },
];

function Chip({ value, active, onPress }: { value: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}><Text style={[styles.chipText, active && styles.chipTextOn]}>{value}</Text></Pressable>;
}

function WeightEditor({ title, rows, onChange, onReset }: { title: string; rows: WeightedRow[]; onChange: (rows: WeightedRow[]) => void; onReset: () => void }) {
  const total = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  return <View style={styles.panel}>
    <View style={styles.rowBetween}><Text style={styles.panelTitle}>{title}</Text><Pressable onPress={onReset}><Text style={styles.link}>Reset default</Text></Pressable></View>
    {rows.map((row, index) => <View key={`${row.key}-${index}`} style={styles.weightRow}>
      <TextInput value={row.label} onChangeText={label => onChange(rows.map((r,i)=>i===index?{...r,label,key:(r.key||label).toUpperCase().replace(/[^A-Z0-9]+/g,'_')}:r))} style={[styles.input,{flex:1,marginBottom:0}]} />
      <TextInput value={row.weight} onChangeText={weight => onChange(rows.map((r,i)=>i===index?{...r,weight}:r))} keyboardType="decimal-pad" style={[styles.input,styles.weightInput,{marginBottom:0}]} />
      <Text style={styles.percent}>%</Text>
    </View>)}
    <View style={styles.rowBetween}><Pressable onPress={() => onChange([...rows,{key:`CUSTOM_${rows.length+1}`,label:'Custom',weight:'0'}])}><Text style={styles.link}>+ Add</Text></Pressable><Text style={[styles.total,total===100?styles.good:styles.bad]}>Total {total.toFixed(1)}%</Text></View>
  </View>;
}

export default function FacultyAcademicControlScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const [program, setProgram] = useState('GENERAL');
  const [subjectType, setSubjectType] = useState('LECTURE');
  const [templateKey, setTemplateKey] = useState('DEFAULT');
  const [flowMode, setFlowMode] = useState('MANUAL');
  const [passing, setPassing] = useState('75');
  const [terms, setTerms] = useState<WeightedRow[]>(DEFAULT_TERMS);
  const [categories, setCategories] = useState<WeightedRow[]>(DEFAULT_CATEGORIES);
  const [attention, setAttention] = useState<Attention>({});
  const [busy, setBusy] = useState(false);

  const termTotal = useMemo(()=>terms.reduce((s,r)=>s+(Number(r.weight)||0),0),[terms]);
  const categoryTotal = useMemo(()=>categories.reduce((s,r)=>s+(Number(r.weight)||0),0),[categories]);

  const load = async () => {
    if (!classroomId) return;
    const [classRes, catRes, attnRes] = await Promise.all([
      supabase.from('buklod_education_classrooms').select('program_key,subject_type,template_key,course_flow_mode,passing_percent,grading_terms').eq('id',classroomId).single(),
      supabase.from('buklod_education_grade_categories').select('name,category_type,weight_percent').eq('classroom_id',classroomId).order('created_at'),
      supabase.rpc('buklod_classroom_faculty_attention_summary_v1',{p_classroom_id:classroomId}),
    ]);
    if (classRes.error) return Alert.alert('Academic Control',classRes.error.message);
    const c:any=classRes.data;
    setProgram(c.program_key||'GENERAL'); setSubjectType(c.subject_type||'LECTURE'); setTemplateKey(c.template_key||'DEFAULT'); setFlowMode(c.course_flow_mode||'MANUAL'); setPassing(String(c.passing_percent??75));
    if (Array.isArray(c.grading_terms) && c.grading_terms.length) setTerms(c.grading_terms.map((r:any)=>({key:String(r.key||''),label:String(r.label||r.key||''),weight:String(r.weight??0)})));
    if (!catRes.error && (catRes.data?.length??0)>0) setCategories((catRes.data??[]).map((r:any,index:number)=>({key:String(r.category_type||`CAT_${index+1}`),label:String(r.name),weight:String(r.weight_percent??0),type:String(r.category_type||'CUSTOM')})));
    if (!attnRes.error) setAttention((attnRes.data??{}) as Attention);
  };

  useEffect(()=>{void load();},[classroomId]);

  const applySetup = async () => {
    if (Math.abs(termTotal-100)>0.0001) return Alert.alert('Term Weights','Term weights must total exactly 100%.');
    if (Math.abs(categoryTotal-100)>0.0001) return Alert.alert('Grade Categories','Category weights must total exactly 100%.');
    const passingValue=Number(passing); if(!Number.isFinite(passingValue)||passingValue<0||passingValue>100) return Alert.alert('Passing Grade','Enter a passing percentage from 0 to 100.');
    setBusy(true);
    try {
      const {error}=await supabase.rpc('buklod_classroom_faculty_apply_academic_setup_v1',{
        p_classroom_id:classroomId,
        p_program_key:program,
        p_subject_type:subjectType,
        p_template_key:templateKey.trim()||'DEFAULT',
        p_course_flow_mode:flowMode,
        p_passing_percent:passingValue,
        p_grading_terms:terms.map(r=>({key:r.key||r.label.toUpperCase().replace(/[^A-Z0-9]+/g,'_'),label:r.label,weight:Number(r.weight)||0})),
        p_categories:categories.map(r=>({name:r.label,type:r.type||r.key||'CUSTOM',weight:Number(r.weight)||0})),
        p_adaptive_config:{academic_engine:'R4',program,subject_type:subjectType,automation_first:true,student_app:'BUKLOD_CLASSROOM'},
      });
      if(error) throw error;
      await load(); Alert.alert('Academic Setup','Saved. New grade items can now be tagged to these terms and the student app will compute term-aware progress from released records.');
    } catch(e:any){ Alert.alert('Academic Setup',String(e?.message??e)); } finally { setBusy(false); }
  };

  const open = (pathname:string) => router.push({pathname:pathname as any,params:{id:classroomId,classroomId,name:classroomName}});

  return <FacultyGate><ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Pressable style={styles.back} onPress={()=>router.back()}><MaterialCommunityIcons name="arrow-left" size={22} color="#17311f"/><Text style={styles.backText}>{classroomName}</Text></Pressable>
    <Text style={styles.eyebrow}>ACADEMIC CONTROL CENTER</Text><Text style={styles.title}>Teach. Review exceptions. Approve.</Text>
    <Text style={styles.subtitle}>One setup controls the student Classroom, term grading, automation, RLE/OJT adaptation and monitoring.</Text>

    <View style={styles.attentionGrid}>
      {[
        ['Students',attention.students??0],['Overdue',attention.overdue_requirements??0],['To review',attention.submissions_to_review??0],['Interventions',attention.open_interventions??0],['RLE gaps',attention.students_with_rle_hour_gap??0]
      ].map(([label,value])=><View key={String(label)} style={styles.metric}><Text style={styles.metricValue}>{String(value)}</Text><Text style={styles.metricLabel}>{String(label)}</Text></View>)}
    </View>

    <Text style={styles.section}>Program / Course Family</Text><View style={styles.chips}>{PROGRAMS.map(x=><Chip key={x} value={x} active={program===x} onPress={()=>setProgram(x)}/>)}</View>
    <Text style={styles.section}>Subject Type</Text><View style={styles.chips}>{SUBJECT_TYPES.map(x=><Chip key={x} value={x} active={subjectType===x} onPress={()=>setSubjectType(x)}/>)}</View>
    <Text style={styles.section}>Course Flow</Text><View style={styles.chips}>{FLOW_MODES.map(x=><Chip key={x} value={x} active={flowMode===x} onPress={()=>setFlowMode(x)}/>)}</View>

    <View style={styles.panel}><Text style={styles.panelTitle}>Template & Passing Grade</Text><TextInput value={templateKey} onChangeText={setTemplateKey} placeholder="Template key" style={styles.input}/><TextInput value={passing} onChangeText={setPassing} keyboardType="decimal-pad" placeholder="Passing %" style={styles.input}/></View>
    <WeightEditor title="Grading Periods" rows={terms} onChange={setTerms} onReset={()=>setTerms(DEFAULT_TERMS)}/>
    <WeightEditor title="Grade Components (inside each term)" rows={categories} onChange={setCategories} onReset={()=>setCategories(DEFAULT_CATEGORIES)}/>

    <Pressable disabled={busy} style={[styles.save,busy&&{opacity:.6}]} onPress={applySetup}><MaterialCommunityIcons name="content-save-check" size={20} color="#fff"/><Text style={styles.saveText}>{busy?'Saving...':'Apply Academic Setup'}</Text></Pressable>

    <Text style={styles.section}>Faculty Operations</Text>
    {[
      ['account-multiple','Roster, Photos & Groups','/profile/buklod-faculty-roster'],
      ['book-open-page-variant','Syllabus & Course Automation','/profile/buklod-faculty-syllabus'],
      ['folder-multiple-outline','Materials Library','/profile/buklod-faculty-materials'],
      ['clipboard-text','Activities, Quiz & Assessment','/profile/buklod-faculty-assessments'],
      ['chart-box','Term Gradebook & Finals','/profile/buklod-faculty-final-grades'],
      ['stethoscope','RLE / OJT / Practicum Management','/profile/buklod-faculty-rle'],
      ['account-star','Participation / Conduct / Extra Credit','/profile/buklod-faculty-participation'],
      ['chart-timeline-variant','Student Progress & Consultation','/profile/buklod-faculty-progress'],
      ['alert-circle','Review Exceptions / Follow-up','/profile/buklod-faculty-exceptions'],
      ['google-classroom','Faculty Classroom Interaction','/profile/buklod-classroom'],
    ].map(([icon,label,path])=><Pressable key={String(label)} style={styles.tool} onPress={()=>open(String(path))}><MaterialCommunityIcons name={icon as any} size={22} color="#1f7a3f"/><Text style={styles.toolText}>{String(label)}</Text><MaterialCommunityIcons name="chevron-right" size={21} color="#9aa59c"/></Pressable>)}
  </ScrollView></FacultyGate>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:'#f4f7f2'},content:{padding:20,paddingTop:44,paddingBottom:70},back:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:18},backText:{fontWeight:'800',color:'#17311f'},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.3,color:'#1f7a3f'},title:{fontSize:28,fontWeight:'900',color:'#17311f',marginTop:3},subtitle:{color:'#68736b',lineHeight:19,marginTop:6,marginBottom:18},attentionGrid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:18},metric:{minWidth:'30%',flexGrow:1,backgroundColor:'#fff',borderRadius:15,padding:12},metricValue:{fontSize:22,fontWeight:'900',color:'#17311f'},metricLabel:{fontSize:11,color:'#6f7b72',marginTop:2},section:{fontSize:17,fontWeight:'900',color:'#17311f',marginTop:12,marginBottom:9},chips:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:6},chip:{borderRadius:999,borderWidth:1,borderColor:'#d7e3da',backgroundColor:'#fff',paddingHorizontal:11,paddingVertical:8},chipOn:{backgroundColor:'#1f7a3f',borderColor:'#1f7a3f'},chipText:{fontSize:11,fontWeight:'800',color:'#516158'},chipTextOn:{color:'#fff'},panel:{backgroundColor:'#fff',borderRadius:18,padding:15,marginTop:12},panelTitle:{fontWeight:'900',fontSize:15,color:'#24362b'},input:{backgroundColor:'#f4f7f2',borderRadius:11,paddingHorizontal:12,paddingVertical:11,marginTop:10,marginBottom:3,color:'#203026'},weightRow:{flexDirection:'row',alignItems:'center',gap:7,marginTop:9},weightInput:{width:66,textAlign:'right'},percent:{fontWeight:'900',color:'#516158'},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:8},link:{color:'#1f7a3f',fontWeight:'900',fontSize:12},total:{fontWeight:'900'},good:{color:'#1f7a3f'},bad:{color:'#b63a3a'},save:{marginTop:16,backgroundColor:'#174c2b',borderRadius:15,paddingVertical:14,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8},saveText:{color:'#fff',fontWeight:'900'},tool:{flexDirection:'row',alignItems:'center',gap:11,backgroundColor:'#fff',padding:14,borderRadius:15,marginBottom:8},toolText:{flex:1,color:'#26392d',fontWeight:'800'},
});