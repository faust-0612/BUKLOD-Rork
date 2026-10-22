import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function FeedbackAdmin(){
  const [items,setItems]=useState<any[]>([]);
  const [resolution,setResolution]=useState<Record<string,string>>({});

  const load=async()=>{
    const {data,error}=await supabase.from('user_feedback')
      .select('id,category,title,message,status,app_version,app_environment,diagnostics,resolution,created_at,user:user_id(full_name,role)')
      .order('created_at',{ascending:false}).limit(200);
    if(error)return Alert.alert('Feedback',error.message);
    setItems(data??[]);
  };
  useEffect(()=>{load()},[]);

  const setStatus=async(item:any,status:string)=>{
    const {error}=await supabase.rpc('resolve_user_feedback',{
      p_feedback_id:item.id,
      p_status:status,
      p_resolution:resolution[item.id]||item.resolution||null,
      p_assigned_to:null
    });
    if(error)return Alert.alert('Feedback',error.message);
    await load();
  };

  return(
    <AdminGate>
      <View style={shared.screen}>
        <FlatList contentContainerStyle={shared.content}
          data={items} keyExtractor={i=>i.id}
          ListHeaderComponent={<View>
            <Text style={shared.h1}>Pilot Feedback Queue</Text>
            <Text style={shared.muted}>Review bugs, privacy concerns, usability issues, and feature requests from testers.</Text>
          </View>}
          ListEmptyComponent={<Card><Text style={shared.muted}>No feedback submitted yet.</Text></Card>}
          renderItem={({item})=>(
            <Card>
              <Text style={shared.h2}>{item.title}</Text>
              <Text style={shared.muted}>
                {item.category.replace('_',' ')} • {item.status} • {item.user?.full_name||'User'} • v{item.app_version||'—'}
              </Text>
              <Text style={[shared.body,{marginTop:8}]}>{item.message}</Text>
              <Text style={[shared.muted,{fontSize:11,marginTop:7}]}>
                Environment: {item.app_environment||'—'} • Online: {String(item.diagnostics?.online??'unknown')}
              </Text>

              {!['resolved','closed'].includes(item.status)&&<>
                <TextInput multiline value={resolution[item.id]??item.resolution??''}
                  onChangeText={v=>setResolution(r=>({...r,[item.id]:v}))}
                  placeholder="Resolution / internal response"
                  style={styles.area}/>
                <View style={{gap:7}}>
                  <Button title="MARK IN PROGRESS" outline onPress={()=>setStatus(item,'in_progress')}/>
                  <Button title="RESOLVE" onPress={()=>setStatus(item,'resolved')}/>
                </View>
              </>}
            </Card>
          )}/>
      </View>
    </AdminGate>
  )
}
const styles=StyleSheet.create({
  area:{minHeight:90,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top',marginVertical:9}
});
