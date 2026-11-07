import {useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Image,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import {supabase} from '@/lib/supabase';

type PaidAd={
 id:string;advertiser_name:string;headline:string;short_text:string|null;
 creative_type:'photo'|'video';image_url:string|null;video_url:string|null;
 coverage_level:string;province:string|null;city_municipality:string|null;
 barangay:string|null;payment_method:string|null;payment_reference:string|null;
 payment_proof_path:string|null;payment_status:string;amount_paid:number;
 monthly_price:number|null;currency:string;status:string;policy_confirmed:boolean;
 starts_at:string;ends_at:string;created_at:string;
};

type ReviewAction='verify_payment'|'approve'|'reject'|'pause'|'resume';
const money=(value:number|null)=>'₱'+Number(value||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const actions:Record<ReviewAction,string>={
 verify_payment:'Confirm payment verified',approve:'Approve campaign',
 reject:'Reject campaign',pause:'Pause campaign',resume:'Resume campaign',
};

export default function BuklodPaidAdsReview(){
 const [ads,setAds]=useState<PaidAd[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState<string|null>(null);
 const [confirm,setConfirm]=useState<{id:string;action:ReviewAction}|null>(null);
 const [message,setMessage]=useState<string|null>(null);

 const load=useCallback(async()=>{
   setLoading(true);
   const {data,error}=await supabase.from('buklod_paid_ad_campaigns')
     .select('id,advertiser_name,headline,short_text,creative_type,image_url,video_url,coverage_level,province,city_municipality,barangay,payment_method,payment_reference,payment_proof_path,payment_status,amount_paid,monthly_price,currency,status,policy_confirmed,starts_at,ends_at,created_at')
     .order('created_at',{ascending:false}).limit(60);
   if(error){setMessage('Could not load paid advertising requests: '+error.message);}
   else{setAds((data??[]) as PaidAd[]);setMessage(null);}
   setLoading(false);
 },[]);

 useEffect(()=>{void load();},[load]);

 async function viewProof(item:PaidAd){
   if(!item.payment_proof_path){setMessage('No payment screenshot was attached. Verify the reference against your payment provider independently.');return;}
   setBusy(item.id);
   try{
     const {data,error}=await supabase.storage.from('paid-ad-payment').createSignedUrl(item.payment_proof_path,90);
     if(error||!data?.signedUrl)throw error??new Error('Could not open private payment proof');
     await Linking.openURL(data.signedUrl);
   }catch(e:any){setMessage('Payment proof unavailable: '+(e?.message||'Try again.'));}
   finally{setBusy(null);}
 }

 async function apply(item:PaidAd,action:ReviewAction){
   if(busy)return;
   setBusy(item.id);setMessage(null);
   try{
     const {error}=await supabase.rpc('buklod_admin_review_paid_ad_v1',{p_campaign_id:item.id,p_action:action});
     if(error)throw error;
     setConfirm(null);
     await load();
     setMessage(actions[action]+' — successful.');
   }catch(e:any){setMessage('Admin action rejected: '+(e?.message||'Check campaign status and authorization.'));}
   finally{setBusy(null);}
 }

 function ask(item:PaidAd,action:ReviewAction){
   if(busy)return;
   setConfirm({id:item.id,action});setMessage(null);
 }

 return <View style={styles.wrap} testID="admin-paid-ad-review">
   <View style={styles.head}>
     <View style={{flex:1}}>
       <Text style={styles.title}>PAID ADVERTISEMENTS — ADMIN REVIEW</Text>
       <Text style={styles.subtitle}>Self-service photo/video submissions. Payment must be checked independently before content approval.</Text>
     </View>
     <Pressable accessibilityRole="button" onPress={()=>void load()} style={styles.refresh}>
       <Text style={styles.refreshText}>Refresh</Text>
     </Pressable>
   </View>
   {!!message&&<Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
   {loading&&<ActivityIndicator color="#216847"/>}
   {!loading&&ads.length===0&&<Text style={styles.empty}>No self-service advertising requests yet.</Text>}
   {ads.map(item=><View key={item.id} style={styles.card}>
     <View style={styles.statusLine}>
       <Text style={styles.name}>{item.advertiser_name}</Text>
       <Text style={styles.status}>{item.status.toUpperCase()} / {item.payment_status.toUpperCase()}</Text>
     </View>
     <Text style={styles.headline}>{item.headline}</Text>
     {!!item.short_text&&<Text style={styles.small}>{item.short_text}</Text>}
     <Text style={styles.small}>{item.creative_type.toUpperCase()} · {item.coverage_level.toUpperCase()} · {item.province??item.city_municipality??item.barangay??'Public'}</Text>
     {item.creative_type==='photo'&&!!item.image_url&&<Image source={{uri:item.image_url}} resizeMode="contain" style={styles.image}/>}
     {item.creative_type==='video'&&!!item.video_url&&<Pressable style={styles.actionNeutral} onPress={()=>void Linking.openURL(item.video_url!)}><Text style={styles.buttonDark}>Preview submitted video</Text></Pressable>}
     <Text style={styles.small}>Submitted: {new Date(item.created_at).toLocaleString()}</Text>
     <Text style={styles.small}>Requested 30 days · Quoted {money(item.monthly_price)} · Recorded received {money(item.amount_paid)}</Text>
     <Text style={styles.small}>Payment: {item.payment_method??'Not specified'}</Text>
     <Text selectable style={styles.reference}>Reference: {item.payment_reference||'NONE ATTACHED'}</Text>
     {!!item.payment_proof_path&&<Pressable disabled={busy===item.id} style={styles.actionNeutral} onPress={()=>void viewProof(item)}>
       <Text style={styles.buttonDark}>View PRIVATE payment proof</Text>
     </Pressable>}
     {item.status==='pending'&&<View style={styles.actions}>
       {item.payment_status==='pending'&&<Pressable onPress={()=>ask(item,'verify_payment')} style={styles.actionNeutral} disabled={busy===item.id}><Text style={styles.buttonDark}>Verify Payment</Text></Pressable>}
       {item.payment_status==='paid'&&<Pressable onPress={()=>ask(item,'approve')} style={styles.actionGreen} disabled={busy===item.id}><Text style={styles.buttonWhite}>Approve Content</Text></Pressable>}
       <Pressable onPress={()=>ask(item,'reject')} style={styles.actionRed} disabled={busy===item.id}><Text style={styles.buttonWhite}>Reject</Text></Pressable>
     </View>}
     {item.status==='approved'&&<Pressable onPress={()=>ask(item,'pause')} style={styles.actionNeutral}><Text style={styles.buttonDark}>Pause</Text></Pressable>}
     {item.status==='paused'&&<Pressable onPress={()=>ask(item,'resume')} style={styles.actionGreen}><Text style={styles.buttonWhite}>Resume</Text></Pressable>}
     {confirm?.id===item.id&&<View style={styles.confirmBox}>
       <Text style={styles.confirmText}>{confirm.action==='verify_payment'
         ? 'Confirm you independently verified the full payment against GCash/bank records. This records payment received; it does NOT approve the advertisement.'
         :confirm.action==='approve'
          ? 'Publish only after reviewing creative, policy, placement and VERIFIED payment. Approval starts a NEW 30-day period from now.'
          :confirm.action==='reject'&&item.payment_status==='paid'
           ? 'Reject this paid campaign? It will not run; arrange any refund separately.'
           :'Confirm '+actions[confirm.action].toLowerCase()+'?'}</Text>
       <View style={styles.actions}>
         <Pressable accessibilityRole="button" testID={`admin-paid-ad-confirm-${confirm.action}`} onPress={()=>void apply(item,confirm.action)} disabled={!!busy} style={styles.actionGreen}><Text style={styles.buttonWhite}>Confirm</Text></Pressable>
         <Pressable accessibilityRole="button" onPress={()=>setConfirm(null)} style={styles.actionNeutral}><Text style={styles.buttonDark}>Cancel</Text></Pressable>
       </View>
     </View>}
     {busy===item.id&&<ActivityIndicator color="#216847"/>}
   </View>)}
 </View>;
}

const styles=StyleSheet.create({
 wrap:{marginVertical:12,gap:12},
 head:{flexDirection:'row',alignItems:'center',gap:8},title:{fontWeight:'900',color:'#21523A',fontSize:14},
 subtitle:{fontSize:11,color:'#586A5F',lineHeight:16,marginTop:3},
 refresh:{padding:10,backgroundColor:'#E5F4EA',borderRadius:10},
 refreshText:{fontSize:12,fontWeight:'800',color:'#216847'},
 message:{padding:12,borderRadius:10,backgroundColor:'#FFF0E8',color:'#784A2D',fontSize:12},
 empty:{padding:12,color:'#6B7F70'},
 card:{padding:14,borderRadius:14,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#D3E3D8',gap:7},
 statusLine:{flexDirection:'row',justifyContent:'space-between',gap:10,flexWrap:'wrap'},
 status:{fontSize:10,fontWeight:'800',color:'#536F5E'},
 name:{fontSize:15,fontWeight:'900',color:'#173F2F'},headline:{fontSize:14,fontWeight:'800',color:'#2C4E3B'},
 small:{fontSize:11,lineHeight:16,color:'#526A59'},
 image:{height:180,width:'100%',backgroundColor:'#F0F5F1',borderRadius:8},
 reference:{fontWeight:'700',fontSize:12,color:'#193D2D'},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:8},
 actionNeutral:{paddingHorizontal:12,paddingVertical:10,backgroundColor:'#E4F0E8',borderRadius:10,alignSelf:'flex-start'},
 actionGreen:{paddingHorizontal:12,paddingVertical:10,backgroundColor:'#216847',borderRadius:10,alignSelf:'flex-start'},
 actionRed:{paddingHorizontal:12,paddingVertical:10,backgroundColor:'#A53D3D',borderRadius:10,alignSelf:'flex-start'},
 buttonDark:{color:'#1B5035',fontSize:12,fontWeight:'800'},buttonWhite:{color:'#FFFFFF',fontSize:12,fontWeight:'800'},
 confirmBox:{padding:10,backgroundColor:'#FFF8E3',borderRadius:10,borderWidth:1,borderColor:'#E7D59A'},
 confirmText:{fontSize:12,color:'#4A421F',lineHeight:18}
});
