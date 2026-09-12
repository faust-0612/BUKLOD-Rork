import {createContext,ReactNode,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {AppState,Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {registerPushToken} from '@/lib/pushNotifications';
import {
  buklodNotificationTarget,
  syncScopeSelection,
} from '@/lib/buklodScopeRoute';
import { buklodReportLandingPath } from '@/lib/buklodReportRoutes';
import { resolveMzbOrganizationScopeId } from '@/lib/buklodMzbOrganization';

type Ctx={unreadCount:number;refreshUnread:()=>Promise<void>;markAllRead:()=>Promise<void>};
const Context=createContext<Ctx|undefined>(undefined);
/* PATCH_171C_PUSH_CHANNEL_V2 */
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:true} as any)});

export function NotificationProvider({children}:{children:ReactNode}){
 const {user}=useAuth();
 const {scopes,selectScope,activeScope}=useBuklodScope();
 const [unreadCount,setUnreadCount]=useState(0);
 useEffect(()=>{if(!user?.id)return;void registerPushToken(user.id).catch(e=>console.warn('BUKLOD push registration',e))},[user?.id]);
 const badge=useCallback(async(n:number)=>{try{await Notifications.setBadgeCountAsync(n)}catch(e){console.warn('Notification badge',e)}},[]);
 const refreshUnread=useCallback(async()=>{if(!user?.id){setUnreadCount(0);await badge(0);return}
  const {count,error}=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).is('read_at',null);
  if(error){console.warn('Notification count',error.message);return}const n=count??0;setUnreadCount(n);await badge(n);
 },[user?.id,badge]);
 const markAllRead=useCallback(async()=>{if(!user?.id)return;const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);if(error)throw error;await refreshUnread()},[user?.id,refreshUnread]);

 const openNotification=useCallback(async(kind:string,data:any)=>{
  if(data?.prayer_request_id){
   router.push(`/prayer/${data.prayer_request_id}` as any);
   return;
  }
  if(data?.prayer_id){
   router.push(`/prayer/${data.prayer_id}` as any);
   return;
  }

  const reportScopeId=String(data?.scope_id??'').trim();
  const reportAssignmentId=String(data?.report_assignment_id??'').trim();
  if(kind.startsWith('report_')&&reportScopeId&&reportAssignmentId){
   void syncScopeSelection(selectScope,reportScopeId,activeScope?.scope_id);
   router.push(buklodReportLandingPath(reportScopeId,reportAssignmentId) as any);
   return;
  }

  const mzbCanonicalScopeId=await resolveMzbOrganizationScopeId().catch(()=>null);
  const target=buklodNotificationTarget(kind,data,{scopes,mzbCanonicalScopeId});

  if(!target?.path){
   router.push('/notifications' as any);
   return;
  }

  if(target.scopeId){
   void syncScopeSelection(selectScope,target.scopeId,activeScope?.scope_id);
  }

  router.push(target.path as any);
 },[scopes,selectScope,activeScope?.scope_id]);

 useEffect(()=>{void (async()=>{try{if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('buklod-activity-v2',{
    name:'BUKLOD Activity Alerts',
    importance:Notifications.AndroidImportance.MAX,
    vibrationPattern:[0,250,250,250],
    enableVibrate:true,
    showBadge:true
});
  const p=await Notifications.getPermissionsAsync();if(p.status!=='granted')await Notifications.requestPermissionsAsync()}catch(e){console.warn('Notification permission',e)}})()},[]);
 useEffect(()=>{void refreshUnread()},[refreshUnread]);

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

  const receivedSub=Notifications.addNotificationReceivedListener(()=>{
   setUnreadCount(current=>{
    const next=current+1;
    void badge(next);
    return next;
   });
  });

  return()=>{
   appStateSub.remove();
   receivedSub.remove();
  };
 },[user?.id,refreshUnread,badge]);

 /* PATCH_171B_COLD_START_NOTIFICATION_RESPONSE */
 useEffect(()=>{
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

   void openNotification(
     String(d.kind||'general'),
     d
   );
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
 },[openNotification]);
 const value=useMemo(()=>({unreadCount,refreshUnread,markAllRead}),[unreadCount,refreshUnread,markAllRead]);
 return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useNotifications(){const v=useContext(Context);if(!v)throw new Error('useNotifications must be used inside NotificationProvider');return v}