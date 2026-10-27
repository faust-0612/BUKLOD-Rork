import {createContext,ReactNode,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {Alert,AppState,InteractionManager,Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {registerPushToken} from '@/lib/pushNotifications';
import { classifyBuklodNotificationSound, isBuklodMessageThreadOpen, playBuklodCue } from '@/lib/buklodSounds';
import { syncScopeSelection } from '@/lib/buklodScopeRoute';
import { resolveBuklodNotificationTarget } from '@/lib/buklodNotificationNavigation';
import { runClusterJoinNotificationAction } from '@/lib/clusterJoinNotificationAction';
import {
  CLUSTER_JOIN_APPROVE_ACTION,
  CLUSTER_JOIN_DECLINE_ACTION,
} from '@/lib/clusterJoinNotification';
import {
  BUKLOD_MESSAGE_REPLY_ACTION,
  BUKLOD_MESSAGE_REPLY_CATEGORY,
  sendBuklodNotificationQuickReply,
} from '@/lib/buklodNotificationQuickReply';

type Ctx={unreadCount:number;refreshUnread:()=>Promise<void>;markAllRead:()=>Promise<void>};
const Context=createContext<Ctx|undefined>(undefined);
/* PATCH_171C_PUSH_CHANNEL_V2 */
Notifications.setNotificationHandler({handleNotification:async n=>({
 shouldShowBanner:true,
 shouldShowList:true,
 // Expo owns background notifications. In the foreground BUKLOD plays one
 // rate-limited event cue instead of a second system sound.
 shouldPlaySound:['community_emergency','ptt_sos','ptt_priority','ptt_incoming'].includes(String(n.request.content.data?.kind||'')),
 shouldSetBadge:true,
} as any)});

export function NotificationProvider({children}:{children:ReactNode}){
 const {user}=useAuth();
 const {scopes,selectScope,activeScope}=useBuklodScope();
 const [unreadCount,setUnreadCount]=useState(0);
 useEffect(()=>{
  if(!user?.id)return;
  const task=InteractionManager.runAfterInteractions(()=>{
   void registerPushToken(user.id).catch(e=>console.warn('BUKLOD push registration',e));
  });
  return()=>{task.cancel()};
 },[user?.id]);
 const badge=useCallback(async(n:number)=>{try{await Notifications.setBadgeCountAsync(n)}catch(e){console.warn('Notification badge',e)}},[]);
 const refreshUnread=useCallback(async()=>{if(!user?.id){setUnreadCount(0);await badge(0);return}
  const {count,error}=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).is('read_at',null);
  if(error){console.warn('Notification count',error.message);return}const n=count??0;setUnreadCount(n);await badge(n);
 },[user?.id,badge]);
 const markAllRead=useCallback(async()=>{if(!user?.id)return;const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);if(error)throw error;await refreshUnread()},[user?.id,refreshUnread]);

 const openNotification=useCallback(async(kind:string,data:any)=>{
  if(kind==='community_emergency'&&data?.help_request_id){
   router.push(`/buklod?help_request_id=${encodeURIComponent(String(data.help_request_id))}` as any);
   return;
  }

  const target=resolveBuklodNotificationTarget(kind,data,{scopes});

  if(!target?.path){
   router.push('/notifications' as any);
   return;
  }

  if(target.scopeId){
   await syncScopeSelection(selectScope,target.scopeId,activeScope?.scope_id);
  }

  router.push(target.path as any);
 },[scopes,selectScope,activeScope?.scope_id]);

 /* PERF_STARTUP_R1: channel + permission work after first interactions */
 useEffect(()=>{
  let cancelled=false;
  const task=InteractionManager.runAfterInteractions(()=>{
   void (async()=>{
    if(cancelled)return;
    try{
     if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('buklod-activity-v2',{
      name:'BUKLOD Activity Alerts',
      importance:Notifications.AndroidImportance.MAX,
      vibrationPattern:[0,250,250,250],
      enableVibrate:true,
      showBadge:true
     });
     if(Platform.OS!=='web'){
      await Notifications.setNotificationCategoryAsync('buklod_cluster_join_request',[
       {identifier:CLUSTER_JOIN_APPROVE_ACTION,buttonTitle:'Approve',options:{opensAppToForeground:true}},
       {identifier:CLUSTER_JOIN_DECLINE_ACTION,buttonTitle:'Decline',options:{opensAppToForeground:true,isDestructive:true}},
      ]);
      await Notifications.setNotificationCategoryAsync('buklod_cluster_invite',[
       {identifier:CLUSTER_JOIN_APPROVE_ACTION,buttonTitle:'Accept',options:{opensAppToForeground:true}},
       {identifier:CLUSTER_JOIN_DECLINE_ACTION,buttonTitle:'Decline',options:{opensAppToForeground:true,isDestructive:true}},
      ]);
      await Notifications.setNotificationCategoryAsync(BUKLOD_MESSAGE_REPLY_CATEGORY, [
       {
        identifier: BUKLOD_MESSAGE_REPLY_ACTION,
        buttonTitle: 'Reply',
        options: { opensAppToForeground: true },
        textInput: { placeholder: 'Write your reply', submitButtonTitle: 'Send' },
       },
      ]);
     }
     const p=await Notifications.getPermissionsAsync();
     if(!cancelled && p.status!=='granted')await Notifications.requestPermissionsAsync();
    }catch(e){console.warn('Notification permission',e)}
   })();
  });
  return()=>{cancelled=true;task.cancel()};
 },[]);
 useEffect(()=>{
  const task=InteractionManager.runAfterInteractions(()=>{
   void refreshUnread();
  });
  return()=>{task.cancel()};
 },[refreshUnread]);

 /* BUKLOD_5K_SCALE_R1_NOTIFICATION_NO_CDC
  * Remote push is already the user-visible notification source, so keeping
  * one Postgres Changes subscription open for every signed-in member was
  * unnecessary database pressure. Refresh the authoritative unread count
  * on foreground, and update the local badge immediately when a push arrives.
  */
 useEffect(()=>{
  if(!user?.id)return;

  const appStateSub=AppState.addEventListener('change',state=>{
   if(state==='active')void refreshUnread();
  });

  const receivedSub=Notifications.addNotificationReceivedListener(notification=>{
   setUnreadCount(current=>{
    const next=current+1;
    void badge(next);
    return next;
   });
   const data:any=notification.request.content.data||{};
   const kind=String(data.kind||'');
   if(['community_emergency','ptt_sos','ptt_priority','ptt_incoming'].includes(kind)) return;
   const cue=classifyBuklodNotificationSound(kind);
   const threadId=String(data.conversation_id||data.thread_id||data.scope_id||'');
   if(cue && !(cue==='message' && isBuklodMessageThreadOpen(threadId))) {
    void playBuklodCue(cue);
   }
  });

  return()=>{
   appStateSub.remove();
   receivedSub.remove();
  };
 },[user?.id,refreshUnread,badge]);

 /* PATCH_171B_COLD_START_NOTIFICATION_RESPONSE */
 useEffect(()=>{
  if(!user?.id)return;
  let active=true;
  const handled=new Set<string>();

  const openResponse=(
   r:Notifications.NotificationResponse|null|undefined
  )=>{
   if(!active||!r)return;

   const requestId=
    r.notification.request.identifier||'unknown';

   const actionId=
    r.actionIdentifier||
    Notifications.DEFAULT_ACTION_IDENTIFIER;

   const key=`${requestId}:${actionId}`;

   if(handled.has(key))return;
   handled.add(key);

   const d:any=
    r.notification.request.content.data||{};

   if(actionId===BUKLOD_MESSAGE_REPLY_ACTION){
    const text=String(r.userText??'').trim();
    if(!text){
     void openNotification(String(d.kind||'general'),d).catch(()=>undefined);
     return;
    }
    void sendBuklodNotificationQuickReply({
     userId:user.id,
     kind:String(d.kind||''),
     data:d,
     notificationId:String(d.notification_id||requestId),
     text,
    }).then(()=>{
     void Notifications.dismissNotificationAsync(requestId).catch(()=>undefined);
    }).catch((error:any)=>{
     Alert.alert(
      'Reply not confirmed',
      `${error?.message||'Please check the conversation before retrying.'} Open the conversation to verify before sending again.`,
     );
     void openNotification(String(d.kind||'general'),d).catch(()=>undefined);
    });
    return;
   }

   if(
    actionId===CLUSTER_JOIN_APPROVE_ACTION||
    actionId===CLUSTER_JOIN_DECLINE_ACTION
   ){
    void runClusterJoinNotificationAction({
     kind:String(d.kind||''),
     data:d,
     approve:actionId===CLUSTER_JOIN_APPROVE_ACTION,
    }).catch(()=>{
     void openNotification(String(d.kind||'general'),d);
    });
    return;
   }

   void openNotification(
     String(d.kind||'general'),
     d
   ).catch((error)=>{
    console.warn('Notification route:',error);
    router.push('/notifications' as any);
   });
  };

  const initial=
   Notifications.getLastNotificationResponse();

  if(initial){
   openResponse(initial);
   Notifications.clearLastNotificationResponse();
  }

  const sub=
   Notifications.addNotificationResponseReceivedListener(
    r=>{
     openResponse(r);
     Notifications.clearLastNotificationResponse();
    }
   );

  return()=>{
   active=false;
   sub.remove();
  };
 },[openNotification,user?.id]);
 const value=useMemo(()=>({unreadCount,refreshUnread,markAllRead}),[unreadCount,refreshUnread,markAllRead]);
 return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useNotifications(){const v=useContext(Context);if(!v)throw new Error('useNotifications must be used inside NotificationProvider');return v}
