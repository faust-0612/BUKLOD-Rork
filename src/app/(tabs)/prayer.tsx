/* BUKLOD_ROOT_PERFORMANCE_R3_PRAYER_REALTIME: stable topic; existing cleanup preserved */
import BuklodSponsorSlot from '@/components/BuklodSponsorSlot';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { getClusterLabels, formatClusterName } from '@/lib/clusterLabels'; // PATCH_154A_CLUSTER_LABELS
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

export default function PrayerScreen() {
  const { user } = useAuth();
  const [items,setItems]=useState<any[]>([]);
  const [myAnswered,setMyAnswered]=useState(0);

  const load=useCallback(async()=>{
    const [{data},{count}]=await Promise.all([
      supabase.from('prayer_requests')
        .select('id,user_id,request_text,title,status,privacy,created_at,profiles:user_id(full_name)')
        .eq('status','active')
        .order('created_at',{ascending:false}),
      user ? supabase.from('prayer_requests')
        .select('*',{count:'exact',head:true})
        .eq('user_id',user.id).eq('status','answered') : Promise.resolve({count:0})
    ]);
    const rows=(data??[]) as any[]; const clusterMap=await getClusterLabels(rows.map((row:any)=>row.user_id)); setItems(rows.map((row:any)=>({...row,cluster_name:clusterMap[row.user_id]??null})));
    setMyAnswered(count??0);
  },[user?.id]);

  useEffect(()=>{load()},[load]);

  useEffect(()=>{
    const ch=supabase.channel(
        `prayer-wall`
      )
      .on('postgres_changes',{event:'*',schema:'public',table:'prayer_requests'},load)
      .subscribe();
    return()=>{supabase.removeChannel(ch)};
  },[load]);

  const prayed=async(id:string)=>{
    if(!user)return;

    /* I_PRAYED_IDEMPOTENT_FIX */

    const {error}=
      await supabase
        .from('prayer_responses')
        .insert([
          {
            prayer_request_id:id,
            user_id:user.id
          }
        ]);

    /*
     * 23505 = response already exists.
     *
     * That is not an app error.
     * One prayer response per member/request
     * is intentional.
     */
    if(
      error &&
      error.code!=='23505'
    ){
      Alert.alert(
        'Prayer',
        error.message
      );
      return;
    }

    if(
      error?.code==='23505'
    ){
      Alert.alert(
        'Prayer',
        'You already prayed for this request.'
      );
      return;
    }

    Alert.alert(
      'Prayer',
      'Prayer recorded. Thank you for praying.'
    );

    
  };

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={items} keyExtractor={i=>i.id}
        ListHeaderComponent={
          <View>
            <View style={shared.row}>
              <Text style={shared.h1}>Prayer</Text>
              <Pressable onPress={()=>router.push('/prayer/new')} style={styles.add}><Text style={styles.addText}>+ REQUEST</Text></Pressable>
            </View>
            <Text style={shared.muted}>Pray with your BUKLOD while respecting each member's chosen privacy.</Text>
                        {/* PATCH_162F_PRAYER_AD */}
<SectionTitle>MY PRAYER JOURNEY</SectionTitle>
            <Card><Text style={shared.h2}>{'\u2713'} {myAnswered} answered prayer{myAnswered===1?'':'s'}</Text></Card>
            <SectionTitle>PRAYER WALL</SectionTitle>
          </View>
        }
        ListEmptyComponent={<Card><Text style={shared.muted}>No prayer requests visible to you.</Text></Card>}
        renderItem={({item})=>(
          <Pressable onPress={()=>router.push(`/prayer/${item.id}`)}>
            <Card>
              <Text style={shared.h2}>{resolvePersonDisplayName(item.profiles, item.user_id)} | {formatClusterName(item.cluster_name)}</Text>
              <Text style={shared.muted}>{item.privacy} | {new Date(item.created_at).toLocaleDateString()}</Text>
              {!!item.title&&<Text style={{fontWeight:'900',marginTop:8}}>{item.title}</Text>}
              <Text style={[shared.body,{marginVertical:8}]}>{item.request_text}</Text>
              <Pressable
              onPress={(event)=>{
                event.stopPropagation();
                void prayed(item.id);
              }}
            ><Text style={styles.pray}>{'\uD83D\uDE4F'} I PRAYED</Text></Pressable>
            </Card>
          </Pressable>
        )}
      />
    </View>
  )
}

const styles=StyleSheet.create({
  add:{backgroundColor:colors.green,borderRadius:11,paddingVertical:9,paddingHorizontal:11},
  addText:{color:colors.white,fontSize:11,fontWeight:'900'},
  pray:{color:colors.green,fontWeight:'900'}
});



