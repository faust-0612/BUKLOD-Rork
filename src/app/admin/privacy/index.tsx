import { useEffect, useState } from 'react';
import { Alert, FlatList, Text, TextInput, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';

export default function PrivacyAdmin(){
  const [requests,setRequests]=useState<any[]>([]);
  const [reports,setReports]=useState<any[]>([]);

  const load=async()=>{
    const [{data:r},{data:c}]=await Promise.all([
      supabase.from('data_subject_requests')
        .select('id,request_type,status,request_text,response_text,submitted_at,user:user_id(full_name)')
        .order('submitted_at',{ascending:false}).limit(100),
      supabase.from('content_reports')
        .select('id,entity_type,entity_id,reason,details,status,created_at,reporter:reporter_id(full_name)')
        .order('created_at',{ascending:false}).limit(100)
    ]);
    setRequests(r??[]);setReports(c??[]);
  };
  useEffect(()=>{load()},[]);

  const completeRequest=async(item:any)=>{
    const {error}=await supabase.from('data_subject_requests')
      .update({status:'completed',completed_at:new Date().toISOString(),response_text:item.response_text||'Processed by BUKLOD privacy administration.'})
      .eq('id',item.id);
    if(error)return Alert.alert('Privacy Request',error.message);
    load();
  };

  const actionReport=async(item:any,hide:boolean)=>{
    const {error}=await supabase.rpc('resolve_content_report',{
      p_report_id:item.id,
      p_hide_content:hide,
      p_resolution:hide?'Content hidden after moderation review.':'Reviewed; no content removal required.'
    });
    if(error)return Alert.alert('Moderation',error.message);
    load();
  };

  return(
    <AdminGate>
      <FlatList style={shared.screen} contentContainerStyle={shared.content}
        data={reports} keyExtractor={i=>i.id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Privacy & Moderation</Text>

            <SectionTitle>DATA SUBJECT REQUESTS</SectionTitle>
            {requests.length?requests.map(item=>(
              <Card key={item.id}>
                <Text style={shared.h2}>{item.user?.full_name||'User'} • {item.request_type}</Text>
                <Text style={shared.muted}>{item.status} • {new Date(item.submitted_at).toLocaleString()}</Text>
                {!!item.request_text&&<Text style={[shared.body,{marginTop:6}]}>{item.request_text}</Text>}
                {item.status!=='completed'&&<View style={{marginTop:9}}><Button title="MARK COMPLETED" onPress={()=>completeRequest(item)}/></View>}
              </Card>
            )):<Card><Text style={shared.muted}>No privacy requests.</Text></Card>}

            <SectionTitle>CONTENT REPORTS</SectionTitle>
          </View>
        }
        ListEmptyComponent={<Card><Text style={shared.muted}>No content reports.</Text></Card>}
        renderItem={({item})=>(
          <Card>
            <Text style={shared.h2}>{item.reason} • {item.entity_type}</Text>
            <Text style={shared.muted}>Reporter: {item.reporter?.full_name||'Member'} • {item.status}</Text>
            {!!item.details&&<Text style={[shared.body,{marginTop:6}]}>{item.details}</Text>}
            {item.status!=='actioned'&&<View style={{gap:7,marginTop:9}}>
              <Button title="HIDE CONTENT & RESOLVE" onPress={()=>actionReport(item,true)}/>
              <Button title="KEEP CONTENT & RESOLVE" outline onPress={()=>actionReport(item,false)}/>
            </View>}
          </Card>
        )}/>
    </AdminGate>
  )
}
