import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';

export default function DirectoryMemberDetail() {
  const {id}=useLocalSearchParams<{id:string}>();
  const {profile,hasAnyRole}=useAuth();
  const [member,setMember]=useState<any>(null);
  const [dates,setDates]=useState<any[]>([]);
  const [household,setHousehold]=useState<any>(null);

  useEffect(()=>{
    if(!id)return;
    (async()=>{
      const {data:d}=await supabase.rpc('church_directory');
      const row=(d??[]).find((x:any)=>x.user_id===id);
      setMember(row??null);

      const {data:dt}=await supabase.from('member_important_dates')
        .select('*').eq('user_id',id).order('event_date');
      setDates(dt??[]);

      const {data:hm}=await supabase.from('household_members')
        .select('household_role,household:household_id(id,household_name)')
        .eq('user_id',id).limit(1).maybeSingle();
      setHousehold(hm);
    })();
  },[id]);

  if(!member)return <View style={shared.screen}/>;

  const pastoral=hasAnyRole(['pastor','local_admin','system_admin']);

  return(
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>{member.full_name}</Text>
      <Text style={shared.muted}>{member.role?.replace('_',' ')}</Text>

      <Card>
        {!!member.mobile&&<Text style={shared.body}>📱 {member.mobile}</Text>}
        {!!household?.household&&<Text style={[shared.body,{marginTop:6}]}>🏠 {household.household.household_name} • {household.household_role}</Text>}
        {!!member.ministries?.length&&<Text style={[shared.body,{marginTop:6}]}>🤝 {member.ministries.join(', ')}</Text>}
      </Card>

      {!!dates.length&&<>
        <SectionTitle>IMPORTANT DATES</SectionTitle>
        {dates.map(d=>(
          <Card key={d.id}>
            <Text style={shared.h2}>{d.label||d.date_type.replace('_',' ')}</Text>
            <Text style={shared.muted}>{new Date(`${d.event_date}T00:00:00`).toLocaleDateString()}</Text>
          </Card>
        ))}
      </>}

      {pastoral&&<>
        <SectionTitle>PASTORAL CARE</SectionTitle>
        <Button title="OPEN MEMBER CARE PROFILE" onPress={()=>router.push(`/admin/member-care/${id}`)}/>
      </>}
    </ScrollView>
  )
}

