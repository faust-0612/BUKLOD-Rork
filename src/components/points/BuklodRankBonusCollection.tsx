import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { RANK_BONUS_REMINDER_POLICY } from '@/lib/buklodRankBonusReminder';

type Bonus = { bonus_key: string; title: string; available_at: string };
type Preference = { reminders_enabled: boolean; snoozed_until: string | null };
const EMPTY: Preference = { reminders_enabled: false, snoozed_until: null };

/** Mount only behind an explicitly enabled server feature flag after RC. */
export default function BuklodRankBonusCollection() {
  const { user } = useAuth();
  const accountId = user?.id ?? '';
  return accountId ? <AccountCollection key={accountId} userId={accountId}/> : null;
}
function AccountCollection({userId}:{userId:string}) {
  const [bonuses,setBonuses]=useState<Bonus[]>([]);
  const [pref,setPref]=useState<Preference>(EMPTY);
  const [loading,setLoading]=useState(true);
  const [loaded,setLoaded]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const epoch=useRef(0);
  const writeLock=useRef(false);
  const load=useCallback(async()=>{
    const seq=++epoch.current;
    setLoading(true);setError('');
    try{
      const [b,p]=await Promise.all([
        (supabase as any).from('buklod_rank_bonus_ledger_v1')
          .select('bonus_key,title,available_at').eq('user_id',userId)
          .is('redeemed_at',null).is('revoked_at',null).lte('available_at',new Date().toISOString()).order('available_at',{ascending:true}),
        (supabase as any).from('buklod_rank_bonus_preferences_v1')
          .select('reminders_enabled,snoozed_until').eq('user_id',userId).maybeSingle(),
      ]);
      if(b.error||p.error)throw b.error||p.error;
      if(seq===epoch.current){setBonuses(b.data??[]);setPref(p.data??EMPTY);setLoaded(true);}
    }catch{if(seq===epoch.current){setLoaded(false);setError('Could not load collections. Your rewards are preserved.');}}
    finally{if(seq===epoch.current)setLoading(false);}
  },[userId]);
  useEffect(()=>{void load();return()=>{epoch.current++;};},[load]);
  const save=async(next:Preference)=>{
    if(writeLock.current||loading)return;
    writeLock.current=true;setSaving(true);setError('');
    const seq=epoch.current;
    try{
      const {data:auth}=await supabase.auth.getSession();
      if(auth.session?.user.id!==userId)throw Error('Account changed');
      const {error:writeError}=await (supabase as any).from('buklod_rank_bonus_preferences_v1')
        .upsert({user_id:userId,...next},{onConflict:'user_id'});
      if(writeError)throw writeError;
      if(seq===epoch.current)setPref(next);
    }catch{if(seq===epoch.current)setError('Could not save reminder preference. Try again.');}
    finally{writeLock.current=false;if(seq===epoch.current)setSaving(false);}
  };
  if(loading)return <ActivityIndicator accessibilityLabel="Loading bonus collections" color="#176C43"/>;
  if(!loaded)return <View style={styles.card}><Text style={styles.heading}>My Bonus Collections</Text><Text accessibilityRole="alert" style={styles.error}>{error || 'Collections unavailable.'}</Text><Pressable accessibilityRole="button" onPress={()=>void load()}><Text style={styles.action}>Try again</Text></Pressable></View>;
  return <View style={styles.card}>
    <Text style={styles.heading}>My Bonus Collections</Text>
    <Text style={styles.body}>{bonuses.length} unredeemed</Text>
    {bonuses.map(b=><Text key={b.bonus_key} style={styles.item}>{b.title} · Pending</Text>)}
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
    <Pressable accessibilityRole="button" disabled={saving} onPress={()=>void load()}><Text style={styles.action}>Refresh collections</Text></Pressable>
    <Pressable accessibilityRole="switch" accessibilityState={{checked:pref.reminders_enabled,disabled:saving}} disabled={saving}
      onPress={()=>void save({reminders_enabled:!pref.reminders_enabled,snoozed_until:null})}>
      <Text style={styles.action}>Reward reminders: {pref.reminders_enabled?'On':'Off'}</Text>
    </Pressable>
    {pref.reminders_enabled&&bonuses.length>0?<Pressable accessibilityRole="button" disabled={saving}
      onPress={()=>void save({...pref,snoozed_until:new Date(Date.now()+RANK_BONUS_REMINDER_POLICY.snoozeDelayMs).toISOString()})}>
      <Text style={styles.action}>Remind me in 7 days</Text>
    </Pressable>:null}
    {pref.reminders_enabled&&pref.snoozed_until&&Date.parse(pref.snoozed_until)>Date.now()?
      <Text style={styles.body}>Reminders snoozed.</Text>:null}
    <Text style={styles.body}>Skipping an optional ad never removes a reward.</Text>
  </View>;
}
const styles=StyleSheet.create({
  card:{backgroundColor:'#FFFFFF',borderRadius:16,borderWidth:1,borderColor:'#B8D4C0',padding:14,marginBottom:16,gap:8},
  heading:{color:'#17482E',fontSize:17,fontWeight:'900'},
  body:{color:'#456052',fontSize:13},
  item:{color:'#17392A',fontSize:14,fontWeight:'700'},
  action:{color:'#075B30',fontSize:14,fontWeight:'800',paddingVertical:8},
  error:{color:'#983B2E',fontSize:13},
});
