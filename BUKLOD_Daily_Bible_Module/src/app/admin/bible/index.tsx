import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AdminGate } from '@/components/AdminGate';
import { Card, SectionTitle, shared } from '@/components/UI';

type Assignment = {
  id:string;
  reading_date:string;
  bible_reference:string;
  instruction_fil:string|null;
  reflection_question_fil:string;
  reflection_question_en:string;
  reward_amount:number|string;
  is_published:boolean;
};

const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromIso=(s:string)=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const addDays=(d:Date,n:number)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const monday=()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d;};

export default function AdminBibleManager() {
  const [weekStart,setWeekStart]=useState(iso(monday()));
  const [selectedDate,setSelectedDate]=useState(iso(monday()));
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [reference,setReference]=useState('');
  const [instruction,setInstruction]=useState('');
  const [questionFil,setQuestionFil]=useState('');
  const [questionEn,setQuestionEn]=useState('');
  const [published,setPublished]=useState(true);
  const [points,setPoints]=useState(10);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);

  const days=useMemo(()=>Array.from({length:7},(_,i)=>iso(addDays(fromIso(weekStart),i))),[weekStart]);

  const load=useCallback(async()=>{
    const {data,error}=await supabase
      .from('daily_bible_assignments')
      .select('id,reading_date,bible_reference,instruction_fil,reflection_question_fil,reflection_question_en,reward_amount,is_published')
      .gte('reading_date',days[0])
      .lte('reading_date',days[6])
      .order('reading_date');
    if(error) throw error;
    setAssignments((data??[]) as Assignment[]);

    const {data:r}=await supabase
      .from('buklod_point_rules')
      .select('base_points')
      .eq('activity_type','daily_bible')
      .eq('is_active',true)
      .maybeSingle();
    if(r?.base_points!=null) setPoints(Number(r.base_points));
  },[days]);

  useEffect(()=>{
    load().catch((e:any)=>Alert.alert('Weekly Bible Reading',e?.message??'Unable to load.')).finally(()=>setLoading(false));
  },[load]);

  const byDate=useMemo(
    ()=>Object.fromEntries(assignments.map(x=>[x.reading_date,x])) as Record<string,Assignment>,
    [assignments]
  );

  useEffect(()=>{
    const x=byDate[selectedDate];
    setReference(x?.bible_reference??'');
    setInstruction(x?.instruction_fil??'');
    setQuestionFil(x?.reflection_question_fil??'');
    setQuestionEn(x?.reflection_question_en??'');
    setPublished(x?.is_published??true);
  },[selectedDate,byDate]);

  const moveWeek=(n:number)=>{
    const next=iso(addDays(fromIso(weekStart),n));
    setWeekStart(next);
    setSelectedDate(next);
    setLoading(true);
  };

  const save=async()=>{
    if(!reference.trim()){
      Alert.alert('Bible Reference','Enter the assigned passage/reference.');
      return;
    }
    setBusy(true);
    try{
      const existing=byDate[selectedDate];
      const {error}=await supabase.rpc('admin_upsert_daily_bible_assignment',{
        p_reading_date:selectedDate,
        p_bible_reference:reference.trim(),
        p_instruction_fil:instruction.trim()||null,
        p_instruction_en:null,
        p_question_fil:questionFil.trim()||null,
        p_question_en:questionEn.trim()||null,
        p_reward_amount:existing?Number(existing.reward_amount):2,
        p_is_published:published,
      });
      if(error) throw error;
      Alert.alert('Saved',`${selectedDate} Bible reading saved.`);
      await load();
    }catch(e:any){
      Alert.alert('Save Bible Reading',e?.message??'Unable to save.');
    }finally{
      setBusy(false);
    }
  };

  return (
    <AdminGate>
      <ScrollView style={shared.screen} contentContainerStyle={[shared.content,styles.content]}>
        <View style={styles.header}>
          <View style={{flex:1}}>
            <Text style={shared.h1}>Weekly Bible Reading</Text>
            <Text style={shared.muted}>Prepare the seven passages for the selected week.</Text>
          </View>
          <Pressable onPress={()=>router.back()} style={styles.outline}><Text style={styles.outlineText}>BACK</Text></Pressable>
        </View>

        <Card>
          <View style={styles.weekNav}>
            <Pressable onPress={()=>moveWeek(-7)}><Text style={styles.nav}>‹ PREV</Text></Pressable>
            <View style={{alignItems:'center'}}>
              <Text style={styles.eyebrow}>WEEK OF</Text>
              <Text style={styles.weekValue}>
                {fromIso(weekStart).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}
              </Text>
            </View>
            <Pressable onPress={()=>moveWeek(7)}><Text style={styles.nav}>NEXT ›</Text></Pressable>
          </View>
          <Text style={styles.meta}>
            {days.filter(d=>!!byDate[d]).length}/7 prepared · +{points} BUKLOD Points per approved reading
          </Text>
        </Card>

        <SectionTitle>SELECT DAY</SectionTitle>
        <View style={styles.dayRow}>
          {days.map(date=>{
            const active=date===selectedDate;
            return (
              <Pressable key={date} onPress={()=>setSelectedDate(date)} style={[styles.day,active&&styles.dayActive]}>
                <Text style={[styles.dayName,active&&styles.white]}>
                  {fromIso(date).toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()}
                </Text>
                <Text style={[styles.dayNum,active&&styles.white]}>{fromIso(date).getDate()}</Text>
                <Text style={[styles.dayState,active&&styles.white]}>{byDate[date]?'SET':'EMPTY'}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle>READING DETAILS</SectionTitle>

        {loading ? <Card><ActivityIndicator/></Card> : (
          <Card>
            <Text style={styles.dateTitle}>
              {fromIso(selectedDate).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
            </Text>

            <Field label="BIBLE PASSAGE / REFERENCE *" value={reference} onChangeText={setReference} placeholder="Example: Philippians 4:4–9"/>
            <Field label="SHORT INSTRUCTION" value={instruction} onChangeText={setInstruction} placeholder="Read slowly and prayerfully." multiline/>
            <Field label="REFLECTION QUESTION — FILIPINO" value={questionFil} onChangeText={setQuestionFil} placeholder="Leave blank for automatic question." multiline/>
            <Field label="REFLECTION QUESTION — ENGLISH" value={questionEn} onChangeText={setQuestionEn} placeholder="Leave blank for automatic question." multiline/>

            <Pressable onPress={()=>setPublished(v=>!v)} style={styles.publish}>
              <View style={[styles.box,published&&styles.boxOn]}>{published&&<Text style={styles.check}>✓</Text>}</View>
              <View style={{flex:1}}>
                <Text style={styles.publishTitle}>Published</Text>
                <Text style={styles.meta}>Assigned members can view this reading.</Text>
              </View>
            </Pressable>

            <Text style={styles.audit}>
              Once any member submits a reflection, the assignment is locked to protect the historical record.
            </Text>

            <Pressable onPress={save} disabled={busy} style={[styles.save,busy&&{opacity:.5}]}>
              <Text style={styles.saveText}>{busy?'SAVING...':byDate[selectedDate]?'UPDATE READING':'SAVE READING'}</Text>
            </Pressable>
          </Card>
        )}

        <Pressable onPress={()=>router.push('/admin/bible/monitor')} style={styles.monitor}>
          <Text style={styles.monitorText}>OPEN WEEKLY MONITORING</Text>
        </Pressable>
      </ScrollView>
    </AdminGate>
  );
}

function Field(props:{
  label:string;
  value:string;
  onChangeText:(v:string)=>void;
  placeholder:string;
  multiline?:boolean;
}){
  return (
    <>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#8A958F"
        textAlignVertical={props.multiline?'top':'center'}
        style={[styles.input,props.multiline&&styles.multi]}
      />
    </>
  );
}

const styles=StyleSheet.create({
  content:{paddingBottom:40,gap:14},
  header:{flexDirection:'row',gap:12,alignItems:'flex-start'},
  outline:{paddingHorizontal:12,paddingVertical:9,borderWidth:1,borderColor:'#D7DFDA',borderRadius:12},
  outlineText:{fontSize:11,fontWeight:'900',color:'#275D45'},
  weekNav:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  nav:{padding:8,fontSize:11,fontWeight:'900',color:'#275D45'},
  eyebrow:{fontSize:9.5,fontWeight:'900',color:'#718078'},
  weekValue:{marginTop:3,fontSize:17,fontWeight:'900',color:'#23382E'},
  meta:{marginTop:8,fontSize:11.5,color:'#758179',textAlign:'center'},
  dayRow:{flexDirection:'row',gap:5},
  day:{flex:1,alignItems:'center',paddingVertical:9,borderRadius:13,borderWidth:1,borderColor:'#DDE4E0',backgroundColor:'#FFF'},
  dayActive:{backgroundColor:'#275D45',borderColor:'#275D45'},
  dayName:{fontSize:8.5,fontWeight:'900',color:'#738078'},
  dayNum:{fontSize:16,fontWeight:'900',color:'#26382F'},
  dayState:{fontSize:7,fontWeight:'900',color:'#849089'},
  white:{color:'#FFF'},
  dateTitle:{fontSize:17,fontWeight:'900',color:'#23382E'},
  label:{marginTop:14,marginBottom:6,fontSize:10,fontWeight:'900',color:'#68766E'},
  input:{borderWidth:1,borderColor:'#D7E0DA',borderRadius:14,paddingHorizontal:13,paddingVertical:11,fontSize:15,color:'#23372D',backgroundColor:'#FBFCFB'},
  multi:{minHeight:80},
  publish:{marginTop:16,flexDirection:'row',gap:10,alignItems:'center',padding:12,borderRadius:14,backgroundColor:'#F3F6F4'},
  box:{width:24,height:24,borderRadius:7,borderWidth:1,borderColor:'#AAB7B0',alignItems:'center',justifyContent:'center'},
  boxOn:{backgroundColor:'#275D45',borderColor:'#275D45'},
  check:{color:'#FFF',fontWeight:'900'},
  publishTitle:{fontSize:13,fontWeight:'900',color:'#283B31'},
  audit:{marginTop:12,fontSize:11,lineHeight:17,color:'#758179'},
  save:{marginTop:15,minHeight:50,borderRadius:15,backgroundColor:'#275D45',alignItems:'center',justifyContent:'center'},
  saveText:{fontSize:11.5,fontWeight:'900',color:'#FFF'},
  monitor:{minHeight:50,borderRadius:15,borderWidth:1,borderColor:'#275D45',alignItems:'center',justifyContent:'center'},
  monitorText:{fontSize:11.5,fontWeight:'900',color:'#275D45'},
});
