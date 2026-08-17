import {useCallback,useEffect,useState} from 'react';
import {Alert,FlatList,Pressable,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {supabase} from '@/lib/supabase';
import {Button,Card,shared} from '@/components/UI';
import {colors} from '@/lib/theme';
import {useAuth} from '@/providers/AuthProvider';
import {useNotifications} from '@/providers/NotificationProvider';

function pathFor(x:any){if(x.data?.post_id&&['community_comment','community_reaction','community_mention','post_share_request','post_share_approved','post_share_declined'].includes(x.kind))return `/post/${x.data.post_id}`;if(x.kind==='direct_message'&&x.data?.conversation_id)return `/connect/${x.data.conversation_id}`;return null}

export default function NotificationCenter(){
 const {user}=useAuth();const {unreadCount,refreshUnread,markAllRead}=useNotifications();const [items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(false);
 const load=useCallback(async()=>{if(!user?.id)return;setLoading(true);const {data,error}=await supabase.from('notifications').select('id,title,body,kind,data,read_at,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(150);setLoading(false);if(error)return Alert.alert('Notifications',error.message);setItems(data??[]);await refreshUnread()},[user?.id,refreshUnread]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{if(!user?.id)return;const c=supabase.channel(`notif-center-screen:${user.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${user.id}`},()=>load()).subscribe();return()=>{supabase.removeChannel(c)}},[user?.id,load]);
 const open=async(x:any)=>{if(!x.read_at){await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',x.id).eq('user_id',user?.id);await refreshUnread()}const p=pathFor(x);if(p)router.push(p as any);else await load()};
 return <View style={shared.screen}><FlatList contentContainerStyle={s.content} data={items} keyExtractor={x=>x.id} refreshing={loading} onRefresh={load}
 ListHeaderComponent={<View><View style={s.header}><View style={{flex:1}}><Text style={shared.h1}>Notifications</Text><Text style={shared.muted}>{unreadCount} unread</Text></View><View style={s.bell}><MaterialCommunityIcons name="bell-outline" size={23} color={colors.greenDark}/>{unreadCount>0&&<View style={s.badge}><Text style={s.badgeText}>{Math.min(unreadCount,99)}</Text></View>}</View></View>
 {unreadCount>0&&<Button title="MARK ALL AS READ" outline onPress={async()=>{try{await markAllRead();await load()}catch(e:any){Alert.alert('Notifications',e?.message||'Could not mark as read.')}}}/>}</View>}
 ListEmptyComponent={<Card><Text style={shared.muted}>No notifications yet.</Text></Card>}
 renderItem={({item})=><Pressable onPress={()=>open(item)}><Card><View style={s.row}><View style={[s.dot,item.read_at&&s.dotRead]}/><View style={{flex:1}}><Text style={s.title}>{item.title}</Text><Text style={s.body}>{item.body}</Text><Text style={s.time}>{new Date(item.created_at).toLocaleString()}</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted}/></View></Card></Pressable>}/></View>
}
const s=StyleSheet.create({content:{padding:16,paddingBottom:50},header:{flexDirection:'row',alignItems:'center',marginBottom:10},bell:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},badge:{position:'absolute',top:-2,right:-2,minWidth:20,height:20,paddingHorizontal:5,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#B3261E'},badgeText:{color:colors.white,fontSize:8.5,fontWeight:'900'},row:{flexDirection:'row',alignItems:'flex-start',gap:9},dot:{width:9,height:9,borderRadius:5,marginTop:5,backgroundColor:colors.green},dotRead:{backgroundColor:colors.line},title:{fontSize:13,fontWeight:'900',color:colors.text},body:{marginTop:5,fontSize:12,lineHeight:18,color:colors.text},time:{marginTop:6,fontSize:9.5,color:colors.muted}});
