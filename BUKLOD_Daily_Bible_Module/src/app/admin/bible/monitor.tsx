import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AdminGate } from '@/components/AdminGate';
import { Card, SectionTitle, shared } from '@/components/UI';

type Assignment={id:string;reading_date:string;bible_reference:string};
type MonitorRow={
  assignment_id:string;
  reading_date:string;
  bible_reference:string;
  user_id:string;
  full_name:string;
  submission_id:string|null;
  answer_text:string|null;
  submission_status:string;
  submitted_at:string|null;
  submitted_on_time:boolean;
};

const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromIso=(s:string)=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const addDays=(d:Date,n:number)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const monday=()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d;};

export default function AdminBibleMonitor(){
  const [weekStart,setWeekStart]=useState(iso(monday()));
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [rows,setRows]=useState<MonitorRow[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [points,setPoints]=useState(10);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);

  const days=useMemo(()=>Array.from({length:7},(_,i)=>iso(addDays(fromIso(weekStart),i))),[weekStart]);

  const load=async()=>{
    const {data:a,error:ae}=await supabase
      .from('daily_bible_assignments')
      .select('id,reading_date,bible_reference')
      .gte('reading_date',days[0])
      .lte('reading_date',days[6])
      .order('reading_date');
    if(ae) throw ae;

    const aa=(a??[]) as Assignment[];
    setAssignments(aa);
    const selectedId = selected && aa.some(x=>x.id===selected) ? selected : aa.length ? aa[aa.length-1].id : null;
    setSelected(selectedId);

    const all:MonitorRow[]=[];

    for(const assignment of aa){
      const {data:m,error:me}=await supabase.rpc('admin_get_daily_bible_monitor',{
        p_assignment_id:assignment.id
      });
      if(me) throw me;

      const {data:s,error:se}=await supabase
        .from('daily_bible_submissions')
        .select('id,user_id,answer_text')
        .eq('assignment_id',assignment.id);
      if(se) throw se;

      const sm=Object.fromEntries((s??[]).map((x:any)=>[x.user_id,x]));

      for(const row of m??[]){
        const sub=sm[row.user_id];
        all.push({
          assignment_id:assignment.id,
          reading_date:assignment.reading_date,
          bible_reference:assignment.bible_reference,
          user_id:row.user_id,
          full_name:row.full_name,
          submission_id:sub?.id??null,
          answer_text:sub?.answer_text??null,
          submission_status:row.submission_status,
          submitted_at:row.submitted_at,
          submitted_on_time:row.submitted_on_time,
        });
      }
    }

    setRows(all);

    const {data:r}=await supabase
      .from('buklod_point_rules')
      .select('base_points')
      .eq('activity_type','daily_bible')
      .eq('is_active',true)
      .maybeSingle();
    if(r?.base_points!=null) setPoints(Number(r.base_points));
  };

  useEffect(()=>{
    setLoading(true);
    load().catch((e:any)=>Alert.alert('Bible Monitoring',e?.message??'Unable to load.')).finally(()=>setLoading(false));
  },[weekStart]);

  const selectedRows=rows.filter(x=>x.assignment_id===selected);
  const counts={
    total:selectedRows.length,
    approved:selectedRows.filter(x=>x.submission_status==='approved').length,
    pending:selectedRows.filter(x=>x.submission_status==='pending_admin').length,
    missed:selectedRows.filter(x=>x.submission_status==='missed').length,
  };

  const review=async(id:string,approve:boolean)=>{
    setBusy(id);
    try{
      const {error}=await supabase.rpc('admin_review_daily_bible_submission',{
        p_submission_id:id,
        p_approve:approve,
        p_admin_note:approve?null:'Please revise your reflection and resubmit.',
      });
      if(error) throw error;
      Alert.alert(
        approve?'Approved':'Returned',
        approve?`Valid reading recorded. +${points} BUKLOD Points will follow the existing approved-activity workflow.`:'Member may revise and resubmit.'
      );
      await load();
    }catch(e:any){
      Alert.alert('Review',e?.message??'Unable to review.');
    }finally{
      setBusy(null);
    }
  };

  return (
    <AdminGate>
      <ScrollView style={shared.screen} contentContainerStyle={[shared.content,styles.content]}>
        <View style={styles.header}>
          <View style={{flex:1}}>
            <Text style={shared.h1}>Bible Reading Monitor</Text>
            <Text style={shared.muted}>Validate reflections and monitor weekly completion.</Text>
          </View>
          <Pressable onPress={()=>router.back()} style={styles.outline}><Text style={styles.outlineText}>BACK</Text></Pressable>
        </View>

        <Card>
          <View style={styles.weekNav}>
            <Pressable onPress={()=>setWeekStart(iso(addDays(fromIso(weekStart),-7)))}><Text style={styles.nav}>‹ PREV</Text></Pressable>
            <Text style={styles.weekValue}>{fromIso(weekStart).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</Text>
            <Pressable onPress={()=>setWeekStart(iso(addDays(fromIso(weekStart),7)))}><Text style={styles.nav}>NEXT ›</Text></Pressable>
          </View>
        </Card>

        <SectionTitle>DAY</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            {assignments.map(a=>(
              <Pressable key={a.id} onPress={()=>setSelected(a.id)} style={[styles.chip,selected===a.id&&styles.chipActive]}>
                <Text style={[styles.chipDay,selected===a.id&&styles.white]}>
                  {fromIso(a.reading_date).toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()}
                </Text>
                <Text numberOfLines={1} style={[styles.chipRef,selected===a.id&&styles.white]}>{a.bible_reference}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {loading ? <Card><ActivityIndicator/></Card> : !selected ? (
          <Card><Text style={shared.muted}>No Bible readings are set for this week.</Text></Card>
        ) : (
          <>
            <Card>
              <Text style={styles.eyebrow}>DAILY SUMMARY</Text>
              <View style={styles.stats}>
                <Stat label="Assigned" value={counts.total}/>
                <Stat label="Valid" value={counts.approved}/>
                <Stat label="Pending" value={counts.pending}/>
                <Stat label="Missed" value={counts.missed}/>
              </View>
            </Card>

            <SectionTitle>MEMBER RECORDS</SectionTitle>

            {selectedRows.map(row=>(
              <Card key={`${row.assignment_id}:${row.user_id}`}>
                <View style={styles.memberHeader}>
                  <View style={{flex:1}}>
                    <Text style={styles.name}>{row.full_name}</Text>
                    <Text style={styles.meta}>
                      {row.submission_status.replace(/_/g,' ').toUpperCase()}
                      {row.submitted_at?` · ${row.submitted_on_time?'ON TIME':'LATE'}`:''}
                    </Text>
                  </View>
                  <Pill status={row.submission_status}/>
                </View>

                {!!row.answer_text && (
                  <View style={styles.answerBox}>
                    <Text style={styles.eyebrow}>REFLECTION</Text>
                    <Text style={styles.answer}>{row.answer_text}</Text>
                  </View>
                )}

                {row.submission_status==='pending_admin' && row.submission_id && (
                  <View style={styles.actions}>
                    <Pressable disabled={busy===row.submission_id} onPress={()=>review(row.submission_id!,false)} style={styles.returnBtn}>
                      <Text style={styles.returnText}>RETURN</Text>
                    </Pressable>
                    <Pressable disabled={busy===row.submission_id} onPress={()=>review(row.submission_id!,true)} style={styles.approveBtn}>
                      <Text style={styles.approveText}>{busy===row.submission_id?'WORKING...':'APPROVE'}</Text>
                    </Pressable>
                  </View>
                )}
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </AdminGate>
  );
}

function Stat({label,value}:{label:string;value:number}){
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
function Pill({status}:{status:string}){
  const text=status==='approved'?'VALID':status==='pending_admin'?'PENDING':status==='rejected'?'REVISE':status==='missed'?'MISSED':'OPEN';
  return <View style={styles.pill}><Text style={styles.pillText}>{text}</Text></View>;
}

const styles=StyleSheet.create({
  content:{paddingBottom:40,gap:14},
  header:{flexDirection:'row',gap:12,alignItems:'flex-start'},
  outline:{paddingHorizontal:12,paddingVertical:9,borderWidth:1,borderColor:'#D7DFDA',borderRadius:12},
  outlineText:{fontSize:11,fontWeight:'900',color:'#275D45'},
  weekNav:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  nav:{padding:8,fontSize:11,fontWeight:'900',color:'#275D45'},
  weekValue:{fontSize:16,fontWeight:'900',color:'#23382E'},
  chips:{flexDirection:'row',gap:8},
  chip:{width:130,padding:11,borderRadius:14,borderWidth:1,borderColor:'#D9E1DC',backgroundColor:'#FFF'},
  chipActive:{backgroundColor:'#275D45',borderColor:'#275D45'},
  chipDay:{fontSize:9.5,fontWeight:'900',color:'#708078'},
  chipRef:{marginTop:4,fontSize:12,fontWeight:'800',color:'#283A31'},
  white:{color:'#FFF'},
  eyebrow:{fontSize:9.5,fontWeight:'900',color:'#728078'},
  stats:{flexDirection:'row',gap:8,marginTop:12},
  stat:{flex:1,paddingVertical:10,alignItems:'center',borderRadius:12,backgroundColor:'#F2F5F3'},
  statValue:{fontSize:20,fontWeight:'900',color:'#25382F'},
  statLabel:{fontSize:8.5,fontWeight:'800',color:'#758179'},
  memberHeader:{flexDirection:'row',gap:10,alignItems:'center'},
  name:{fontSize:16,fontWeight:'900',color:'#23382E'},
  meta:{marginTop:3,fontSize:9.5,fontWeight:'700',color:'#78857D'},
  pill:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,backgroundColor:'#E7ECE9'},
  pillText:{fontSize:8.5,fontWeight:'900',color:'#384A40'},
  answerBox:{marginTop:12,padding:12,borderRadius:13,backgroundColor:'#F6F8F7'},
  answer:{marginTop:6,fontSize:14,lineHeight:21,color:'#34463C'},
  actions:{flexDirection:'row',gap:8,marginTop:13},
  returnBtn:{flex:1,minHeight:44,borderRadius:13,borderWidth:1,borderColor:'#9A5555',alignItems:'center',justifyContent:'center'},
  returnText:{fontSize:11,fontWeight:'900',color:'#8A4141'},
  approveBtn:{flex:1,minHeight:44,borderRadius:13,backgroundColor:'#275D45',alignItems:'center',justifyContent:'center'},
  approveText:{fontSize:11,fontWeight:'900',color:'#FFF'},
});
