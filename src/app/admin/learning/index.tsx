import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function LearningAdmin() {
  const [tracks,setTracks]=useState<any[]>([]);
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [category,setCategory]=useState('discipleship');

  const load=useCallback(async()=>{
    const {data,error}=await supabase.from('learning_tracks')
      .select('*').order('created_at',{ascending:false});
    if(error)Alert.alert('Learning',error.message);
    setTracks(data??[]);
  },[]);

  useEffect(()=>{load()},[load]);

  const create=async()=>{
    if(!title.trim())return Alert.alert('Track','Title is required.');
    const slug=title.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const {data,error}=await supabase.from('learning_tracks').insert({
      title:title.trim(),slug,description:description.trim()||null,category,status:'draft'
    }).select('id').single();
    if(error)return Alert.alert('Could not create track',error.message);
    setTitle('');setDescription('');
    router.push({pathname:'/admin/learning/track-editor',params:{id:data.id}});
  };

  return(
    <AdminGate>
      <FlatList style={shared.screen} contentContainerStyle={shared.content}
        data={tracks} keyExtractor={i=>i.id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Learning & Discipleship</Text>
            <Text style={shared.muted}>Create and manage Bible study, membership, discipleship, and leadership tracks.</Text>
            <SectionTitle>NEW TRACK</SectionTitle>
            <Card>
              <TextInput style={styles.input} placeholder="Track title" value={title} onChangeText={setTitle}/>
              <TextInput multiline style={[styles.input,{minHeight:80,textAlignVertical:'top'}]}
                placeholder="Description" value={description} onChangeText={setDescription}/>
              <Text style={{fontWeight:'900'}}>Category</Text>
              <View style={styles.wrap}>
                {['new_believer','membership','discipleship','leadership','bible_study'].map(c=>(
                  <Pressable key={c} onPress={()=>setCategory(c)} style={[styles.chip,category===c&&styles.chipOn]}>
                    <Text style={{fontSize:11,fontWeight:'800'}}>{c.replace('_',' ')}</Text>
                  </Pressable>
                ))}
              </View>
              <Button title="CREATE TRACK" onPress={create}/>
            </Card>
            <SectionTitle>TRACKS</SectionTitle>
          </View>
        }
        renderItem={({item})=>(
          <Pressable onPress={()=>router.push({pathname:'/admin/learning/track-editor',params:{id:item.id}})}>
            <Card>
              <Text style={shared.h2}>{item.title}</Text>
              <Text style={shared.muted}>{item.category.replace('_',' ')} • {item.status}</Text>
              <Text style={[shared.body,{marginTop:5}]}>{item.description||'No description'}</Text>
            </Card>
          </Pressable>
        )}
      />
    </AdminGate>
  )
}

const styles=StyleSheet.create({
  input:{borderWidth:1,borderColor:colors.line,borderRadius:12,padding:12,backgroundColor:colors.white,marginBottom:8},
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:6,marginVertical:8},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:18,paddingVertical:7,paddingHorizontal:9},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green}
});
