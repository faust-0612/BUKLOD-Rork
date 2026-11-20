import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import {
 governmentApply, governmentAssignStaff, governmentCaseEvents, governmentCases,
 governmentDirectory, governmentEntityStaff, governmentEvents, governmentFollows,
 governmentIsSystemAdmin, governmentMyApplications, governmentMyRoles,
 governmentPendingApplications, governmentPosts, governmentPublish,
 governmentSaveEvent, governmentSaveService, governmentServices, governmentSubmitCase,
 governmentToggleFollow, governmentTransitionCase, governmentVerifyEntity,
 type GovCase, type GovCaseEvent, type GovCaseStatus, type GovEntity, type GovEntityType,
 type GovEvent, type GovPublication, type GovPublicationKind, type GovService,
 type GovStaff, type GovStaffRole,
} from '@/lib/buklodGovernment';

type Page = 'DISCOVER'|'UPDATES'|'SERVICES'|'CONCERNS'|'OFFICE';
const TYPES: GovEntityType[]=['NATIONAL','REGIONAL','PROVINCIAL','CITY','MUNICIPALITY','BARANGAY','DEPARTMENT'];
const KINDS: GovPublicationKind[]=['ANNOUNCEMENT','PROGRAM','PROJECT','CONSULTATION','ADVISORY'];
const CASE_STATUSES: GovCaseStatus[]=['ACKNOWLEDGED','IN_PROGRESS','RESOLVED','ESCALATED','CLOSED'];
const STAFF_ROLES: GovStaffRole[]=['ADMIN','PUBLISHER','CONCERN_HANDLER','AUDITOR','EMERGENCY_PUBLISHER'];

export default function BuklodGovernmentFocusApp() {
 const {theme}=useBuklodTheme();
 const [page,setPage]=useState<Page>('DISCOVER');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [query,setQuery]=useState('');
 const [entities,setEntities]=useState<GovEntity[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [myApps,setMyApps]=useState<GovEntity[]>([]);
 const [myRoles,setMyRoles]=useState<GovStaff[]>([]);
 const [follows,setFollows]=useState<string[]>([]);
 const [isSystemAdmin,setIsSystemAdmin]=useState(false);
 const [pending,setPending]=useState<GovEntity[]>([]);
 const [posts,setPosts]=useState<GovPublication[]>([]);
 const [services,setServices]=useState<GovService[]>([]);
 const [events,setEvents]=useState<GovEvent[]>([]);
 const [cases,setCases]=useState<GovCase[]>([]);
 const [staff,setStaff]=useState<GovStaff[]>([]);
 const [caseEvents,setCaseEvents]=useState<GovCaseEvent[]>([]);
 const [caseId,setCaseId]=useState<string|null>(null);
 const [applyOpen,setApplyOpen]=useState(false);
 const [name,setName]=useState('');
 const [officeType,setOfficeType]=useState<GovEntityType>('MUNICIPALITY');
 const [location,setLocation]=useState('');
 const [psgc,setPsgc]=useState('');
 const [email,setEmail]=useState('');
 const [officialUrl,setOfficialUrl]=useState('');
 const [applicationNote,setApplicationNote]=useState('');
 const [postBody,setPostBody]=useState('');
 const [postRequestKey,setPostRequestKey]=useState(()=>randomUUID());
 const [postKind,setPostKind]=useState<GovPublicationKind>('ANNOUNCEMENT');
 const [localityKeys,setLocalityKeys]=useState('');
 const [publishNational,setPublishNational]=useState(false);
 const [concernTitle,setConcernTitle]=useState('');
 const [caseRequestKey,setCaseRequestKey]=useState(()=>randomUUID());
 const [concernText,setConcernText]=useState('');
 const [concernLocality,setConcernLocality]=useState('');
 const [updateStatus,setUpdateStatus]=useState<GovCaseStatus>('ACKNOWLEDGED');
 const [updateNote,setUpdateNote]=useState('');
 const [caseUpdateRequestKey,setCaseUpdateRequestKey]=useState(()=>randomUUID());
 const [serviceTitle,setServiceTitle]=useState('');
 const [serviceDescription,setServiceDescription]=useState('');
 const [serviceUrl,setServiceUrl]=useState('');
 const [eventTitle,setEventTitle]=useState('');
 const [eventDescription,setEventDescription]=useState('');
 const [eventLocation,setEventLocation]=useState('');
 const [eventDate,setEventDate]=useState('');
 const [staffId,setStaffId]=useState('');
 const [staffAssignRole,setStaffAssignRole]=useState<GovStaffRole>('PUBLISHER');

 const active=entities.find(e=>e.id===selectedId)??null;
 const staffRole=myRoles.find(s=>s.entity_id===selectedId && s.is_active)?.role??null;
 const canPublish=staffRole!==null && ['OWNER','ADMIN','PUBLISHER','EMERGENCY_PUBLISHER'].includes(staffRole);
 const canCases=staffRole!==null && ['OWNER','ADMIN','CONCERN_HANDLER','AUDITOR'].includes(staffRole);
 const canEditCases=staffRole!==null && ['OWNER','ADMIN','CONCERN_HANDLER'].includes(staffRole);
 const canManage=staffRole==='OWNER'||staffRole==='ADMIN';
 const canSaveDirectory=staffRole!==null && ['OWNER','ADMIN','PUBLISHER'].includes(staffRole);
 const colors=useMemo(()=>({card:theme.cardSurface,text:theme.textPrimary,muted:theme.textSecondary,
   border:theme.border,accent:theme.accent,onAccent:theme.onAccent,soft:theme.surfaceMuted}),[theme]);

 const refreshHome=useCallback(async()=>{
  const [directory,apps,roles,followed,admin]=await Promise.all([
    governmentDirectory(),governmentMyApplications(),governmentMyRoles(),
    governmentFollows(),governmentIsSystemAdmin()
  ]);
  setEntities(directory);setMyApps(apps);setMyRoles(roles);setFollows(followed);
  setIsSystemAdmin(admin);
  if(admin) setPending(await governmentPendingApplications());
 },[]);
 useEffect(()=>{
  let alive=true;
  setLoading(true);
  void refreshHome().catch(e=>{if(alive)setError(String(e.message??e));})
   .finally(()=>{if(alive)setLoading(false);});
  return ()=>{alive=false;};
 },[refreshHome]);
 const refreshSelected=useCallback(async()=>{
  if(!selectedId)return;
  const [p,s,e,c]=await Promise.all([
    governmentPosts(selectedId),governmentServices(selectedId),
    governmentEvents(selectedId),governmentCases(selectedId)
  ]);
  setPosts(p);setServices(s);setEvents(e);setCases(c);
  const role=myRoles.find(r=>r.entity_id===selectedId && r.is_active)?.role;
  if(role==='OWNER'||role==='ADMIN')setStaff(await governmentEntityStaff(selectedId));
  else setStaff([]);
 },[selectedId,myRoles]);
 useEffect(()=>{
  let alive=true;
  if(!selectedId){setPosts([]);setServices([]);setEvents([]);setCases([]);return;}
  void refreshSelected().catch(e=>{if(alive)setError(String(e.message??e));});
  return ()=>{alive=false;};
 },[selectedId,refreshSelected]);

 const perform=async(operation:()=>Promise<unknown>,success:string,which:'HOME'|'SELECTED'|'CASE'='SELECTED')=>{
   if(busy)return;
   setBusy(true);setError('');
   try{
     await operation();
     if(which==='HOME')await refreshHome();
     else if(which==='SELECTED')await refreshSelected();
     else if(caseId)setCaseEvents(await governmentCaseEvents(caseId));
     Alert.alert('BUKLOD Government',success);
   }catch(e:any){const message=String(e?.message??'Request failed.');setError(message);Alert.alert('Government request',message);}
   finally{setBusy(false);}
 };
 const openCase=async(id:string)=>{
   setCaseId(id);setCaseEvents([]);
   try{setCaseEvents(await governmentCaseEvents(id));}catch(e:any){setError(String(e.message??e));}
 };
 const chooseOffice=(id:string)=>{setSelectedId(id);setPage('UPDATES');setCaseId(null);setPublishNational(false);setPostRequestKey(randomUUID());setCaseRequestKey(randomUUID());setCaseUpdateRequestKey(randomUUID());setError('');};
 const openOfficialLink=async(url:string)=>{
   if(!/^https:\/\//i.test(url)){Alert.alert('Invalid link','Official links must use HTTPS.');return;}
   try{await Linking.openURL(url);}catch{Alert.alert('Link unavailable','Could not open the external government portal.');}
 };
 const btn=(label:string,fn:()=>void,secondary=false,disabled=false)=>(
   <Pressable accessibilityRole="button" disabled={busy||disabled} onPress={fn}
     style={[styles.button,{backgroundColor:secondary?colors.soft:colors.accent,borderColor:colors.border,opacity:(busy||disabled)?0.5:1}]}>
     <Text style={{color:secondary?colors.text:colors.onAccent,fontSize:12,fontWeight:'800'}}>{label}</Text>
   </Pressable>
 );
 const inp=(placeholder:string,value:string,onChangeText:(v:string)=>void,multiline=false)=>(
   <TextInput placeholder={placeholder} placeholderTextColor={theme.textMuted}
     accessibilityLabel={placeholder} value={value} onChangeText={onChangeText}
     multiline={multiline} maxLength={multiline?6000:254}
     style={[styles.input,{color:colors.text,borderColor:colors.border,backgroundColor:theme.inputSurface},
       multiline?{minHeight:80,textAlignVertical:'top'}:null]}/>
 );
 const heading=(label:string)=><Text style={[styles.sectionTitle,{color:colors.text}]}>{label}</Text>;
 const caption=(label:string)=><Text style={[styles.caption,{color:colors.muted}]}>{label}</Text>;
 const tile=(children:React.ReactNode)=>(
   <View style={[styles.card,{backgroundColor:colors.card,borderColor:colors.border}]}>{children}</View>
 );

 return <>
  <Stack.Screen options={{title:'BUKLOD Government'}}/>
  <BuklodPortalScrollView style={{backgroundColor:theme.canvas}} contentContainerStyle={styles.page}
    keyboardShouldPersistTaps="handled">
   <View style={styles.titleRow}>
    <MaterialCommunityIcons name="bank-outline" size={30} color={colors.accent}/>
    <View style={{flex:1}}>
     <Text style={[styles.title,{color:colors.text}]}>BUKLOD Government</Text>
     {caption('Genesis: Let There Be Light • Government & People')}
    </View>
   </View>
   {caption('Verified official information, local programs and private citizen concerns. Free for every citizen.')}
   {loading?<ActivityIndicator color={colors.accent}/>:null}
   {error?tile(<Text style={{color:theme.danger}}>{error}</Text>):null}
   <View style={styles.tabs}>
    {(['DISCOVER','UPDATES','SERVICES','CONCERNS','OFFICE'] as Page[]).map(t=>
     <Pressable key={t} onPress={()=>setPage(t)} accessibilityRole="tab"
       accessibilityState={{selected:page===t}}
       style={[styles.tab,{backgroundColor:page===t?colors.accent:colors.soft}]}>
       <Text style={{color:page===t?colors.onAccent:colors.text,fontSize:10,fontWeight:'800'}}>{t==='OFFICE'?'OFFICE':t}</Text>
     </Pressable>
    )}
   </View>
   {active?tile(<>
     <Text style={[styles.sectionTitle,{color:colors.text}]}>{active.name}  ✓</Text>
     {caption(active.entity_type+' • '+active.location_label+(active.psgc_code?' • PSGC '+active.psgc_code:''))}
     <View style={styles.buttonRow}>
      {btn(follows.includes(active.id)?'Following ✓':'Follow Office',()=>{
        void perform(async()=>{await governmentToggleFollow(active.id,follows.includes(active.id));
          setFollows(await governmentFollows());},'Follow preference saved.','CASE');
      },true)}
      {btn('Change Office',()=>setPage('DISCOVER'),true)}
     </View>
   </>):null}

   {page==='DISCOVER'?<>
    {heading('Find verified government offices')}
    {inp('Search office name',query,setQuery)}
    {btn('Search',()=>void perform(async()=>setEntities(await governmentDirectory(query)),
      'Search updated.','CASE'),true)}
    {entities.map(o=><Pressable key={o.id} onPress={()=>chooseOffice(o.id)}
      style={[styles.card,{backgroundColor:colors.card,borderColor:colors.border}]}>
      <Text style={{color:colors.text,fontWeight:'800'}}>{o.name}  ✓</Text>
      {caption(o.entity_type+' • '+o.location_label)}
      <Text style={{color:colors.accent,fontSize:12,fontWeight:'700'}}>Open official page →</Text>
    </Pressable>)}
    {!entities.length&&!loading?caption('No verified offices found yet.'):null}
    {heading('Register a government office')}
    {caption('Application only. Public official status and posting remain locked until BUKLOD verification.')}
    {myApps.map(o=>tile(<><Text style={{color:colors.text,fontWeight:'700'}}>{o.name}</Text>{caption('Application: '+o.status)}</>))}
    {btn(applyOpen?'Close application':'Apply for official verification',()=>setApplyOpen(!applyOpen),true)}
    {applyOpen?tile(<>
     {heading('Government verification application')}
     {inp('Official office name',name,setName)}
     <View style={styles.buttonRow}>{TYPES.map(t=>btn(t,()=>setOfficeType(t),officeType!==t))}</View>
     {caption('Selected: '+officeType)}
     {inp('Official jurisdiction / locality',location,setLocation)}
     {inp('PSGC code (optional)',psgc,setPsgc)}
     {inp('Government office email',email,setEmail)}
     {inp('Official website HTTPS (optional)',officialUrl,setOfficialUrl)}
     {inp('Authority / verification notes',applicationNote,setApplicationNote,true)}
     {btn('Submit verification application',()=>void perform(async()=>{
       await governmentApply({name,entity_type:officeType,location_label:location,psgc_code:psgc,
        official_email:email,official_url:officialUrl,application_note:applicationNote});
       setApplyOpen(false);setName('');setLocation('');setEmail('');
     },'Application submitted for official review.','HOME'),false,!name.trim()||!location.trim()||!email.trim())}
    </>):null}
   </>:null}

   {page==='UPDATES'?<>
    {heading('Government Wall & announcements')}
    {!active?caption('Choose a verified office in Discover.'):null}
    {active&&posts.length===0?caption('No official updates yet.'):null}
    {posts.map(p=>tile(<>
      <Text style={{color:colors.accent,fontSize:11,fontWeight:'800'}}>{p.post_kind} • OFFICIAL</Text>
      <Text style={{color:colors.text,fontSize:14,lineHeight:20}}>{p.body}</Text>
      {caption(p.locality_keys.length?'Location targeting: '+p.locality_keys.join(', '):'Official office followers')}
      {caption(new Date(p.created_at).toLocaleString())}
      {p.public_wall_post_id?btn('View Public Wall',()=>router.push('/buklod' as any),true):null}
    </>))}
    {active&&canPublish?tile(<>
     {heading('Publish official update')}
     {caption('Server verifies active government staff permissions. Only national entities can cross-post to the nationwide Public Wall.')}
     {inp('Announcement, program, advisory or project update',postBody,(v)=>{setPostBody(v);setPostRequestKey(randomUUID());},true)}
     <View style={styles.buttonRow}>{KINDS.map(k=>btn(k,()=>{setPostKind(k);setPostRequestKey(randomUUID());},postKind!==k))}</View>
     {inp('Location PSGC keys, separated by commas (optional)',localityKeys,(v)=>{setLocalityKeys(v);setPostRequestKey(randomUUID());})}
     {active.entity_type==='NATIONAL'?btn(publishNational?'Nationwide Public Wall ✓':'Also publish to Public Wall',()=>{setPublishNational(!publishNational);setPostRequestKey(randomUUID());},true):null}
     {btn('Publish official update',()=>void perform(async()=>{
       const keys=localityKeys.split(',').map(x=>x.trim()).filter(Boolean);
       if(!keys.length && active.psgc_code && active.entity_type!=='NATIONAL') keys.push(active.psgc_code);
       await governmentPublish({entityId:active.id,body:postBody,kind:postKind,
         localityKeys:keys,publishNationalWall:publishNational,requestKey:postRequestKey});
       setPostBody('');setLocalityKeys('');setPostRequestKey(randomUUID());
     },'Official update published.'),false,postBody.trim().length<1)}
    </>):null}
   </>:null}

   {page==='SERVICES'?<>
    {heading('Official services & public programs')}
    {!active?caption('Choose a government office in Discover.'):null}
    {services.map(s=>tile(<>
      <Text style={{color:colors.text,fontWeight:'800'}}>{s.title}</Text>
      {s.description?caption(s.description):null}
      {btn('Open official government service',()=>void openOfficialLink(s.official_url),true)}
    </>))}
    {events.map(e=>tile(<>
      <Text style={{color:colors.text,fontWeight:'800'}}>{e.title}</Text>
      {caption(new Date(e.starts_at).toLocaleString()+(e.location_label?' • '+e.location_label:''))}
      {e.description?caption(e.description):null}
    </>))}
    {active&&canSaveDirectory?tile(<>
      {heading('Office: publish service link')}
      {caption('Official HTTPS links only. Transactions stay on the government portal.')}
      {inp('Service title',serviceTitle,setServiceTitle)}
      {inp('Service description',serviceDescription,setServiceDescription,true)}
      {inp('Official HTTPS service URL',serviceUrl,setServiceUrl)}
      {btn('Publish service',()=>void perform(async()=>{
       await governmentSaveService({entityId:active.id,title:serviceTitle,description:serviceDescription,url:serviceUrl});
       setServiceTitle('');setServiceDescription('');setServiceUrl('');
      },'Official service link published.'),false,!serviceTitle.trim()||!/^https:\/\//i.test(serviceUrl))}
      {heading('Office: publish event')}
      {inp('Event title',eventTitle,setEventTitle)}
      {inp('Event details',eventDescription,setEventDescription,true)}
      {inp('Venue / locality',eventLocation,setEventLocation)}
      {inp('Date and time ISO e.g. 2026-12-12T08:00:00+08:00',eventDate,setEventDate)}
      {btn('Publish event',()=>void perform(async()=>{
       await governmentSaveEvent({entityId:active.id,title:eventTitle,description:eventDescription,
        locationLabel:eventLocation,startsAt:eventDate});
       setEventTitle('');setEventDescription('');setEventLocation('');setEventDate('');
      },'Government event published.'),false,!eventTitle.trim()||!eventDate.trim())}
    </>):null}
   </>:null}

   {page==='CONCERNS'?<>
    {heading('Private Citizen Concern Desk')}
    {caption('Your concern is private to you and authorized office handlers. A BUKLOD reference is not automatically an official government case number.')}
    {!active?caption('Choose an office first.'):null}
    {active?tile(<>
      {heading('Send a concern')}
      {inp('Concern subject',concernTitle,(v)=>{setConcernTitle(v);setCaseRequestKey(randomUUID());})}
      {inp('Describe the concern',concernText,(v)=>{setConcernText(v);setCaseRequestKey(randomUUID());},true)}
      {inp('Locality / PSGC key (optional)',concernLocality,(v)=>{setConcernLocality(v);setCaseRequestKey(randomUUID());})}
      {btn('Submit private concern',()=>void perform(async()=>{
        const c=await governmentSubmitCase({entityId:active.id,subject:concernTitle,
          description:concernText,localityKey:concernLocality,requestKey:caseRequestKey});
        setConcernTitle('');setConcernText('');setConcernLocality('');setCaseRequestKey(randomUUID());
        setCaseId(c.id);
      },'Your BUKLOD concern has been submitted.'),false,concernTitle.trim().length<5||concernText.trim().length<10)}
    </>):null}
    {active?heading(canCases?'Office concern inbox':'My submitted concerns'):null}
    {cases.map(c=>tile(<>
       <Text style={{color:colors.text,fontWeight:'800'}}>{c.subject}</Text>
       {caption(c.reference_code+' • '+c.status+' • '+new Date(c.created_at).toLocaleDateString())}
       {btn(caseId===c.id?'Showing details':'View updates',()=>void openCase(c.id),true)}
       {caseId===c.id?<View style={{gap:8,marginTop:8}}>
         <Text style={{color:colors.text}}>{c.description}</Text>
         {caseEvents.map(x=><View key={x.id} style={{borderTopWidth:1,borderColor:colors.border,paddingTop:6}}>
          {caption((x.status??'UPDATE')+' • '+new Date(x.created_at).toLocaleString())}
          <Text style={{color:colors.text}}>{x.note}</Text>
         </View>)}
         {canEditCases||c.status==='RESOLVED'||c.status==='CLOSED'?<>
          {heading('Update case')}
          {canEditCases?<View style={styles.buttonRow}>
           {CASE_STATUSES.map(s=>btn(s,()=>{setUpdateStatus(s);setCaseUpdateRequestKey(randomUUID());},updateStatus!==s))}
          </View>:btn('Reopen case',()=>setUpdateStatus('REOPENED'),true)}
          {inp('Action taken / clarification',updateNote,(v)=>{setUpdateNote(v);setCaseUpdateRequestKey(randomUUID());},true)}
          {btn('Save case update',()=>void perform(async()=>{
            const status=canEditCases?updateStatus:'REOPENED';
            await governmentTransitionCase({caseId:c.id,status,note:updateNote,requestKey:caseUpdateRequestKey});
            setUpdateNote('');setCaseUpdateRequestKey(randomUUID());setCases(await governmentCases(active!.id));
          },'Case status recorded.','CASE'),false,updateNote.trim().length<2)}
         </>:null}
       </View>:null}
     </>))}
   </>:null}

   {page==='OFFICE'?<>
    {heading('Official government workspace')}
    {caption('Administrative tools require verified agency staff permissions. Public citizen access is free.')}
    {!active?caption('Select a verified office in Discover.'):null}
    {active&&staffRole?tile(<>
      <Text style={{color:colors.text,fontWeight:'800'}}>Verified office role: {staffRole}</Text>
      {caption('Authority is always enforced on the backend, independently from this screen.')}
    </>):null}
    {active&&!staffRole?caption('You are viewing this office as a citizen.'):null}
    {active&&canManage?tile(<>
      {heading('Manage authorized staff')}
      {staff.map(s=><View key={s.user_id}>{caption(s.role+' • '+s.user_id+' • '+(s.is_active?'ACTIVE':'INACTIVE'))}</View>)}
      {inp('Existing BUKLOD user ID (UUID)',staffId,setStaffId)}
      <View style={styles.buttonRow}>{STAFF_ROLES.map(s=>btn(s,()=>setStaffAssignRole(s),staffAssignRole!==s))}</View>
      {btn('Assign verified staff role',()=>void perform(async()=>{
       await governmentAssignStaff(active.id,staffId.trim(),staffAssignRole);setStaffId('');
      },'Staff assignment saved.'),false,staffId.trim().length!==36)}
    </>):null}
    {isSystemAdmin?tile(<>
      {heading('System Admin: verification queue')}
      {caption('Verify agency documents and authorization independently before approval.')}
      {pending.map(p=><View key={p.id} style={{gap:5,paddingVertical:7,borderBottomWidth:1,borderColor:colors.border}}>
        <Text style={{color:colors.text,fontWeight:'700'}}>{p.name} • {p.entity_type}</Text>
        {caption(p.location_label+' • '+p.official_email+' • PSGC '+(p.psgc_code??'unspecified'))}
        {btn('Approve verified agency',()=>Alert.alert('Verify government authority',
          'Confirm that the agency identity, authorization, and official documents were independently checked.',
          [{text:'Cancel',style:'cancel'},{text:'Approve',onPress:()=>void perform(async()=>{
            await governmentVerifyEntity(p.id);
          },'Agency verified. Initial owner provisioned.','HOME')}]),false)}
      </View>)}
      {!pending.length?caption('No pending government applications.'):null}
    </>):null}
   </>:null}
   {btn('Refresh',()=>void perform(async()=>{await refreshHome();if(active)await refreshSelected();},'Government information refreshed.','CASE'),true)}
  </BuklodPortalScrollView>
 </>;
}

const styles=StyleSheet.create({
 page:{paddingHorizontal:12,paddingTop:8,paddingBottom:24,gap:10},
 titleRow:{flexDirection:'row',alignItems:'center',gap:9},
 title:{fontSize:21,fontWeight:'900'},
 tabs:{flexDirection:'row',flexWrap:'wrap',gap:4},
 tab:{paddingHorizontal:8,paddingVertical:8,borderRadius:10},
 card:{padding:12,borderWidth:1,borderRadius:13,gap:7},
 sectionTitle:{fontSize:16,fontWeight:'800'},
 caption:{fontSize:12,lineHeight:17},
 buttonRow:{flexDirection:'row',flexWrap:'wrap',gap:5},
 button:{paddingHorizontal:10,paddingVertical:9,borderRadius:9,borderWidth:1,alignSelf:'flex-start'},
 input:{borderRadius:9,borderWidth:1,paddingHorizontal:10,paddingVertical:8,fontSize:13},
});
