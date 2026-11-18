import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Linking,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import {useAuth} from '@/providers/AuthProvider';
import {listBuklodIdentityPending,openBuklodPrivateId,reviewBuklodLegalIdentity,
 type BuklodIdentityReview} from '@/lib/buklodLegalIdentity';

export default function BuklodAdminIdentityReview(){
 const {hasRole}=useAuth();
 const [rows,setRows]=useState<BuklodIdentityReview[]>([]);
 const [observed,setObserved]=useState<Record<string,string>>({});
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{try{
  setRows(await listBuklodIdentityPending());setError('');
 }catch(e){setError(e instanceof Error?e.message:'Could not load ID review queue.');}},[]);
 useEffect(()=>{if(hasRole('system_admin'))void refresh();},[hasRole,refresh]);
 const view=async(path:string)=>{try{
  const url=await openBuklodPrivateId(path);await Linking.openURL(url);
 }catch(e){Alert.alert('Private ID',e instanceof Error?e.message:'ID unavailable.');}};
 const save=async(row:BuklodIdentityReview,approve:boolean)=>{
  const key=`${row.user_id}:${row.revision}`;
  if(approve&&!observed[key]?.trim()){
   Alert.alert('Inspect the ID','Type the exact name you read on the ID before approval.');return;
  }
  if(!approve&&(reasons[key]||'').trim().length<8){
   Alert.alert('Rejection reason','Provide a clear explanation to the member.');return;
  }
  setBusy(key);
  try{
   await reviewBuklodLegalIdentity({userId:row.user_id,revision:row.revision,
    approve,observedName:observed[key]||'',reason:reasons[key]||''});
   await refresh();
   Alert.alert('ID review',approve?'Legal name verified.':'ID rejected; member can resubmit.');
  }catch(e){Alert.alert('Review failed',e instanceof Error?e.message:'Review unavailable.');}
  finally{setBusy(null);}
 };
 if(!hasRole('system_admin'))return <View style={styles.screen}><Text>System Admin only.</Text></View>;
 return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
  <Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ BACK</Text></Pressable>
  <Text style={styles.title}>Government ID reviews</Text>
  <Text style={styles.note}>Open each private photo, inspect its authenticity and name, and enter the printed name. No self-approval; server-side permissions and revision locking apply.</Text>
  <Pressable onPress={()=>void refresh()}><Text style={styles.link}>REFRESH QUEUE</Text></Pressable>
  {!!error&&<Text style={styles.error}>{error}</Text>}
  {!rows.length&&!error&&<Text style={styles.note}>No pending IDs.</Text>}
  {rows.map(row=>{
   const key=`${row.user_id}:${row.revision}`;
   return <View key={key} style={styles.card}>
    <Text style={styles.name}>{row.legal_full_name}</Text>
    <Text style={styles.note}>{row.id_type} · {new Date(row.submitted_at).toLocaleDateString('en-PH')}</Text>
    <Pressable style={styles.outline} onPress={()=>void view(row.document_path)}>
     <Text style={styles.link}>VIEW PRIVATE ID (60-SECOND LINK)</Text>
    </Pressable>
    <TextInput style={styles.input} placeholder="Exact name printed on ID" placeholderTextColor="#8C9D93"
     value={observed[key]||''} onChangeText={value=>setObserved(prev=>({...prev,[key]:value}))}/>
    <TextInput style={styles.input} placeholder="Rejection reason" placeholderTextColor="#8C9D93"
     value={reasons[key]||''} onChangeText={value=>setReasons(prev=>({...prev,[key]:value}))}/>
    <View style={styles.row}>
     <Pressable disabled={busy===key} style={styles.outline} onPress={()=>void save(row,false)}>
      <Text style={styles.link}>REJECT</Text>
     </Pressable>
     <Pressable disabled={busy===key} style={styles.primary} onPress={()=>void save(row,true)}>
      {busy===key?<ActivityIndicator color="#fff"/>:<Text style={styles.white}>APPROVE ID</Text>}
     </Pressable>
    </View>
   </View>;
  })}
 </ScrollView>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#F9FBFA'},content:{padding:15,paddingBottom:90,gap:12},
 title:{fontSize:22,fontWeight:'900',color:'#163B27'},note:{color:'#566C5E',fontSize:12,lineHeight:18},
 link:{color:'#286F49',fontSize:12,fontWeight:'900'},
 card:{backgroundColor:'#fff',padding:14,gap:10,borderRadius:10,borderWidth:1,borderColor:'#D8E8DC'},
 name:{fontSize:15,fontWeight:'900',color:'#274332'},input:{backgroundColor:'#fff',fontSize:14,color:'#22392C',padding:11,borderWidth:1,borderColor:'#C8DDCE',borderRadius:8},
 row:{flexDirection:'row',gap:9,justifyContent:'flex-end'},outline:{padding:12,borderWidth:1,borderColor:'#43815C',borderRadius:8},
 primary:{padding:12,backgroundColor:'#267045',borderRadius:8},white:{color:'#fff',fontSize:12,fontWeight:'900'},
 error:{color:'#AA3030',fontSize:12}
});
