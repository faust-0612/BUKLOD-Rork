import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import {
  loadMyWeeklyPerformance, S2_WEEKLY_PERFORMANCE_STAGING_ONLY,
} from '@/lib/season2/buklodWeeklyPerformanceClientR1';
import {
  WEEKLY_CLASS_META, WEEKLY_PERFORMANCE_TIERS,
  type BuklodWeeklyEvidence,
} from '@/lib/season2/buklodWeeklyPerformanceRulesR1';

/** Compact first-view Profile section; details stay private to the owner.
 * Uses the existing authenticated backend account. No inferred or local grants.
 */
export default function BuklodWeeklyPerformanceCard({userId}:{userId?:string|null}){
  const {user}=useAuth();
  const {theme}=useBuklodTheme();
  const [data,setData]=useState<{owner:string;value:BuklodWeeklyEvidence|null}>({owner:'',value:null});
  const [expanded,setExpanded]=useState(false);
  const viewerId=user?.id??'';
  const ownerId=userId??'';
  useFocusEffect(useCallback(()=>{
    let active=true;
    if(!S2_WEEKLY_PERFORMANCE_STAGING_ONLY||!viewerId||viewerId!==ownerId)return ()=>{active=false;};
    setExpanded(false);
    void loadMyWeeklyPerformance(ownerId)
      .then(value=>{if(active)setData({owner:ownerId,value});})
      .catch(()=>undefined);
    return ()=>{active=false;};
  },[viewerId,ownerId]));

  if(!S2_WEEKLY_PERFORMANCE_STAGING_ONLY||!ownerId||viewerId!==ownerId)return null;
  const current=data.owner===ownerId?data.value:null;
  // No staged RPC = no half-ready card on members' Profiles. The next
  // focus rechecks the isolated backend; a valid Unrated record still shows.
  if(!current)return null;
  const meta=current?WEEKLY_CLASS_META[current.class_code]:null;
  const next=current?WEEKLY_PERFORMANCE_TIERS.find(t=>t.minScore>current.score ||
    (t.minScore<=current.score && t.class_code!==current.class_code &&
     WEEKLY_PERFORMANCE_TIERS.findIndex(r=>r.class_code===t.class_code)>
     WEEKLY_PERFORMANCE_TIERS.findIndex(r=>r.class_code===current.class_code))):null;
  const activeCategories=current?
    Number(current.learning_days>0)+Number(current.community_days>0)+Number(current.creation_days>0):0;

  return (
    <View testID="weekly-performance-profile" style={{
      marginTop:4,borderRadius:10,borderWidth:1,borderColor:theme.border,
      backgroundColor:theme.surface,paddingHorizontal:10,paddingVertical:7,
    }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Weekly Performance ${meta?.title??'not yet available'}. ${expanded?'Collapse':'View'} details`}
        onPress={()=>setExpanded(v=>!v)}
        style={{flexDirection:'row',alignItems:'center',gap:8,minHeight:28}}
      >
        <MaterialCommunityIcons name={meta?.icon??'clock-outline'}
          size={19} color={meta?.color??theme.textMuted}/>
        <View style={{flex:1}}>
          <Text numberOfLines={1} style={{color:theme.textPrimary,fontSize:12.5,fontWeight:'800'}}>
            Weekly Performance: {meta?.title??'Awaiting verified staging data'}
          </Text>
          <Text numberOfLines={1} style={{color:theme.textMuted,fontSize:10.5}}>
            {current?`Week of ${current.week_start} · Resets Monday (PH)`:'Server classification only · No estimated rank'}
          </Text>
        </View>
        <MaterialCommunityIcons name={expanded?'chevron-up':'chevron-down'} size={19} color={theme.textMuted}/>
      </Pressable>
      {expanded?(
        <View testID="weekly-performance-owner-details" style={{
          paddingTop:7,marginTop:6,borderTopWidth:1,borderTopColor:theme.border,gap:4,
        }}>
          {current?(
            <>
              <Text style={{color:theme.textPrimary,fontSize:12,fontWeight:'700'}}>
                Verified progress: {current.score}/100 · {current.active_days}/7 active days
              </Text>
              <Text style={{color:theme.textMuted,fontSize:11}}>
                Learning: {current.learning_days} days · Community impact: {current.community_days} days · Quality contributions: {current.creation_days} days
              </Text>
              <Text style={{color:theme.textMuted,fontSize:11}}>
                {current.class_code==='exceptional'
                  ? 'Highest weekly class achieved. Keep participating meaningfully.'
                  : next
                  ? `Next: ${WEEKLY_CLASS_META[next.class_code].title} — at least ${next.minScore}/100, ${next.minDays} active days and ${next.minCategories} categories. Current categories: ${activeCategories}.`
                  : 'Keep participating in verified activities to improve your class.'}
              </Text>
              <Text style={{color:theme.textMuted,fontSize:11}}>
                Only server-confirmed, claimed activities count. Repeated reactions or spam do not raise this class. Learning and community routes are optional, not compulsory faith requirements.
              </Text>
              <Text style={{color:theme.textPrimary,fontSize:11,fontWeight:'700'}}>
                Reward preview: {meta?.rewardPreview}
              </Text>
            </>
          ):(
            <Text style={{color:theme.textMuted,fontSize:11}}>
              The staging classification service has not returned verified data. No badge or reward is assumed.
            </Text>
          )}
          <Text style={{color:theme.textMuted,fontSize:10.5}}>
            Season 2 rewards are held. No BP, token, cash, or collectible is issued by this preview.
          </Text>
        </View>
      ):null}
    </View>
  );
}
