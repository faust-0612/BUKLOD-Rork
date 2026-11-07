import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {colors} from '@/lib/theme';

type Candidate={user_id:string;full_name:string|null;username:string|null;masked_mobile:string|null;is_active:boolean};
type Staff={user_id:string;full_name:string|null;role_key:string;assignment_status:string;training_status:string;certification_version:string|null;production_access_enabled:boolean};
type Role={role_key:string;display_name:string;description:string;permissions:string[]};
type Invite={access_code:string;expires_at:string;role_key:string;invite_id:string};

export default function BsocPersonnelAuthorization(){
 const [isAdmin,setIsAdmin]=useState<boolean|null>(null);
 const [query,setQuery]=useState(''),[results,setResults]=useState<Candidate[]>([]);
 const [roles,setRoles]=useState<Role[]>([]),[staff,setStaff]=useState<Staff[]>([]);
 const [selected,setSelected]=useState<Candidate|null>(null),[role,setRole]=useState('BSOC_SUPPORT_AGENT');
 const [reason,setReason]=useState(''),[invitation,setInvitation]=useState<Invite|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const [selectedStaff,setSelectedStaff]=useState<Staff|null>(null);
 const [manageReason,setManageReason]=useState('');
 const friendly=(v:unknown)=>String((v as any)?.message||v||'Request failed');
 const init=useCallback(async()=>{
  const {data}=await supabase.rpc('buklod_bsoc_my_access_v1');
  const authorized=data?.is_system_admin===true;
  setIsAdmin(authorized);
  if(!authorized)return;
  const [a,b]=await Promise.all([
   supabase.rpc('buklod_bsoc_role_catalog_v1'),
   supabase.rpc('buklod_bsoc_staff_list_v1')
  ]);
  if(a.error||b.error){setError(a.error?.message||b.error?.message||'Could not load personnel');return;}
  setRoles(Array.isArray(a.data?.roles)?a.data.roles:[]);
  setStaff(Array.isArray(b.data)?b.data:[]);
 },[]);
 useEffect(()=>{void init();},[init]);
 const search=async()=>{
  if(query.trim().length<2||busy)return;
  setBusy(true);setError('');setSelected(null);setInvitation(null);
  try{
   const {data,error:e}=await supabase.rpc('buklod_bsoc_staff_candidate_lookup_v1',{p_query:query.trim(),p_limit:20});
   if(e)throw e;
   setResults((data||[]) as Candidate[]);
  }catch(e){setError(friendly(e));}finally{setBusy(false);}
 };
 const authorize=async()=>{
  if(!selected||reason.trim().length<8||busy)return;
  setBusy(true);setError('');setInvitation(null);
  try{
   const {data,error:e}=await supabase.rpc('buklod_bsoc_issue_personnel_code_v1',{
    p_user_id:selected.user_id,p_role_key:role,p_reason:reason.trim(),
   });
   if(e)throw e;
   if(!data?.ok)throw Error(data?.error||'Authorization failed');
   setInvitation(data as Invite);
   setNotice('A one-time code is ready. Share it privately with the selected BUKLOD member.');
   setResults([]);setReason('');
  }catch(e){setError(friendly(e));}finally{setBusy(false);}
 };
 const revoke=async()=>{
  if(!selectedStaff||manageReason.trim().length<8||busy)return;
  setBusy(true);setError('');
  try{
   const {data,error:e}=await supabase.rpc('buklod_bsoc_revoke_role_v1',{
    p_user_id:selectedStaff.user_id,p_role_key:selectedStaff.role_key,p_reason:manageReason.trim()
   });
   if(e)throw e;
   if(!data?.ok)throw Error('Revoke failed');
   setSelectedStaff(null);setManageReason('');setNotice('Role revoked; changes are audited.');
   await init();
  }catch(e){setError(friendly(e));}finally{setBusy(false);}
 };
 if(isAdmin===null)return <View style={styles.page}><ActivityIndicator color={colors.green}/></View>;
 if(!isAdmin)return <View style={styles.page}><Text style={styles.heading}>System Administrator authorization required</Text></View>;
 return <ScrollView style={styles.page} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
  <Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ BSOC Operations</Text></Pressable>
  <Text style={styles.heading}>BSOC · Authorize Personnel</Text>
  <Text style={styles.hint}>Only the System Administrator can issue or revoke access. Search an existing BUKLOD member, select their limited role, then issue a one-time account-bound code.</Text>
  {!!error&&<Text style={styles.error} accessibilityRole="alert">{error}</Text>}
  {!!notice&&<Text style={styles.success}>{notice}</Text>}
  <View style={styles.card}>
   <Text style={styles.title}>1. Search a member</Text>
   <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Name or BUKLOD username" autoCapitalize="words"/>
   <Pressable style={styles.button} disabled={busy||query.trim().length<2} onPress={()=>void search()}>
    <Text style={styles.btnText}>{busy?'Searching…':'Search personnel'}</Text>
   </Pressable>
   {results.map(user=><Pressable key={user.user_id} style={[styles.item,selected?.user_id===user.user_id&&styles.selected]}
     accessibilityRole="button" onPress={()=>{setSelected(user);setInvitation(null);}}>
    <Text style={styles.title}>{user.full_name||user.username||'Member'}</Text>
    <Text style={styles.hint}>@{user.username||'—'} · {user.masked_mobile||'No mobile displayed'} · {user.is_active?'Active':'Inactive'}</Text>
   </Pressable>)}
   {selected&&<View style={styles.cardInner}>
    <Text style={styles.title}>2. Authorize {selected.full_name||selected.username}</Text>
    <Text style={styles.hint}>Choose only the capabilities this person needs. A code alone cannot bypass training or authentication.</Text>
    {roles.map(r=><Pressable key={r.role_key} onPress={()=>setRole(r.role_key)}
      style={[styles.item,role===r.role_key&&styles.selected]}>
      <Text style={styles.title}>{role===r.role_key?'◉':'○'} {r.display_name}</Text>
      <Text style={styles.hint}>{r.description}</Text>
    </Pressable>)}
    <Text style={styles.hint}>Audit reason (minimum 8 characters)</Text>
    <TextInput style={[styles.input,styles.multiline]} multiline value={reason} onChangeText={setReason}
      placeholder="Why is this member being authorized?"/>
    <Pressable style={styles.button} disabled={!selected.is_active||busy||reason.trim().length<8} onPress={()=>void authorize()}>
      <Text style={styles.btnText}>Authorize and generate access code</Text>
    </Pressable>
   </View>}
   {!!invitation&&<View style={styles.codeBox}>
    <Text style={styles.title}>One-time personnel access code</Text>
    <Text selectable style={styles.code}>{invitation.access_code}</Text>
    <Text style={styles.hint}>Expires: {new Date(invitation.expires_at).toLocaleString()} · One use only · Bound to selected member's account.</Text>
    <Pressable style={styles.button} onPress={()=>void Clipboard.setStringAsync(invitation.access_code)}>
      <Text style={styles.btnText}>Copy code for secure delivery</Text>
    </Pressable>
    <Text style={styles.hint}>The code will not be displayed again after leaving this screen. Use secure direct delivery, not public chat or group posts.</Text>
   </View>}
  </View>
  <View style={styles.card}>
   <Text style={styles.title}>Authorized BSOC personnel</Text>
   <Pressable onPress={()=>void init()}><Text style={styles.link}>Refresh role assignments</Text></Pressable>
   {staff.length===0&&<Text style={styles.hint}>No BSOC role assignments found.</Text>}
   {staff.map((x,i)=><Pressable key={x.user_id+x.role_key+i} style={styles.item} onPress={()=>setSelectedStaff(x)}>
    <Text style={styles.title}>{x.full_name||'Member'} · {x.role_key}</Text>
    <Text style={styles.hint}>{x.assignment_status} · Training: {x.training_status} · Production access: {x.production_access_enabled?'Enabled':'Not yet'}</Text>
   </Pressable>)}
   {selectedStaff&&<View style={styles.cardInner}>
    <Text style={styles.title}>Revoke {selectedStaff.role_key}?</Text>
    <Text style={styles.hint}>Only this role will be revoked. Authentication remains unchanged.</Text>
    <TextInput style={[styles.input,styles.multiline]} value={manageReason} onChangeText={setManageReason} multiline placeholder="Reason for revoking this role"/>
    <Pressable style={styles.danger} disabled={busy||manageReason.trim().length<8} onPress={()=>void revoke()}>
      <Text style={styles.btnText}>Revoke role (audited)</Text>
    </Pressable>
   </View>}
  </View>
 </ScrollView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.white},content:{padding:18,paddingBottom:95,gap:13},
 heading:{fontSize:24,fontWeight:'800',color:colors.text},title:{fontSize:15,fontWeight:'800',color:colors.text},
 hint:{fontSize:12,color:'#64748b',lineHeight:19},link:{color:colors.green,fontWeight:'800'},
 card:{padding:16,gap:12,borderRadius:14,borderWidth:1,borderColor:'#d8e6e0'},
 cardInner:{gap:10,padding:12,borderRadius:12,backgroundColor:'#f1f5f9'},
 item:{padding:11,borderWidth:1,borderColor:'#d9e5e0',borderRadius:9,gap:5},
 selected:{borderColor:colors.green,backgroundColor:'#e7f7ef'},
 input:{borderWidth:1,borderRadius:10,borderColor:'#cbd5e1',padding:12,color:colors.text},
 multiline:{minHeight:72,textAlignVertical:'top'},
 button:{backgroundColor:colors.green,padding:13,alignItems:'center',borderRadius:10},
 danger:{backgroundColor:'#991b1b',padding:13,alignItems:'center',borderRadius:10},
 btnText:{color:colors.white,fontWeight:'800'},error:{color:'#991b1b',backgroundColor:'#fee2e2',padding:12},
 success:{color:'#166534',backgroundColor:'#dcfce7',padding:12},
 codeBox:{gap:10,padding:14,backgroundColor:'#e4f4ea',borderRadius:11},
 code:{fontSize:18,fontWeight:'800',letterSpacing:1,color:colors.text}
});
