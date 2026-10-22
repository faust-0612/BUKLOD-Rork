import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

type Privacy='private'|'leader'|'group'|'church';

export default function NewPrayerRequest() {
  const {user}=useAuth();
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [privacy,setPrivacy]=useState<Privacy>('group');
  const [busy,setBusy]=useState(false);

  const save=async()=>{
    if(!user||!body.trim())return Alert.alert('Prayer request','Please write your prayer request.');
    setBusy(true);
    const {error}=await supabase.from('prayer_requests').insert({
      user_id:user.id,title:title.trim()||null,request_text:body.trim(),privacy
    });
    setBusy(false);
    if(error)return Alert.alert('Could not save',error.message);
    Alert.alert('Prayer request saved','Your selected privacy setting has been applied.');
    router.back();
  };

  return(
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>New Prayer Request</Text>
      <Card>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Title (optional)"/>
        <TextInput style={styles.area} value={body} onChangeText={setBody} multiline placeholder="How can we pray for you?"/>
      </Card>

      <Text style={shared.h2}>Who can see this?</Text>
      <View style={styles.wrap}>
        {(['private','leader','group','church'] as Privacy[]).map(p=>(
          <Pressable key={p} onPress={()=>setPrivacy(p)} style={[styles.chip,privacy===p&&styles.chipOn]}>
            <Text style={{fontWeight:'800'}}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[shared.muted,{fontSize:12,lineHeight:18}]}>
        Private means only you. Leader shares with your assigned leader. Group shares with your BUKLOD. Church shares within your approved local church.
      </Text>

      <Button title={busy?'SAVING...':'SAVE PRAYER REQUEST'} onPress={save}/>
      <Button title="CANCEL" outline onPress={()=>router.back()}/>
    </ScrollView>
  )
}

const styles=StyleSheet.create({
  input:{borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,marginBottom:8},
  area:{minHeight:150,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top'},
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:20,paddingVertical:8,paddingHorizontal:11,backgroundColor:colors.white},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green}
});
