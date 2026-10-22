import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Profile = { id:string; full_name:string|null; mobile:string|null; is_active:boolean; is_verified?:boolean|null };
type Church = { id:string; name:string; code:string|null; is_active:boolean };
type Assignment = {
  assignment_id:string; pastor_id:string; pastor_name:string; church_id:string; church_name:string;
  is_active:boolean; assigned_at:string; ended_at:string|null; assignment_note:string|null; end_note:string|null;
};
type PickerMode = 'pastor'|'church';

const prettyDate=(value?:string|null)=>{ if(!value)return ''; const d=new Date(value); return Number.isNaN(d.getTime())?value:d.toLocaleDateString(); };

export default function PastorAssignmentsScreen(){
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [churches,setChurches]=useState<Church[]>([]);
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [pastorId,setPastorId]=useState('');
  const [churchId,setChurchId]=useState('');
  const [note,setNote]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [pickerMode,setPickerMode]=useState<PickerMode|null>(null);
  const [pickerSearch,setPickerSearch]=useState('');
  const [reassignFrom,setReassignFrom]=useState<Assignment|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    const [{data:p,error:pe},{data:c,error:ce},{data:a,error:ae}]=await Promise.all([
      supabase.from('profiles').select('id,full_name,mobile,is_active,is_verified').eq('is_active',true).eq('is_verified',true).order('full_name'),
      supabase.from('churches').select('id,name,code,is_active').eq('is_active',true).order('name'),
      (supabase as any).rpc('admin_get_pastor_church_assignments'),
    ]);
    if(pe) Alert.alert('Pastor Accounts',pe.message);
    if(ce) Alert.alert('Local Churches',ce.message);
    if(ae) Alert.alert('Pastor Assignments',ae.message);
    setProfiles((p??[]) as Profile[]); setChurches((c??[]) as Church[]);
    setAssignments(((a??[]) as Assignment[]).filter(x=>x.is_active)); setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const selectedPastor=profiles.find(x=>x.id===pastorId)??null;
  const selectedChurch=churches.find(x=>x.id===churchId)??null;
  const q=pickerSearch.trim().toLowerCase();
  const filteredProfiles=useMemo(()=>!q?profiles:profiles.filter(x=>String(x.full_name??'').toLowerCase().includes(q)||String(x.mobile??'').includes(q)),[profiles,q]);
  const filteredChurches=useMemo(()=>!q?churches:churches.filter(x=>x.name.toLowerCase().includes(q)||String(x.code??'').toLowerCase().includes(q)),[churches,q]);

  const assign=async()=>{
    if(!pastorId||!churchId) return Alert.alert('Pastor Assignment','Select a Pastor account and a Local Church.');
    setBusy(true);
    const {error}=await (supabase as any).rpc('admin_assign_pastor_to_church',{p_pastor_id:pastorId,p_church_id:churchId,p_note:note.trim()||null});
    setBusy(false);
    if(error) return Alert.alert('Could not assign Pastor',error.message);
    Alert.alert('Pastor Assigned','Pastor role was granted automatically if needed.'); setNote(''); await load();
  };

  const endAssignment=(item:Assignment)=>Alert.alert('End Pastor Assignment?',`${item.pastor_name} will no longer serve ${item.church_name} under this assignment.`,[
    {text:'CANCEL',style:'cancel'},
    {text:'END ASSIGNMENT',style:'destructive',onPress:async()=>{
      const {error}=await (supabase as any).rpc('admin_end_pastor_church_assignment',{p_assignment_id:item.assignment_id,p_note:'Ended from Pastor Local Assignments'});
      if(error) return Alert.alert('Could not end assignment',error.message); await load();
    }}
  ]);

  const confirmReassign=()=>{
    if(!reassignFrom||!churchId)return;
    if(churchId===reassignFrom.church_id)return Alert.alert('Choose another Local','The selected Local is the current assignment.');
    const target=churches.find(x=>x.id===churchId);
    Alert.alert('Reassign Pastor?',`Move ${reassignFrom.pastor_name} from ${reassignFrom.church_name} to ${target?.name??'the selected Local'}?`,[
      {text:'CANCEL',style:'cancel'},
      {text:'REASSIGN',onPress:async()=>{
        setBusy(true);
        const {error}=await (supabase as any).rpc('admin_reassign_pastor_church_assignment',{p_assignment_id:reassignFrom.assignment_id,p_new_church_id:churchId,p_note:note.trim()||null});
        setBusy(false);
        if(error)return Alert.alert('Could not reassign Pastor',error.message);
        setReassignFrom(null);setPastorId('');setChurchId('');setNote('');await load();
      }}
    ]);
  };

  return <AdminGate>
    <FlatList style={shared.screen} contentContainerStyle={styles.content} data={assignments} keyExtractor={x=>x.assignment_id} refreshing={loading} onRefresh={load}
      ListHeaderComponent={<View>
        <Text style={styles.eyebrow}>PEOPLE AND ORGANIZATION</Text><Text style={shared.h1}>Pastor Local Assignments</Text>
        <Text style={shared.muted}>Assign any verified account as Pastor. One Pastor may serve several Locals, and one Local may have several Pastors.</Text>
        <View style={styles.ruleBox}><Text style={styles.ruleTitle}>HOW IT WORKS</Text><Text style={styles.ruleText}>Assigning an account here automatically grants Pastor role. Ending one Local assignment does not remove other active Local assignments.</Text></View>
        <SectionTitle>{reassignFrom?'REASSIGN PASTOR':'ADD PASTOR ASSIGNMENT'}</SectionTitle>
        <Card>
          <Text style={styles.label}>PASTOR ACCOUNT</Text>
          <Pressable style={styles.selector} disabled={!!reassignFrom} onPress={()=>{setPickerSearch('');setPickerMode('pastor')}}>
            <View style={{flex:1}}><Text style={styles.selectorSmall}>{reassignFrom?'PASTOR TO REASSIGN':'SELECT PASTOR'}</Text><Text style={selectedPastor?styles.selectorValue:styles.placeholder}>{selectedPastor?.full_name??'Tap to search account'}</Text></View><Ionicons name="search-outline" size={20} color={colors.greenDark}/>
          </Pressable>
          <Text style={[styles.label,{marginTop:14}]}>LOCAL CHURCH</Text>
          <Pressable style={styles.selector} onPress={()=>{setPickerSearch('');setPickerMode('church')}}>
            <View style={{flex:1}}><Text style={styles.selectorSmall}>{reassignFrom?'NEW LOCAL CHURCH':'SELECT LOCAL'}</Text><Text style={selectedChurch?styles.selectorValue:styles.placeholder}>{selectedChurch?.name??'Tap to search Local Church'}</Text></View><Ionicons name="search-outline" size={20} color={colors.greenDark}/>
          </Pressable>
          <TextInput style={styles.input} placeholder="Assignment note (optional)" value={note} onChangeText={setNote}/>
          {reassignFrom?<><Text style={styles.warning}>Current Local: {reassignFrom.church_name}</Text><Button title={busy?'REASSIGNING...':'CONFIRM REASSIGNMENT'} onPress={confirmReassign}/><Button title="CANCEL REASSIGNMENT" outline onPress={()=>{setReassignFrom(null);setPastorId('');setChurchId('');setNote('')}}/></>:<Button title={busy?'ASSIGNING...':'ASSIGN PASTOR TO LOCAL'} onPress={assign}/>} 
        </Card>
        <SectionTitle>ACTIVE ASSIGNMENTS</SectionTitle>{loading&&<ActivityIndicator color={colors.green}/>} 
      </View>}
      ListEmptyComponent={!loading?<Card><Text style={shared.muted}>No active Pastor-to-Local assignments.</Text></Card>:null}
      renderItem={({item})=><Card>
        <Text style={styles.pastor}>{item.pastor_name}</Text><Text style={styles.church}>{item.church_name}</Text><Text style={styles.meta}>Assigned {prettyDate(item.assigned_at)}</Text>{!!item.assignment_note&&<Text style={styles.note}>{item.assignment_note}</Text>}
        <View style={styles.actions}><View style={{flex:1}}><Button title="REASSIGN" outline onPress={()=>{setPastorId(item.pastor_id);setChurchId('');setReassignFrom(item);setPickerSearch('');setPickerMode('church')}}/></View><View style={{flex:1}}><Button title="END" outline onPress={()=>endAssignment(item)}/></View></View>
      </Card>}/>

    <Modal visible={pickerMode!==null} transparent animationType="slide" onRequestClose={()=>setPickerMode(null)}>
      <View style={styles.overlay}><Pressable style={{flex:1}} onPress={()=>setPickerMode(null)}/><View style={styles.drawer}>
        <View style={styles.handle}/><View style={styles.drawerHeader}><View style={{flex:1}}><Text style={styles.drawerTitle}>{pickerMode==='pastor'?'Select Pastor Account':'Select Local Church'}</Text><Text style={styles.help}>Search then tap one item.</Text></View><Pressable style={styles.close} onPress={()=>setPickerMode(null)}><Ionicons name="close" size={23} color={colors.text}/></Pressable></View>
        <View style={styles.searchRow}><Ionicons name="search-outline" size={19} color={colors.muted}/><TextInput style={{flex:1,paddingVertical:12}} placeholder={pickerMode==='pastor'?'Search name or mobile...':'Search Local Church...'} value={pickerSearch} onChangeText={setPickerSearch}/></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:7,paddingTop:10,paddingBottom:20}}>
          {pickerMode==='pastor'?filteredProfiles.map(x=><Pressable key={x.id} style={[styles.item,pastorId===x.id&&styles.itemOn]} onPress={()=>{setPastorId(x.id);setPickerMode(null)}}><View style={{flex:1}}><Text style={styles.itemName}>{x.full_name||'Unnamed Account'}</Text>{!!x.mobile&&<Text style={styles.itemMeta}>{x.mobile}</Text>}</View>{pastorId===x.id&&<Ionicons name="checkmark-circle" size={22} color={colors.green}/>}</Pressable>):filteredChurches.map(x=><Pressable key={x.id} style={[styles.item,churchId===x.id&&styles.itemOn]} onPress={()=>{setChurchId(x.id);setPickerMode(null)}}><View style={{flex:1}}><Text style={styles.itemName}>{x.name}</Text>{!!x.code&&<Text style={styles.itemMeta}>{x.code}</Text>}</View>{churchId===x.id&&<Ionicons name="checkmark-circle" size={22} color={colors.green}/>}</Pressable>)}
        </ScrollView>
      </View></View>
    </Modal>
  </AdminGate>;
}

const styles=StyleSheet.create({
  content:{padding:18,paddingBottom:40},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:.8,color:colors.greenDark,marginBottom:4},
  ruleBox:{marginTop:12,padding:12,borderRadius:12,backgroundColor:'#F2F6F3',borderWidth:1,borderColor:colors.line},ruleTitle:{fontSize:10,fontWeight:'900',color:colors.greenDark},ruleText:{marginTop:5,fontSize:12,lineHeight:18,color:colors.text},
  label:{fontSize:10,fontWeight:'900',letterSpacing:.6,color:colors.muted},selector:{marginTop:7,minHeight:58,borderWidth:1,borderColor:colors.line,borderRadius:12,backgroundColor:colors.white,padding:12,flexDirection:'row',alignItems:'center',gap:10},selectorSmall:{fontSize:9,fontWeight:'900',color:colors.muted},selectorValue:{marginTop:3,fontSize:14,fontWeight:'900',color:colors.greenDark},placeholder:{marginTop:3,fontSize:13,color:colors.muted},
  input:{marginTop:12,marginBottom:9,borderWidth:1,borderColor:colors.line,borderRadius:12,backgroundColor:colors.white,padding:12},warning:{fontSize:12,fontWeight:'800',color:'#8A5A12',marginBottom:8},pastor:{fontSize:17,fontWeight:'900',color:colors.text},church:{marginTop:3,fontSize:14,fontWeight:'900',color:colors.greenDark},meta:{marginTop:6,fontSize:11,color:colors.muted},note:{marginTop:7,fontSize:12,lineHeight:18,color:colors.text},actions:{flexDirection:'row',gap:8,marginTop:10},
  overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.35)'},drawer:{maxHeight:'78%',minHeight:'55%',backgroundColor:colors.background,borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:18,paddingTop:9,paddingBottom:24},handle:{width:42,height:5,borderRadius:999,alignSelf:'center',marginBottom:12,backgroundColor:colors.line},drawerHeader:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12},drawerTitle:{fontSize:20,fontWeight:'900',color:colors.text},help:{fontSize:11,lineHeight:17,color:colors.muted},close:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:colors.white},searchRow:{flexDirection:'row',alignItems:'center',gap:8,borderWidth:1,borderColor:colors.line,borderRadius:12,paddingHorizontal:12,backgroundColor:colors.white},item:{minHeight:58,paddingHorizontal:13,paddingVertical:11,borderWidth:1,borderColor:colors.line,borderRadius:12,backgroundColor:colors.white,flexDirection:'row',alignItems:'center',gap:10},itemOn:{borderColor:colors.green,backgroundColor:colors.greenSoft},itemName:{fontSize:14,fontWeight:'900',color:colors.text},itemMeta:{marginTop:3,fontSize:11,color:colors.muted}
});