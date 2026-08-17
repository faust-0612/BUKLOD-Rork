import React,{useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,Image,Linking,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {decode} from 'base64-arraybuffer';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';

type Creative='photo'|'video';
type Coverage='barangay'|'city'|'province'|'nationwide';
type Rate={coverage_level:Coverage;creative_type:Creative;monthly_price:number;currency:string};
const fallback={photo:{barangay:100,city:250,province:500,nationwide:999},video:{barangay:200,city:500,province:1000,nationwide:1998}} as const;
const instapayQr = require('../../../assets/images/advertise-instapay-qr.jpg');

function text(s:any,keys:string[]){for(const k of keys){const v=s?.[k];if(typeof v==='string'&&v.trim())return v.trim();}return '';}
function secs(a:ImagePicker.ImagePickerAsset){const n=Number(a.duration??0);return !Number.isFinite(n)||n<=0?0:n>1000?n/1000:n;}
function money(n:number){return `\u20B1${n.toLocaleString('en-PH')}`;}
function ext(a:ImagePicker.ImagePickerAsset,c:Creative|'proof'){const m=String(a.mimeType??'').toLowerCase();if(c==='proof'||c==='photo'){if(m.includes('png'))return 'png';if(m.includes('webp'))return 'webp';return 'jpg';}if(m.includes('quicktime'))return 'mov';return 'mp4';}
function mime(a:ImagePicker.ImagePickerAsset,c:Creative|'proof'){return a.mimeType||(c==='proof'||c==='photo'?'image/jpeg':'video/mp4');}

export default function AdvertiseScreen(){
 const router=useRouter(); const {user,profile}=useAuth();
 const [creative,setCreative]=useState<Creative>('photo'); const [coverage,setCoverage]=useState<Coverage>('barangay');
 const [asset,setAsset]=useState<ImagePicker.ImagePickerAsset|null>(null); const [proof,setProof]=useState<ImagePicker.ImagePickerAsset|null>(null);
 const [name,setName]=useState(''); const [headline,setHeadline]=useState(''); const [shortText,setShortText]=useState('');
 const [url,setUrl]=useState(''); const [reference,setReference]=useState(''); const [note,setNote]=useState('');
 const [rates,setRates]=useState<Rate[]>([]); const [busy,setBusy]=useState(false); const [ratesBusy,setRatesBusy]=useState(true);

 const geo=useMemo(()=>{
   const p:any=profile??{}; const a:any=p.address??p.home_address??p.location??{};
   return {
     barangay:text(p,['barangay','barangay_name','address_barangay'])||text(a,['barangay','barangay_name']),
     city:text(p,['city_municipality','municipality','municipality_name','city','city_name','address_city','address_municipality'])||text(a,['city_municipality','municipality','municipality_name','city','city_name']),
     province:text(p,['province','province_name','address_province'])||text(a,['province','province_name']),
     country:text(p,['country','country_name','address_country'])||text(a,['country','country_name'])||'Philippines'
   };
 },[profile]);

 useEffect(()=>{const suggested=text(profile,['display_name','full_name','name']); if(suggested&&!name)setName(suggested);},[profile]);

 useEffect(()=>{ let live=true; (async()=>{
   setRatesBusy(true);
   const {data}=await supabase.from('buklod_ad_self_service_rates').select('coverage_level,creative_type,monthly_price,currency').eq('is_active',true);
   if(!live)return; setRates((data??[]) as Rate[]); setRatesBusy(false);
 })(); return ()=>{live=false;}; },[]);

 useEffect(()=>{setAsset(null);},[creative]);

 const price=useMemo(()=>{const r=rates.find(x=>x.creative_type===creative&&x.coverage_level===coverage); return Number(r?.monthly_price??fallback[creative][coverage]);},[rates,creative,coverage]);
 const paymentMethod='GCash';
 const paymentName=process.env.EXPO_PUBLIC_AD_PAYMENT_ACCOUNT_NAME||'BUKLOD Advertising';
 const paymentNumber='09811646218';

 const targets=[
   {key:'barangay' as const,title:'Barangay',sub:geo.barangay||'Select now; complete Barangay in Profile before submitting'},
   {key:'city' as const,title:'Town / City',sub:geo.city||'Select now; complete Town/City in Profile before submitting'},
   {key:'province' as const,title:'Province',sub:geo.province||'Select now; complete Province in Profile before submitting'},
   {key:'nationwide' as const,title:'Public',sub:`All BUKLOD users in ${geo.country}`},
 ];

 async function openGCash(){
   try{ await Linking.openURL('gcash://'); }
   catch{
     Alert.alert('Open GCash',`Open GCash, then scan/upload the InstaPay QR or send ${money(price)} to ${paymentNumber}.`);
   }
 }

 async function pickCreative(){
   if(busy)return; const p=await ImagePicker.requestMediaLibraryPermissionsAsync();
   if(!p.granted){Alert.alert('Media Permission','Please allow media access.'); return;}
   const r=await ImagePicker.launchImageLibraryAsync(creative==='photo'?{mediaTypes:['images'] as any,allowsEditing:true,aspect:[16,9],quality:0.85}:{mediaTypes:['videos'] as any,allowsEditing:false,videoMaxDuration:30,quality:1});
   if(r.canceled||!r.assets?.length)return; const a=r.assets[0];
   if(creative==='video'){ const s=secs(a); if(!s||s>30.05){Alert.alert('Video Limit','Advertising videos must be 30 seconds or shorter.'); return;} }
   setAsset(a);
 }

 async function pickProof(){
   if(busy)return; const p=await ImagePicker.requestMediaLibraryPermissionsAsync();
   if(!p.granted){Alert.alert('Photo Permission','Please allow access to your payment screenshot.'); return;}
   const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'] as any,allowsEditing:false,quality:0.8});
   if(r.canceled||!r.assets?.length)return; setProof(r.assets[0]);
 }

 async function uploadAsset(a:ImagePicker.ImagePickerAsset, bucket:'paid-ad-media'|'paid-ad-payment', folder:'creative'|'payment', c:Creative|'proof'){
   if(!user?.id)throw new Error('Please sign in again.');
   const path=`${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext(a,c)}`;
   const b64=await FileSystem.readAsStringAsync(a.uri,{encoding:FileSystem.EncodingType.Base64});
   const {error}=await supabase.storage.from(bucket).upload(path,decode(b64),{contentType:mime(a,c),upsert:false});
   if(error)throw error;
   const {data}=supabase.storage.from(bucket).getPublicUrl(path);
   return {path,url:data.publicUrl,mime:mime(a,c)};
 }

 async function submit(){
   if(!user?.id||busy)return;
   if(!name.trim()){Alert.alert('Advertiser Name','Enter the advertiser or business name.'); return;}
   if(!headline.trim()){Alert.alert('Headline','Enter a short advertisement headline.'); return;}
   if(!asset){Alert.alert('Creative Required',creative==='photo'?'Choose the advertisement photo.':'Choose a video up to 30 seconds.'); return;}
   if(coverage==='barangay'&&(!geo.barangay||!geo.city||!geo.province)){Alert.alert('Location Needed','Complete your Barangay, Town/City, and Province in Profile before submitting a Barangay-targeted ad.'); return;}
   if(coverage==='city'&&(!geo.city||!geo.province)){Alert.alert('Location Needed','Complete your Town/City and Province in Profile before submitting a Town/City-targeted ad.'); return;}
   if(coverage==='province'&&!geo.province){Alert.alert('Location Needed','Complete your Province in Profile before submitting a Province-targeted ad.'); return;}
   if(!reference.trim()){Alert.alert('Payment Reference','Enter your payment / transaction reference number.'); return;}
   const duration=creative==='video'?secs(asset):null;
   if(creative==='video'&&(!duration||duration>30.05)){Alert.alert('Video Limit','Advertising videos must be 30 seconds or shorter.'); return;}
   setBusy(true);
   try{
     const uploaded=await uploadAsset(asset,'paid-ad-media','creative',creative);
     let paymentProofPath:string|null=null;
     if(proof){ const proofUpload=await uploadAsset(proof,'paid-ad-payment','payment','proof'); paymentProofPath=proofUpload.path; }
     const now=new Date(); const ends=new Date(now.getTime()+30*24*60*60*1000);
     const payload:any={
       advertiser_user_id:user.id,
       created_by:user.id,
       advertiser_name:name.trim(),
       headline:headline.trim(),
       short_text:shortText.trim()||null,
       destination_url:url.trim()||null,
       creative_type:creative,
       image_url:creative==='photo'?uploaded.url:null,
       video_url:creative==='video'?uploaded.url:null,
       media_path:uploaded.path,
       media_mime_type:uploaded.mime,
       media_duration_seconds:creative==='video'?duration:null,
       placement:creative==='photo'?'all':'community',
       coverage_level:coverage,
       barangay:coverage==='barangay'?geo.barangay:null,
       city_municipality:coverage==='barangay'||coverage==='city'?geo.city:null,
       province:coverage!=='nationwide'?geo.province:null,
       country_code:'PH',
       monthly_price:price,
       amount_paid:0,
       claimed_payment_amount:price,
       currency:'PHP',
       payment_status:'pending',
       payment_method:paymentMethod,
       payment_reference:reference.trim(),
       payment_proof_path:paymentProofPath,
       status:'pending',
       policy_confirmed:true,
       submission_note:note.trim()||null,
       starts_at:now.toISOString(),
       ends_at:ends.toISOString(),
       priority:100,
     };
     const {error}=await (supabase as any).from('buklod_paid_ad_campaigns').insert(payload);
     if(error)throw error;
     Alert.alert('Advertisement Submitted','Your advertisement was submitted for verification. It will go live only after payment and content approval.',[{text:'Done',onPress:()=>router.back()}]);
   }catch(e:any){
     Alert.alert('Could Not Submit',e?.message||'Please try again.');
   }finally{ setBusy(false); }
 }

 return <View style={s.screen}><View style={s.header}><Pressable onPress={()=>router.back()} style={s.back}><MaterialCommunityIcons name="arrow-left" size={24} color="#163B2C"/></Pressable><View style={{flex:1}}><Text style={s.title}>Advertise</Text><Text style={s.sub}>Promote to the right BUKLOD community</Text></View></View><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   <View style={s.info}><Text style={s.infoTitle}>Community advertising</Text><Text style={s.body}>Choose a photo or a video up to 30 seconds, select the community coverage, complete payment information, then submit for review.</Text><Text style={s.body}>Photo campaigns may appear in eligible geo-targeted BUKLOD sponsor banners and as a Sponsored Community card. Video campaigns appear as Sponsored Community content.</Text><Text style={s.note}>Ads do not go live automatically. Payment and content must be verified first.</Text></View>

   <Text style={s.section}>1. Advertisement type</Text><View style={s.row}>{([{key:'photo',icon:'image-outline',title:'Photo',sub:'Banner + Community'},{key:'video',icon:'play-box-outline',title:'Video',sub:'Up to 30 seconds'}] as const).map(x=><Pressable key={x.key} onPress={()=>setCreative(x.key)} style={[s.choice,creative===x.key&&s.on]}><MaterialCommunityIcons name={x.icon as any} size={24} color={creative===x.key?'#175A3A':'#61726A'}/><Text style={s.choiceTitle}>{x.title}</Text><Text style={s.small}>{x.sub}</Text></Pressable>)}</View>
   <Pressable onPress={pickCreative} style={s.mediaPicker}>{asset?(creative==='photo'?<Image source={{uri:asset.uri}} style={s.preview} resizeMode="cover"/>:<View style={s.videoPreview}><MaterialCommunityIcons name="play-circle" size={42} color="#175A3A"/><Text style={s.videoText}>Video selected - {secs(asset).toFixed(1)}s</Text></View>):<><MaterialCommunityIcons name={creative==='photo'?'image-plus':'video-plus'} size={34} color="#2D6B4F"/><Text style={s.choiceTitle}>{creative==='photo'?'Choose advertisement photo':'Choose video up to 30 seconds'}</Text></>}</Pressable>

   <Text style={s.section}>2. Community coverage</Text><View style={s.stack}>{targets.map(t=><Pressable key={t.key} onPress={()=>setCoverage(t.key)} style={[s.target,coverage===t.key&&s.on]}><MaterialCommunityIcons name={t.key==='nationwide'?'earth':t.key==='province'?'map-marker-radius-outline':t.key==='city'?'city-variant-outline':'home-group'} size={22} color="#2D6B4F"/><View style={{flex:1}}><Text style={s.choiceTitle}>{t.title}</Text><Text style={s.small}>{t.sub}</Text></View><Text style={s.priceTag}>{money(rates.find(r=>r.creative_type===creative&&r.coverage_level===t.key)?.monthly_price??fallback[creative][t.key])}</Text><MaterialCommunityIcons name={coverage===t.key?'radiobox-marked':'radiobox-blank'} size={22} color="#2D6B4F"/></Pressable>)}</View>
   <View style={s.priceCard}><Text style={s.priceLabel}>30-DAY ADVERTISING PRICE</Text><View style={s.rowCenter}><Text style={s.price}>{money(price)}</Text>{ratesBusy&&<ActivityIndicator size="small" color="#2D6B4F"/>}</View><Text style={s.small}>Rates are admin-configurable. Video and photo pricing are separate.</Text></View>

   <Text style={s.section}>3. Advertisement information</Text><TextInput style={s.input} value={name} onChangeText={setName} placeholder="Advertiser / business name"/><TextInput style={s.input} value={headline} onChangeText={setHeadline} placeholder="Headline" maxLength={80}/><TextInput style={[s.input,s.multi]} value={shortText} onChangeText={setShortText} placeholder="Short description" maxLength={180} multiline/><TextInput style={s.input} value={url} onChangeText={setUrl} placeholder="Website / page link (optional)" autoCapitalize="none" keyboardType="url"/>

   <Text style={s.section}>4. Payment</Text><View style={s.payment}><MaterialCommunityIcons name="wallet-outline" size={24} color="#2D6B4F"/><View style={{flex:1}}><Text style={s.choiceTitle}>{paymentMethod}</Text><Text style={s.small}>{paymentName}</Text><Text selectable style={s.payNo}>{paymentNumber}</Text><Text style={s.payDue}>Amount: {money(price)}</Text><Pressable onPress={openGCash} style={s.gcashButton}><MaterialCommunityIcons name="wallet-outline" size={20} color="#fff"/><Text style={s.gcashButtonText}>Pay {money(price)} with GCash</Text></Pressable><Text style={s.gcashHint}>Tap the button to open GCash. You can also scan or upload the InstaPay QR below.</Text></View></View>
   <View style={s.qrCard}><Image source={instapayQr} style={s.qrImage} resizeMode="contain"/><Text style={s.qrTitle}>InstaPay QR</Text><Text style={s.qrText}>Recipient: {paymentName}</Text><Text style={s.qrText}>Mobile No.: {paymentNumber}</Text><Text style={s.qrText}>Amount due: {money(price)}</Text><Text style={s.qrHint}>If your GCash app does not jump straight to Send Money, use Scan QR or Upload QR and use this code.</Text></View>
   <TextInput style={s.input} value={reference} onChangeText={setReference} placeholder="Payment / transaction reference"/><Pressable style={s.proof} onPress={pickProof}><MaterialCommunityIcons name={proof?'check-circle-outline':'receipt-text-plus-outline'} size={21} color="#2D6B4F"/><Text style={s.body}>{proof?'Payment screenshot selected':'Attach payment screenshot (optional)'}</Text></Pressable><TextInput style={[s.input,s.multi]} value={note} onChangeText={setNote} placeholder="Note for review (optional)" multiline/>

   <View style={s.final}><Text style={s.choiceTitle}>Review before submitting</Text><Text style={s.small}>Creative: {creative==='photo'?'Photo':'Video up to 30s'}</Text><Text style={s.small}>Coverage: {targets.find(t=>t.key===coverage)?.title}</Text><Text style={s.small}>Price: {money(price)} / 30 days</Text></View>
   <Pressable disabled={busy} onPress={submit} style={[s.submit,busy&&s.disabled]}>{busy?<ActivityIndicator color="#fff"/>:<MaterialCommunityIcons name="bullhorn" size={22} color="#fff"/>}<Text style={s.submitText}>{busy?'Submitting...':'Advertise'}</Text></Pressable>
   <Text style={s.foot}>Submission does not guarantee approval. BUKLOD may reject misleading, unsafe, prohibited, or inappropriate advertising content.</Text>
 </ScrollView></View>;
}

const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#F4F7F5'},header:{flexDirection:'row',alignItems:'center',gap:10,padding:15,backgroundColor:'#fff',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#DCE6E0'},back:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:'#EDF5F0'},title:{fontSize:22,fontWeight:'900',color:'#173F2F'},sub:{fontSize:11,color:'#697970'},content:{padding:16,paddingBottom:44,gap:10},info:{padding:15,borderRadius:17,backgroundColor:'#E9F4ED'},infoTitle:{fontSize:18,fontWeight:'900',color:'#173F2F'},body:{fontSize:12,lineHeight:18,color:'#52665C'},note:{marginTop:8,fontSize:12,fontWeight:'800',color:'#7B5B11'},section:{marginTop:8,fontSize:14,fontWeight:'900',color:'#214936'},row:{flexDirection:'row',gap:10},rowCenter:{flexDirection:'row',alignItems:'center',gap:8},stack:{gap:8},choice:{flex:1,padding:14,borderRadius:15,backgroundColor:'#fff',borderWidth:1,borderColor:'#DCE6E0'},on:{borderColor:'#68A483',backgroundColor:'#EFF8F2'},choiceTitle:{fontSize:13,fontWeight:'900',color:'#244C39'},small:{marginTop:2,fontSize:10,color:'#718078'},mediaPicker:{minHeight:132,borderRadius:16,borderWidth:1,borderStyle:'dashed',borderColor:'#8FB49F',backgroundColor:'#fff',alignItems:'center',justifyContent:'center',overflow:'hidden'},preview:{width:'100%',height:180},videoPreview:{alignItems:'center',justifyContent:'center',minHeight:132},videoText:{marginTop:6,fontSize:12,fontWeight:'800',color:'#3F5D4F'},target:{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:14,backgroundColor:'#fff',borderWidth:1,borderColor:'#DDE7E1'},priceTag:{fontSize:12,fontWeight:'900',color:'#23583E'},priceCard:{padding:14,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:'#DCE6E0'},priceLabel:{fontSize:10,fontWeight:'900',letterSpacing:0.8,color:'#3B5F4B'},price:{fontSize:27,fontWeight:'900',color:'#173F2F'},input:{minHeight:48,paddingHorizontal:14,paddingVertical:11,borderRadius:13,backgroundColor:'#fff',borderWidth:1,borderColor:'#DCE6E0',fontSize:13,color:'#193C2D'},multi:{minHeight:88,textAlignVertical:'top'},payment:{flexDirection:'row',gap:12,padding:14,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:'#DCE6E0'},payNo:{marginTop:3,fontSize:16,fontWeight:'900',color:'#173F2F'},payDue:{marginTop:7,fontSize:12,fontWeight:'900',color:'#315F49'},gcashButton:{marginTop:12,minHeight:48,borderRadius:12,backgroundColor:'#0A63D8',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingHorizontal:12},gcashButtonText:{fontSize:14,fontWeight:'900',color:'#fff'},gcashHint:{marginTop:8,fontSize:10,lineHeight:15,color:'#65756D'},qrCard:{padding:14,borderRadius:16,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DCE6E0',alignItems:'center'},qrImage:{width:220,height:300,borderRadius:12,backgroundColor:'#F4F4F4'},qrTitle:{marginTop:10,fontSize:16,fontWeight:'900',color:'#173F2F'},qrText:{marginTop:3,fontSize:12,color:'#4F6258'},qrHint:{marginTop:8,fontSize:10,lineHeight:15,color:'#6D7A74',textAlign:'center'},proof:{minHeight:48,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:9,borderRadius:13,backgroundColor:'#EDF5F0',borderWidth:1,borderColor:'#D1E4D8'},final:{padding:14,borderRadius:15,backgroundColor:'#FFF9E8',borderWidth:1,borderColor:'#EFE1B7'},submit:{minHeight:54,borderRadius:16,flexDirection:'row',gap:9,alignItems:'center',justifyContent:'center',backgroundColor:'#1E6B45'},submitText:{fontSize:16,fontWeight:'900',color:'#fff'},foot:{textAlign:'center',fontSize:10,lineHeight:15,color:'#78837D',paddingHorizontal:12},disabled:{opacity:0.48}
});