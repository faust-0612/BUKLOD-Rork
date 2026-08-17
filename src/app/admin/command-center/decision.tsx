import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { appEnvironment } from '@/lib/environment';
import { colors } from '@/lib/theme';

const DECISIONS=[
  ['hold','HOLD'],
  ['continue_pilot','CONTINUE PILOT'],
  ['ready_for_final_signoff','READY FOR FINAL SIGNOFF'],
  ['go_live','GO LIVE'],
  ['rollback','ROLLBACK'],
];

export default function RolloutDecision(){
  const [readiness,setReadiness]=useState<any>(null);
  const [releases,setReleases]=useState<any[]>([]);
  const [releaseId,setReleaseId]=useState('');
  const [decision,setDecision]=useState('hold');
  const [rationale,setRationale]=useState('');

  const environment=appEnvironment==='production'?'production':'staging';

  useEffect(()=>{
    Promise.all([
      supabase.rpc('evaluate_go_live_readiness',{p_environment:environment}),
      supabase.from('release_candidates').select('id,build_label,version,status')
        .eq('environment',environment).order('created_at',{ascending:false})
    ]).then(([r,c])=>{
      setReadiness(r.data);
      setReleases(c.data??[]);
      const approved=(c.data??[]).find((x:any)=>x.status==='approved');
      if(approved)setReleaseId(approved.id);
    });
  },[]);

  const save=async()=>{
    if(!rationale.trim())return Alert.alert('Decision','A written rationale is required.');
    if(['go_live','ready_for_final_signoff'].includes(decision)&&!releaseId){
      return Alert.alert('Decision','Select an approved/tested release candidate first.');
    }

    Alert.alert(
      'Record rollout decision?',
      `${decision.replaceAll('_',' ').toUpperCase()} will be added to the audited decision history.`,
      [
        {text:'Cancel',style:'cancel'},
        {text:'Record',onPress:async()=>{
          const {error}=await supabase.rpc('record_rollout_decision',{
            p_environment:environment,p_decision:decision,
            p_release_candidate_id:releaseId||null,p_rationale:rationale.trim()
          });
          if(error)return Alert.alert('Decision',error.message);
          Alert.alert('Decision recorded','The Command Center snapshot and rationale were saved.');
          router.replace('/admin/command-center');
        }}
      ]
    );
  };

  return(
    <AdminGate>
      <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
        <Text style={shared.h1}>Rollout Decision</Text>

        <SectionTitle>ADVISORY READINESS</SectionTitle>
        <Card>
          <Text style={shared.h2}>{readiness?.recommendation?.replaceAll('_',' ')||'Loading...'}</Text>
          {(readiness?.blockers??[]).map((x:string,i:number)=>
            <Text key={i} style={{marginTop:5,color:colors.danger}}>• {x}</Text>)}
          {(readiness?.warnings??[]).map((x:string,i:number)=>
            <Text key={i} style={{marginTop:5,color:colors.amber}}>• {x}</Text>)}
          <Text style={[shared.muted,{marginTop:8}]}>
            This evaluation does not authorize launch by itself.
          </Text>
        </Card>

        <SectionTitle>RELEASE CANDIDATE</SectionTitle>
        <View style={styles.wrap}>
          {releases.map(r=>(
            <Pressable key={r.id} onPress={()=>setReleaseId(r.id)}
              style={[styles.chip,releaseId===r.id&&styles.chipOn]}>
              <Text style={{fontSize:11}}>{r.build_label} • {r.status}</Text>
            </Pressable>
          ))}
        </View>

        <SectionTitle>DECISION</SectionTitle>
        <View style={styles.wrap}>
          {DECISIONS.map(([value,label])=>(
            <Pressable key={value} onPress={()=>setDecision(value)}
              style={[styles.chip,decision===value&&styles.chipOn]}>
              <Text style={{fontSize:10,fontWeight:'900'}}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput multiline value={rationale} onChangeText={setRationale}
          placeholder="Why is this the correct decision? Include blockers, accepted risks, test evidence, and next action."
          style={styles.area}/>

        <Button title="RECORD DECISION" onPress={save}/>
      </ScrollView>
    </AdminGate>
  )
}
const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:20,paddingVertical:8,paddingHorizontal:10},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  area:{minHeight:160,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top',marginTop:16}
});
