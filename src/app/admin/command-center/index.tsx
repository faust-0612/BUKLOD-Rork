import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { appEnvironment } from '@/lib/environment';
import { colors } from '@/lib/theme';

export default function CommandCenter(){
  const [metrics,setMetrics]=useState<any>(null);
  const [readiness,setReadiness]=useState<any>(null);

  const load=useCallback(async()=>{
    const [{data:m,error:me},{data:r,error:re}]=await Promise.all([
      supabase.rpc('command_center_metrics',{
        p_environment:appEnvironment,p_days:7
      }),
      supabase.rpc('evaluate_go_live_readiness',{
        p_environment:appEnvironment
      })
    ]);
    if(me)return Alert.alert('Command Center',me.message);
    if(re)return Alert.alert('Readiness',re.message);
    setMetrics(m);setReadiness(r);
  },[]);

  useEffect(()=>{load()},[load]);

  if(!metrics)return(
    <AdminGate>
      <View style={shared.screen}/>
    </AdminGate>
  );

  const recommendation=readiness?.recommendation||'—';
  const blocked=recommendation==='HOLD';

  return(
    <AdminGate>
      <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
        <Text style={shared.h1}>Go-Live Command Center</Text>
        <Text style={shared.muted}>
          Operational pilot health and release evidence. Final launch remains a human decision.
        </Text>

        <SectionTitle>CURRENT RECOMMENDATION</SectionTitle>
        <Card>
          <Text style={[styles.recommendation,{color:blocked?colors.danger:colors.green}]}>
            {recommendation.replaceAll('_',' ')}
          </Text>
          {(readiness?.blockers??[]).map((x:string,i:number)=>(
            <Text key={`b-${i}`} style={[shared.body,{marginTop:5,color:colors.danger}]}>• {x}</Text>
          ))}
          {(readiness?.warnings??[]).map((x:string,i:number)=>(
            <Text key={`w-${i}`} style={[shared.body,{marginTop:5,color:colors.amber}]}>• {x}</Text>
          ))}
        </Card>

        <SectionTitle>PILOT HEALTH — LAST 7 DAYS</SectionTitle>
        <View style={styles.grid}>
          <Metric label="Active Pilot" value={metrics.pilot.active_participants}/>
          <Metric label="Active Users" value={metrics.pilot.active_users_in_period}/>
          <Metric label="Checklist" value={`${metrics.pilot.checklist_percent}%`}/>
          <Metric label="Open Feedback" value={metrics.support.open_feedback}/>
          <Metric label="Privacy Feedback" value={metrics.support.open_privacy_feedback}/>
          <Metric label="Open Reports" value={metrics.support.open_content_reports}/>
        </View>

        <SectionTitle>INCIDENTS</SectionTitle>
        <View style={styles.grid}>
          <Metric label="P0 Open" value={metrics.incidents.open_p0} danger/>
          <Metric label="P1 Open" value={metrics.incidents.open_p1} warn/>
          <Metric label="P2 Open" value={metrics.incidents.open_p2}/>
          <Metric label="P3 Open" value={metrics.incidents.open_p3}/>
        </View>
        <Button title="INCIDENT / DEFECT REGISTER" onPress={()=>router.push('/admin/command-center/incidents')}/>

        <SectionTitle>READINESS EVIDENCE</SectionTitle>
        <View style={styles.grid}>
          <Metric label="Pass" value={metrics.readiness.pass}/>
          <Metric label="Warnings" value={metrics.readiness.warning} warn/>
          <Metric label="Fail" value={metrics.readiness.fail} danger/>
          <Metric label="Pending" value={metrics.readiness.pending}/>
        </View>
        <Button title="GO-LIVE READINESS CHECKS" outline onPress={()=>router.push('/admin/command-center/readiness')}/>

        <SectionTitle>RELEASE CANDIDATE</SectionTitle>
        <Card>
          <Text style={shared.h2}>
            {metrics.latest_release_candidate?.build_label || 'No release candidate registered'}
          </Text>
          {!!metrics.latest_release_candidate&&
            <Text style={shared.muted}>
              v{metrics.latest_release_candidate.version} • {metrics.latest_release_candidate.platform} • {metrics.latest_release_candidate.status}
            </Text>
          }
        </Card>
        <Button title="RELEASE CANDIDATES" outline onPress={()=>router.push('/admin/command-center/releases')}/>

        <SectionTitle>DECISION LOG</SectionTitle>
        <Card>
          <Text style={shared.h2}>
            {metrics.latest_decision?.decision?.replaceAll('_',' ') || 'No recorded decision'}
          </Text>
          {!!metrics.latest_decision?.rationale&&
            <Text style={[shared.body,{marginTop:6}]}>{metrics.latest_decision.rationale}</Text>
          }
        </Card>
        <Button title="LAUNCH • HOLD • ROLLBACK DECISION" onPress={()=>router.push('/admin/command-center/decision')}/>
        <Button title="REFRESH COMMAND CENTER" outline onPress={load}/>
      </ScrollView>
    </AdminGate>
  )
}

function Metric({label,value,danger,warn}:{label:string;value:string|number;danger?:boolean;warn?:boolean}){
  return(
    <View style={styles.metric}>
      <Text style={[styles.value,{color:danger?colors.danger:warn?colors.amber:colors.greenDark}]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles=StyleSheet.create({
  recommendation:{fontSize:22,fontWeight:'900'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:7},
  metric:{width:'31%',minWidth:98,flexGrow:1,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:13,padding:12},
  value:{fontSize:22,fontWeight:'900'},
  label:{fontSize:10,color:colors.muted,marginTop:4}
});
