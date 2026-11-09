import { BuklodGivingSettingsButton } from './BuklodGivingSettingsButton';
/* PATCH_170B_CLUSTER_HOME_COMMAND_CENTER */
import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{ActivityIndicator,Alert,Image,KeyboardAvoidingView,Linking,Modal,Platform,Pressable,RefreshControl,ScrollView,Share,StyleSheet,Text,TextInput,View}from'react-native';
import*as Clipboard from'expo-clipboard';
import{MaterialCommunityIcons}from'@expo/vector-icons';
import{router,useFocusEffect}from'expo-router';
import { clusterScopeManageRoute } from '@/lib/buklodCluster';
import{supabase}from'@/lib/supabase';
import{colors}from'@/lib/theme';
import { clusterHomeResources, createClusterReadCache } from '@/lib/clusterHomeLoading';
import{useBuklodCharacterEventsOptional}from'@/components/character/BuklodCharacterEventProvider';
import{CharacterEventType}from'@/lib/buklodCharacterEvents';
import{useAuth}from'@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import BuklodHomeScopeBulletins from'@/components/BuklodHomeScopeBulletins';
import BuklodHomeFaithPanel from'@/components/BuklodHomeFaithPanel';
import BuklodHomeCheckinToday from '@/components/BuklodHomeCheckinToday';
import BuklodNonFaithEncouragementDoor from '@/components/BuklodNonFaithEncouragementDoor';
import BuklodScopeBuklodLessonPanel from'@/components/BuklodScopeBuklodLessonPanel';
import BuklodScopeFaithMonitoringDoor from'@/components/BuklodScopeFaithMonitoringDoor';
import BuklodScopeCallLauncher from'@/components/BuklodScopeCallLauncher';
import BuklodScopeProfilePhoto from '@/components/BuklodScopeProfilePhoto';
import BuklodUnifiedEarningsHomeCard from '@/components/BuklodUnifiedEarningsHomeCard';
import {
 type BuklodScopeHomeFile,pickBuklodScopeHomeMedia,pickBuklodScopeHomeResource,
 uploadBuklodScopeHomeAsset,signedBuklodScopeHomeAsset,rollbackBuklodScopeHomeAsset,
} from '@/lib/buklodScopeHomeAssets';
import{BuklodTappableAvatar}from'@/components/BuklodTappableAvatar';
import{CommunityVideo}from'@/components/CommunityVideo';
import { BuklodCommunityPhotoCollage, communityPhotoCollageItems } from '@/components/BuklodCommunityPhotoCollage';
import{BuklodQrMatrix}from'@/components/BuklodQrMatrix';
import BuklodScreenBottomBanner from '@/components/BuklodScreenBottomBanner';
import BuklodFirstViewAd from '@/components/BuklodFirstViewAd';
import{buildClusterInviteUrl}from'@/lib/buklodClusterInvite';
import{fetchClusterHomeMembers}from'@/lib/buklodScopeMembers';
import{scopeRouteParams}from'@/lib/buklodScopeManage';
import{useBuklodScrollBottomInset,useBuklodDrawerBottomInset}from'@/lib/buklodSafeArea';
import type{BuklodScope}from'@/lib/buklodScope';
import type{DashboardTheme}from'@/components/BuklodDashboardCustomizer';
import{DEFAULT_DASHBOARD_THEME}from'@/components/BuklodDashboardCustomizer';

type Props={scope:BuklodScope;onOpenCommunity?:()=>void;onOpenConnect?:()=>void;manageMode?:boolean;theme?:DashboardTheme};
type Member={user_id:string;full_name:string;avatar_url:string|null;is_admin:boolean};
type Notice={id:string;title:string;body:string|null;priority:string;expires_at:string|null;created_at:string;media_path?:string|null;media_mime_type?:string|null;media_url?:string|null};
type Event={id:string;title:string;description:string|null;starts_at:string;location:string|null;media_path?:string|null;media_mime_type?:string|null;media_url?:string|null};
type Rsvp={event_id:string;status:string};
type Task={id:string;title:string;description:string|null;assigned_to:string|null;due_at:string|null;status:string};
type Poll={id:string;question:string;closes_at:string|null;is_active:boolean};
type Option={id:string;poll_id:string;label:string;sort_order:number};
type Vote={poll_id:string;option_id:string;user_id:string};
type Resource={id:string;title:string;description:string|null;resource_url:string;storage_path?:string|null;original_name?:string|null;mime_type?:string|null;asset_url?:string|null};
type Recognition={id:string;title:string;recipient_name:string|null;body:string|null};
type Settings={scope_id:string;about_text:string|null;hidden_widgets:string[]|null};
type Post={id:string;body:string;created_at:string;author_name:string|null;media_path:string|null;media_mime_type:string|null;reaction_counts:Record<string,number>|null;comment_count:number;media_url?:string|null};
type Kind='notice'|'event'|'task'|'poll'|'resource'|'recognition'|'about'|null;

const WIDGETS=[['notice','Important Notice'],['bulletin','Cluster Bulletin'],['today','Today / This Week'],['events','Upcoming Events'],['members','Member Snapshot'],['officers','Officers / Admins'],['tasks','Tasks'],['poll','Poll'],['community','Community Posts'],['attendance','Attendance'],['resources','Files & Resources'],['recognition','Recognition'],['calls','Calls'],['invite','Invite / QR'],['about','About'],['insights','Admin Insights']] as const;
const TILE_ICONS: Record<string,string>={today:'calendar-today',events:'calendar-star',members:'account-group',officers:'shield-account',tasks:'clipboard-check',poll:'poll',community:'message-text',attendance:'calendar-check',resources:'folder',recognition:'trophy',calls:'video',invite:'qrcode',about:'information',insights:'chart-bar'};
const TILE_LABELS: Record<string,string>={tasks:'Tasks & Assignments',poll:'Poll / Quick Vote',attendance:'Attendance Snapshot',recognition:'Recognition / Milestones',calls:'Cluster Audio / Video Call',about:'About Cluster'};
const TILE_COLORS: Record<string,string>={today:'#0D82DC',events:'#0D82DC',members:'#157BD2',officers:'#D28C19',tasks:'#14A372',poll:'#9B55DC',community:'#1587DC',attendance:'#0979D8',resources:'#E39413',recognition:'#C99513',calls:'#1A81DB',invite:'#177FDA',about:'#1977D0',insights:'#5659CF'};
const dt=(v?:string|null)=>{if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleString()};
const sd=(v?:string|null)=>{if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString(undefined,{month:'short',day:'numeric'})};
const total=(x?:Record<string,number>|null)=>Object.values(x??{}).reduce((a,b)=>a+Number(b??0),0);
const localClusterDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

const clusterReads = createClusterReadCache();
async function clusterData(promise: PromiseLike<{data: any; error: any}>) {
 const {data,error}=await promise;
 if(error)throw error;
 return data;
}

async function hydratePostMedia(posts: Post[]) {
  return Promise.all(
    posts.map(async (post) => {
      if (!post.media_path) {
        return { ...post, media_url: null };
      }

      const signed = await supabase.storage
        .from('community-media')
        .createSignedUrl(post.media_path, 1800);

      return {
        ...post,
        media_url: signed.data?.signedUrl ?? null,
      };
    })
  );
}

function Card({icon,title,action,onAction,children,cardColor}:{icon:any;title:string;action?:string;onAction?:()=>void;children:React.ReactNode;cardColor:string}){
 return <View style={[s.card,{backgroundColor:cardColor}]}><View style={s.head}><View style={s.hleft}><View style={s.ico}><MaterialCommunityIcons name={icon} size={18} color={colors.greenDark}/></View><Text style={s.ht}>{title}</Text></View>{action&&onAction?<Pressable onPress={onAction} style={s.action}><Text style={s.actionText}>{action}</Text></Pressable>:null}</View>{children}</View>
}
const Empty=({children}:{children:React.ReactNode})=><Text style={s.empty}>{children}</Text>;

export default function BuklodClusterHomeCommandCenter({scope,onOpenCommunity,onOpenConnect,manageMode=false,theme}:Props){
 const dashboardTheme=theme??DEFAULT_DASHBOARD_THEME;
 const cardColor=dashboardTheme.cardColor||DEFAULT_DASHBOARD_THEME.cardColor;
 const{user}=useAuth();const {online}=useNetwork();const characterEvents=useBuklodCharacterEventsOptional();
 const isAdmin=manageMode;
 const[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[members,setMembers]=useState<Member[]>([]),[notices,setNotices]=useState<Notice[]>([]),[events,setEvents]=useState<Event[]>([]),[rsvps,setRsvps]=useState<Rsvp[]>([]),[tasks,setTasks]=useState<Task[]>([]),[polls,setPolls]=useState<Poll[]>([]),[options,setOptions]=useState<Option[]>([]),[votes,setVotes]=useState<Vote[]>([]),[resources,setResources]=useState<Resource[]>([]),[recognitions,setRecognitions]=useState<Recognition[]>([]),[settings,setSettings]=useState<Settings|null>(null),[posts,setPosts]=useState<Post[]>([]),[attendance,setAttendance]=useState<any[]>([]),[description,setDescription]=useState('');
 const[kind,setKind]=useState<Kind>(null),[title,setTitle]=useState(''),[body,setBody]=useState(''),[extra,setExtra]=useState(''),[when,setWhen]=useState(''),[saving,setSaving]=useState(false);
 const[customizeOpen,setCustomizeOpen]=useState(false);
 const[pickedAsset,setPickedAsset]=useState<BuklodScopeHomeFile|null>(null);
 const[openWidget,setOpenWidget]=useState<string|null>(null);
 /* BUKLOD_V28_CLUSTER_TILE_LAYOUT_R1: preserve all existing widget bodies and actions. */
 const hidden=useMemo(()=>new Set(settings?.hidden_widgets??[]),[settings?.hidden_widgets]);const show=(k:string)=>(manageMode||(k!=='members'&&k!=='officers'))&&!hidden.has(k);

 const contextKey=JSON.stringify([user?.id,scope.scope_id,manageMode,localClusterDate()]);
 const contextRef=useRef({key:contextKey,generation:0});
 if(contextRef.current.key!==contextKey)contextRef.current={key:contextKey,generation:contextRef.current.generation+1};
 const resourceVersions=useRef<Record<string,number>>({});
 const mounted=useRef(true);
 const [loadError,setLoadError]=useState<string|null>(null);
 const [pendingCount,setPendingCount]=useState(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const load=useCallback(async(options?:{background?:boolean;resources?:string[]})=>{
  if(scope.scope_type!=='CLUSTER'||!user?.id)return;
  const key=contextKey;
  const generation=contextRef.current.generation;
  const valid=()=>mounted.current&&contextRef.current.key===key&&contextRef.current.generation===generation;
  const today=localClusterDate();
  const loaders:Record<string,()=>Promise<any>>={
   members:()=>fetchClusterHomeMembers(scope.scope_id),
   notices:async()=>{
    const rows=(await clusterData(supabase.from('buklod_cluster_home_notices')
      .select('id,title,body,priority,expires_at,created_at,media_path,media_mime_type')
      .eq('scope_id',scope.scope_id).order('created_at',{ascending:false}).limit(5)))??[];
    return Promise.all(rows.map(async(x:Notice)=>({...x,media_url:await signedBuklodScopeHomeAsset(x.media_path)})));
   },
   events:async()=>{
    const rows=(await clusterData(supabase.from('buklod_cluster_events')
      .select('id,title,description,starts_at,location,media_path,media_mime_type')
      .eq('scope_id',scope.scope_id).gte('starts_at',new Date(Date.now()-86400000).toISOString()).order('starts_at').limit(20)))??[];
    return Promise.all(rows.map(async(x:Event)=>({...x,media_url:await signedBuklodScopeHomeAsset(x.media_path)})));
   },
   rsvps:()=>clusterData(supabase.from('buklod_cluster_event_rsvps').select('event_id,status').eq('user_id',user.id)),
   tasks:()=>clusterData(supabase.from('buklod_cluster_tasks').select('id,title,description,assigned_to,due_at,status').eq('scope_id',scope.scope_id).order('created_at',{ascending:false}).limit(30)),
   polls:async()=>{
    const rows=await clusterData(supabase.from('buklod_cluster_polls').select('id,question,closes_at,is_active').eq('scope_id',scope.scope_id).eq('is_active',true).order('created_at',{ascending:false}).limit(3))??[];
    const ids=rows.map((row:Poll)=>row.id);
    const [options,votes]=ids.length?await Promise.all([
     clusterData(supabase.from('buklod_cluster_poll_options').select('id,poll_id,label,sort_order').in('poll_id',ids).order('sort_order')),
     clusterData(supabase.from('buklod_cluster_poll_votes').select('poll_id,option_id,user_id').in('poll_id',ids)),
    ]):[[],[]];
    return {rows,options,votes};
   },
   resources:async()=>{
    const rows=(await clusterData(supabase.from('buklod_cluster_resources')
      .select('id,title,description,resource_url,storage_path,original_name,mime_type')
      .eq('scope_id',scope.scope_id).order('created_at',{ascending:false}).limit(12)))??[];
    return Promise.all(rows.map(async(x:Resource)=>({...x,asset_url:await signedBuklodScopeHomeAsset(x.storage_path)})));
   },
   recognitions:()=>clusterData(supabase.from('buklod_cluster_recognitions').select('id,title,recipient_name,body').eq('scope_id',scope.scope_id).order('created_at',{ascending:false}).limit(10)),
   settings:()=>clusterData(supabase.from('buklod_cluster_home_settings').select('scope_id,about_text,hidden_widgets').eq('scope_id',scope.scope_id).maybeSingle()),
   attendance:()=>clusterData(supabase.from('buklod_cluster_attendance').select('user_id').eq('scope_id',scope.scope_id).eq('checkin_date',today)),
   description:async()=>String((await clusterData(supabase.from('buklod_scopes').select('description').eq('id',scope.scope_id).maybeSingle()))?.description??''),
   posts:async()=>((await clusterData((supabase as any).rpc('buklod_scope_social_feed_v1',{p_scope_id:scope.scope_id,p_limit:4})))??[]).map((post:Post)=>({...post,media_url:null})),
  };
  const setters:Record<string,(data:any)=>void>={members:setMembers,notices:setNotices,events:setEvents,rsvps:setRsvps,tasks:setTasks,resources:setResources,recognitions:setRecognitions,settings:setSettings,attendance:setAttendance,description:setDescription,posts:setPosts,
   polls:data=>{setPolls(data?.rows??[]);setOptions(data?.options??[]);setVotes(data?.votes??[]);}};
  const keys=options?.resources??clusterHomeResources(openWidget,manageMode);
  setLoadError(null);setPendingCount(n=>n+1);
  await Promise.all(keys.map(async resource=>{
   if(resource==='members'&&!manageMode)return;
   const cacheKey=key+':'+resource;
   const version=(resourceVersions.current[cacheKey]??0)+1;resourceVersions.current[cacheKey]=version;
   const latest=()=>valid()&&resourceVersions.current[cacheKey]===version;
   const cached=clusterReads.peek(cacheKey);
   if(cached!==undefined&&latest())setters[resource](cached);
   if(!online){if(latest()&&cached===undefined)setLoadError('Offline — no saved data for this feature yet.');return;}
   try{
    const data=await clusterReads.read(cacheKey,loaders[resource],Boolean(options?.background));
    if(!latest())return;
    setters[resource](data??(resource==='settings'?null:[]));
    if(resource==='posts'){
     // Text appears immediately; signing media never holds the Home loader.
     void hydratePostMedia(data??[]).then(signed=>{if(latest())setPosts(signed);}).catch(()=>undefined);
    }
   }catch(error:any){if(latest())setLoadError(error?.message??'Could not refresh this feature.');}
  }));
  if(valid()){setLoading(false);setRefreshing(false);setPendingCount(n=>Math.max(0,n-1));}
 },[contextKey,online,manageMode,openWidget,scope.scope_id,scope.scope_type,user?.id]);
 useEffect(()=>{
  setMembers([]);setNotices([]);setEvents([]);setRsvps([]);setTasks([]);setPolls([]);setOptions([]);setVotes([]);setResources([]);setRecognitions([]);setSettings(null);setPosts([]);setAttendance([]);setDescription('');setPendingCount(0);setLoading(true);setLoadError(null);
 },[contextKey]);
 useFocusEffect(useCallback(()=>{void load();},[load]));

 const notice=notices.find(x=>!x.expires_at||new Date(x.expires_at).getTime()>Date.now())??null,upcoming=events.filter(x=>new Date(x.starts_at).getTime()>=Date.now()-3600000),week=upcoming.filter(x=>new Date(x.starts_at).getTime()<=Date.now()+7*86400000),officers=members.filter(x=>x.is_admin),myTasks=tasks.filter(x=>!x.assigned_to||x.assigned_to===user?.id||isAdmin),openTasks=myTasks.filter(x=>x.status!=='DONE'),poll=polls[0]??null,pollOptions=poll?options.filter(x=>x.poll_id===poll.id):[],myVote=poll&&user?.id?votes.find(x=>x.poll_id===poll.id&&x.user_id===user.id):null;

 const filteredWeek=week;
 const filteredUpcoming=upcoming;
 const filteredMembers=members;
 const filteredTasks=myTasks;
 const filteredPosts=posts;
 const filteredResources=resources;
 const filteredRecognitions=recognitions;

 const edit=(k:Exclude<Kind,null>)=>{setKind(k);setTitle('');setBody(k==='about'?(settings?.about_text??description):'');setExtra('');setWhen('');setPickedAsset(null)};
 const pickHomeAsset=async()=>{
  if(!isAdmin||!kind)return;
  try{
   const next=kind==='resource'?await pickBuklodScopeHomeResource():
    (kind==='notice'||kind==='event'?await pickBuklodScopeHomeMedia():null);
   if(next)setPickedAsset(next);
  }catch(e:any){Alert.alert('Attach media or file',e?.message||'Unable to select a file.');}
 };
 const save=async()=>{
  if(!kind||!isAdmin||saving)return;
  setSaving(true);
  let pendingAssetPath:string|null=null;
  try{
   const selectedKind=kind;
   let assetRef:{storagePath:string;mimeType:string}|null=null;
   if(pickedAsset&&(kind==='resource'||kind==='event'||kind==='notice')){
     assetRef=await uploadBuklodScopeHomeAsset({scopeId:scope.scope_id,kind,asset:pickedAsset});
     pendingAssetPath=assetRef.storagePath;
   }
   if(kind==='notice'){
     if(!title.trim())throw Error('Title required');
     const q=await supabase.from('buklod_cluster_home_notices').insert({
       scope_id:scope.scope_id,title:title.trim(),body:body.trim()||null,
       priority:extra.trim().toLowerCase()==='emergency'?'EMERGENCY':'IMPORTANT',
       created_by:user?.id,media_path:assetRef?.storagePath??null,
       media_mime_type:assetRef?.mimeType??null,
     });if(q.error)throw q.error;
   }
   if(kind==='event'){
     if(!title.trim())throw Error('Title required');
     const d=when.trim()?new Date(when):new Date(Date.now()+86400000);
     if(Number.isNaN(d.getTime()))throw Error('Invalid date/time');
     const q=await supabase.from('buklod_cluster_events').insert({
       scope_id:scope.scope_id,title:title.trim(),description:body.trim()||null,
       location:extra.trim()||null,starts_at:d.toISOString(),created_by:user?.id,
       media_path:assetRef?.storagePath??null,media_mime_type:assetRef?.mimeType??null,
     });if(q.error)throw q.error;
   }
   if(kind==='task'){
     if(!title.trim())throw Error('Title required');
     let due=null;
     if(when.trim()){const d=new Date(when);if(Number.isNaN(d.getTime()))throw Error('Invalid due date');due=d.toISOString()}
     const q=await supabase.from('buklod_cluster_tasks').insert({
       scope_id:scope.scope_id,title:title.trim(),description:body.trim()||null,
       due_at:due,status:'OPEN',created_by:user?.id,
     });if(q.error)throw q.error;
   }
   if(kind==='poll'){
     const labels=extra.split(',').map(x=>x.trim()).filter(Boolean);
     if(!title.trim()||labels.length<2)throw Error('Question + at least 2 comma-separated options required');
     const q=await supabase.from('buklod_cluster_polls').insert({
       scope_id:scope.scope_id,question:title.trim(),created_by:user?.id,
     }).select('id').single();if(q.error)throw q.error;
     const o=await supabase.from('buklod_cluster_poll_options').insert(
       labels.map((label,i)=>({poll_id:q.data.id,label,sort_order:i})));
     if(o.error)throw o.error;
   }
   if(kind==='resource'){
     if(!title.trim()||(!extra.trim()&&!assetRef))throw Error('Title and a URL or file required');
     if(!assetRef&&!/^https?:\/\//i.test(extra.trim()))throw Error('Resource URL must use https://');
     const q=await supabase.from('buklod_cluster_resources').insert({
       scope_id:scope.scope_id,title:title.trim(),description:body.trim()||null,
       resource_url:extra.trim()||'',created_by:user?.id,
       storage_path:assetRef?.storagePath??null,original_name:assetRef?pickedAsset?.name??null:null,
       mime_type:assetRef?.mimeType??null,
     });if(q.error)throw q.error;
   }
   if(kind==='recognition'){
     if(!title.trim())throw Error('Title required');
     const q=await supabase.from('buklod_cluster_recognitions').insert({
       scope_id:scope.scope_id,title:title.trim(),recipient_name:extra.trim()||null,
       body:body.trim()||null,created_by:user?.id,
     });if(q.error)throw q.error;
   }
   if(kind==='about'){
     const q=await supabase.from('buklod_cluster_home_settings').upsert({
       scope_id:scope.scope_id,about_text:body.trim()||null,updated_by:user?.id,
     },{onConflict:'scope_id'});if(q.error)throw q.error;
   }
   pendingAssetPath=null;
   setPickedAsset(null);
   setKind(null);
   const resource=({notice:'notices',event:'events',task:'tasks',poll:'polls',
     resource:'resources',recognition:'recognitions',about:'settings'} as Record<string,string>)[selectedKind];
   await load({background:true,resources:[resource]});
  }catch(err:any){
    if(pendingAssetPath)await rollbackBuklodScopeHomeAsset(pendingAssetPath).catch(()=>undefined);
    Alert.alert('Cluster Home',err?.message??'Save failed. Existing records were not changed.');
  }finally{setSaving(false)}
 };

 const rsvp=async(id:string,status:string)=>{if(!user?.id)return;const q=await supabase.from('buklod_cluster_event_rsvps').upsert({event_id:id,user_id:user.id,status},{onConflict:'event_id,user_id'});if(q.error)Alert.alert('RSVP',q.error.message);else await load({background:true,resources:['rsvps']})};
 const taskDone=async(x:Task)=>{const q=await supabase.from('buklod_cluster_tasks').update({status:'DONE'}).eq('id',x.id);if(q.error)Alert.alert('Task',q.error.message);else await load({background:true,resources:['tasks']})};
 const vote=async(optionId:string)=>{if(!poll||!user?.id)return;const q=await supabase.from('buklod_cluster_poll_votes').upsert({poll_id:poll.id,option_id:optionId,user_id:user.id},{onConflict:'poll_id,user_id'});if(q.error)Alert.alert('Poll',q.error.message);else await load({background:true,resources:['polls']})};

 const toggle=async(k:string)=>{if(!isAdmin)return;const n=new Set(settings?.hidden_widgets??[]);n.has(k)?n.delete(k):n.add(k);const arr=[...n];setSettings(x=>({scope_id:scope.scope_id,about_text:x?.about_text??null,hidden_widgets:arr}));const q=await supabase.from('buklod_cluster_home_settings').upsert({scope_id:scope.scope_id,hidden_widgets:arr,updated_by:user?.id},{onConflict:'scope_id'});if(q.error){Alert.alert('Customize',q.error.message);void load({background:true,resources:['settings']})}else{await load({background:true,resources:['settings']})}};
 const openCommunity=()=>{
  if(onOpenCommunity){
    onOpenCommunity();
    return;
  }

  router.setParams({
    section:'community',
  } as any)
};
 const openConnect=()=>{
  if(onOpenConnect){
    onOpenConnect();
    return;
  }

  router.setParams({
    section:'connect',
  } as any)
};
 const invite=buildClusterInviteUrl(scope.scope_id),shareInvite=()=>Share.share({title:`Join ${scope.name}`,message:`Join ${scope.name} on BUKLOD.\n${invite}\nOpen the link to request membership`}),copyInvite=async()=>{await Clipboard.setStringAsync(invite);Alert.alert('Invite link copied','Share it with people you want in this Cluster.')};
 const scrollBottomInset=useBuklodScrollBottomInset({extra:12});
 const drawerBottomInset=useBuklodDrawerBottomInset();

 return <><ScrollView contentContainerStyle={[s.content,{paddingBottom:scrollBottomInset}]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load({background:true})}}/>} showsVerticalScrollIndicator={false}>
  {loadError ? <View style={s.loadingNotice}><Text style={s.empty}>{loadError} Saved content is retained.</Text><Pressable onPress={()=>void load({background:true})}><Text style={s.actionText}>RETRY</Text></Pressable></View> : null}
  {openWidget && pendingCount>0 ? <Text style={s.empty}>Updating selected feature…</Text> : null}
  {loading && !notices.length && !events.length && !posts.length ? <View style={s.loadingNotice}><ActivityIndicator size="small" color="#0874DE"/><Text style={s.empty}>Loading Cluster details; actions remain available.</Text></View> : null}
  <View style={s.topBar}>
    {isAdmin ? <Pressable accessibilityRole="button" accessibilityLabel="Manage Cluster" onPress={()=>router.push(clusterScopeManageRoute(scope.scope_id,scope.name) as any)} style={s.manageMini}>
      <MaterialCommunityIcons name="cog-outline" size={15} color="#FFFFFF"/><Text style={s.manageMiniText}>Manage Cluster</Text>
    </Pressable> : null}
    {isAdmin ? <Pressable accessibilityRole="button" accessibilityLabel="Customize Cluster Home" onPress={()=>setCustomizeOpen(true)} style={s.customizeMini}>
      <MaterialCommunityIcons name="tune-variant" size={15} color="#0869C9"/><Text style={s.customizeMiniText}>Customize Home</Text>
    </Pressable> : null}
  </View>
  <BuklodScopeProfilePhoto scopeId={scope.scope_id} scopeName={scope.name} isAdmin={isAdmin}/>
  <BuklodUnifiedEarningsHomeCard scopeId={scope.scope_id} scopeType={scope.scope_type} />
  {show('notice')&&<Card icon={notice?.priority==='EMERGENCY'?'alert-octagon-outline':'alert-circle-outline'} title={notice?.priority==='EMERGENCY'?'EMERGENCY NOTICE':'IMPORTANT NOTICE'} action={isAdmin?'EDIT':undefined} onAction={isAdmin?()=>edit('notice'):undefined} cardColor={cardColor}>{notice?<><Text style={[s.big,notice.priority==='EMERGENCY'&&{color:'#A82020'}]}>{notice.title}</Text>{notice.body?<Text style={s.body}>{notice.body}</Text>:null}
 {notice.media_url&&notice.media_mime_type?.startsWith('image/')?
   <Image source={{uri:notice.media_url}} style={s.homeMedia} resizeMode="cover"/>:null}
 {notice.media_url&&notice.media_mime_type?.startsWith('video/')?
   <View style={s.video}><CommunityVideo uri={notice.media_url} active={false}
     onOpenFullscreen={()=>{if(notice.media_url)void Linking.openURL(notice.media_url);}}/></View>:null}
 </>:<Empty>No important notice right now.</Empty>}</Card>}
  <BuklodFirstViewAd placement="cluster" placementId="cluster_command_first_view" />
  {/* CLUSTER BULLETIN uses the existing official bulletin card directly. */}
  {show('bulletin')&&<BuklodHomeScopeBulletins/>}
  {scope.show_faith_content ? (
    <>
      <BuklodScopeFaithMonitoringDoor scope={scope} />
      <BuklodScopeBuklodLessonPanel scope={scope} />
      <BuklodHomeFaithPanel scopeId={scope.scope_id} compact />
    </>
  ) : <BuklodNonFaithEncouragementDoor />}
  {/* 14 existing configurable widgets as buttons; selecting opens the original fully functional card below. */}
  <View style={s.featureGrid}>
    {WIDGETS.filter(([k])=>k!=='notice' && k!=='bulletin' && show(k) && (k!=='insights'||isAdmin)).map(([k,l])=>(
      <Pressable key={k} accessibilityRole="button" accessibilityLabel={`Open ${TILE_LABELS[k] ?? l}`}
        accessibilityState={{expanded:openWidget===k}}
        onPress={()=>setOpenWidget(current=>current===k?null:k)}
        style={[s.featureTile,openWidget===k&&s.featureTileActive]}>
        <MaterialCommunityIcons name={TILE_ICONS[k] as any} size={20} color={openWidget===k?'#FFFFFF':(TILE_COLORS[k] ?? '#0874DE')} />
        <Text style={[s.featureTileText,openWidget===k&&{color:'#FFFFFF'}]}>{TILE_LABELS[k] ?? l}</Text>
      </Pressable>
    ))}
  </View>
  {openWidget ? <View style={s.expandedLabel}><Text style={s.expandedText}>Selected Cluster feature</Text><Pressable onPress={()=>setOpenWidget(null)} accessibilityRole="button" accessibilityLabel="Close expanded feature"><MaterialCommunityIcons name="close" size={19} color="#0B5FA9"/></Pressable></View> : null}
  {show('today')&&openWidget==='today'&&<Card icon="calendar-today-outline" title="TODAY / THIS WEEK" cardColor={cardColor}>{filteredWeek.length?filteredWeek.slice(0,4).map(x=><View key={x.id} style={s.row}><View style={s.badge}><Text style={s.badgeText}>{sd(x.starts_at)}</Text></View><View style={{flex:1}}><Text style={s.item}>{x.title}</Text><Text style={s.meta}>{dt(x.starts_at)}</Text></View></View>):<Empty>No scheduled activity in the next 7 days.</Empty>}</Card>}
  {show('events')&&openWidget==='events'&&<Card icon="calendar-star" title="UPCOMING EVENTS" action={isAdmin?'ADD':undefined} onAction={isAdmin?()=>edit('event'):undefined} cardColor={cardColor}>{filteredUpcoming.length?filteredUpcoming.slice(0,6).map(x=>{const mine=rsvps.find(y=>y.event_id===x.id)?.status;return <View key={x.id} style={s.block}><Text style={s.item}>{x.title}</Text><Text style={s.meta}>{dt(x.starts_at)}{x.location?` · ${x.location}`:''}</Text>{x.description?<Text style={s.body}>{x.description}</Text>:null}
 {x.media_url&&x.media_mime_type?.startsWith('image/')?
   <Image source={{uri:x.media_url}} style={s.homeMedia} resizeMode="cover"/>:null}
 {x.media_url&&x.media_mime_type?.startsWith('video/')?
   <View style={s.video}><CommunityVideo uri={x.media_url} active={false}
     onOpenFullscreen={()=>{if(x.media_url)void Linking.openURL(x.media_url);}}/></View>:null}
 <View style={s.chips}>{['GOING','MAYBE','NOT_GOING'].map(z=><Pressable key={z} onPress={()=>void rsvp(x.id,z)} style={[s.chip,mine===z&&s.chipOn]}><Text style={[s.chipText,mine===z&&s.chipTextOn]}>{z.replace('_',' ')}</Text></Pressable>)}</View></View>}):<Empty>No upcoming event.</Empty>}</Card>}

  {show('members')&&openWidget==='members'&&<Card icon="account-multiple-outline" title="MEMBER SNAPSHOT" cardColor={cardColor}><View style={s.stats}><Stat v={scope.member_count??members.length} l="MEMBERS"/><Stat v={officers.length} l="ADMINS"/><Stat v={attendance.length} l="CHECKED IN"/></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.people}>{filteredMembers.slice(0,12).map(x=><View key={x.user_id} style={s.person}><BuklodTappableAvatar userId={x.user_id} uri={x.avatar_url} name={x.full_name} size={42}/><Text numberOfLines={1} style={s.personName}>{x.full_name}</Text></View>)}</ScrollView></Card>}
  {show('officers')&&openWidget==='officers'&&<Card icon="shield-account-outline" title="CLUSTER OFFICERS / ADMINS" cardColor={cardColor}>{officers.length?officers.map(x=><View key={x.user_id} style={s.row}><BuklodTappableAvatar userId={x.user_id} uri={x.avatar_url} name={x.full_name} size={36}/><Text style={s.item}>{x.full_name}</Text></View>):<Empty>No officer information available.</Empty>}</Card>}
  {show('tasks')&&openWidget==='tasks'&&<Card icon="clipboard-check-outline" title="TASKS & ASSIGNMENTS" action={isAdmin?'ADD':undefined} onAction={isAdmin?()=>edit('task'):undefined} cardColor={cardColor}>{filteredTasks.length?filteredTasks.slice(0,8).map(x=><View key={x.id} style={s.block}><View style={s.between}><Text style={[s.item,x.status==='DONE'&&s.done]}>{x.title}</Text><Text style={s.status}>{x.status}</Text></View>{x.description?<Text style={s.body}>{x.description}</Text>:null}{x.due_at?<Text style={s.meta}>Due {dt(x.due_at)}</Text>:null}{x.status!=='DONE'?<Pressable onPress={()=>void taskDone(x)} style={s.small}><Text style={s.smallText}>MARK DONE</Text></Pressable>:null}</View>):<Empty>No tasks assigned.</Empty>}</Card>}
  {show('poll')&&openWidget==='poll'&&<Card icon="poll" title="POLL / QUICK VOTE" action={isAdmin?'NEW':undefined} onAction={isAdmin?()=>edit('poll'):undefined} cardColor={cardColor}>{poll?<><Text style={s.big}>{poll.question}</Text>{pollOptions.map(o=>{const count=votes.filter(v=>v.option_id===o.id).length,sel=myVote?.option_id===o.id;return <Pressable key={o.id} onPress={()=>void vote(o.id)} style={[s.poll,sel&&s.pollOn]}><Text style={[s.item,sel&&{color:colors.white}]}>{o.label}</Text><Text style={[s.status,sel&&{color:colors.white}]}>{count}</Text></Pressable>})}</>:<Empty>No active poll.</Empty>}</Card>}
  {show('community')&&openWidget==='community'&&<Card icon="post-outline" title="COMMUNITY POSTS" action="VIEW COMMUNITY" onAction={openCommunity} cardColor={cardColor}>{filteredPosts.length?filteredPosts.slice(0,4).map(x=><View key={x.id} style={s.post}><View style={s.between}><Text style={s.author}>{x.author_name??'Cluster Member'}</Text><Text style={s.meta}>{sd(x.created_at)}</Text></View>{x.body?<Text numberOfLines={4} style={s.body}>{x.body}</Text>:null}{x.media_url&&String(x.media_mime_type??'').toLowerCase().startsWith('image/')?<BuklodCommunityPhotoCollage items={communityPhotoCollageItems(null,{media_path:x.media_path,media_url:x.media_url,media_mime_type:x.media_mime_type})} onPressPhoto={()=>router.push({pathname:'/post/[id]',params:{id:x.id}} as any)}/>:null}{x.media_url&&String(x.media_mime_type??'').toLowerCase().startsWith('video/')?<View style={s.video}><CommunityVideo uri={x.media_url} active={false} onOpenFullscreen={()=>router.push({pathname:'/post/[id]',params:{id:x.id}} as any)}/></View>:null}<View style={s.postMeta}><Text style={s.meta}>Reactions {total(x.reaction_counts)}</Text><Text style={s.meta}>Comments {x.comment_count??0}</Text></View></View>):<Empty>No member posts yet.</Empty>}</Card>}
  {/* PATCH_177B_R2_CLUSTER_ATTENDANCE */}
 {show('attendance')&&openWidget==='attendance'&&<Card
   icon="clipboard-check-outline"
   title="ATTENDANCE SNAPSHOT"
   action="OPEN"
   onAction={()=>router.push({pathname:'/scope/attendance',params:scopeRouteParams(scope.scope_id,{scopeType:'CLUSTER'})} as any)}
  cardColor={cardColor}><View style={s.stats}><Stat v={attendance.length} l="CHECKED IN"/><Stat v={scope.member_count??members.length} l="MEMBERS"/></View><Text style={s.body}>Check In Today is available only during an official live Cluster attendance event. Each submission needs Admin verification before Points are issued.</Text><BuklodHomeCheckinToday scopeId={scope.scope_id}/></Card>}
  {show('resources')&&openWidget==='resources'&&<Card icon="folder-multiple-outline" title="FILES & RESOURCES" action={isAdmin?'ADD':undefined} onAction={isAdmin?()=>edit('resource'):undefined} cardColor={cardColor}>{filteredResources.length?filteredResources.map(x=><Pressable key={x.id} onPress={()=>{
   const url=x.asset_url||(/^https?:\/\//i.test(x.resource_url)?x.resource_url:null);
   if(url)void Linking.openURL(url);
   else Alert.alert('Resource','This resource is not accessible with your current membership.');
 }} style={s.row}><MaterialCommunityIcons name="file-link-outline" size={21} color={colors.greenDark}/><View style={{flex:1}}><Text style={s.item}>{x.title}</Text>{x.description?<Text numberOfLines={2} style={s.meta}>{x.description}</Text>:null}
 {x.original_name?<Text style={s.meta}>{x.original_name} · secure shared file</Text>:null}</View><MaterialCommunityIcons name="open-in-new" size={17} color={colors.muted}/></Pressable>):<Empty>No shared resources yet.</Empty>}</Card>}
  {show('recognition')&&openWidget==='recognition'&&<Card icon="trophy-outline" title="RECOGNITION / MILESTONES" action={isAdmin?'ADD':undefined} onAction={isAdmin?()=>edit('recognition'):undefined} cardColor={cardColor}>{filteredRecognitions.length?filteredRecognitions.map(x=><View key={x.id} style={s.row}><MaterialCommunityIcons name="medal-outline" size={25} color="#B78216"/><View style={{flex:1}}><Text style={s.item}>{x.title}</Text>{x.recipient_name?<Text style={s.recipient}>{x.recipient_name}</Text>:null}{x.body?<Text style={s.body}>{x.body}</Text>:null}</View></View>):<Empty>No recognition posted yet.</Empty>}</Card>}
  {show('calls')&&openWidget==='calls'&&<Card icon="phone-in-talk-outline" title="LIVE CLUSTER AUDIO / VIDEO CALL" cardColor={cardColor}><BuklodScopeCallLauncher scopeId={scope.scope_id} title={scope.name}/></Card>}
  {show('invite')&&openWidget==='invite'&&<Card icon="qrcode" title="INVITE / QR" cardColor={cardColor}><View style={s.invite}><BuklodQrMatrix value={invite} size={176}/><View style={{flex:1}}><Text style={s.item}>Cluster invitation link</Text><Pressable onPress={()=>void copyInvite()} accessibilityRole="button" accessibilityLabel="Copy Cluster invite link"><Text selectable numberOfLines={2} style={[s.meta,s.inviteLink]}>{invite}</Text></Pressable></View></View><View style={s.inviteActions}><Pressable onPress={()=>void shareInvite()} style={s.primary}><MaterialCommunityIcons name="share-variant-outline" size={18} color="#fff"/><Text style={s.primaryText}>SHARE INVITE</Text></Pressable><Pressable onPress={()=>void copyInvite()} style={s.secondary}><MaterialCommunityIcons name="content-copy" size={18} color={colors.greenDark}/><Text style={s.secondaryText}>COPY LINK</Text></Pressable></View><Text style={s.help}>Scan or share this invite link. Join approval depends on Cluster privacy settings.</Text></Card>}
  {show('about')&&openWidget==='about'&&<Card icon="information-outline" title="ABOUT CLUSTER" action={isAdmin?'EDIT':undefined} onAction={isAdmin?()=>edit('about'):undefined} cardColor={cardColor}><Text style={s.body}>{settings?.about_text||description||'No Cluster description yet.'}</Text><Text style={[s.meta,{marginTop:8}]}>Visibility: {scope.visibility??'—'} · Status: {scope.scope_status??'ACTIVE'}</Text></Card>}
  {isAdmin&&show('insights')&&openWidget==='insights'&&<Card icon="chart-box-outline" title="ADMIN INSIGHTS" cardColor={cardColor}><View style={s.stats}><Stat v={scope.member_count??members.length} l="MEMBERS"/><Stat v={openTasks.length} l="OPEN TASKS"/><Stat v={upcoming.length} l="EVENTS"/><Stat v={attendance.length} l="TODAY"/></View></Card>}
  {/* PATCH_170B_R3_CUSTOMIZE_DRAWER preserved in the existing modal; entry now beside Search. */}
  <BuklodScreenBottomBanner placement="cluster" variant="large" />
  <View style={{height:28}}/>
 </ScrollView>
 <Modal
  visible={customizeOpen}
  transparent
  animationType="slide"
  onRequestClose={()=>setCustomizeOpen(false)}
 >
  <View style={s.backdrop}>
   <View style={[s.drawer,{paddingBottom:drawerBottomInset}]}>
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
        Show or hide cards for this Cluster. Header controls stay available.
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
 <Modal
  visible={kind!==null}
  transparent
  animationType="slide"
  onRequestClose={()=>setKind(null)}
 >
  {/* The editor is a separate native Modal; root keyboard avoidance cannot resize it. */}
  <KeyboardAvoidingView
   style={s.backdrop}
   behavior={Platform.OS==='ios'?'padding':'height'}
   keyboardVerticalOffset={0}
  >
   <View style={[s.modal,{paddingBottom:drawerBottomInset}]}>
    <View style={s.between}>
     <Text style={s.modalTitle}>{kind==='notice'?'Important Notice':kind==='event'?'Add Event':kind==='task'?'Add Task':kind==='poll'?'Create Poll':kind==='resource'?'Add Resource':kind==='recognition'?'Add Recognition':'Edit About Cluster'}</Text>
     <Pressable accessibilityRole="button" accessibilityLabel="Close editor" onPress={()=>setKind(null)}>
      <MaterialCommunityIcons name="close" size={24} color={colors.text}/>
     </Pressable>
    </View>
    <ScrollView
     style={s.editorFieldsScroll}
     contentContainerStyle={s.editorFields}
     keyboardShouldPersistTaps="handled"
     keyboardDismissMode={Platform.OS==='ios'?'interactive':'on-drag'}
     showsVerticalScrollIndicator={false}
    >
     {kind!=='about'?<TextInput value={title} onChangeText={setTitle} placeholder={kind==='poll'?'Question':'Title'} style={s.input}/>:null}
     <TextInput value={body} onChangeText={setBody} placeholder={kind==='about'?'Cluster description / purpose':'Details / description'} multiline style={[s.input,s.area]}/>
     {kind==='notice'?<TextInput value={extra} onChangeText={setExtra} placeholder="Type EMERGENCY for emergency priority" style={s.input}/>:null}
     {kind==='event'?<>
      <TextInput value={extra} onChangeText={setExtra} placeholder="Location" style={s.input}/>
      <TextInput value={when} onChangeText={setWhen} placeholder="2026-08-20 18:00" style={s.input}/>
     </>:null}
     {kind==='task'?<TextInput value={when} onChangeText={setWhen} placeholder="Due date/time (optional)" style={s.input}/>:null}
     {kind==='poll'?<TextInput value={extra} onChangeText={setExtra} placeholder="Option 1, Option 2, Option 3" style={s.input}/>:null}
     {kind==='resource'?<TextInput value={extra} onChangeText={setExtra}
       placeholder="https:// link (optional when uploading file)" autoCapitalize="none" style={s.input}/>:null}
     {(kind==='resource'||kind==='notice'||kind==='event')&&(
       <View style={{gap:8,marginVertical:5}}>
         <Pressable accessibilityRole="button" accessibilityLabel={kind==='resource'?'Choose resource file':'Choose photo or video'}
           disabled={saving} onPress={()=>void pickHomeAsset()} style={s.secondary}>
           <MaterialCommunityIcons name={kind==='resource'?'file-upload-outline':'image-multiple-outline'}
             size={19} color={colors.greenDark}/>
           <Text style={s.secondaryText}>{kind==='resource'?'UPLOAD FILE':'UPLOAD PHOTO / VIDEO'}</Text>
         </Pressable>
         {pickedAsset&&(
           <View style={{padding:9,backgroundColor:'#E8F8EF',borderRadius:10,gap:5}}>
             <Text style={s.item}>{pickedAsset.name}</Text>
             <Text style={s.meta}>{pickedAsset.mediaType.toUpperCase()} · {(pickedAsset.size/1048576).toFixed(1)} MB · Upload starts when you save</Text>
             {pickedAsset.mediaType==='image'&&(
               <Image source={{uri:pickedAsset.uri}} style={s.homeMedia} resizeMode="cover"/>
             )}
             <Pressable accessibilityRole="button" onPress={()=>setPickedAsset(null)}>
               <Text style={[s.actionText,{color:'#AA3737'}]}>REMOVE SELECTED FILE</Text>
             </Pressable>
           </View>
         )}
       </View>
     )}
     {kind==='recognition'?<TextInput value={extra} onChangeText={setExtra} placeholder="Member / team name" style={s.input}/>:null}
    </ScrollView>
    {/* Footer remains outside the scrolling fields and inside the keyboard-safe sheet. */}
    <Pressable
     accessibilityRole="button"
     accessibilityLabel="Save Cluster Home changes"
     disabled={saving}
     onPress={()=>void save()}
     style={[s.primary,s.editorSave,saving&&{opacity:.5}]}
    >
     {saving?<ActivityIndicator size="small" color="#fff"/>:<MaterialCommunityIcons name="content-save-outline" size={18} color="#fff"/>}
     <Text style={s.primaryText}>SAVE</Text>
    </Pressable>
   </View>
  </KeyboardAvoidingView>
 </Modal>
 </>;
}
function Quick({icon,text,onPress}:{icon:any;text:string;onPress:()=>void}){return <Pressable onPress={onPress} style={s.quick}><MaterialCommunityIcons name={icon} size={22} color={colors.greenDark}/><Text style={s.quickText}>{text}</Text></Pressable>}
function Stat({v,l}:{v:number|string;l:string}){return <View style={s.stat}><Text style={s.statV}>{v}</Text><Text style={s.statL}>{l}</Text></View>}

const s=StyleSheet.create({
 homeMedia:{width:'100%',height:190,borderRadius:12,marginTop:6,backgroundColor:'#DAEAE3'},
 loadingNotice:{flexDirection:'row',alignItems:'center',gap:9,padding:10,backgroundColor:'#FFFFFF',borderRadius:12},
 content:{paddingHorizontal:10,paddingTop:9,paddingBottom:30,gap:9,backgroundColor:'#F2F7FD'},topBar:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:6,marginBottom:2},topSearch:{flexGrow:1,flexShrink:1,minWidth:125,minHeight:40,maxHeight:40,borderRadius:9,borderWidth:1,borderColor:'#CDE1F7',paddingHorizontal:10,color:colors.text,backgroundColor:colors.white,fontSize:11},manageMini:{minHeight:40,paddingHorizontal:8,borderRadius:9,flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#0874DE'},manageMiniText:{fontSize:9,color:'#FFFFFF',fontWeight:'900'},customizeMini:{minHeight:40,paddingHorizontal:8,borderRadius:9,borderWidth:1,borderColor:'#87B9ED',flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#FFFFFF'},customizeMiniText:{fontSize:9,color:'#0869C9',fontWeight:'900'},featureGrid:{flexDirection:'row',flexWrap:'wrap',gap:6},featureTile:{width:'22%',minWidth:73,flexGrow:1,minHeight:69,paddingHorizontal:4,paddingVertical:9,borderRadius:10,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DEECFA',justifyContent:'center',alignItems:'center',gap:5},featureTileActive:{backgroundColor:'#0874DE',borderColor:'#0874DE'},featureTileText:{color:'#224D78',fontSize:9,fontWeight:'800',textAlign:'center'},expandedLabel:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:5,paddingTop:7},expandedText:{fontSize:10,color:'#0B5FA9',fontWeight:'800'},topInvite:{minHeight:48,minWidth:48,paddingHorizontal:14,borderRadius:12,backgroundColor:colors.greenDark,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},topInviteText:{color:'#fff',fontSize:10,fontWeight:'900',letterSpacing:.2},loading:{flex:1,alignItems:'center',justifyContent:'center',gap:9,padding:30},card:{borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,borderRadius:18,padding:12,backgroundColor:colors.white},head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:10},hleft:{flex:1,flexDirection:'row',alignItems:'center',gap:8},ico:{width:31,height:31,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},ht:{flex:1,color:colors.text,fontSize:12,fontWeight:'900'},action:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,backgroundColor:colors.greenSoft},actionText:{color:colors.greenDark,fontSize:8,fontWeight:'900'},empty:{color:colors.muted,fontSize:11,lineHeight:17},big:{color:colors.text,fontSize:13,fontWeight:'900',marginBottom:5},body:{color:colors.text,fontSize:11.5,lineHeight:18},meta:{color:colors.muted,fontSize:9,lineHeight:14},row:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:7},block:{paddingVertical:9,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line,gap:5},between:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:9},badge:{width:52,minHeight:38,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},badgeText:{color:colors.greenDark,fontSize:9,fontWeight:'900'},item:{flex:1,color:colors.text,fontSize:11,fontWeight:'900'},chips:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:6},chip:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,borderWidth:1,borderColor:colors.line,flexDirection:'row',alignItems:'center',gap:4},chipOn:{backgroundColor:colors.greenDark,borderColor:colors.greenDark},chipText:{color:colors.muted,fontSize:7.5,fontWeight:'900'},chipTextOn:{color:colors.white},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},quick:{width:'22%',minWidth:72,flexGrow:1,minHeight:50,padding:6,borderRadius:10,alignItems:'center',justifyContent:'center',gap:3,backgroundColor:'#E9F4FF'},quickText:{color:'#145EAA',fontSize:8,fontWeight:'900',textAlign:'center'},stats:{flexDirection:'row',flexWrap:'wrap',gap:8},stat:{minWidth:78,flex:1,padding:10,borderRadius:13,alignItems:'center',backgroundColor:colors.greenSoft},statV:{color:colors.greenDark,fontSize:20,fontWeight:'900'},statL:{marginTop:2,color:colors.muted,fontSize:7,fontWeight:'900'},people:{gap:10,paddingTop:12},person:{width:64,alignItems:'center',gap:4},avatar:{width:42,height:42,borderRadius:21,backgroundColor:colors.greenSoft},avFallback:{alignItems:'center',justifyContent:'center'},personName:{width:'100%',color:colors.text,fontSize:8,fontWeight:'800',textAlign:'center'},status:{color:colors.greenDark,fontSize:8,fontWeight:'900'},done:{textDecorationLine:'line-through',color:colors.muted},small:{alignSelf:'flex-start',paddingHorizontal:9,paddingVertical:6,borderRadius:999,backgroundColor:colors.greenSoft},smallText:{color:colors.greenDark,fontSize:8,fontWeight:'900'},poll:{minHeight:42,paddingHorizontal:12,paddingVertical:9,borderRadius:12,borderWidth:1,borderColor:colors.line,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:6},pollOn:{backgroundColor:colors.greenDark,borderColor:colors.greenDark},post:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.line,paddingVertical:10,gap:7},author:{flex:1,color:colors.text,fontSize:10.5,fontWeight:'900'},postImage:{width:'100%',height:180,borderRadius:13,backgroundColor:colors.greenSoft},video:{minHeight:200,borderRadius:13,overflow:'hidden'},postMeta:{flexDirection:'row',gap:14},cal:{width:49,height:49,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenDark},calDay:{color:'#fff',fontSize:17,fontWeight:'900'},calMonth:{color:'#fff',fontSize:7,fontWeight:'900'},primary:{minHeight:42,paddingHorizontal:14,paddingVertical:9,borderRadius:12,backgroundColor:colors.greenDark,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},primaryText:{color:'#fff',fontSize:9,fontWeight:'900'},recipient:{color:'#8A6214',fontSize:9,fontWeight:'900'},invite:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:10},inviteLink:{color:colors.greenDark,textDecorationLine:'underline'},inviteActions:{flexDirection:'row',flexWrap:'wrap',gap:8},secondary:{minHeight:42,paddingHorizontal:14,paddingVertical:9,borderRadius:12,borderWidth:1,borderColor:colors.greenDark,backgroundColor:colors.white,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,flex:1},secondaryText:{color:colors.greenDark,fontSize:9,fontWeight:'900'},qr:{width:82,height:82,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},code:{marginVertical:4,color:colors.greenDark,fontSize:17,fontWeight:'900',letterSpacing:2},help:{color:colors.muted,fontSize:9,lineHeight:14,marginTop:8},
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
 backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.35)'},modal:{maxHeight:'86%',minHeight:0,flexShrink:1,borderTopLeftRadius:24,borderTopRightRadius:24,padding:18,gap:10,backgroundColor:colors.white},modalTitle:{flex:1,color:colors.text,fontSize:16,fontWeight:'900'},editorFieldsScroll:{flexGrow:0,flexShrink:1,minHeight:0},editorFields:{gap:10,paddingBottom:2},editorSave:{minHeight:48,flexShrink:0},input:{minHeight:46,borderRadius:12,borderWidth:1,borderColor:colors.line,paddingHorizontal:12,paddingVertical:10,color:colors.text,backgroundColor:colors.white,fontSize:11},area:{minHeight:96,textAlignVertical:'top'}
});

