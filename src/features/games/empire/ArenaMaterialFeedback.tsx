/** BUKLOD Empire Arena — animated, receipt-driven collection UX.
 * Artwork is custom lightweight SVG; it never adjusts HP, stock or points.
 * Every +N is sourced from a successful canonical engine/verified snapshot event.
 */
import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import Svg,{G,Rect,Circle,Path,Line,Polygon,Ellipse,Defs,RadialGradient,Stop} from 'react-native-svg';
type Kind='wood'|'gold'|'stone';
type Receipt={id:string;seq:number;kind:string;amount:number;where:string;name:string;age:number;tier:number;source:{x:number;y:number}};
const kinds:Kind[]=['wood','gold','stone'];
const tint:Record<Kind,string>={wood:'#a8edb7',gold:'#ffe395',stone:'#b1e2ff'};
const label:Record<Kind,string>={wood:'WOOD',gold:'GOLD',stone:'STONE'};
const small=(n:number)=>Math.floor(Math.max(0,Number.isFinite(n)?n:0)).toLocaleString('en-US');
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const kindOf=(kind:string):Kind=>kinds.includes(kind as Kind)?kind as Kind:'stone';
/** Detailed small material symbol shared by in-world trail and top HUD. */
export function ArenaMaterialGlyph({kind,scale=1}:{kind:Kind;scale?:number}){
 return <G transform={'scale('+scale+')'}>
  {kind==='wood'?<G>
    <Rect x="5" y="11" width="21" height="9" rx="3" fill="#7f5136" stroke="#e9b77b" strokeWidth="1.4"/>
    <Path d="M6 13q7-4 18 0M6 18q9-3 19 0" fill="none" stroke="#dca36d" strokeWidth="1.2"/>
    <Ellipse cx="5.6" cy="15.5" rx="4.2" ry="5.1" fill="#c18b58" stroke="#ffe0a1" strokeWidth="1.4"/>
    <Ellipse cx="5.7" cy="15.5" rx="2.3" ry="3" fill="none" stroke="#8d5539" strokeWidth="1"/>
    <Path d="M17 8l3-3 6 2-3 4" fill="#5ea16c" stroke="#b8f2a4" strokeWidth=".85"/>
   </G>:kind==='gold'?<G>
    <Path d="M15 3L25 12L21 25L12 29L5 17L8 8Z" fill="#ad7543" stroke="#ffe5a2" strokeWidth="1.4"/>
    <Path d="M15 3L17 14L12 29L5 17Z" fill="#f6c768"/>
    <Path d="M15 3L25 12L17 14Z" fill="#ffefbe"/>
    <Path d="M17 14L25 12L21 25L12 29Z" fill="#ffdc83"/>
    <Path d="M13 9L15 6L16 11Z" fill="#fff7cc"/>
   </G>:<G>
    <Path d="M15 3L26 12L21 26L8 28L3 15Z" fill="#648cab" stroke="#bbebff" strokeWidth="1.3"/>
    <Path d="M15 3L17 15L8 28L3 15Z" fill="#c5e5f7"/>
    <Path d="M15 3L26 12L17 15Z" fill="#e5f8ff"/>
    <Path d="M17 15L26 12L21 26L8 28Z" fill="#85bdd8"/>
    <Path d="M15 3L12 12" stroke="#fff" strokeWidth=".7"/>
   </G>}
 </G>;
}
export function ArenaResourceHud({stock,carrying,receipts}:{stock:Record<string,number>;carrying:Record<string,number>;receipts:Receipt[]}){
 return <View style={styles.hudBar} pointerEvents="none">
   {kinds.map(kind=>{
     const last=receipts.filter(r=>r.kind===kind && (r.where==='carry'||r.where==='bank')).at(-1);
     const age=last?.age??1,lit=last?1-age:0;
     return <View key={kind} style={[styles.chip,{borderColor:lit>.05?tint[kind]:'#5c7a86'}]}>
       <Svg width={23} height={25} viewBox="0 0 32 32">
         <Circle cx={15} cy={16} r={14} fill={tint[kind]} opacity={lit*.18}/>
         <ArenaMaterialGlyph kind={kind}/>
       </Svg>
       <View style={styles.numbers}>
         <Text numberOfLines={1} style={styles.resourceText}>{label[kind]} {small(stock?.[kind])}</Text>
         <Text style={styles.carryText}>BAG {small(carrying?.[kind])}</Text>
       </View>
       {last&&last.amount>0 ? <View style={[styles.pop,{opacity:clamp(lit*2,0,1),
         transform:[{translateY:-8*(1-age)},{scale:1+.11*(1-age)}]}]}>
         <Text style={[styles.popText,{color:tint[kind]}]}>+{small(last.amount)}</Text>
       </View>:null}
     </View>;
   })}
 </View>;
}
export function ArenaPickupTrails({receipts,width,height,camera}:{
 receipts:Receipt[];width:number;height:number;
 camera:{x:number;y:number;width:number;height:number};
}){
 if(width<30||height<30)return null;
 const active=receipts.filter(r=>r.amount>0&&r.age<.91).slice(-10);
 return <Svg pointerEvents="none" style={StyleSheet.absoluteFill}
    width={width} height={height} viewBox={'0 0 '+width+' '+height}>
   <Defs><RadialGradient id="arena-collection-light">
     <Stop offset="0" stopColor="#fff7c6" stopOpacity=".7"/>
     <Stop offset="1" stopColor="#fff7c6" stopOpacity="0"/>
   </RadialGradient></Defs>
   {active.map((r,i)=>{
     const index=kinds.indexOf(r.kind as Kind),isMaterial=index>=0;
     const sx=(r.source.x-camera.x)*width/camera.width;
     const sy=(r.source.y-camera.y)*height/camera.height;
     if(sx< -15||sx>width+15||sy< -15||sy>height+15)return null;
     const t=clamp(r.age/.84,0,1),ease=t*t*(3-2*t);
     const ex=isMaterial?width*(.37+index*.13):width*.58;
     const ey=3;
     const x=lerp(sx,ex,ease),y=lerp(sy,ey,ease)-Math.sin(Math.PI*ease)*Math.min(28,height*.15);
     const alpha=(1-t)*.94;
     const color=isMaterial?tint[kindOf(r.kind)]:r.where==='level'?'#ffe4a2':'#c4a6ff';
     return <G key={'collect-'+r.id}>
       <Path d={'M '+sx+' '+sy+' Q '+((sx+ex)/2)+' '+(Math.min(sy,ey)-Math.min(24,height*.2))+' '+x+' '+y}
         fill="none" stroke={color} strokeWidth="2" strokeOpacity={alpha*.45} strokeDasharray="3 5"/>
       <Circle cx={x} cy={y} r={11+(1-t)*7} fill="url(#arena-collection-light)" opacity={alpha*.45}/>
       <G transform={'translate('+(x-12*(1-t*.6))+','+(y-12*(1-t*.6))+') scale('+(1-t*.6)+')'}>
         {isMaterial?<ArenaMaterialGlyph kind={kindOf(r.kind)}/>:
           <G><Path d="M15 2L25 16L15 29L5 16Z" fill={color} stroke="#fff5cb" strokeWidth="1.8"/>
           <Circle cx={15} cy={16} r="4" fill="#fff7d0"/></G>}
       </G>
       {i<5 ? <G><Circle cx={x+10+2*(1-t)} cy={y-7} r={1.2+(1-t)*1.3} fill={color} opacity={alpha}/>
       <Circle cx={x-8} cy={y+8} r="1.7" fill="#fff5d6" opacity={alpha*.7}/></G>:null}
     </G>;
   })}
 </Svg>;
}
export function ArenaRewardBanner({receipts}:{receipts:Receipt[]}){
 const latest=receipts.filter(r=>!kinds.includes(r.kind as Kind)&&r.age<.7).at(-1);
 if(!latest)return null;
 const title=latest.where==='level'?'LEVEL UP':latest.where==='upgrade'?'UPGRADE COMPLETE':
   latest.where==='buff'?'BUFF ACQUIRED':latest.where==='inventory'?'ITEM CLAIMED':'REWARD';
 const rarity=latest.tier>=3?'★ EPIC':'✦';
 return <View pointerEvents="none" style={[styles.banner,
   {opacity:clamp((1-latest.age)*2,0,1),transform:[{scale:.88+latest.age*.15}]}]}>
   <Text style={styles.bannerSymbol}>{rarity}</Text>
   <Text style={styles.bannerTitle}>{title}</Text>
   <Text numberOfLines={1} style={styles.bannerItem}>{latest.where==='level'?'LV '+latest.amount:latest.name}</Text>
 </View>;
}
const styles=StyleSheet.create({
 hudBar:{flexDirection:'row',alignItems:'center',gap:4,flexShrink:1},
 chip:{minWidth:72,minHeight:27,flexDirection:'row',alignItems:'center',
    borderRadius:9,borderWidth:1,backgroundColor:'#09283acb',paddingHorizontal:3,gap:1},
 numbers:{gap:0},
 resourceText:{fontSize:9,fontWeight:'900',color:'#fff1c4'},
 carryText:{fontSize:7,fontWeight:'800',color:'#a8ded1'},
 pop:{position:'absolute',top:-13,right:-4,paddingHorizontal:3,borderRadius:4,backgroundColor:'#071522e8'},
 popText:{fontSize:11,fontWeight:'900',textShadowColor:'#020a16',textShadowRadius:3},
 banner:{position:'absolute',top:51,alignSelf:'center',zIndex:23,
    flexDirection:'row',alignItems:'center',gap:5,maxWidth:'64%',
    backgroundColor:'#13273fe9',borderColor:'#eace89',borderWidth:1.5,
    borderRadius:20,paddingVertical:6,paddingHorizontal:13},
 bannerSymbol:{fontSize:12,fontWeight:'900',color:'#ffde8d'},
 bannerTitle:{fontSize:11,fontWeight:'900',color:'#fff3c9'},
 bannerItem:{fontSize:10,fontWeight:'800',color:'#a5f5e4',flexShrink:1},
});
