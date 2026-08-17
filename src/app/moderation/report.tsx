import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, shared } from '@/components/UI';
import { colors } from '@/lib/theme';

const REASONS=['spam','harassment','privacy','misinformation','inappropriate','other'];

export default function ReportContent(){
  const p=useLocalSearchParams<{entityType:string;entityId:string}>();
  const [reason,setReason]=useState('privacy');
  const [details,setDetails]=useState('');

  const submit=async()=>{
    const {error}=await supabase.rpc('submit_content_report',{
      p_entity_type:p.entityType,
      p_entity_id:p.entityId,
      p_reason:reason,
      p_details:details.trim()||null
    });
    if(error)return Alert.alert('Report',error.message);
    Alert.alert('Report submitted','A moderator can review the content.');
    router.back();
  };

  return(
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>Report Content</Text>
      <Text style={shared.muted}>Use reporting for privacy, safety, spam, or serious community-guideline concerns.</Text>
      <View style={styles.wrap}>
        {REASONS.map(r=>(
          <Pressable key={r} onPress={()=>setReason(r)} style={[styles.chip,reason===r&&styles.chipOn]}>
            <Text style={{fontWeight:'800'}}>{r}</Text>
          </Pressable>
        ))}
      </View>
      <Card>
        <TextInput multiline value={details} onChangeText={setDetails}
          placeholder="Optional details for the moderator" style={styles.area}/>
        <Button title="SUBMIT REPORT" onPress={submit}/>
      </Card>
    </ScrollView>
  )
}
const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:20,paddingVertical:8,paddingHorizontal:10},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  area:{minHeight:120,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top',marginBottom:9}
});
