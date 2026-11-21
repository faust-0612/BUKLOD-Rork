/** Animated, responsive 2.5D CONSTRUCTION PREVIEW over existing licensed V2 scene artwork.
 * This is a decorative visual blueprint, never proof of a real lot or completed upgrade.
 */
import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,StyleSheet,View} from 'react-native';
import Svg,{Circle,Defs,Ellipse,G,Line,LinearGradient,Path,Polygon,Rect,Stop} from 'react-native-svg';
import {constructionStage,majorLevel,safeCosmetics} from './constructionPlan.mjs';

const PALETTES={
 stone:{wall:'#D7C49E',dark:'#7B6859',roof:'#5D707A',trim:'#FCEDC9'},
 timber:{wall:'#B97E51',dark:'#765033',roof:'#455B47',trim:'#F9D9AC'},
 garden:{wall:'#AED1AD',dark:'#4F7955',roof:'#53766E',trim:'#E7F4D6'},
 slate:{wall:'#99B3C3',dark:'#466477',roof:'#344459',trim:'#D7F4FF'},
 clay:{wall:'#D5AB82',dark:'#8B593F',roof:'#AA624A',trim:'#FFE3C3'},
 light:{wall:'#E8DCC4',dark:'#8A8F9F',roof:'#6879A4',trim:'#FFF9E9'},
};
type Track='lot'|'house'|'cluster';
type Props={track:Track;level:number;stage:number;finish:string;roof:string;ground:string;};
export default function DevelopmentStructurePreview({track,level,stage,finish,roof,ground}:Props){
 const cosmetics=safeCosmetics({finish,roof,ground});
 const p=PALETTES[cosmetics.finish as keyof typeof PALETTES];
 const l=majorLevel(level),s=constructionStage(stage);
 const shine=useRef(new Animated.Value(.3)).current;
 const [reduced,setReduced]=useState(true);
 useEffect(()=>{let mounted=true;AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(mounted)setReduced(v);}).catch(()=>undefined);return()=>{mounted=false;};},[]);
 useEffect(()=>{
   if(reduced){shine.setValue(.3);return;}
   const pulse=Animated.loop(Animated.sequence([
     Animated.timing(shine,{toValue:.75,duration:2200,useNativeDriver:true}),
     Animated.timing(shine,{toValue:.3,duration:2200,useNativeDriver:true})
   ]));pulse.start();return()=>pulse.stop();
 },[reduced,shine]);
 const wood=s>=1,frame=s>=2,walls=s>=3,finished=s>=4;
 const isHouse=track==='house',isVillage=track==='cluster';
 const growth=l>=4,large=l>=7,premium=l>=9;
 return <View pointerEvents="none" style={StyleSheet.absoluteFillObject} accessible={false}>
  <Svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
   <Defs>
    <LinearGradient id="lot-earth" x1="0" x2="0" y1="0" y2="1"><Stop offset="0" stopColor="#5A845C"/><Stop offset="1" stopColor="#244C3C"/></LinearGradient>
    <LinearGradient id="structure-wall" x1="0" x2="1" y1="0" y2="1"><Stop offset="0" stopColor={p.wall}/><Stop offset="1" stopColor={p.dark}/></LinearGradient>
   </Defs>
   <Ellipse cx="202" cy="216" rx="166" ry="28" fill="#061E1C" opacity=".65"/>
   <Path d="M20 172 L201 95 L380 172 L203 244 Z" fill={cosmetics.ground==='stone'?'#758078':'url(#lot-earth)'} stroke="#D5C08B" strokeWidth="3"/>
   {cosmetics.ground==='flower'&&[55,90,318,349].map((x,i)=><G key={i}><Circle cx={x} cy={178+i%2*29} r="12" fill="#426D50"/><Circle cx={x+3} cy={174+i%2*29} r="5" fill="#E9A1B7"/></G>)}
   {cosmetics.ground==='stone'&&<Path d="M202 240 L200 177 L220 175 L229 239" fill="#C7BBA0" stroke="#9C957F" strokeWidth="1"/>}
   {wood&&<G stroke="#E7CC93" strokeWidth="4" strokeLinecap="round">
     <Path d="M35 172 L201 108 L364 172 M35 172 L202 232 L364 172" strokeDasharray={s<4?'12 9':'3 0'}/>
     <Line x1="35" y1="172" x2="35" y2="148"/><Line x1="364" y1="172" x2="364" y2="148"/>
     <Line x1="91" y1="151" x2="91" y2="124"/><Line x1="310" y1="150" x2="310" y2="124"/>
   </G>}
   {frame&&<G>
     <Path d="M114 140 L204 100 L288 139 L288 202 L202 234 L114 198 Z" fill={walls?'url(#structure-wall)':'#274D4D'} fillOpacity={walls?1:.35} stroke={p.trim} strokeWidth="4"/>
     <Path d="M204 100 L204 232 M114 140 L288 139 M114 198 L202 234 L288 202" fill="none" stroke={p.trim} strokeWidth={walls?2:5} opacity=".9"/>
     {walls&&<Path d="M114 140 L204 100 L204 234 L114 198 Z" fill={p.wall} opacity=".8"/>}
     {walls&&<Path d="M204 100 L288 139 L288 202 L204 234 Z" fill={p.dark} opacity=".95"/>}
     <Polygon points={cosmetics.roof==='terrace'?'101,135 194,86 297,131 204,179':cosmetics.roof==='hip'?'103,137 199,73 299,138 204,106':'105,136 204,67 297,138 203,101'} fill={s===2?'#385A50':p.roof} stroke={p.trim} strokeWidth="3" fillOpacity={s===2?.4:1}/>
     {walls&&<G><Rect x="229" y="149" width="27" height="28" rx="2" fill="#90D4D9" stroke={p.trim} strokeWidth="3"/><Path d="M242 149 L242 178 M229 164 L255 164" stroke="#F5E9BD" strokeWidth="2"/>
       <Path d="M142 158 L173 144 L173 192 L142 205 Z" fill="#463A34" stroke={p.trim} strokeWidth="3"/></G>}
   </G>}
   {s===0&&<G>
     <Path d="M129 181 L168 160 L203 181 L163 201 Z" fill="#B49C76" stroke="#F4D39E" strokeWidth="2"/>
     <Path d="M224 164 L267 184 L239 198 L197 179 Z" fill="#A58D72" stroke="#F4D39E" strokeWidth="2"/>
     <Path d="M152 185 L175 174 L180 182 L155 196" fill="#D8BA88"/>
     {[124,290].map((x,i)=><G key={i}><Line x1={x} y1="141" x2={x} y2="176" stroke="#F6E1AA" strokeWidth="4"/><Circle cx={x} cy="138" r="4" fill="#9BD4AD"/></G>)}
   </G>}
   {finished&&<G>
     <Path d="M200 234 L205 241 L240 224 L238 218" fill="#F2D9A8"/>
     {growth&&<Path d="M298 180 L334 168 L334 215 L299 221 Z" fill={p.wall} stroke={p.trim} strokeWidth="3"/>}
     {large&&<Path d="M70 186 L106 168 L106 210 L70 219 Z" fill={p.dark} stroke={p.trim} strokeWidth="3"/>}
     {premium&&[76,326].map((x,i)=><G key={i}><Line x1={x} y1={i?155:169} x2={x} y2={i?183:197} stroke="#E4D6AE" strokeWidth="3"/><Circle cx={x} cy={i?152:166} r="9" fill="#FFF2B7" opacity=".8"/></G>)}
     {[53,344].map((x,i)=><G key={i}><Rect x={x-3} y={178+i*7} width="6" height="18" fill="#86694E"/><Circle cx={x} cy={171+i*7} r="18" fill="#376D49"/><Circle cx={x-7} cy={166+i*7} r="11" fill="#6BAE70"/></G>)}
   </G>}
   {isVillage&&growth&&<G><Rect x="286" y="205" width="28" height="12" fill="#D5C093"/><Line x1="300" y1="192" x2="300" y2="205" stroke="#FFEDBB" strokeWidth="3"/></G>}
   {isHouse&&large&&<Path d="M145 119 L202 85 L244 107" fill="none" stroke="#F8DF9F" strokeWidth="3" opacity=".75"/>}
   {track==='lot'&&s<3&&<Path d="M122 202 L200 228 L291 199" fill="none" stroke="#F7DAB2" strokeDasharray="9 5" strokeWidth="3"/>}
  </Svg>
  <Animated.View style={[styles.glow,{opacity:shine}]}/>
 </View>;
}
const styles=StyleSheet.create({glow:{position:'absolute',width:8,height:8,borderRadius:8,backgroundColor:'#FFEDB1',right:'17%',top:'23%',shadowColor:'#FFF6BE',shadowOpacity:.9,shadowRadius:14,elevation:4}});
