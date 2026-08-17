import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Button, Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { appEnvironment } from '@/lib/environment';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { colors } from '@/lib/theme';

const CATEGORIES=[
  ['bug','Bug / Something is broken'],
  ['usability','Usability / Confusing'],
  ['content','Content concern'],
  ['privacy','Privacy concern'],
  ['feature_request','Feature request'],
  ['other','Other'],
] as const;

export default function FeedbackScreen(){
  const {profile}=useAuth();
  const {isConnected,isInternetReachable}=useNetwork();
  const [category,setCategory]=useState<string>('bug');
  const [title,setTitle]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  const online=isConnected && isInternetReachable!==false;

  const submit=async()=>{
    if(!online)return Alert.alert('Offline','Connect to the internet before sending feedback.');
    if(!title.trim()||!message.trim())return Alert.alert('Feedback','Title and message are required.');

    setBusy(true);
    const {data,error}=await supabase.rpc('submit_user_feedback',{
      p_category:category,
      p_title:title.trim(),
      p_message:message.trim(),
      p_app_version:Constants.expoConfig?.version || 'unknown',
      p_app_environment:appEnvironment,
      p_diagnostics:{
        online,
        role:profile?.role || null,
        has_church:!!profile?.church_id,
      }
    });
    setBusy(false);

    if(error)return Alert.alert('Could not send feedback',error.message);

    Alert.alert(
      'Feedback sent',
      `Thank you. Reference: ${String(data).slice(0,8).toUpperCase()}`
    );
    router.back();
  };

  return(
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>Send Feedback</Text>
      <Text style={shared.muted}>
        Report a bug, privacy concern, confusing workflow, content issue, or feature idea.
      </Text>

      <View style={styles.wrap}>
        {CATEGORIES.map(([value,label])=>(
          <Pressable key={value} onPress={()=>setCategory(value)}
            style={[styles.chip,category===value&&styles.chipOn]}>
            <Text style={{fontSize:11,fontWeight:'800'}}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <TextInput style={styles.input} value={title} onChangeText={setTitle}
          placeholder="Short title"/>
        <TextInput style={styles.area} value={message} onChangeText={setMessage}
          multiline placeholder="What happened? What did you expect?"/>
      </Card>

      <Card>
        <Text style={shared.h2}>Diagnostic information</Text>
        <Text style={shared.muted}>
          Version: {Constants.expoConfig?.version || '—'} • Environment: {appEnvironment} • Connection: {online?'online':'offline'}
        </Text>
        <Text style={[shared.muted,{marginTop:5}]}>
          BUKLOD does not attach private reflection, prayer-request, or pastoral-note text to this feedback.
        </Text>
      </Card>

      <Button title={busy?'SENDING...':'SEND FEEDBACK'} onPress={submit}/>
    </ScrollView>
  )
}

const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:20,paddingVertical:8,paddingHorizontal:10,backgroundColor:colors.white},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  input:{borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,marginBottom:8},
  area:{minHeight:150,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top'}
});
