import React, {useEffect,useState} from 'react';
import {ActivityIndicator,ScrollView,Text,View,Pressable} from 'react-native';
import {AdminGate} from '@/components/AdminGate';
import {useAuth} from '@/providers/AuthProvider';
import {supabase} from '@/lib/supabase';
import {WallPostStyleEditor,WallPostDesignSurface,WallRankBonusFrame,wallFontTextStyle} from '@/components/BuklodWallPostDesignPicker';
import {DEFAULT_WALL_POST_STYLE,type WallPostStyle} from '@/lib/buklodWallPostStylePersistence';
import {RANK_BONUS_FRAMES,rankBonusFrameForViewer} from '@/lib/buklodRankBonusFrames';
import {OFFICIAL_COSMETIC_ACCESS,resolveWallPostDesign} from '@/lib/buklodWallPostDesigns';
import {RANK_VISUAL_MILESTONES} from '@/lib/buklodRankVisualMilestones';
import BuklodCircleRankBadge from '@/components/points/BuklodCircleRankBadge';
export default function DesignStudio(){
 const {user,hasRole}=useAuth();
 const [verified,setVerified]=useState<string|null>(null);
 const [busy,setBusy]=useState(true);
 const [attempt,setAttempt]=useState(0);
 const [style,setStyle]=useState<WallPostStyle>(DEFAULT_WALL_POST_STYLE);
 const [selectedRank,setSelectedRank]=useState(40);
 const owner=user?.id;
 const candidate=!!owner&&hasRole('system_admin');
 useEffect(()=>{let live=true;setVerified(null);setBusy(true);setStyle(DEFAULT_WALL_POST_STYLE);if(!candidate){setBusy(false);return;}
 void Promise.resolve(supabase.rpc('is_system_admin')).then(({data,error})=>{if(live&&!error&&data===true)setVerified(owner!);}).catch(()=>{}).finally(()=>{if(live)setBusy(false);});
 return()=>{live=false;};},[owner,candidate,attempt]);
 const design=resolveWallPostDesign(style.designId);
 const frame=rankBonusFrameForViewer(style.bonusKey);
 const sample=<Text style={{color:design?.ink??'#183C29',fontSize:22,textAlign:style.alignment==='auto'?'center':style.alignment,...wallFontTextStyle(style.fontId)}}>Genesis: Let There Be Light</Text>;
 const preview=design?<WallPostDesignSurface design={design} active={style.animated}>{sample}</WallPostDesignSurface>:sample;
 return <AdminGate>{busy?<ActivityIndicator/>:!candidate||verified!==owner?<Pressable onPress={()=>setAttempt(v=>v+1)}><Text>System Admin verification required. Retry.</Text></Pressable>:<ScrollView contentContainerStyle={{padding:16,gap:14,backgroundColor:'#F5FAF6'}}>
 <Text style={{fontSize:22,fontWeight:'900',color:'#173C29'}}>Official Premium Design Studio</Text>
 <Text style={{color:'#355746'}}>Supreme System Authority · all cosmetic collections unlocked. No member rank, BP, QMP, payout or reward redemption.</Text>
 {frame?<WallRankBonusFrame frame={frame}>{preview}</WallRankBonusFrame>:preview}
 <WallPostStyleEditor rankName={OFFICIAL_COSMETIC_ACCESS} value={style} onChange={setStyle} previewText="Genesis: Let There Be Light" redeemedBonusKeys={RANK_BONUS_FRAMES.map(f=>f.key)}/>
 <Text style={{fontWeight:'800',color:'#173C29'}}>Original member rank artwork previews (not your rank)</Text>
 <View style={{alignItems:'center'}}><BuklodCircleRankBadge rankName={RANK_VISUAL_MILESTONES[selectedRank-1].rankName} size={100} animate/></View>
 {RANK_VISUAL_MILESTONES.map(m=><Pressable key={m.order} onPress={()=>setSelectedRank(m.order)} accessibilityRole="button" accessibilityState={{selected:m.order===selectedRank}}><Text style={{paddingVertical:9,color:'#173C29'}}>{m.rankName} · {m.description}</Text></Pressable>)}
 </ScrollView>}</AdminGate>;
}
