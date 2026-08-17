import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const STATUSES=['not_checked','pass','warning','fail','not_applicable'];

export default function ReadinessChecks(){
  const [items,setItems]=useState<any[]>([]);
  const [evidence,setEvidence]=useState<Record<string,string>>({});

  const load=useCallback(async()=>{
    const {data,error}=await supabase.from('go_live_checks')
      .select('*').order('sort_order');
    if(error)return Alert.alert('Readiness',error.message);
    setItems(data??[]);
    const next:Record<string,string>={};
    (data??[]).forEach((x:any)=>next[x.check_key]=x.evidence??'');
    setEvidence(next);
  },[]);

  useEffect(()=>{load()},[load]);

  const setCheck=async(item:any,status:string)=>{
    const {error}=await supabase.rpc('set_go_live_check',{
      p_check_key:item.check_key,p_status:status,
      p_evidence:evidence[item.check_key]?.trim()||null
    });
    if(error)return Alert.alert('Readiness',error.message);
    await load();
  };

  return(
    <AdminGate>
      <View style={shared.screen}>
        <FlatList contentContainerStyle={shared.content}
          data={items} keyExtractor={i=>i.id}
          ListHeaderComponent={<View>
            <Text style={shared.h1}>Go-Live Readiness Checks</Text>
            <Text style={shared.muted}>
              Required checks should be supported by actual evidence. A green screen is not evidence by itself.
            </Text>
          </View>}
          renderItem={({item})=>(
            <Card>
              <Text style={shared.h2}>{item.is_required?'★ ':''}{item.title}</Text>
              <Text style={shared.muted}>{item.category} • {item.status.replaceAll('_',' ')}</Text>
              {!!item.description&&<Text style={[shared.body,{marginTop:6}]}>{item.description}</Text>}
              <TextInput multiline value={evidence[item.check_key]??''}
                onChangeText={v=>setEvidence(e=>({...e,[item.check_key]:v}))}
                placeholder="Evidence / build / test reference"
                style={styles.area}/>
              <View style={styles.wrap}>
                {STATUSES.map(s=>(
                  <Pressable key={s} onPress={()=>setCheck(item,s)}
                    style={[styles.chip,item.status===s&&styles.chipOn]}>
                    <Text style={{fontSize:10,fontWeight:'800'}}>{s.replaceAll('_',' ')}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          )}/>
      </View>
    </AdminGate>
  )
}
const styles=StyleSheet.create({
  area:{minHeight:80,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:10,textAlignVertical:'top',marginVertical:9},
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:6},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:18,paddingVertical:6,paddingHorizontal:8},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green}
});
