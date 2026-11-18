import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import type * as ImagePicker from 'expo-image-picker';
import {useAuth} from '@/providers/AuthProvider';
import {getMyBuklodLegalIdentityStatus,pickBuklodLegalIdPhoto,submitMyBuklodLegalIdentity,
 type BuklodLegalIdType,type BuklodLegalIdentityStatus} from '@/lib/buklodLegalIdentity';

const types:{id:BuklodLegalIdType;label:string}[]=[
 {id:'PHILSYS',label:'PhilSys / National ID'},{id:'PASSPORT',label:'Passport'},
 {id:'DRIVERS_LICENSE',label:'Driver’s License'},{id:'UMID',label:'UMID'},
 {id:'POSTAL_ID',label:'Postal ID'},{id:'OTHER_GOV_ID',label:'Other government-issued ID'}
];

export default function BuklodIdentityVerificationScreen(){
 const {profile,refreshProfile}=useAuth();
 const [status,setStatus]=useState<BuklodLegalIdentityStatus|null>(null);
 const [first,setFirst]=useState(profile?.first_name||'');
 const [middle,setMiddle]=useState(profile?.middle_name||'');
 const [surname,setSurname]=useState(profile?.surname||'');
 const [suffix,setSuffix]=useState(profile?.suffix||'');
 const [type,setType]=useState<BuklodLegalIdType>('PHILSYS');
 const [photo,setPhoto]=useState<ImagePicker.ImagePickerAsset|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{try{
  setStatus(await getMyBuklodLegalIdentityStatus());setError('');
 }catch(e){setError(e instanceof Error?e.message:'Unable to read verification status.');}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 const submit=async()=>{
  if(busy||!photo)return;
  if(!first.trim()||!surname.trim()){
   Alert.alert('Legal name','First name and surname are required.');return;
  }
  setBusy(true);
  try{
   await submitMyBuklodLegalIdentity({firstName:first,middleName:middle,surname,suffix,idType:type,photo});
   setPhoto(null);await refresh();await refreshProfile();
   Alert.alert('ID submitted','Your old name remains until your government ID is approved. Withdrawals stay locked meanwhile.');
  }catch(e){Alert.alert('ID verification',e instanceof Error?e.message:'Unable to submit ID.');}
  finally{setBusy(false);}
 };
 return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
  <Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ BACK</Text></Pressable>
  <Text style={styles.title}>Verify your real name</Text>
  <Text style={styles.note}>A real government ID is required before changing your existing name or withdrawing cash. Aliases are not accepted.</Text>
  <View style={styles.banner}>
   <Text style={styles.bold}>ID status: {status?.status||'LOADING'}</Text>
   {!!status?.legal_full_name&&<Text style={styles.note}>Approved name: {status.legal_full_name}</Text>}
   {!!status?.rejected_reason&&<Text style={styles.error}>{status.rejected_reason}</Text>}
   {!!error&&<Text style={styles.error}>{error}</Text>}
   <Pressable onPress={()=>void refresh()}><Text style={styles.link}>REFRESH STATUS</Text></Pressable>
  </View>
  <Text style={styles.bold}>Exact legal name on your ID</Text>
  {([
   ['First name',first,setFirst],['Middle name',middle,setMiddle],
   ['Surname',surname,setSurname],['Suffix',suffix,setSuffix]
  ] as const).map(([label,value,set])=><View key={label} style={styles.field}>
   <Text style={styles.note}>{label}</Text>
   <TextInput style={styles.input} value={value} onChangeText={set} autoCapitalize="words"
    placeholder={label} placeholderTextColor="#809286"/>
  </View>)}
  <Text style={styles.bold}>Government ID type</Text>
  {types.map(item=><Pressable key={item.id} onPress={()=>setType(item.id)}
    style={[styles.choice,type===item.id&&styles.selected]}>
   <Text style={styles.note}>{type===item.id?'●':'○'} {item.label}</Text>
  </Pressable>)}
  <Text style={styles.bold}>Secure government ID photo</Text>
  <Text style={styles.note}>Use a clear JPG/PNG photo of your ID showing the name. Maximum 5 MB. Your ID will never appear on your public profile or Wall.</Text>
  <Pressable disabled={busy} style={styles.secondary} onPress={()=>{
   void pickBuklodLegalIdPhoto().then(value=>{if(value)setPhoto(value);})
    .catch(e=>Alert.alert('Photo',e instanceof Error?e.message:'Cannot select ID image.'));
  }}><Text style={styles.link}>{photo?'CHANGE ID PHOTO':'SELECT ID PHOTO'}</Text></Pressable>
  <Text style={styles.note}>{photo?'ID photo selected (hidden for privacy).':'No ID photo selected.'}</Text>
  <Pressable disabled={busy||!photo} onPress={()=>void submit()}
    style={[styles.primary,(busy||!photo)&&{opacity:0.5}]}>
   {busy?<ActivityIndicator color="#fff"/>:<Text style={styles.white}>SUBMIT FOR VERIFICATION</Text>}
  </Pressable>
  <Text style={styles.note}>Only authorized reviewers can inspect this private ID. Any new legal-name submission suspends previous withdrawal verification until approved.</Text>
 </ScrollView>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#F9FBFA'},content:{padding:16,paddingBottom:90,gap:10},
 title:{fontSize:23,color:'#183C28',fontWeight:'900'},
 note:{color:'#51695B',fontSize:12,lineHeight:17},bold:{fontSize:13,fontWeight:'900',color:'#285137'},
 banner:{backgroundColor:'#EAF6EE',padding:12,borderRadius:10,gap:6},
 field:{gap:5},input:{backgroundColor:'#fff',color:'#153225',fontSize:15,borderWidth:1,borderColor:'#CADCCC',borderRadius:8,padding:12},
 choice:{backgroundColor:'#fff',padding:10,borderWidth:1,borderColor:'#D5E7DA',borderRadius:8},
 selected:{backgroundColor:'#E7F5EA',borderColor:'#26824F'},
 secondary:{borderColor:'#26824F',borderWidth:1,alignItems:'center',padding:13,borderRadius:8},
 primary:{backgroundColor:'#287044',padding:15,alignItems:'center',borderRadius:9},
 link:{color:'#237646',fontWeight:'800',fontSize:12},white:{color:'#fff',fontWeight:'900',fontSize:12},
 error:{color:'#A32929',fontSize:12}
});
