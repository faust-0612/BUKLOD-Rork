import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, Text, TextInput, View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Channel = 'email'|'mobile';
type Phase = 'loading'|'choose'|'otp'|'complete'|'unavailable';
type ServiceStatus = { needsMigration?: boolean; emailReady?: boolean; smsReady?: boolean };

export default function LegacyLoginContactMigration() {
  const [phase,setPhase]=useState<Phase>('loading');
  const [channel,setChannel]=useState<Channel>('email');
  const [destination,setDestination]=useState('');
  const [currentPassword,setCurrentPassword]=useState('');
  const [code,setCode]=useState('');
  const [challengeId,setChallengeId]=useState('');
  const [service,setService]=useState<ServiceStatus|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const inFlight=useRef(false);
  useEffect(()=>{
    let active=true;
    void (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user) {if(active)setPhase('unavailable');return;}
      const {data:profile,error}=await supabase.from('profiles')
        .select('login_method').eq('id',user.id).maybeSingle();
      if(!active)return;
      if(error){setPhase('unavailable');return;}
      if(profile?.login_method!=='username'){setPhase('complete');return;}
      const {data, error:statusError}=await supabase.functions.invoke(
        'buklod-legacy-contact-migrate',{body:{action:'status'}});
      if(!active)return;
      if(statusError||!data?.ok){
        setPhase('unavailable');
        setMessage('Username migration requires the protected verification service. Your old account is preserved; contact BUKLOD Support if this screen stays unavailable.');
        return;
      }
      setService(data);
      if(data.pendingChallenge?.id){
        setChallengeId(data.pendingChallenge.id);
        setChannel(data.pendingChallenge.channel==='mobile'?'mobile':'email');
        setDestination(data.pendingChallenge.destinationHint||'your contact');
        setMessage(data.pendingChallenge.status==='VERIFIED'
          ?'Your code is already verified. Select Retry finishing migration below.'
          :'Enter your code, or contact support if it has expired.');
        setPhase('otp');
      }else{
        setChannel(data.emailReady?'email':'mobile');
        setPhase('choose');
      }
    })().catch(()=>{
      if(active){setPhase('unavailable');setMessage('Cannot check migration right now. Your account remains active.');}
    });
    return()=>{active=false;};
  },[]);

  const invoke=async(action:'request'|'verify'|'finalize')=>{
    if(inFlight.current)return;
    if(action==='request'&&currentPassword.length<6){
      Alert.alert('Current password','Enter the password for this existing BUKLOD account.');
      return;
    }
    if(action==='request'&&((channel==='email'&&!service?.emailReady)||(channel==='mobile'&&!service?.smsReady))){
      Alert.alert('Delivery unavailable',
        channel==='email'?'Email verification is not yet configured. Try mobile or contact support.'
          :'SMS verification needs a provider. Choose email or contact support.');
      return;
    }
    if(action==='verify'&&!/^\d{6}$/.test(code.trim())){
      Alert.alert('Verification code','Enter the six-digit code sent to you.');
      return;
    }
    inFlight.current=true;
    setBusy(true);setMessage(action==='request'?'Sending verification…':'Verifying and linking your contact…');
    try{
      const {data,error}=await supabase.functions.invoke('buklod-legacy-contact-migrate',{
        body:{action,channel,destination,currentPassword:action==='request'?currentPassword:undefined,
          code:action==='verify'?code.trim():undefined,challengeId},
      });
      if(error||!data?.ok)throw new Error(String(data?.message||error?.message||'Verification unavailable'));
      if(action==='request'){
        setCurrentPassword('');
        setChallengeId(data.challengeId);
        setPhase('otp');
        setMessage('Enter the code sent to '+(data.destinationHint||'your contact')+'. The code expires in 10 minutes.');
      }else if(data.completed||data.alreadyMigrated){
        setPhase('complete');
        setCode('');
        setCurrentPassword('');
        setMessage('Verified and linked to the same BUKLOD account. Next sign-in: use your new '+channel+' and existing password. Your posts, points and history remain intact.');
      }else{
        setMessage(String(data.message||'Migration still pending.'));
      }
    }catch(err:any){
      setMessage(String(err?.message||'Unable to complete contact verification.'));
    }finally{
      inFlight.current=false;setBusy(false);
    }
  };
  if(phase==='loading')return <ActivityIndicator color={colors.green}/>;
  if(phase==='complete'&&!message)return null;
  const control={
    color:colors.text,fontSize:16,borderWidth:1,borderColor:colors.line,
    borderRadius:10,paddingHorizontal:12,paddingVertical:11,backgroundColor:colors.white,
  } as const;
  const actionStyle={
    padding:12,borderRadius:10,backgroundColor:colors.greenDark,alignItems:'center',
  } as const;
  return <View style={{padding:12,borderWidth:1,borderColor:colors.green,borderRadius:14,gap:9,backgroundColor:colors.white}}>
    <Text style={{fontWeight:'900',fontSize:16,color:colors.greenDark}}>Update your old username login</Text>
    <Text style={{fontSize:13,color:colors.text}}>
      Ang username ay hindi na para sa bagong login. Piliin ang iyong email o mobile,
      patunayan sa verification code, at manatili sa dati mong BUKLOD account.
      Walang bagong registration, account deletion o points reset.
    </Text>
    {phase==='unavailable'&&<Text style={{color:'#9A3412'}}>Verification service is not available yet. Do not create another account. Use BUKLOD Support or try again later.</Text>}
    {phase==='choose'&&<>
      <View style={{flexDirection:'row',gap:8}}>
        {(['email','mobile'] as const).map(option=>
          <Pressable key={option} accessibilityRole="button"
            onPress={()=>{setChannel(option);setDestination('');setMessage('');}}
            style={{paddingVertical:10,paddingHorizontal:13,borderRadius:9,borderWidth:1,
              borderColor:channel===option?colors.greenDark:colors.line,
              backgroundColor:channel===option?'#EAF4EC':colors.white}}>
            <Text style={{fontWeight:'800',color:colors.greenDark}}>{option==='email'?'Email':'Mobile'}</Text>
          </Pressable>
        )}
      </View>
      <TextInput accessibilityLabel="New verified login destination"
        autoCapitalize="none" autoCorrect={false}
        keyboardType={channel==='email'?'email-address':'phone-pad'}
        placeholder={channel==='email'?'your@email.com':'09XXXXXXXXX'}
        value={destination} onChangeText={setDestination} style={control}/>
      {channel==='mobile'&&!service?.smsReady&&
        <Text style={{color:'#9A3412'}}>SMS verification needs a configured provider. Email can be used instead if enabled.</Text>}
      {channel==='email'&&!service?.emailReady&&
        <Text style={{color:'#9A3412'}}>Email verification is currently unavailable; choose mobile if ready or contact support.</Text>}
      <TextInput accessibilityLabel="Existing account password"
        placeholder="Current password (for security)" secureTextEntry
        value={currentPassword} onChangeText={setCurrentPassword} style={control}/>
      <Pressable accessibilityRole="button" disabled={busy}
        onPress={()=>void invoke('request')}
        style={[actionStyle,busy&&{opacity:0.5}]}>
        <Text style={{fontWeight:'900',color:colors.white}}>{busy?'PROCESSING…':'SEND VERIFICATION CODE'}</Text>
      </Pressable>
    </>}
    {phase==='otp'&&<>
      <Text style={{color:colors.text}}>Code sent to {destination}. Check your email or mobile messages.</Text>
      <TextInput accessibilityLabel="Six-digit verification code"
        keyboardType="number-pad" maxLength={6} placeholder="000000"
        value={code} onChangeText={setCode} style={control}/>
      <Pressable disabled={busy} onPress={()=>void invoke('verify')} style={[actionStyle,busy&&{opacity:0.5}]}>
        <Text style={{fontWeight:'900',color:colors.white}}>{busy?'VERIFYING…':'VERIFY AND UPDATE LOGIN'}</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={()=>void invoke('finalize')}>
        <Text style={{color:colors.greenDark,fontWeight:'700'}}>Code already verified? Retry finishing migration.</Text>
      </Pressable>
    </>}
    {!!message&&<Text accessibilityLiveRegion="polite" style={{color:phase==='complete'?colors.greenDark:colors.text}}>{message}</Text>}
  </View>;
}
