import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, Button, SectionTitle, shared } from '@/components/UI';
import { colors } from '@/lib/theme';

export default function MemberCareProfile() {
  const {id}=useLocalSearchParams<{id:string}>();
  const [summary,setSummary]=useState<any>(null);
  const [notes,setNotes]=useState<any[]>([]);
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [followUp,setFollowUp]=useState(false);

  const load=useCallback(async()=>{
    if(!id)return;
    const [{data:s,error},{data:n}]=await Promise.all([
      supabase.rpc('member_care_summary',{p_member_id:id}),
      supabase.from('pastoral_care_notes')
        .select('id,title,note_text,visibility,follow_up_needed,follow_up_due_at,resolved_at,created_at,author:author_id(full_name)')
        .eq('member_id',id).order('created_at',{ascending:false})
    ]);
    if(error)Alert.alert('Member Care',error.message);
    setSummary(s);setNotes(n??[]);
  },[id]);

  useEffect(()=>{load()},[load]);

  const add=async()=>{
    if(!title.trim()||!body.trim())return Alert.alert('Pastoral Note','Title and note are required.');
    const {error}=await supabase.rpc('add_pastoral_care_note',{
      p_member_id:id,
      p_title:title.trim(),
      p_note_text:body.trim(),
      p_visibility:'pastoral_team',
      p_follow_up_needed:followUp,
      p_follow_up_due_at:null
    });
    if(error)return Alert.alert('Could not save note',error.message);
    setTitle('');setBody('');setFollowUp(false);await load();
  };

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={notes} keyExtractor={i=>i.id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>{summary?.member?.full_name||'Member Care'}</Text>
            <Text style={shared.muted}>Pastoral care records are private leadership data. Keep notes brief, necessary, and respectful.</Text>

            <SectionTitle>CARE SUMMARY</SectionTitle>
            <View style={styles.grid}>
              <Stat label="Open Follow-ups" value={summary?.open_followups??0}/>
              <Stat label="Care Notes" value={summary?.pastoral_notes??0}/>
              <Stat label="Active Learning" value={summary?.learning_tracks_active??0}/>
            </View>
            <Card>
              <Text style={shared.h2}>Last devotional</Text>
              <Text style={shared.muted}>{summary?.last_devotional||'No completion yet'}</Text>
              {!!summary?.household?.name&&<Text style={[shared.body,{marginTop:5}]}>🏠 {summary.household.name} • {summary.household.role}</Text>}
            </Card>

            <SectionTitle>ADD PASTORAL NOTE</SectionTitle>
            <Card>
              <TextInput style={styles.input} placeholder="Note title" value={title} onChangeText={setTitle}/>
              <TextInput multiline style={styles.area} placeholder="Pastoral care note" value={body} onChangeText={setBody}/>
              <Pressable onPress={()=>setFollowUp(v=>!v)}>
                <Text style={{fontWeight:'900',marginBottom:9}}>{followUp?'✓ ':''}Follow-up needed</Text>
              </Pressable>
              <Button title="SAVE PRIVATE CARE NOTE" onPress={add}/>
            </Card>
            <SectionTitle>PASTORAL NOTES</SectionTitle>
          </View>
        }
        ListEmptyComponent={<Card><Text style={shared.muted}>No visible pastoral care notes.</Text></Card>}
        renderItem={({item})=>(
          <Card>
            <Text style={shared.h2}>{item.title}</Text>
            <Text style={shared.muted}>{item.author?.full_name||'Pastoral team'} • {new Date(item.created_at).toLocaleString()}</Text>
            <Text style={[shared.body,{marginTop:8}]}>{item.note_text}</Text>
            {item.follow_up_needed&&!item.resolved_at&&<Text style={{marginTop:8,fontWeight:'900',color:colors.amber}}>Follow-up needed</Text>}
          </Card>
        )}
      />
    </View>
  )
}
function Stat({label,value}:{label:string;value:string|number}){
  return <View style={styles.stat}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></View>
}
const styles=StyleSheet.create({
  grid:{flexDirection:'row',gap:7},
  stat:{flex:1,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:12,padding:10},
  value:{fontSize:22,fontWeight:'900',color:colors.greenDark},
  label:{fontSize:10,color:colors.muted},
  input:{borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,marginBottom:8},
  area:{minHeight:120,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top',marginBottom:8}
});
