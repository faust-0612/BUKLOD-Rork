import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type Rule = {
 activity_type: string;
 label: string;
 points: number;
 active: boolean;
 max_per_event: number | null;
};

const LABELS: Record<string,string> = {
 abc_growth_lesson: 'ABC growth lesson',
 daily_bible: 'Daily Bible Reading',
 devotional: 'Daily Word devotional',
 formation_lesson: 'Approved Formation Lesson',
 stage_completion: 'Formation Stage Completion',
 weekly_consistency: 'Weekly Consistency',
 scope_attendance: 'Home Check In Today — Admin Verified Attendance',
 event_attendance: 'Official Event Attendance',
 mentor_session: 'Verified Mentoring Session',
 mentoring_release: 'Mentoring Lesson Completion',
 bible_quiz_easy: 'Home Bible Quiz Easy — 4/5 minimum',
 bible_quiz_medium: 'Home Bible Quiz Medium — 4/5 minimum',
 bible_quiz_hard: 'Home Bible Quiz Hard — 4/5 minimum',
 verified_volunteer_service: 'Verified volunteer service (review required)',
 verified_mentoring_session: 'Mentoring milestone (upcoming)',
 ministry_major_milestone: 'Major Ministry Milestone (review required)',
 consistency_30_day: '30-day consistency milestone (upcoming)',
 r2_verified_challenge: 'Difficulty challenge (upcoming)',
 achievement_bible_scholar: 'Bible Scholar (reviewed milestone)',
 achievement_community_builder: 'Community Builder (reviewed milestone)',
 achievement_faithful_mentor: 'Faithful Mentor (reviewed milestone)',
 achievement_kingdom_champion: 'Kingdom Champion (reviewed milestone)',
 game_tournament_champion: 'Tournament Champion (review required)',
}
const KEYS = Object.keys(LABELS);

export default function BuklodPointsR2Guide() {
 const [expanded,setExpanded] = useState(false);
 const [loading,setLoading] = useState(false);
 const [rules,setRules] = useState<Rule[] | null>(null);
 const [error,setError] = useState(false);
 useEffect(() => {
   if (!expanded || rules !== null) return;
   let mounted = true;
   setLoading(true);
   setError(false);
   void (async () => {
     try {
       const {data,error:rpcError} = await (supabase as any).rpc('get_buklod_points_r2_catalog_v1');
       if (rpcError) throw rpcError;
       const filtered: Rule[] = Array.isArray(data)
         ? data.filter((row: unknown): row is Rule => Boolean(
             row && typeof row === 'object' &&
             typeof (row as Rule).activity_type === 'string' &&
             typeof (row as Rule).points === 'number' &&
             typeof (row as Rule).active === 'boolean'
           )).filter((row: Rule) => KEYS.includes(row.activity_type)) : [];
       if (mounted) setRules(filtered);
     } catch {
       if (mounted) setError(true);
     } finally {
       if (mounted) setLoading(false);
     }
   })();
   return () => { mounted = false; };
 },[expanded,rules]);
 return (
   <View style={styles.wrap}>
     <Pressable
       accessibilityRole="button"
       accessibilityLabel="Show BUKLOD Points R2 reward guide"
       accessibilityState={{expanded}}
       onPress={() => setExpanded(value => !value)}
       style={styles.header}
     >
       <View style={styles.icon}>
         <MaterialCommunityIcons name="trophy-award" size={22} color="#8A5A00" />
       </View>
       <View style={{flex:1}}>
         <Text style={styles.title}>Points & Achievements</Text>
         <Text style={styles.subtitle}>Check active rewards and future challenges</Text>
       </View>
       <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={23} color="#577165" />
     </Pressable>
     {expanded && (
       <View style={styles.body}>
         <Text style={styles.explainer}>
           Higher rewards require real accomplishments and evidence.
           Daily Bible Quiz: Show Faith → Daily Bible Quiz → submit five server-scored answers.
           Cluster Verified Attendance: open Cluster → Events & Attendance → authorized operator records present/late.
           Mentor reward: BUKLOD Lesson → report registered mentees → attach teaching photo → Pastor and Admin approval.
           Major milestones: nominate with evidence in the Live Reward Focus panel; Admin reviews before reward claim.
           Only backend-validated activities earn points. Unsupported challenges remain disabled.
           Your existing lifetime and available balances are preserved.
         </Text>
         {loading && <ActivityIndicator color="#0A7436" />}
         {error && (
           <Text style={styles.fallback}>
             Current reward values are unavailable. Your existing points are unaffected.
           </Text>
         )}
         {rules?.map(rule => (
           <View style={styles.row} key={rule.activity_type}>
             <View style={{flex:1}}>
               <Text style={styles.rowTitle}>{LABELS[rule.activity_type]}</Text>
               <Text style={styles.status}>{rule.active ? 'Configured in BUKLOD · claim after verified completion' : 'Upcoming · not claimable'}</Text>
             </View>
             <Text style={[styles.points,!rule.active && styles.inactive]}>
               {rule.active ? '+' : ''}{rule.points} BP
             </Text>
           </View>
         ))}
         {rules !== null && rules.length === 0 && (
           <Text style={styles.fallback}>New achievement rewards are not configured yet.</Text>
         )}
         <Text style={styles.footnote}>
           Achievement and challenge rewards require verified eligibility. Difficulty multipliers
           apply to approved R2 challenges only. A listed reward is not an automatic claim.
         </Text>
       </View>
     )}
   </View>
 );
}
const styles=StyleSheet.create({
 wrap:{marginHorizontal:14,marginVertical:8,borderWidth:1,borderColor:'#DFE8DB',
   borderRadius:17,backgroundColor:'#FFFCF5',overflow:'hidden'},
 header:{flexDirection:'row',alignItems:'center',padding:12,gap:9},
 icon:{width:38,height:38,alignItems:'center',justifyContent:'center',
   borderRadius:12,backgroundColor:'#FFF0CA'},
 title:{fontSize:13,fontWeight:'900',color:'#233B2C'},
 subtitle:{fontSize:10,color:'#667B6E',marginTop:2},
 body:{paddingHorizontal:12,paddingBottom:12,gap:9},
 explainer:{fontSize:11,lineHeight:16,color:'#4C6254'},
 row:{flexDirection:'row',alignItems:'center',paddingVertical:8,
   borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#DFE8DB',gap:10},
 rowTitle:{fontSize:11,fontWeight:'800',color:'#25432F'},
 status:{fontSize:9,color:'#667B6E',marginTop:3},
 points:{fontSize:13,fontWeight:'900',color:'#0A7436'},
 inactive:{color:'#8C9589'},
 fallback:{fontSize:11,color:'#7A6652'},
 footnote:{fontSize:9.5,lineHeight:14,color:'#718074',marginTop:2},
});
