import { useEffect, useMemo, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type MemberOption={id:string;full_name:string|null;role:string};
type MenteeLinkRequest={id:string;mentor_id:string;mentor_name:string;mentee_name:string;created_at:string};
const normalize=(value:string)=>value.toLocaleLowerCase().trim();
export default function MentorAssignmentsAdmin() {
  const [members,setMembers]=useState<MemberOption[]>([]);
  const [mentorId,setMentorId]=useState('');
  const [discipleId,setDiscipleId]=useState('');
  const [mentorSearch,setMentorSearch]=useState('');
  const [learnerSearch,setLearnerSearch]=useState('');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [linkRequests,setLinkRequests]=useState<MenteeLinkRequest[]>([]);
  const [linkQueueEnabled,setLinkQueueEnabled]=useState(false);
  const [reviewRequestId,setReviewRequestId]=useState('');
  const [reviewSearch,setReviewSearch]=useState('');
  const [reviewLearnerId,setReviewLearnerId]=useState('');
  const [reviewNote,setReviewNote]=useState('');
  useEffect(()=>{
    let live=true;
    void supabase.from('profiles').select('id,full_name,role').eq('is_active',true)
      .order('full_name').then(({data,error})=>{
        if(!live)return;
        if(error)Alert.alert('Could not load members',error.message);
        else setMembers((data??[]) as MemberOption[]);
      });
    return()=>{live=false};
  },[]);

  const loadLinkRequests=async()=>{
    const {data,error}=await (supabase as any).rpc('admin_pending_mentee_link_requests_v1');
    if(error){setLinkQueueEnabled(false);setLinkRequests([]);return;}
    setLinkQueueEnabled(true);
    setLinkRequests(Array.isArray(data)?data:[]);
  };
  useEffect(()=>{void loadLinkRequests()},[]);

  const reviewLearners=useMemo(()=>reviewSearch.trim().length>=2
    ? members.filter(x=>x.id!==linkRequests.find(r=>r.id===reviewRequestId)?.mentor_id
      && normalize(x.full_name??'').includes(normalize(reviewSearch))).slice(0,30)
    :[],[members,reviewSearch,reviewRequestId,linkRequests]);
  const selectedLink=linkRequests.find(x=>x.id===reviewRequestId);

  const reviewLink=async(approve:boolean)=>{
    if(busy||!selectedLink)return;
    if(approve&&!reviewLearnerId)
      return Alert.alert('Choose verified mentee','Search and select the actual registered BUKLOD member first.');
    if(reviewNote.trim().length<12)
      return Alert.alert('Review note required','Write at least 12 characters explaining how the member was verified or why the request was rejected.');
    setBusy(true);
    try{
      const {error}=await (supabase as any).rpc('admin_review_mentee_link_request_v1',{
        p_request_id:selectedLink.id,p_disciple_id:approve?reviewLearnerId:null,
        p_approve:approve,p_review_note:reviewNote.trim()
      });
      if(error)throw error;
      setReviewRequestId('');setReviewSearch('');setReviewLearnerId('');setReviewNote('');
      await loadLinkRequests();
      Alert.alert(approve?'Mentee linked':'Request declined',approve
        ? 'The verified member is now in the mentor\'s assigned attendee list.'
        : 'The request was reviewed without creating a mentor assignment.');
    }catch(error){
      Alert.alert('Review not saved',error instanceof Error?error.message:String(error));
    }finally{setBusy(false);}
  };

  const mentors=useMemo(()=>mentorSearch.trim().length>=2
    ? members.filter(x=>x.role!=='system_admin' && normalize(x.full_name??'').includes(normalize(mentorSearch))).slice(0,30)
    :[],[members,mentorSearch]);
  const learners=useMemo(()=>learnerSearch.trim().length>=2
    ? members.filter(x=>x.id!==mentorId && normalize(x.full_name??'').includes(normalize(learnerSearch))).slice(0,30)
    :[],[members,learnerSearch]);
  const chosenMentor=members.find(x=>x.id===mentorId);

  const activatePermission=()=>{
    if(busy || !chosenMentor)return Alert.alert('Select mentor','Choose the member whose role you have verified.');
    if(reason.trim().length<15)return Alert.alert('Audit reason required','Explain the verified mentoring responsibility in at least 15 characters.');
    Alert.alert('Activate mentor permission?',
      'This permits real teaching reports and access to assigned learners. Activate only after verifying the member\'s responsibility.',
      [
        {text:'Cancel',style:'cancel'},
        {text:'Activate',onPress:()=>{
          void (async()=>{
            if(busy)return;
            setBusy(true);
            try{
              const {data,error}=await (supabase as any).rpc('admin_set_mentor_capability_v1',{
                p_target_id:chosenMentor.id,p_enable:true,
                p_reason:reason.trim(),p_request_key:Crypto.randomUUID()
              });
              if(error)throw error;
              Alert.alert('Mentor permission',data?.changed?'Permission activated and audited. Assign learners next.':'Permission already active. You may assign learners.');
              setReason('');
            }catch(error){
              Alert.alert('Permission unchanged',error instanceof Error?error.message:String(error));
            }finally{setBusy(false)}
          })();
        }},
      ]);
  };

  const assign=async()=>{
    if(busy)return;
    if(!mentorId||!discipleId)return Alert.alert('Mentor Assignment','Select both mentor and learner.');
    if(mentorId===discipleId)return Alert.alert('Mentor Assignment','Mentor and learner must be different people.');
    if(chosenMentor?.role==='system_admin')return Alert.alert('Protected identity','System Admin cannot be assigned as a rewarded mentor.');
    setBusy(true);
    try{
      const {data:access,error:checkError}=await (supabase as any).rpc('has_capability',{
        p_user_id:mentorId,p_capability:'mentor'
      });
      if(checkError)throw checkError;
      if(access!==true)throw new Error('Mentor permission is inactive. Have a System Admin review and activate it first.');
      const {error}=await supabase.from('mentor_assignments').upsert({
        mentor_id:mentorId,disciple_id:discipleId,is_active:true
      });
      if(error)throw error;
      Alert.alert('Assigned','Mentor relationship created.');
      setDiscipleId('');
      setLearnerSearch('');
    }catch(error){
      Alert.alert('Could not assign mentor',error instanceof Error?error.message:String(error));
    }finally{setBusy(false)}
  };

  return <AdminGate>
    <ScrollView style={shared.screen} contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
      <Text style={shared.h1}>Mentor Assignments</Text>
      <Card>
        <Text style={shared.h2}>Mentee linking requests</Text>
        <Text style={shared.muted}>Mentors can enter a name in the teaching report, but only a verified account link adds a selectable attendee. Do not approve an unverified or similarly named account.</Text>
        {!linkQueueEnabled && <Text style={shared.muted}>Link request queue is not enabled on this backend. Existing assignment controls below remain available.</Text>}
        {linkQueueEnabled && linkRequests.length===0 &&
          <Text style={shared.muted}>No pending mentee requests.</Text>}
        {linkRequests.map(r=>
          <Pressable key={r.id}
            onPress={()=>{setReviewRequestId(r.id);setReviewSearch(r.mentee_name);setReviewLearnerId('');}}
            style={[styles.requestCard,reviewRequestId===r.id&&styles.chipOn]}>
            <Text style={styles.requestTitle}>{r.mentor_name||'Mentor'} requests: {r.mentee_name}</Text>
            <Text style={shared.muted}>{new Date(r.created_at).toLocaleDateString()}</Text>
          </Pressable>)}
        {selectedLink&&<>
          <Text style={shared.h2}>Verify this mentee's actual account</Text>
          <Text style={shared.muted}>Requested name: {selectedLink.mentee_name}. Search the registered member list, confirm identity independently, then choose one account.</Text>
          <TextInput style={styles.input} placeholder="Search verified member by name"
            value={reviewSearch} onChangeText={v=>{setReviewSearch(v);setReviewLearnerId('');}}/>
          <View style={styles.wrap}>{reviewLearners.map(x=>
            <Pressable key={x.id} onPress={()=>setReviewLearnerId(x.id)}
              style={[styles.chip,reviewLearnerId===x.id&&styles.chipOn]}>
              <Text>{x.full_name||'Member'} · ID …{x.id.slice(-6)}</Text>
            </Pressable>)}</View>
          {!!reviewLearnerId&&<Text style={shared.muted}>Selected verified member: {members.find(x=>x.id===reviewLearnerId)?.full_name} · ID …{reviewLearnerId.slice(-6)}. Verify their actual account before approving.</Text>}
          <TextInput style={styles.input} multiline maxLength={500}
            placeholder="Required review/audit note (12+ characters)"
            value={reviewNote} onChangeText={setReviewNote}/>
          <Button title={busy?'WORKING...':'APPROVE VERIFIED MENTEE LINK'} onPress={()=>void reviewLink(true)}/>
          <Button title="REJECT REQUEST" onPress={()=>Alert.alert(
            'Reject mentee link request?', 'No attendee will be added.',
            [{text:'Cancel',style:'cancel'},{text:'Reject',style:'destructive',onPress:()=>void reviewLink(false)}]
          )}/>
        </>}
        <Button title="REFRESH LINK REQUESTS" onPress={()=>void loadLinkRequests()}/>
      </Card>
      <Card>
        <Text style={shared.h2}>Choose Mentor</Text>
        <Text style={shared.muted}>Search an active member. The protected System Admin cannot be a mentor.</Text>
        <TextInput style={styles.input} placeholder="Search mentor name (2+ letters)"
          value={mentorSearch} onChangeText={setMentorSearch} />
        <View style={styles.wrap}>{mentors.map(x=>
          <Pressable key={x.id} onPress={()=>{setMentorId(x.id);setDiscipleId('');}}
            style={[styles.chip,mentorId===x.id&&styles.chipOn]}>
            <Text>{x.full_name||x.role}</Text>
          </Pressable>)}
        </View>
        {chosenMentor&&<Text style={shared.muted}>Selected mentor: {chosenMentor.full_name||chosenMentor.role}</Text>}

        <Text style={shared.h2}>Review Mentor Permission</Text>
        <Text style={shared.muted}>Only System Admin can activate this permission. Review the member's assignment and record why access is justified; no automatic restoration.</Text>
        <TextInput style={styles.input} multiline placeholder="Required audit reason (15+ characters)"
          value={reason} onChangeText={setReason} maxLength={500}/>
        <Button title={busy?'WORKING...':'ACTIVATE VERIFIED MENTOR PERMISSION'} onPress={activatePermission}/>

        <Text style={shared.h2}>Choose Assigned Learner</Text>
        <TextInput style={styles.input} placeholder="Search learner name (2+ letters)"
          value={learnerSearch} onChangeText={setLearnerSearch}/>
        <View style={styles.wrap}>{learners.map(x=>
          <Pressable key={x.id} onPress={()=>setDiscipleId(x.id)}
            style={[styles.chip,discipleId===x.id&&styles.chipOn]}>
            <Text>{x.full_name||'Member'}</Text>
          </Pressable>)}
        </View>
        <Button title={busy?'WORKING...':'ASSIGN MENTOR'} onPress={()=>void assign()}/>
      </Card>
    </ScrollView>
  </AdminGate>;
}
const styles=StyleSheet.create({
  input:{borderColor:colors.line,borderWidth:1,borderRadius:9,padding:10,marginVertical:7,color:colors.text},
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7,marginVertical:9},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:18,paddingVertical:7,paddingHorizontal:9},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  requestCard:{padding:10,marginVertical:5,borderWidth:1,borderColor:colors.line,borderRadius:10},
  requestTitle:{fontWeight:'800',color:colors.text},
});
