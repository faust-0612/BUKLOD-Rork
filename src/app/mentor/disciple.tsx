import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { colors } from '@/lib/theme';

export default function DiscipleDetail() {
  const {id}=useLocalSearchParams<{id:string}>();
  const [profile,setProfile]=useState<any>(null);
  const [enrollments,setEnrollments]=useState<any[]>([]);
  const [assignments,setAssignments]=useState<any[]>([]);
  const [feedback,setFeedback]=useState<Record<string,string>>({});

  const load=useCallback(async()=>{
    if(!id)return;
    const [{data:p},{data:e}]=await Promise.all([
      supabase.from('profiles').select('id,full_name').eq('id',id).single(),
      supabase.from('track_enrollments')
        .select('id,status,enrolled_at,completed_at,track:track_id(title)')
        .eq('user_id',id).order('enrolled_at',{ascending:false})
    ]);
    setProfile(p);setEnrollments(e??[]);
    const enrollmentIds=(e??[]).map(x=>x.id);
    if(enrollmentIds.length){
      const {data:a}=await supabase.from('assignment_submissions')
        .select('id,enrollment_id,lesson_id,response_text,status,reviewer_feedback,lesson:lesson_id(title)')
        .in('enrollment_id',enrollmentIds)
        .order('submitted_at',{ascending:false});
      setAssignments(a??[]);
    } else setAssignments([]);
  },[id]);

  useEffect(()=>{load()},[load]);

  const review=async(sub:any,accept:boolean)=>{
    const {error}=await supabase.rpc('review_learning_assignment',{
      p_submission_id:sub.id,
      p_feedback:feedback[sub.id]||'',
      p_accept:accept
    });
    if(error)return Alert.alert('Review failed',error.message);
    Alert.alert('Review saved',accept?'Assignment accepted.':'Assignment returned with feedback.');
    await load();
  };

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={assignments} keyExtractor={i=>i.id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>{profile?.full_name||'Disciple'}</Text>
            <SectionTitle>TRACKS</SectionTitle>
            {enrollments.map(e=>(
              <Card key={e.id}>
                <Text style={shared.h2}>{e.track?.title||'Learning Track'}</Text>
                <Text style={shared.muted}>{e.status}</Text>
              </Card>
            ))}
            <SectionTitle>ASSIGNMENTS</SectionTitle>
          </View>
        }
        ListEmptyComponent={<Card><Text style={shared.muted}>No submitted assignments.</Text></Card>}
        renderItem={({item})=>(
          <Card>
            <Text style={shared.h2}>{item.lesson?.title||'Assignment'}</Text>
            <Text style={shared.muted}>{item.status}</Text>
            <Text style={[shared.body,{marginVertical:9}]}>{item.response_text}</Text>

            {item.status==='submitted'&&<>
              <TextInput multiline
                value={feedback[item.id]||''}
                onChangeText={v=>setFeedback(f=>({...f,[item.id]:v}))}
                placeholder="Mentor feedback..."
                style={styles.area}/>
              <Button title="ACCEPT ASSIGNMENT" onPress={()=>review(item,true)}/>
              <View style={{height:7}}/>
              <Button title="RETURN FOR REVISION" outline onPress={()=>review(item,false)}/>
            </>}

            {!!item.reviewer_feedback&&
              <Text style={[shared.body,{marginTop:9}]}>Feedback: {item.reviewer_feedback}</Text>}
          </Card>
        )}
      />
    </View>
  )
}

const styles=StyleSheet.create({
  area:{minHeight:100,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top',marginBottom:9}
});
