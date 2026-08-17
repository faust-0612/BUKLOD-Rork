import { BuklodGivingSettingsButton } from './BuklodGivingSettingsButton';
/* PATCH_170B_CLUSTER_HOME_COMMAND_CENTER */
import React,{useCallback,useEffect,useMemo,useState}from'react';
import{ActivityIndicator,Alert,Image,Linking,Modal,Pressable,RefreshControl,ScrollView,Share,StyleSheet,Text,TextInput,View}from'react-native';
import{MaterialCommunityIcons}from'@expo/vector-icons';
import{router}from'expo-router';
import{supabase}from'@/lib/supabase';
import{colors}from'@/lib/theme';
import{useAuth}from'@/providers/AuthProvider';
import{useBuklodAccess}from'@/hooks/useBuklodAccess';
import BuklodHomeScopeBulletins from'@/components/BuklodHomeScopeBulletins';
import BuklodScopeCallLauncher from'@/components/BuklodScopeCallLauncher';
import{CommunityVideo}from'@/components/CommunityVideo';
import type{BuklodScope}from'@/lib/buklodScope';

type Props={scope:BuklodScope;onOpenCommunity?:()=>void};
type Member={user_id:string;full_name:string;avatar_url:string|null;is_admin:boolean};
type Notice={id:string;title:string;body:string|null;priority:string;expires_at:string|null;created_at:string};
type Event={id:string;title:string;description:string|null;starts_at:string;location:string|null};
type Rsvp={event_id:string;status:string};
type Task={id:string;title:string;description:string|null;assigned_to:string|null;due_at:string|null;status:string};
type Poll={id:string;question:string;closes_at:string|null;is_active:boolean};
type Option={id:string;poll_id:string;label:string;sort_order:number};
type Vote={poll_id:string;option_id:string;user_id:string};
type Resource={id:string;title:string;description:string|null;resource_url:string};
type Recognition={id:string;title:string;recipient_name:string|null;body:string|null};
type Settings={scope_id:string;about_text:string|null;hidden_widgets:string[]|null};
type Post={id:string;body:string;created_at:string;author_name:string|null;media_path:string|null;media_mime_type:string|null;reaction_counts:Record<string,number>|null;comment_count:number;media_url?:string|null};
type Kind='notice'|'event'|'task'|'poll'|'resource'|'recognition'|'about'|null;

const WIDGETS=[['notice','Important Notice'],['bulletin','Cluster Bulletin'],['today','Today / This Week'],['events','Upcoming Events'],['members','Member Snapshot'],['officers','Officers / Admins'],['tasks','Tasks'],['poll','Poll'],['community','Community Posts'],['calendar','Calendar'],['attendance','Attendance'],['resources','Files & Resources'],['recognition','Recognition'],['calls','Calls'],['invite','Invite / QR'],['about','About'],['insights','Admin Insights']] as const;
const dt=(v?:string|null)=>{if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleString()};
const sd=(v?:string|null)=>{if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString(undefined,{month:'short',day:'numeric'})};
const total=(x?:Record<string,number>|null)=>Object.values(x??{}).reduce((a,b)=>a+Number(b??0),0);

function Card({icon,title,action,onAction,children}:{icon:any;title:string;action?:string;onAction?:()=>void;children:React.ReactNode}){
 return <View style={s.card}><View style={s.head}><View style={s.hleft}><View style={s.ico}><MaterialCommunityIcons name={icon} size={18} color={colors.greenDark}/></View><Text style={s.ht}>{title}</Text></View>{action&&onAction?<Pressable onPress={onAction} style={s.action}><Text style={s.actionText}>{action}</Text></Pressable>:null}</View>{children}</View>
}
const Empty=({children}:{children:React.ReactNode})=><Text style={s.empty}>{children}</Text>;

export default function BuklodClusterHomeCommandCenter({scope,onOpenCommunity}:Props){
 const{user}=useAuth();const{isAdmin}=useBuklodAccess();
 const[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[members,setMembers]=useState<Member[]>([]),[notices,setNotices]=useState<Notice[]>([]),[events,setEvents]=useState<Event[]>([]),[rsvps,setRsvps]=useState<Rsvp[]>([]),[tasks,setTasks]=useState<Task[]>([]),[polls,setPolls]=useState<Poll[]>([]),[options,setOptions]=useState<Option[]>([]),[votes,setVotes]=useState<Vote[]>([]),[resources,setResources]=useState<Resource[]>([]),[recognitions,setRecognitions]=useState<Recognition[]>([]),[settings,setSettings]=useState<Settings|null>(null),[posts,setPosts]=useState<Post[]>([]),[attendance,setAttendance]=useState<any[]>([]),[description,setDescription]=useState('');
 const[kind,setKind]=useState<Kind>(null),[title,setTitle]=useState(''),[body,setBody]=useState(''),[extra,setExtra]=useState(''),[when,setWhen]=useState(''),[saving,setSaving]=useState(false);
 const[customizeOpen,setCustomizeOpen]=useState(false);
 const hidden=useMemo(()=>new Set(settings?.hidden_widgets??[]),[settings?.hidden_widgets]);const show=(k:string)=>!hidden.has(k);

 const load=useCallback(async()=>{
  if(scope.scope_type!=='CLUSTER')return;
  try{
   const today=new Date().toISOString().slice(0,10);
   const [m,n,e,r,t,p,res,rec,setg,att,sc,com]=await Promise.all([
    (supabase as any).rpc('buklod_cluster_home_members_v1',{p_scope_id:scope.scope_id}),
    supabase.from('buklod_cluster_home_notices').select('id,title,body,priority,expires_at,created_at').eq('scope_id',scope.scope_id).order('created_at',{ascending:false}).limit(5),
    supabase.from('buklod_cluster_events').select('id,title,description,starts_at,location').eq('scope_id',scope.scope_id).gte('starts_at',new Date(Date.now()-86400000).toISOString()).order('starts_at').limit(20),
    user?.id?supabase.from('buklod_cluster_event_rsvps').select('event_id,status').eq('user_id',user.id):Promise.resolve({data:[],error:null}),
    supabase.from('buklod_cluster_tasks').select('id,title,description,assigned_to,due_at,status').eq('scope_id',scope.scope_id).order('created_at',{ascending:false}).limit(30),
    supabase.from('buklod_cluster_polls').select('id,question,closes_at,is_active').eq('scope_id',scope.scope_id).eq('is_active',true).order('created_at',{ascending:false}).limit(3),
    supabase.from('buklod_cluster_resources').select('id,title,description,resource_url').eq('scope_id',scope.scope_id).order('created_at',{ascending:false}).limit(12),
    supabase.from('buklod_cluster_recognitions').select('id,title,recipient_name,body').eq('scope_id',scope.scope_id).order('created_at',{ascending:false}).limit(10),
    supabase.from('buklod_cluster_home_settings').select('scope_id,about_text,hidden_widgets').eq('scope_id',scope.scope_id).maybeSingle(),
    supabase.from('buklod_cluster_attendance').select('user_id').eq('scope_id',scope.scope_id).eq('checkin_date',today),
    supabase.from('buklod_scopes').select('description').eq('id',scope.scope_id).maybeSingle(),
    (supabase as any).rpc('buklod_scope_social_feed_v1',{p_scope_id:scope.scope_id,p_limit:4}),
   ]);
   const err=m.error||n.error||e.error||r.error||t.error||p.error||res.error||rec.error||setg.error||att.error||sc.error||com.error;if(err)throw err;
   const pr=(p.data??[]) as Poll[];let op:Option[]=[];let vo:Vote[]=[];
   if(pr.length){const ids=pr.map(x=>x.id);const[a,b]=await Promise.all([supabase.from('buklod_cluster_poll_options').select('id,poll_id,label,sort_order').in('poll_id',ids).order('sort_order'),supabase.from('buklod_cluster_poll_votes').select('poll_id,option_id,user_id').in('poll_id',ids)]);if(a.error)throw a.error;if(b.error)throw b.error;op=(a.data??[]) as Option[];vo=(b.data??[]) as Vote[]}
   const raw=(com.data??[]) as Post[];const signed=await Promise.all(raw.map(async x=>{if(!x.media_path)return{...x,media_url:null};const z=await supabase.storage.from('community-media').createSignedUrl(x.media_path,1800);return{...x,media_url:z.data?.signedUrl??null}}));
   setMembers((m.data??[]) as Member[]);setNotices((n.data??[]) as Notice[]);setEvents((e.data??[]) as Event[]);setRsvps((r.data??[]) as Rsvp[]);setTasks((t.data??[]) as Task[]);setPolls(pr);setOptions(op);setVotes(vo);setResources((res.data??[]) as Resource[]);setRecognitions((rec.data??[]) as Recognition[]);setSettings((setg.data??null) as Settings|null);setAttendance(att.data??[]);setDescription(String(sc.data?.description??''));setPosts(signed);
  }catch(err:any){console.warn('Cluster Home:',err);Alert.alert('Cluster Home',err?.message??'Could not load Cluster Home.')}finally{setLoading(false);setRefreshing(false)}
 },[scope.scope_id,scope.scope_type,user?.id]);

 useEffect(()=>{void load()},[load]);
 useEffect(()=>{const c=supabase.channel(`cluster-home:${scope.scope_id}:${Date.now()}:${Math.random().toString(36).slice(2)}`).on('postgres_changes',{event:'*',schema:'public',table:'buklod_cluster_home_notices',filter:`scope_id=eq.${scope.scope_id}`},()=>void load()).on('postgres_changes',{event:'*',schema:'public',table:'buklod_cluster_events',filter:`scope_id=eq.${scope.scope_id}`},()=>void load()).on('postgres_changes',{event:'*',schema:'public',table:'buklod_cluster_tasks',filter:`scope_id=eq.${scope.scope_id}`},()=>void load()).on('postgres_changes',{event:'*',schema:'public',table:'community_posts',filter:`scope_id=eq.${scope.scope_id}`},()=>void load()).subscribe();return()=>{void supabase.removeChannel(c)}},[load,scope.scope_id]);

 const notice=notices.find(x=>!x.expires_at||new Date(x.expires_at).getTime()>Date.now())??null,upcoming=events.filter(x=>new Date(x.starts_at).getTime()>=Date.now()-3600000),week=upcoming.filter(x=>new Date(x.starts_at).getTime()<=Date.now()+7*86400000),officers=members.filter(x=>x.is_admin),myTasks=tasks.filter(x=>!x.assigned_to||x.assigned_to===user?.id||isAdmin),openTasks=myTasks.filter(x=>x.status!=='DONE'),poll=polls[0]??null,pollOptions=poll?options.filter(x=>x.poll_id===poll.id):[],myVote=poll&&user?.id?votes.find(x=>x.poll_id===poll.id&&x.user_id===user.id):null,myChecked=!!user?.id&&attendance.some(x=>x.user_id===user.id);

 const edit=(k:Exclude<Kind,null>)=>{setKind(k);setTitle('');setBody(k==='about'?(settings?.about_text??description):'');setExtra('');setWhen('')};
 const save=async()=>{if(!kind||!isAdmin)return;setSaving(true);try{
  if(kind==='notice'){if(!title.trim())throw new Error('Title required');const q=await supabase.from('buklod_cluster_home_notices').insert({scope_id:scope.scope_id,title:title.trim(),body:body.trim()||null,priority:extra.trim().toLowerCase()==='emergency'?'EMERGENCY':'IMPORTANT',created_by:user?.id});if(q.error)throw q.error}
  if(kind==='event'){if(!title.trim())throw new Error('Title required');const d=when.trim()?new Date(when):new Date(Date.now()+86400000);if(Number.isNaN(d.getTime()))throw new Error('Invalid date/time');const q=await supabase.from('buklod_cluster_events').insert({scope_id:scope.scope_id,title:title.trim(),description:body.trim()||null,location:extra.trim()||null,starts_at:d.toISOString(),created_by:user?.id});if(q.error)throw q.error}
  if(kind==='task'){if(!title.trim())throw new Error('Title required');let due=null;if(when.trim()){const d=new Date(when);if(Number.isNaN(d.getTime()))throw new Error('Invalid due date');due=d.toISOString()}const q=await supabase.from('buklod_cluster_tasks').insert({scope_id:scope.scope_id,title:title.trim(),description:body.trim()||null,due_at:due,status:'OPEN',created_by:user?.id});if(q.error)throw q.error}
  if(kind==='poll'){const labels=extra.split(',').map(x=>x.trim()).filter(Boolean);if(!title.trim()||labels.length<2)throw new Error('Question + at least 2 comma-separated options required');const q=await supabase.from('buklod_cluster_polls').insert({scope_id:scope.scope_id,question:title.trim(),created_by:user?.id}).select('id').single();if(q.error)throw q.error;const o=await supabase.from('buklod_cluster_poll_options').insert(labels.map((label,i)=>({poll_id:q.data.id,label,sort_order:i})));if(o.error)throw o.error}
  if(kind==='resource'){if(!title.trim()||!extra.trim())throw new Error('Title and URL required');const q=await supabase.from('buklod_cluster_resources').insert({scope_id:scope.scope_id,title:title.trim(),description:body.trim()||null,resource_url:extra.trim(),created_by:user?.id});if(q.error)throw q.error}
  if(kind==='recognition'){if(!title.trim())throw new Error('Title required');const q=await supabase.from('buklod_cluster_recognitions').insert({scope_id:scope.scope_id,title:title.trim(),recipient_name:extra.trim()||null,body:body.trim()||null,created_by:user?.id});if(q.error)throw q.error}
  if(kind==='about'){const q=await supabase.from('buklod_cluster_home_settings').upsert({scope_id:scope.scope_id,about_text:body.trim()||null,updated_by:user?.id},{onConflict:'scope_id'});if(q.error)throw q.error}
  setKind(null);await load();
 }catch(err:any){Alert.alert('Cluster Home',err?.message??'Save failed')}finally{setSaving(false)}};

 const rsvp=async(id:string,status:string)=>{if(!user?.id)return;const q=await supabase.from('buklod_cluster_event_rsvps').upsert({event_id:id,user_id:user.id,status},{onConflict:'event_id,user_id'});if(q.error)Alert.alert('RSVP',q.error.message);else await load()};
 const taskDone=async(x:Task)=>{const q=await supabase.from('buklod_cluster_tasks').update({status:'DONE'}).eq('id',x.id);if(q.error)Alert.alert('Task',q.error.message);else await load()};
 const vote=async(optionId:string)=>{if(!poll||!user?.id)return;const q=await supabase.from('buklod_cluster_poll_votes').upsert({poll_id:poll.id,option_id:optionId,user_id:user.id},{onConflict:'poll_id,user_id'});if(q.error)Alert.alert('Poll',q.error.message);else await load()};
 const checkin=async()=>{if(!user?.id)return;const q=await supabase.from('buklod_cluster_attendance').upsert({scope_id:scope.scope_id,user_id:user.id,checkin_date:new Date().toISOString().slice(0,10)},{onConflict:'scope_id,user_id,checkin_date'});if(q.error)Alert.alert('Check-in',q.error.message);else await load()};
 const toggle=async(k:string)=>{if(!isAdmin)return;const n=new Set(settings?.hidden_widgets??[]);n.has(k)?n.delete(k):n.add(k);const arr=[...n];setSettings(x=>({scope_id:scope.scope_id,about_text:x?.about_text??null,hidden_widgets:arr}));const q=await supabase.from('buklod_cluster_home_settings').upsert({scope_id:scope.scope_id,hidden_widgets:arr,updated_by:user?.id},{onConflict:'scope_id'});if(q.error){Alert.alert('Customize',q.error.message);void load()}};
 const openCommunity=()=>{
  if(onOpenCommunity){
    onOpenCommunity();
    return;
  }

  router.setParams({
    section:'community',
  } as any)
},invite=`buklod://scope?scopeId=${encodeURIComponent(scope.scope_id)}`,shareInvite=()=>Share.share({title:`Join ${scope.name}`,message:`Join ${scope.name} on BUKLOD.\n${invite}\nInvite code: ${scope.scope_id.slice(0,8).toUpperCase()}`});

 if(loading)return <View style={s.loading}><ActivityIndicator color={colors.green}/><Text style={s.empty}>Loading Cluster Home...</Text></View>;
 return <><ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load()}}/>} showsVerticalScrollIndicator={false}>
  {show('notice')&&<Card icon={notice?.priority==='EMERGENCY'?'alert-octagon-outline':'alert-circle-outline'} title={notice?.priority==='EMERGENCY'?'EMERGENCY NOTICE':'IMPORTANT NOTICE'} action={isAdmin?'EDIT':undefined} onAction={isAdmin?()=>edit('notice'):undefined}>{notice?<><Text style={[s.big,notice.priority==='EMERGENCY'&&{color:'#A82020'}]}>{notice.title}</Text>{notice.body?<Text style={s.body}>{notice.body}</Text>:null}</>:<Empty>No important notice right now.</Empty>}</Card>}
  {/* CLUSTER BULLETIN uses the existing official bulletin card directly. */}
  {show('bulletin')&&<BuklodHomeScopeBulletins/>}
  {show('today')&&<Card icon="calendar-today-outline" title="TODAY / THIS WEEK">{week.length?week.slice(0,4).map(x=><View key={x.id} style={s.row}><View style={s.badge}><Text style={s.badgeText}>{sd(x.starts_at)}</Text></View><View style={{flex:1}}><Text style={s.item}>{x.title}</Text><Text style={s.meta}>{dt(x.starts_at)}</Text></View></View>):<Empty>No scheduled activity in the next 7 days.</Empty>}</Card>}
  {show('events')&&<Card icon="calendar-star" title="UPCOMING EVENTS" action={isAdmin?'ADD':undefined} onAction={isAdmin?()=>edit('event'):undefined}>{upcoming.length?upcoming.slice(0,6).map(x=>{const mine=rsvps.find(y=>y.event_id===x.id)?.status;return <View key={x.id} style={s.block}><Text style={s.item}>{x.title}</Text><Text style={s.meta}>{dt(x.starts_at)}{x.location?` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ ${x.location}`:''}</Text>{x.description?<Text style={s.body}>{x.description}</Text>:null}<View style={s.chips}>{['GOING','MAYBE','NOT_GOING'].map(z=><Pressable key={z} onPress={()=>void rsvp(x.id,z)} style={[s.chip,mine===z&&s.chipOn]}><Text style={[s.chipText,mine===z&&s.chipTextOn]}>{z.replace('_',' ')}</Text></Pressable>)}</View></View>}):<Empty>No upcoming event.</Empty>}</Card>}
  <Card icon="lightning-bolt-outline" title="QUICK ACTIONS"><View style={s.grid}><Quick icon="account-group-outline" text="Community" onPress={openCommunity}/><Quick icon="clipboard-check-outline" text="Attendance" onPress={()=>router.push('/scope/attendance' as any)}/><Quick icon="account-plus-outline" text="Invite" onPress={()=>void shareInvite()}/>{isAdmin?<><Quick icon="clipboard-plus-outline" text="Add Task" onPress={()=>edit('task')}/><Quick icon="poll" text="New Poll" onPress={()=>edit('poll')}/><Quick icon="folder-plus-outline" text="Resource" onPress={()=>edit('resource')}/></>:null}</View></Card>
  {show('members')&&<Card icon="account-multiple-outline" title="MEMBER SNAPSHOT"><View style={s.stats}><Stat v={scope.member_count??members.length} l="MEMBERS"/><Stat v={officers.length} l="ADMINS"/><Stat v={attendance.length} l="CHECKED IN"/></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.people}>{members.slice(0,12).map(x=><View key={x.user_id} style={s.person}>{x.avatar_url?<Image source={{uri:x.avatar_url}} style={s.avatar}/>:<View style={[s.avatar,s.avFallback]}><MaterialCommunityIcons name="account" size={21} color={colors.greenDark}/></View>}<Text numberOfLines={1} style={s.personName}>{x.full_name}</Text></View>)}</ScrollView></Card>}
  {show('officers')&&<Card icon="shield-account-outline" title="CLUSTER OFFICERS / ADMINS">{officers.length?officers.map(x=><View key={x.user_id} style={s.row}><MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.greenDark}/><Text style={s.item}>{x.full_name}</Text></View>):<Empty>No officer information available.</Empty>}</Card>}
  {show('tasks')&&<Card icon="clipboard-check-outline" title="TASKS & ASSIGNMENTS" action={isAdmin?'ADD':undefined} onAction={isAdmin?()=>edit('task'):undefined}>{myTasks.length?myTasks.slice(0,8).map(x=><View key={x.id} style={s.block}><View style={s.between}><Text style={[s.item,x.status==='DONE'&&s.done]}>{x.title}</Text><Text style={s.status}>{x.status}</Text></View>{x.description?<Text style={s.body}>{x.description}</Text>:null}{x.due_at?<Text style={s.meta}>Due {dt(x.due_at)}</Text>:null}{x.status!=='DONE'?<Pressable onPress={()=>void taskDone(x)} style={s.small}><Text style={s.smallText}>MARK DONE</Text></Pressable>:null}</View>):<Empty>No tasks assigned.</Empty>}</Card>}
  {show('poll')&&<Card icon="poll" title="POLL / QUICK VOTE" action={isAdmin?'NEW':undefined} onAction={isAdmin?()=>edit('poll'):undefined}>{poll?<><Text style={s.big}>{poll.question}</Text>{pollOptions.map(o=>{const count=votes.filter(v=>v.option_id===o.id).length,sel=myVote?.option_id===o.id;return <Pressable key={o.id} onPress={()=>void vote(o.id)} style={[s.poll,sel&&s.pollOn]}><Text style={[s.item,sel&&{color:colors.white}]}>{o.label}</Text><Text style={[s.status,sel&&{color:colors.white}]}>{count}</Text></Pressable>})}</>:<Empty>No active poll.</Empty>}</Card>}
  {show('community')&&<Card icon="post-outline" title="COMMUNITY POSTS" action="VIEW COMMUNITY" onAction={openCommunity}>{posts.length?posts.slice(0,4).map(x=><View key={x.id} style={s.post}><View style={s.between}><Text style={s.author}>{x.author_name??'Cluster Member'}</Text><Text style={s.meta}>{sd(x.created_at)}</Text></View>{x.body?<Text numberOfLines={4} style={s.body}>{x.body}</Text>:null}{x.media_url&&String(x.media_mime_type??'').toLowerCase().startsWith('image/')?<Image source={{uri:x.media_url}} style={s.postImage}/>:null}{x.media_url&&String(x.media_mime_type??'').toLowerCase().startsWith('video/')?<View style={s.video}><CommunityVideo uri={x.media_url}/></View>:null}<View style={s.postMeta}><Text style={s.meta}>ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â¤ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â {total(x.reaction_counts)}</Text><Text style={s.meta}>ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â¬ {x.comment_count??0}</Text></View></View>):<Empty>No member posts yet.</Empty>}</Card>}
  {show('calendar')&&<Card icon="calendar-month-outline" title="CALENDAR">{upcoming.length?upcoming.slice(0,8).map(x=><View key={x.id} style={s.row}><View style={s.cal}><Text style={s.calDay}>{new Date(x.starts_at).getDate()}</Text><Text style={s.calMonth}>{new Date(x.starts_at).toLocaleString(undefined,{month:'short'}).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={s.item}>{x.title}</Text><Text style={s.meta}>{x.location??'Cluster activity'}</Text></View></View>):<Empty>Calendar is clear.</Empty>}</Card>}
  {/* PATCH_177B_R2_CLUSTER_ATTENDANCE */}
 {show('attendance')&&<Card
   icon="clipboard-check-outline"
   title="EVENTS & ATTENDANCE"
   action="OPEN"
   onAction={()=>router.push('/scope/attendance' as any)}
 ><Text style={s.body}>Create or select an exact-scope event, then use QR, Face, Biometric or Manual attendance in BUKLOD Attendance.</Text></Card>}
  {show('resources')&&<Card icon="folder-multiple-outline" title="FILES & RESOURCES" action={isAdmin?'ADD':undefined} onAction={isAdmin?()=>edit('resource'):undefined}>{resources.length?resources.map(x=><Pressable key={x.id} onPress={()=>void Linking.openURL(x.resource_url)} style={s.row}><MaterialCommunityIcons name="file-link-outline" size={21} color={colors.greenDark}/><View style={{flex:1}}><Text style={s.item}>{x.title}</Text>{x.description?<Text numberOfLines={2} style={s.meta}>{x.description}</Text>:null}</View><MaterialCommunityIcons name="open-in-new" size={17} color={colors.muted}/></Pressable>):<Empty>No shared resources yet.</Empty>}</Card>}
  {show('recognition')&&<Card icon="trophy-outline" title="RECOGNITION / MILESTONES" action={isAdmin?'ADD':undefined} onAction={isAdmin?()=>edit('recognition'):undefined}>{recognitions.length?recognitions.map(x=><View key={x.id} style={s.row}><MaterialCommunityIcons name="medal-outline" size={25} color="#B78216"/><View style={{flex:1}}><Text style={s.item}>{x.title}</Text>{x.recipient_name?<Text style={s.recipient}>{x.recipient_name}</Text>:null}{x.body?<Text style={s.body}>{x.body}</Text>:null}</View></View>):<Empty>No recognition posted yet.</Empty>}</Card>}
  {show('calls')&&<Card icon="phone-in-talk-outline" title="CLUSTER AUDIO / VIDEO CALL"><BuklodScopeCallLauncher scopeId={scope.scope_id} title={scope.name}/></Card>}
  {show('invite')&&<Card icon="qrcode" title="INVITE / QR"><View style={s.invite}><View style={s.qr}><MaterialCommunityIcons name="qrcode" size={58} color={colors.greenDark}/></View><View style={{flex:1}}><Text style={s.item}>Invite code</Text><Text selectable style={s.code}>{scope.scope_id.slice(0,8).toUpperCase()}</Text><Text selectable numberOfLines={2} style={s.meta}>{invite}</Text></View></View><Pressable onPress={()=>void shareInvite()} style={s.primary}><MaterialCommunityIcons name="share-variant-outline" size={18} color="#fff"/><Text style={s.primaryText}>SHARE INVITE</Text></Pressable><Text style={s.help}>QR-ready invite card. Shareable deep link works without a new native dependency.</Text></Card>}
  {show('about')&&<Card icon="information-outline" title="ABOUT CLUSTER" action={isAdmin?'EDIT':undefined} onAction={isAdmin?()=>edit('about'):undefined}><Text style={s.body}>{settings?.about_text||description||'No Cluster description yet.'}</Text><Text style={[s.meta,{marginTop:8}]}>Visibility: {scope.visibility??'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â'} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Status: {scope.scope_status??'ACTIVE'}</Text></Card>}
  {isAdmin&&show('insights')&&<Card icon="chart-box-outline" title="ADMIN INSIGHTS"><View style={s.stats}><Stat v={scope.member_count??members.length} l="MEMBERS"/><Stat v={openTasks.length} l="OPEN TASKS"/><Stat v={upcoming.length} l="EVENTS"/><Stat v={attendance.length} l="TODAY"/></View></Card>}
  {/* PATCH_170B_R3_CUSTOMIZE_DRAWER */}
  {isAdmin&&(
   <Pressable
    accessibilityRole="button"
    accessibilityLabel="Customize Cluster Home"
    onPress={()=>setCustomizeOpen(true)}
    style={({pressed})=>[
     s.customizeLauncher,
     pressed&&{opacity:.72},
    ]}
   >
    <View style={s.customizeIcon}>
     <MaterialCommunityIcons
      name="view-dashboard-edit-outline"
      size={22}
      color={colors.greenDark}
     />
    </View>
    <View style={s.customizeCopy}>
     <Text style={s.customizeTitle}>
      CUSTOMIZE CLUSTER HOME
     </Text>
     <Text style={s.customizeSub}>
      Choose which cards appear on this Cluster Home.
     </Text>
    </View>
    <MaterialCommunityIcons
     name="chevron-up"
     size={24}
     color={colors.greenDark}
    />
   </Pressable>
  )}
  <View style={{height:28}}/>
 </ScrollView>
 <Modal
  visible={customizeOpen}
  transparent
  animationType="slide"
  onRequestClose={()=>setCustomizeOpen(false)}
 >
  <View style={s.backdrop}>
   <View style={s.drawer}>
    <View style={s.drawerHandle}/>

    <View style={s.drawerHeader}>
     <View style={s.drawerTitleWrap}>
      <View style={s.drawerHeaderIcon}>
       <MaterialCommunityIcons
        name="view-dashboard-edit-outline"
        size={22}
        color={colors.greenDark}
       />
      </View>
      <View style={{flex:1}}>
       <Text style={s.drawerTitle}>
        Customize Cluster Home
       </Text>
       <Text style={s.drawerSubtitle}>
        Show or hide cards for this Cluster. Header and Quick Actions stay available.
       </Text>
      </View>
     </View>

     <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close Customize Cluster Home"
      onPress={()=>setCustomizeOpen(false)}
      style={s.drawerClose}
     >
      <MaterialCommunityIcons
       name="close"
       size={22}
       color={colors.text}
      />
     </Pressable>
    </View>

    <ScrollView
     style={s.drawerScroll}
     contentContainerStyle={s.drawerList}
     showsVerticalScrollIndicator={false}
    >
     {WIDGETS.map(([k,l])=>{
      const on=!hidden.has(k);

      return(
       <Pressable
        key={k}
        accessibilityRole="button"
        accessibilityLabel={`${on?'Hide':'Show'} ${l}`}
        onPress={()=>void toggle(k)}
        style={({pressed})=>[
         s.drawerRow,
         pressed&&{opacity:.7},
        ]}
       >
        <View
         style={[
          s.drawerEye,
          on&&s.drawerEyeOn,
         ]}
        >
         <MaterialCommunityIcons
          name={on?'eye-outline':'eye-off-outline'}
          size={20}
          color={on?colors.white:colors.muted}
         />
        </View>

        <View style={s.drawerRowCopy}>
         <Text style={s.drawerRowTitle}>
          {l}
         </Text>
         <Text style={s.drawerRowState}>
          {on?'Visible on Cluster Home':'Hidden from Cluster Home'}
         </Text>
        </View>

        <View
         style={[
          s.toggleTrack,
          on&&s.toggleTrackOn,
         ]}
        >
         <View
          style={[
           s.toggleKnob,
           on&&s.toggleKnobOn,
          ]}
         />
        </View>
       </Pressable>
      );
     })}

        <BuklodGivingSettingsButton scopeId={scope?.scope_id ?? null} />
</ScrollView>

    <Pressable
     accessibilityRole="button"
     accessibilityLabel="Done customizing Cluster Home"
     onPress={()=>setCustomizeOpen(false)}
     style={s.drawerDone}
    >
     <MaterialCommunityIcons
      name="check"
      size={19}
      color={colors.white}
     />
     <Text style={s.drawerDoneText}>
      DONE
     </Text>
    </Pressable>
   </View>
  </View>
 </Modal>
 <Modal visible={kind!==null} transparent animationType="slide" onRequestClose={()=>setKind(null)}><View style={s.backdrop}><View style={s.modal}><View style={s.between}><Text style={s.modalTitle}>{kind==='notice'?'Important Notice':kind==='event'?'Add Event':kind==='task'?'Add Task':kind==='poll'?'Create Poll':kind==='resource'?'Add Resource':kind==='recognition'?'Add Recognition':'Edit About Cluster'}</Text><Pressable onPress={()=>setKind(null)}><MaterialCommunityIcons name="close" size={24} color={colors.text}/></Pressable></View>{kind!=='about'?<TextInput value={title} onChangeText={setTitle} placeholder={kind==='poll'?'Question':'Title'} style={s.input}/>:null}<TextInput value={body} onChangeText={setBody} placeholder={kind==='about'?'Cluster description / purpose':'Details / description'} multiline style={[s.input,s.area]}/>{kind==='notice'?<TextInput value={extra} onChangeText={setExtra} placeholder="Type EMERGENCY for emergency priority" style={s.input}/>:null}{kind==='event'?<><TextInput value={extra} onChangeText={setExtra} placeholder="Location" style={s.input}/><TextInput value={when} onChangeText={setWhen} placeholder="2026-08-20 18:00" style={s.input}/></>:null}{kind==='task'?<TextInput value={when} onChangeText={setWhen} placeholder="Due date/time (optional)" style={s.input}/>:null}{kind==='poll'?<TextInput value={extra} onChangeText={setExtra} placeholder="Option 1, Option 2, Option 3" style={s.input}/>:null}{kind==='resource'?<TextInput value={extra} onChangeText={setExtra} placeholder="https://..." autoCapitalize="none" style={s.input}/>:null}{kind==='recognition'?<TextInput value={extra} onChangeText={setExtra} placeholder="Member / team name" style={s.input}/>:null}<Pressable disabled={saving} onPress={()=>void save()} style={[s.primary,saving&&{opacity:.5}]}>{saving?<ActivityIndicator size="small" color="#fff"/>:<MaterialCommunityIcons name="content-save-outline" size={18} color="#fff"/>}<Text style={s.primaryText}>SAVE</Text></Pressable></View></View></Modal>
 </>;
}
function Quick({icon,text,onPress}:{icon:any;text:string;onPress:()=>void}){return <Pressable onPress={onPress} style={s.quick}><MaterialCommunityIcons name={icon} size={22} color={colors.greenDark}/><Text style={s.quickText}>{text}</Text></Pressable>}
function Stat({v,l}:{v:number|string;l:string}){return <View style={s.stat}><Text style={s.statV}>{v}</Text><Text style={s.statL}>{l}</Text></View>}

const s=StyleSheet.create({
 content:{paddingHorizontal:12,paddingTop:10,paddingBottom:30,gap:10},loading:{flex:1,alignItems:'center',justifyContent:'center',gap:9,padding:30},card:{borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,borderRadius:18,padding:12,backgroundColor:colors.white},head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:10},hleft:{flex:1,flexDirection:'row',alignItems:'center',gap:8},ico:{width:31,height:31,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},ht:{flex:1,color:colors.text,fontSize:12,fontWeight:'900'},action:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,backgroundColor:colors.greenSoft},actionText:{color:colors.greenDark,fontSize:8,fontWeight:'900'},empty:{color:colors.muted,fontSize:11,lineHeight:17},big:{color:colors.text,fontSize:13,fontWeight:'900',marginBottom:5},body:{color:colors.text,fontSize:11.5,lineHeight:18},meta:{color:colors.muted,fontSize:9,lineHeight:14},row:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:7},block:{paddingVertical:9,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line,gap:5},between:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:9},badge:{width:52,minHeight:38,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},badgeText:{color:colors.greenDark,fontSize:9,fontWeight:'900'},item:{flex:1,color:colors.text,fontSize:11,fontWeight:'900'},chips:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:6},chip:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,borderWidth:1,borderColor:colors.line,flexDirection:'row',alignItems:'center',gap:4},chipOn:{backgroundColor:colors.greenDark,borderColor:colors.greenDark},chipText:{color:colors.muted,fontSize:7.5,fontWeight:'900'},chipTextOn:{color:colors.white},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},quick:{width:'30%',minWidth:88,flexGrow:1,minHeight:70,padding:8,borderRadius:14,alignItems:'center',justifyContent:'center',gap:5,backgroundColor:colors.greenSoft},quickText:{color:colors.greenDark,fontSize:8,fontWeight:'900',textAlign:'center'},stats:{flexDirection:'row',flexWrap:'wrap',gap:8},stat:{minWidth:78,flex:1,padding:10,borderRadius:13,alignItems:'center',backgroundColor:colors.greenSoft},statV:{color:colors.greenDark,fontSize:20,fontWeight:'900'},statL:{marginTop:2,color:colors.muted,fontSize:7,fontWeight:'900'},people:{gap:10,paddingTop:12},person:{width:64,alignItems:'center',gap:4},avatar:{width:42,height:42,borderRadius:21,backgroundColor:colors.greenSoft},avFallback:{alignItems:'center',justifyContent:'center'},personName:{width:'100%',color:colors.text,fontSize:8,fontWeight:'800',textAlign:'center'},status:{color:colors.greenDark,fontSize:8,fontWeight:'900'},done:{textDecorationLine:'line-through',color:colors.muted},small:{alignSelf:'flex-start',paddingHorizontal:9,paddingVertical:6,borderRadius:999,backgroundColor:colors.greenSoft},smallText:{color:colors.greenDark,fontSize:8,fontWeight:'900'},poll:{minHeight:42,paddingHorizontal:12,paddingVertical:9,borderRadius:12,borderWidth:1,borderColor:colors.line,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:6},pollOn:{backgroundColor:colors.greenDark,borderColor:colors.greenDark},post:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.line,paddingVertical:10,gap:7},author:{flex:1,color:colors.text,fontSize:10.5,fontWeight:'900'},postImage:{width:'100%',height:180,borderRadius:13,backgroundColor:colors.greenSoft},video:{minHeight:200,borderRadius:13,overflow:'hidden'},postMeta:{flexDirection:'row',gap:14},cal:{width:49,height:49,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenDark},calDay:{color:'#fff',fontSize:17,fontWeight:'900'},calMonth:{color:'#fff',fontSize:7,fontWeight:'900'},primary:{minHeight:42,paddingHorizontal:14,paddingVertical:9,borderRadius:12,backgroundColor:colors.greenDark,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},primaryText:{color:'#fff',fontSize:9,fontWeight:'900'},recipient:{color:'#8A6214',fontSize:9,fontWeight:'900'},invite:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:10},qr:{width:82,height:82,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},code:{marginVertical:4,color:colors.greenDark,fontSize:17,fontWeight:'900',letterSpacing:2},help:{color:colors.muted,fontSize:9,lineHeight:14,marginTop:8},
 customizeLauncher:{minHeight:76,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,borderRadius:18,paddingHorizontal:13,paddingVertical:12,backgroundColor:colors.white,flexDirection:'row',alignItems:'center',gap:11},
 customizeIcon:{width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},
 customizeCopy:{flex:1,gap:3},
 customizeTitle:{color:colors.text,fontSize:11.5,fontWeight:'900'},
 customizeSub:{color:colors.muted,fontSize:9,lineHeight:14},
 drawer:{maxHeight:'84%',borderTopLeftRadius:26,borderTopRightRadius:26,paddingTop:9,paddingHorizontal:14,paddingBottom:16,backgroundColor:colors.white},
 drawerHandle:{width:42,height:4,borderRadius:999,alignSelf:'center',marginBottom:11,backgroundColor:colors.line},
 drawerHeader:{flexDirection:'row',alignItems:'flex-start',gap:10,paddingBottom:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line},
 drawerTitleWrap:{flex:1,flexDirection:'row',alignItems:'center',gap:10},
 drawerHeaderIcon:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},
 drawerTitle:{color:colors.text,fontSize:16,fontWeight:'900'},
 drawerSubtitle:{marginTop:3,color:colors.muted,fontSize:9.5,lineHeight:14},
 drawerClose:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},
 drawerScroll:{flexGrow:0},
 drawerList:{paddingVertical:8,gap:7},
 drawerRow:{minHeight:66,paddingHorizontal:10,paddingVertical:9,borderRadius:15,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,backgroundColor:colors.white,flexDirection:'row',alignItems:'center',gap:10},
 drawerEye:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},
 drawerEyeOn:{backgroundColor:colors.greenDark},
 drawerRowCopy:{flex:1},
 drawerRowTitle:{color:colors.text,fontSize:11.5,fontWeight:'900'},
 drawerRowState:{marginTop:2,color:colors.muted,fontSize:8.5,lineHeight:12},
 toggleTrack:{width:44,height:25,borderRadius:999,padding:3,justifyContent:'center',backgroundColor:colors.line},
 toggleTrackOn:{backgroundColor:colors.greenDark},
 toggleKnob:{width:19,height:19,borderRadius:10,backgroundColor:colors.white},
 toggleKnobOn:{alignSelf:'flex-end'},
 drawerDone:{minHeight:48,borderRadius:14,backgroundColor:colors.greenDark,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:4},
 drawerDoneText:{color:colors.white,fontSize:10,fontWeight:'900',letterSpacing:.6},
 backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.35)'},modal:{maxHeight:'86%',borderTopLeftRadius:24,borderTopRightRadius:24,padding:18,gap:10,backgroundColor:colors.white},modalTitle:{flex:1,color:colors.text,fontSize:16,fontWeight:'900'},input:{minHeight:46,borderRadius:12,borderWidth:1,borderColor:colors.line,paddingHorizontal:12,paddingVertical:10,color:colors.text,backgroundColor:colors.white,fontSize:11},area:{minHeight:96,textAlignVertical:'top'}
});
