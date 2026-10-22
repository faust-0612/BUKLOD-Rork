import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

type Diagnostics = Record<string,string|number|boolean|null>;
export default function BuklodSupportCheckR2({onDiagnostics}:{onDiagnostics:(value:Diagnostics)=>void}) {
  const {user}=useAuth();
  const {isConnected,isInternetReachable}=useNetwork();
  const account=useRef(user?.id);account.current=user?.id;
  const [busy,setBusy]=useState(false),[report,setReport]=useState<Diagnostics|null>(null),[error,setError]=useState('');
  const running=useRef(false);
  async function check(repair=false) {
    if(running.current)return;
    running.current=true;setBusy(true);setError('');
    const owner=user?.id;
    const online=isConnected&&isInternetReachable!==false;
    const result:Diagnostics={check_network:online?'online':'offline',runtime_version:String(Constants.expoConfig?.runtimeVersion??''),check_repair:'not attempted'};
    try {
      const session=await withBuklodTimeout(supabase.auth.getSession(),5000,'Session check');
      if(account.current!==owner)return;
      result.check_session=session.error?'unavailable':session.data.session?.user.id===owner&&owner?'signed in':'signed out';
      if(repair&&online&&owner&&session.data.session?.user.id===owner) {
        const refreshed=await withBuklodTimeout(supabase.auth.refreshSession(),7000,'Safe session refresh');
        if(account.current!==owner)return;
        result.check_repair=!refreshed.error&&refreshed.data.session?.user.id===owner?'session refreshed':'refresh unavailable';
      }
      const key='@buklod/check-r2/'+Date.now()+'-'+Math.random().toString(36).slice(2);
      try {
        await withBuklodTimeout(AsyncStorage.setItem(key,'check'),4000,'Storage check');
        result.check_storage=await withBuklodTimeout(AsyncStorage.getItem(key),4000,'Storage read')==='check'?'available':'unavailable';
      } catch {result.check_storage='unavailable';}
      finally {void AsyncStorage.removeItem(key).catch(()=>undefined);}
      try {result.check_notifications=(await withBuklodTimeout(Notifications.getPermissionsAsync(),4000,'Notification permission check')).status;}
      catch {result.check_notifications='unavailable';}
      if(account.current!==owner)return;
      setReport(result);onDiagnostics(result);
    } catch {if(account.current===owner)setError('Check unavailable. Your data has been retained.');}
    finally {running.current=false;setBusy(false);}
  }
  return <View style={{padding:14,gap:10,borderWidth:1,borderColor:'#DCE5E0',borderRadius:14,marginVertical:12}}>
    <Text style={{fontWeight:'800'}}>Check &amp; Fix R2</Text>
    <Text>Check connection, session, local storage and notification permission. Safe fix refreshes your current session, then rechecks.</Text>
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void check()} style={{minHeight:44,justifyContent:'center'}}><Text>Run self-check</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={busy||!isConnected} onPress={()=>void check(true)} style={{minHeight:44,justifyContent:'center'}}><Text>Safe fix &amp; recheck</Text></Pressable>
    {busy&&<ActivityIndicator accessibilityLabel="Checking app"/>}
    {report&&Object.entries(report).map(([key,value])=><Text key={key}>{key.replace(/^check_/,'').replace(/_/g,' ')}: {String(value)}</Text>)}
    {!!error&&<Text accessibilityRole="alert">{error}</Text>}
    <Text>Diagnostics contain status only. Use the issue form below to request support; a case is confirmed only after the service returns a case code.</Text>
  </View>;
}
