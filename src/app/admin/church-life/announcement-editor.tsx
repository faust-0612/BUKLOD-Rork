import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

export default function AnnouncementEditor() {
  const {user}=useAuth();
  const [churches,setChurches]=useState<any[]>([]);
  const [churchId,setChurchId]=useState('');
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [priority,setPriority]=useState('normal');
  const [pinned,setPinned]=useState(false);

  useEffect(()=>{
    supabase.from('churches').select('id,name').eq('is_active',true).order('name')
      .then(({data})=>setChurches(data??[]));
  },[]);

  const create=async()=>{
    if(!user||!churchId||!title.trim()||!body.trim())return Alert.alert('Announcement','Church, title, and message are required.');
    const {error}=await supabase.from('announcements').insert({
      author_id:user.id,church_id:churchId,title:title.trim(),body:body.trim(),
      priority,is_pinned:pinned,starts_at:new Date().toISOString()
    });
    if(error)return Alert.alert('Could not publish',error.message);
    Alert.alert('Published','Announcement is now visible to the selected church.');
    router.back();
  };

  return(
    <AdminGate>
      <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
        <Text style={shared.h1}>Create Announcement</Text>
        <Text style={shared.h2}>Local Church</Text>
        <View style={styles.wrap}>
          {churches.map(c=>(
            <Pressable key={c.id} onPress={()=>setChurchId(c.id)} style={[styles.chip,churchId===c.id&&styles.chipOn]}>
              <Text>{c.name}</Text>
            </Pressable>
          ))}
        </View>
        <Card>
          <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle}/>
          <TextInput multiline style={styles.area} placeholder="Announcement" value={body} onChangeText={setBody}/>
        </Card>
        <Text style={shared.h2}>Priority</Text>
        <View style={styles.wrap}>
          {['normal','important','urgent'].map(p=>(
            <Pressable key={p} onPress={()=>setPriority(p)} style={[styles.chip,priority===p&&styles.chipOn]}><Text>{p}</Text></Pressable>
          ))}
        </View>
        <Card><View style={shared.row}><Text style={shared.h2}>Pin Announcement</Text><Switch value={pinned} onValueChange={setPinned}/></View></Card>
        <Button title="PUBLISH ANNOUNCEMENT" onPress={create}/>
      </ScrollView>
    </AdminGate>
  )
}
const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:20,paddingVertical:8,paddingHorizontal:10},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  input:{borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,marginBottom:8},
  area:{minHeight:140,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top'}
});
