import React, { type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Ellipse, Path } from 'react-native-svg';
import BuklodLivingWallArt from '@/components/BuklodLivingWallArt';
import type { WallPostStyle } from '@/lib/buklodWallPostStylePersistence';
import { BUKLOD_CIRCLE_RANK_FAMILIES } from '@/lib/buklodCircleRankArt';
import { availableWallPostDesigns, resolveWallPostDesign, WALL_POST_DESIGNS, WALL_FONT_PRESETS, canSelectWallFont, wallDesignMotionAllowed, type WallPostDesign, type WallFontId } from '@/lib/buklodWallPostDesigns';

/** Lightweight vector artwork; no remote assets or animated feed overhead. */
export function WallPostDesignArt({ design }: { design: WallPostDesign }) {
  const ink = design.ink;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Svg width="100%" height="100%" viewBox="0 0 360 240" preserveAspectRatio="xMidYMid slice">
      <Defs><LinearGradient id="wallGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={design.start}/><Stop offset="100%" stopColor={design.end}/>
      </LinearGradient></Defs>
      <Rect width="360" height="240" fill="url(#wallGradient)"/>
      {design.motif === 'rays' && <>{[0,1,2,3].map(i=><Path key={i} d={`M0 ${12+i*15} L${125+i*24} 0 M360 ${228-i*15} L${235-i*24} 240`} stroke={ink} strokeWidth="2" opacity=".16"/>)}</>}
      {design.motif === 'orbit' && <>{[0,1,2].map(i=><Ellipse key={i} cx="345" cy="8" rx={30+i*20} ry={18+i*15} rotation="-30" origin="345,8" stroke={ink} strokeWidth="1.3" fill="none" opacity=".19"/>)}<Circle cx="14" cy="226" r="34" stroke={ink} strokeWidth="1" fill="none" opacity=".2"/></>}
      {design.motif === 'stars' && <>{[[15,18],[39,34],[95,14],[324,26],[343,76],[20,194],[55,224],[303,218],[340,207]].map(([x,y],i)=><Circle key={i} cx={x} cy={y} r={i%3===0?2.5:1.2} fill={ink} opacity=".35"/>)}</>}
      {design.motif === 'leaves' && <><Path d="M0 100 Q-3 12 83 0 Q72 58 0 100 M360 140 Q363 228 277 240 Q288 182 360 140" fill={ink} opacity=".12"/><Path d="M0 100 Q25 42 83 0 M360 140 Q335 198 277 240" fill="none" stroke={ink} opacity=".2"/></>}
      {design.motif === 'frame' && <><Rect x="8" y="8" width="344" height="224" rx="10" stroke={ink} strokeWidth="1" fill="none" opacity=".3"/><Path d="M16 46 V16 H46 M314 16 H344 V46 M16 194 V224 H46 M314 224 H344 V194" stroke={ink} strokeWidth="2" fill="none" opacity=".32"/></>}
    </Svg>
  </View>;
}

export function WallPostDesignSurface({ design, children, active=false }: { design: WallPostDesign; children: ReactNode; active?:boolean }) {
  return <View style={[styles.surface,{backgroundColor:design.start}]}>
    <WallPostDesignArt design={design}/>
    {active&&<BuklodLivingWallArt design={design} active={active}/>}
    <View style={styles.content}>{children}</View>
  </View>;
}

/** Picker receives the canonical claimed rank; the server must independently authorize writes. */
export function WallPostDesignPicker({ rankName, value, onChange, disabled=false, previewText, fontId='standard', animated=false }: {
  rankName?:string|null; value:string|null; onChange:(id:string|null)=>void; disabled?:boolean; previewText?:string; fontId?:WallFontId; animated?:boolean;
}) {
  const allowed = new Set(availableWallPostDesigns(rankName).map(d=>d.id));
  const selected=value&&allowed.has(value)?resolveWallPostDesign(value):null;
  return <View style={styles.picker}>
    {selected&&<WallPostDesignSurface design={selected} active={!disabled&&animated&&wallDesignMotionAllowed(selected,rankName)}>
      <Text numberOfLines={6} style={{color:selected.ink,fontSize:23,lineHeight:31,fontWeight:'800',textAlign:'center',...wallFontTextStyle(fontId)}}>{previewText?.trim()||'Your words. Your story.'}</Text>
    </WallPostDesignSurface>}
    <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{selected:value===null,disabled}}
      onPress={()=>onChange(null)} style={[styles.normal,value===null&&styles.selected]}>
      <Text style={styles.normalText}>Normal post</Text>
    </Pressable>
    {BUKLOD_CIRCLE_RANK_FAMILIES.slice(1).map((family,i)=><View key={family}>
      <Text style={styles.group}>{family}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {WALL_POST_DESIGNS.filter(d=>d.minFamilyIndex===i+1).map(d=>{
          const locked=!allowed.has(d.id);
          return <Pressable key={d.id} disabled={disabled||locked} accessibilityRole="button"
            accessibilityLabel={d.name+(locked?', unlock at '+family+' '+['V','IV','III','II','I'][(d.minRankOrder-1)%5]:'')}
            accessibilityState={{disabled:disabled||locked,selected:value===d.id}}
            onPress={()=>onChange(d.id)} style={[styles.swatch,value===d.id&&styles.selected]}>
            <View style={[styles.preview,{backgroundColor:d.start}]}>
              <WallPostDesignArt design={d}/>
              <Text style={{color:d.ink,fontSize:17,fontWeight:'700'}}>{locked?['V','IV','III','II','I'][(d.minRankOrder-1)%5]:'Aa'}</Text>
            </View>
            <Text numberOfLines={2} style={styles.name}>{d.name}</Text>
          </Pressable>;
        })}
      </ScrollView>
    </View>)}
  </View>;
}
const styles=StyleSheet.create({
  surface:{minHeight:168,justifyContent:'center',overflow:'hidden',borderRadius:12},
  content:{paddingHorizontal:24,paddingVertical:24},
  picker:{gap:10,paddingVertical:8},
  normal:{alignSelf:'flex-start',padding:10,borderWidth:2,borderColor:'#A4B5AB',borderRadius:9,backgroundColor:'#FFFFFF'},
  selected:{borderColor:'#237B53',borderWidth:2},
  normalText:{color:'#173E2D',fontWeight:'700'},
  group:{fontWeight:'800',color:'#456A58',fontSize:13,marginBottom:5},
  swatch:{width:112,padding:3,marginRight:7,borderWidth:2,borderColor:'transparent',borderRadius:10,backgroundColor:'#FFFFFF'},
  preview:{height:64,borderRadius:6,overflow:'hidden',alignItems:'center',justifyContent:'center'},
  name:{color:'#263B32',fontWeight:'700',fontSize:11,padding:3},
});

export function wallFontTextStyle(fontId:WallFontId):TextStyle {
  const serif=Platform.OS==='android'?'serif':'Georgia';
  switch(fontId){
    case 'bold':return {fontWeight:'800'};
    case 'serif':return {fontFamily:serif,fontWeight:'600'};
    case 'editorial':return {fontFamily:serif,fontWeight:'700',letterSpacing:.35};
    case 'royal':return {fontFamily:serif,fontWeight:'900',letterSpacing:.65};
    case 'cosmic':return {fontWeight:'800',letterSpacing:1.05};
    case 'divine':return {fontFamily:serif,fontWeight:'800',letterSpacing:.8};
    default:return {};
  }
}
/** Full editor preserves native typing and leaves font/background independent. */
export function WallPostStyleEditor({rankName,value,onChange,previewText,disabled=false}:{
 rankName:string|null;value:WallPostStyle;onChange:(s:WallPostStyle)=>void;previewText:string;disabled?:boolean;
}){
 const [open,setOpen]=React.useState(false);
 const design=resolveWallPostDesign(value.designId);
 const motionAllowed=!!design&&wallDesignMotionAllowed(design,rankName);
 return <View style={{gap:6}}>
   <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(v=>!v)}>
     <Text style={styles.normalText}>{open?'Hide post designs':'Choose post design & font'}</Text>
   </Pressable>
   {open&&<>
    <WallPostDesignPicker rankName={rankName} value={value.designId} onChange={id=>onChange({...value,designId:id,animated:false})}
      disabled={disabled} previewText={previewText} fontId={value.fontId} animated={value.animated}/>
    <Text style={styles.group}>Typography</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {WALL_FONT_PRESETS.map(font=>{
        const locked=font.id!=='standard'&&!canSelectWallFont(font.id,rankName);
        return <Pressable key={font.id} disabled={disabled||locked}
          accessibilityRole="button" accessibilityState={{disabled:disabled||locked,selected:value.fontId===font.id}}
          onPress={()=>onChange({...value,fontId:font.id})} style={[styles.normal,{marginRight:6,opacity:locked?.5:1},value.fontId===font.id&&styles.selected]}>
          <Text style={[styles.normalText,wallFontTextStyle(font.id)]}>{font.label}</Text>
        </Pressable>;
      })}
    </ScrollView>
    {!design&&<Text numberOfLines={6} style={[styles.normalText,{fontSize:22,textAlign:'center'},wallFontTextStyle(value.fontId)]}>{previewText}</Text>}
    {design&&<Pressable disabled={disabled||!motionAllowed} accessibilityRole="switch" accessibilityState={{checked:value.animated,disabled:disabled||!motionAllowed}}
       onPress={()=>onChange({...value,animated:!value.animated})} style={styles.normal}>
       <Text style={styles.normalText}>{motionAllowed?'Living ambiance: '+(value.animated?'On':'Off'):'Living ambiance unlocks at the next eligible rank'}</Text>
    </Pressable>}
   </>}
 </View>;
}
