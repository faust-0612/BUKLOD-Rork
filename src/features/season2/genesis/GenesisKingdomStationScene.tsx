/**
 * Small, deterministic, original vector environments.
 * Each station's built environment derives from a Kabihasnang Ligaw place's
 * documented visual motif; association to a playable character is art direction,
 * NOT an amendment to unreleased KL lore.
 *
 * Layer only: existing canonical gameplay routes / rewards remain untouched.
 * No network, audio, timers, expensive blur, events or animation loops.
 */
import React,{memo} from 'react';
import Svg,{Circle,Defs,Ellipse,G,Line,LinearGradient as SvgGradient,Path,Rect,Stop} from 'react-native-svg';
import {KL_KINGDOM_VISUAL_MOTIFS,type KlKingdomVisualId} from './klKingdomVisualMotifs';

type Props={id:KlKingdomVisualId;mode?:'station'|'hero'};

function Tree({x,y,c,scale=1}:{x:number;y:number;c:string;scale?:number}){
  return <G transform={'translate('+x+' '+y+') scale('+scale+')'}>
    <Path d="M0 6 V24" stroke="#6B5843" strokeWidth={4}/>
    <Path d="M-19 10 L0 -25 L20 10 Z" fill={c}/>
    <Path d="M-16 1 L0 -35 L16 1 Z" fill={c} opacity=".88"/>
  </G>;
}
function RoofHouse({x,y,stone,accent}:{x:number;y:number;stone:string;accent:string}){
  return <G>
    <Rect x={x-25} y={y-3} width={50} height={40} rx={4} fill={stone} stroke="#445957" strokeWidth={1.5}/>
    <Path d={'M'+(x-32)+' '+(y-3)+' L'+x+' '+(y-28)+' L'+(x+32)+' '+(y-3)+' Z'}
      fill="#745D4C" stroke={accent} strokeWidth={1.4}/>
    <Rect x={x-6} y={y+12} width={12} height={25} rx={2} fill="#4A6560"/>
    <Rect x={x-18} y={y+6} width={8} height={9} rx={2} fill={accent}/>
    <Rect x={x+10} y={y+6} width={8} height={9} rx={2} fill={accent}/>
  </G>;
}
function Tower({x=183,y=88,stone,accent,roof=true}:{x?:number;y?:number;stone:string;accent:string;roof?:boolean}){
  return <G>
    <Rect x={x-23} y={y-51} width={46} height={96} rx={3} fill={stone} stroke="#617673" strokeWidth={2}/>
    {roof?<Path d={'M'+(x-30)+' '+(y-50)+' L'+x+' '+(y-88)+' L'+(x+30)+' '+(y-50)+' Z'}
      fill="#475E63" stroke={accent} strokeWidth={2}/>:null}
    <Rect x={x-8} y={y+19} width={16} height={26} rx={7} fill="#46645E"/>
    <Rect x={x-7} y={y-30} width={14} height={25} rx={5} fill={accent}/>
    <Path d={'M'+(x-14)+' '+(y+1)+' H'+(x+14)} stroke="#6C7D78" strokeWidth={2}/>
  </G>;
}
function KingdomLandmark({id}:{id:KlKingdomVisualId}){
 const c=KL_KINGDOM_VISUAL_MOTIFS[id],s=c.stone,a=c.accent;
 switch(c.visual){
  case 'light-stone-village':
   return <G>
    <RoofHouse x={119} y={131} stone={s} accent={a}/>
    <RoofHouse x={237} y={120} stone={s} accent={a}/>
    <Path d="M102 169 Q183 102 261 171" fill="none" stroke={a} strokeWidth={5} opacity=".75"/>
    <Circle cx={183} cy={75} r={19} fill={a} opacity=".67"/>
    <Path d="M183 52 V28 M161 75 H138 M205 75 H228" stroke={a} strokeWidth={3} opacity=".65"/>
   </G>;
  case 'memory-ruins':
   return <G>
    {[119,173,236].map((x,i)=><G key={x}>
      <Rect x={x-13} y={110-(i%2)*26} width={26} height={75+(i%2)*26} rx={3} fill={s} opacity=".91"/>
      <Path d={'M'+x+' '+(110-(i%2)*26)+' V'+(169-(i%2)*16)}
        stroke="#6C91A1" strokeWidth={2} strokeDasharray="3 8"/>
      <Circle cx={x+5} cy={92-(i%2)*26} r={5} fill={a} opacity=".72"/>
    </G>)}
    <Path d="M98 174 Q170 142 263 176" fill="none" stroke={a} strokeDasharray="2 9" strokeWidth={3}/>
   </G>;
  case 'order-measure-tower':
   return <G>
     <Tower stone={s} accent={a} roof={false}/>
     {[112,249].map(x=><G key={x}>
       <Rect x={x-24} y={118} width={48} height={67} rx={2} fill={s}/>
       <Rect x={x-15} y={127} width={30} height={15} fill={a} opacity=".65"/>
     </G>)}
     <Circle cx={183} cy={82} r={13} fill="#41686B" stroke={a} strokeWidth={3}/>
     <Path d="M183 73 V83 L192 90" fill="none" stroke={a} strokeWidth={2}/>
     <Path d="M90 173 H270 M90 181 H270" stroke="#D7E6DA" strokeWidth={2} strokeDasharray="3 8" opacity=".6"/>
   </G>;
  case 'crossroads-gate':
   return <G>
     <Path d="M90 190 L182 137 L272 190 M113 190 L182 154 L246 190" fill="none" stroke={a} strokeWidth={5}/>
     <Rect x={126} y={98} width={18} height={78} fill={s}/>
     <Rect x={216} y={98} width={18} height={78} fill={s}/>
     <Path d="M119 102 Q180 56 241 102 L237 115 Q180 77 124 115 Z" fill={s} stroke={a} strokeWidth={3}/>
     <Path d="M180 98 V158" stroke={a} strokeWidth={3} strokeDasharray="8 7"/>
   </G>;
  case 'lantern-city':
   return <G>
     <Tower stone={s} accent={a}/>
     {[113,251].map(x=><G key={x}>
       <RoofHouse x={x} y={136} stone={s} accent={a}/>
       <Line x1={x} y1={98} x2={x} y2={113} stroke={s} strokeWidth={2}/>
       <Rect x={x-8} y={110} width={16} height={23} rx={4} fill={a}/>
       <Circle cx={x} cy={122} r={14} fill={a} opacity=".25"/>
     </G>)}
     {[153,213].map(x=><Circle key={x} cx={x} cy={57} r={5} fill={a} opacity=".8"/>)}
   </G>;
  case 'fear-fortress':
   return <G>
     <Path d="M90 178 V99 H120 V87 H141 V99 H163 V70 H197 V99 H220 V87 H240 V99 H270 V178 Z"
       fill={s} stroke="#6B8495" strokeWidth={2}/>
     <Path d="M164 70 L180 36 L196 70 Z" fill="#384959" stroke={a} strokeWidth={2}/>
     <Path d="M175 178 V145 Q180 130 191 145 V178" fill="#263C51"/>
     {[114,141,219,247].map(x=><Rect key={x} x={x-4} y={120} width={9} height={19} rx={4} fill={a} opacity=".7"/>)}
     <Path d="M88 186 H272" stroke={a} strokeWidth={3}/>
   </G>;
  case 'woven-record-hall':
   return <G>
     <RoofHouse x={126} y={126} stone={s} accent={a}/>
     <RoofHouse x={237} y={126} stone={s} accent={a}/>
     <Rect x={162} y={93} width={40} height={85} rx={3} fill={s}/>
     <Path d="M154 94 L182 67 L211 94 Z" fill="#75584C" stroke={a} strokeWidth={2}/>
     <Path d="M170 120 V173 M179 119 V173 M189 118 V173 M198 120 V173" stroke="#A58963" strokeWidth={3}/>
     <Path d="M167 133 H202 M167 147 H202 M167 161 H202" stroke={a} strokeWidth={3}/>
   </G>;
  case 'traced-forest':
   return <G>
     {[89,126,247,278].map((x,i)=><Tree key={x} x={x} y={154-i%2*19} c="#2B6644" scale={i%2?1.15:.85}/>)}
     <Path d="M183 191 C134 157 140 131 160 112 M183 191 C226 155 229 126 205 107"
       fill="none" stroke="#6B4E39" strokeWidth={8} strokeLinecap="round"/>
     <Ellipse cx={183} cy={107} rx={53} ry={42} fill="#367B50"/>
     <Ellipse cx={162} cy={95} rx={36} ry={30} fill="#4D9864"/>
     <Ellipse cx={208} cy={91} rx={38} ry={33} fill="#458957"/>
     <Path d="M146 104 Q182 75 218 105 M177 136 Q182 102 188 137" stroke={a} strokeWidth={2} fill="none"/>
     <Path d="M116 191 Q136 180 151 187 T183 189 T216 188 T249 191" stroke={a} strokeDasharray="2 7" strokeWidth={2} fill="none"/>
   </G>;
  case 'mirror-sanctum':
   return <G>
     <Path d="M110 172 V104 L182 67 L250 104 V172 Z" fill={s} stroke={a} strokeWidth={2}/>
     <Path d="M123 104 H239 M182 69 V170" fill="none" stroke="#7C928B" strokeWidth={3}/>
     <Path d="M144 113 L182 84 L221 113 L213 160 L182 181 L152 160 Z" fill="#598895" stroke={a} strokeWidth={3}/>
     <Path d="M182 84 V181 M152 160 L213 160" stroke="#D4EAEC" strokeWidth={2}/>
     <Circle cx={165} cy={123} r={5} fill={a}/><Circle cx={200} cy={122} r={5} fill={a}/>
   </G>;
  case 'hope-bridge':
   return <G>
     <Path d="M58 163 Q130 116 180 154 Q233 116 298 163" fill="none" stroke={s} strokeWidth={14} strokeLinecap="round"/>
     <Path d="M58 163 Q130 116 180 154 Q233 116 298 163" fill="none" stroke={a} strokeWidth={3} strokeDasharray="4 9"/>
     <Path d="M92 161 V120 M260 161 V119" stroke={s} strokeWidth={4}/>
     <Circle cx={92} cy={112} r={13} fill={a}/>
     <Circle cx={260} cy={111} r={13} fill={a}/>
     <Path d="M95 191 Q181 176 267 190" stroke="#92CBD4" strokeWidth={10} fill="none"/>
     <Path d="M181 65 L188 83 L206 88 L190 101 L186 118 L176 102 L160 94 L177 83 Z" fill={a}/>
   </G>;
  case 'record-archive':
   return <G>
     <Path d="M95 109 L182 70 L269 109 Z" fill={s} stroke={a} strokeWidth={3}/>
     <Rect x={109} y={107} width={146} height={77} fill={s}/>
     {[127,164,201,238].map(x=><G key={x}>
       <Rect x={x-6} y={113} width={12} height={62} rx={3} fill="#9BA39A"/>
       <Rect x={x-9} y={112} width={18} height={8} fill={a} opacity=".65"/>
     </G>)}
     <Path d="M105 182 H259 M118 94 H247" stroke={a} strokeWidth={3}/>
     <Circle cx={182} cy={100} r={8} fill={a} opacity=".9"/>
     <Path d="M182 87 V114 M172 101 H192" stroke="#6E7161" strokeWidth={2}/>
   </G>;
  case 'root-river':
   return <G>
     <Path d="M180 191 Q161 161 176 123 M180 191 Q210 156 197 121 M180 182 Q134 167 101 181 M182 180 Q240 157 264 183" stroke="#6D6550" strokeWidth={9} fill="none" strokeLinecap="round"/>
     <Ellipse cx={183} cy={97} rx={61} ry={44} fill="#548F59"/>
     <Ellipse cx={166} cy={82} rx={31} ry={28} fill="#7BAD67"/>
     <Ellipse cx={210} cy={88} rx={37} ry={31} fill="#78A967"/>
     <Path d="M42 180 Q105 145 160 183 Q207 214 320 164" fill="none" stroke="#75C7B7" strokeWidth={10} opacity=".75"/>
     <Path d="M42 179 Q105 144 160 182 Q207 213 320 163" fill="none" stroke={a} strokeWidth={2} opacity=".7"/>
     <RoofHouse x={87} y={150} stone={s} accent={a}/>
   </G>;
  case 'first-light-garden':
   return <G>
     <Tower x={183} y={103} stone={s} accent={a}/>
     <Circle cx={183} cy={29} r={22} fill={a} opacity=".8"/>
     <Circle cx={183} cy={29} r={34} fill={a} opacity=".22"/>
     {[96,128,235,267].map((x,i)=><G key={x}>
       <Tree x={x} y={169-(i%2)*9} c="#639B67" scale={.75}/>
       <Circle cx={x} cy={136-i%2*8} r={4} fill={a} opacity=".9"/>
     </G>)}
     <Path d="M80 191 Q183 159 279 191" fill="none" stroke={a} strokeWidth={3} strokeDasharray="5 7"/>
   </G>;
 }
}
function GenesisKingdomStationScene({id,mode='station'}:Props){
 const c=KL_KINGDOM_VISUAL_MOTIFS[id];
 const skyId='kl-sky-'+id,glowId='kl-glow-'+id;
 return <Svg width="100%" height="100%" viewBox="0 0 360 220"
    preserveAspectRatio="xMidYMid slice" pointerEvents="none">
    <Defs>
      <SvgGradient id={skyId} x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor={c.sky}/>
        <Stop offset="100%" stopColor={c.horizon}/>
      </SvgGradient>
      <SvgGradient id={glowId} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={c.accent} stopOpacity=".35"/>
        <Stop offset="100%" stopColor={c.accent} stopOpacity="0"/>
      </SvgGradient>
    </Defs>
    <Rect x={0} y={0} width={360} height={220} fill={'url(#'+skyId+')'}/>
    <Circle cx={267} cy={42} r={30} fill={'url(#'+glowId+')'}/>
    <Circle cx={267} cy={42} r={11} fill={c.accent} opacity=".80"/>
    <Path d="M-8 136 L61 52 L125 135 L193 69 L276 142 L328 62 L369 135 V220 H-8 Z"
      fill="#496C6E" opacity=".43"/>
    <Path d="M-12 159 L52 96 L104 162 L172 110 L231 151 L297 94 L372 157 V220 H-12 Z"
      fill={c.horizon} opacity=".75"/>
    <Path d="M-20 194 Q58 153 121 173 Q187 145 245 171 Q318 142 380 175 V225 H-20 Z"
      fill={c.ground}/>
    <Path d="M-8 198 Q68 184 113 198 T242 197 T368 199"
      fill="none" stroke={c.accent} strokeWidth={1.5} opacity=".35"/>
    <KingdomLandmark id={id}/>
    {mode==='station'?<Rect x={1} y={1} width={358} height={218} rx={12}
      stroke={c.accent} strokeOpacity=".53" strokeWidth={2} fill="none"/>:null}
  </Svg>;
}
export default memo(GenesisKingdomStationScene);
