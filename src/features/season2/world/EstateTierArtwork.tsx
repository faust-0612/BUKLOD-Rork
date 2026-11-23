/** Original BUKLOD scalable 2.5D architecture layers.
 * These are real RN-SVG renderables, not unshipped PNG URLs.
 * Each completed tier has a distinct, persistent in-scene visual milestone.
 */
import React from 'react';
import {Circle,Ellipse,G,Line,Path,Polygon,Rect} from 'react-native-svg';

export type EstateArtTrack='lot'|'house'|'cluster';
type Props={
 track:EstateArtTrack; completedTier:number; activeStage:number; mastery:number;
 wall:string;dark:string;roofColor:string;trim:string;
 fence:string; windows:string; lights:string; door:string; path:string; yard:string;
};
const glow='#FFEAC1';
export default function EstateTierArtwork({
 track,completedTier,activeStage,mastery,wall,dark,roofColor,trim,fence,windows,lights,door,path,yard,
}:Props){
 const tier=Math.max(0,Math.min(10,Math.trunc(completedTier)));
 const c=(n:number)=>tier>=n;
 const paving=path==='brick'?'#BE8668':path==='pavers'?'#D9CBA6':'#A3A39B';
 const light=lights==='starlight'?'#BDE8FF':lights==='garden'?'#C4EAAA':glow;
 const gateMetal=fence==='iron'?'#B6C7C2':fence==='hedge'?'#84AB71':'#C6A273';
 const doorTint=door==='glass'?'#9CD2DF':door==='arched'?'#76513D':'#8A6349';
 return <G>
  {track==='lot'&&<G>
   {c(1)&&[40,100,300,356].map((x,i)=><G key={'landmark-'+i}>
     <Rect x={x-3} y={i%2?145:183} width="6" height="21" fill="#D7BF8C" stroke="#6D604F" strokeWidth="1"/>
     <Circle cx={x} cy={i%2?145:183} r="4" fill="#F9E9C5"/>
   </G>)}
   {c(2)&&<Path d="M40 172 L196 107 L356 172 L200 234 Z" stroke="#C9B888" strokeWidth="5" fill="none" strokeDasharray="11 5"/>}
   {c(3)&&[65,110,280,340].map((x,i)=><G key={'bamboo-'+i}>
     <Line x1={x} y1={i%2?153:184} x2={x} y2={i%2?135:167} stroke="#D5BC82" strokeWidth="4"/>
     <Line x1={x+7} y1={i%2?149:186} x2={x+7} y2={i%2?131:169} stroke="#D5BC82" strokeWidth="4"/>
   </G>)}
   {c(4)&&<Path d="M44 172 L198 108 L351 174 M44 172 L196 236 L351 174" stroke={gateMetal} strokeWidth="7" fill="none"/>}
   {c(5)&&<G>
     <Line x1="178" y1="228" x2="178" y2="198" stroke={gateMetal} strokeWidth="7"/>
     <Line x1="230" y1="225" x2="230" y2="198" stroke={gateMetal} strokeWidth="7"/>
     <Path d="M178 198 Q203 174 230 198" stroke={gateMetal} strokeWidth="6" fill="none"/>
     <Path d="M181 202 L201 214 L227 199" stroke={fence==='hedge'?'#65B37A':'#F5E7BF'} strokeWidth="3" fill="none"/>
   </G>}
   {c(6)&&<G>
     <Line x1="320" y1="191" x2="320" y2="145" stroke="#B6C8B8" strokeWidth="4"/>
     <Path d="M305 148 L333 148" stroke="#F0D7A4" strokeWidth="3"/>
     <Circle cx="320" cy="141" r="9" fill={light} opacity=".85"/>
     <Ellipse cx="80" cy="199" rx="15" ry="7" fill="#72A6B3" stroke="#E8E0BA" strokeWidth="2"/>
   </G>}
   {c(7)&&<G>
     <Path d="M205 239 L193 212 L219 177 L239 189 L221 215 L232 239" fill={paving} stroke="#F1D8B3" strokeWidth="2"/>
     {path==='brick'&&[191,204,215,226].map((y,i)=><Line key={'brick-'+i} x1={199-i} y1={y} x2={234-i} y2={y-6} stroke="#724F48" strokeWidth="2"/>)}
     {path==='pavers'&&[193,208,225].map((y,i)=><Path key={'paver-'+i} d={'M196 '+y+' l22 -8 l7 5 l-21 10 Z'} fill="#E6DBC1" stroke="#998F76" strokeWidth="1"/>)}
   </G>}
   {c(8)&&<G>
     <Path d="M75 187 L116 167 L148 182 L107 202 Z" fill="#5C875B" stroke="#A7BD82" strokeWidth="3"/>
     {[91,107,124].map((x,i)=><G key={'crop-'+i}><Line x1={x} y1={184-i*4} x2={x} y2={169-i*2} stroke="#65A268" strokeWidth="3"/><Circle cx={x} cy={169-i*2} r="5" fill="#B6DC81"/></G>)}
     <Polygon points="279,180 310,163 340,178 309,198" fill={roofColor} stroke={trim} strokeWidth="3"/>
     <Line x1="288" y1="190" x2="288" y2="209" stroke={trim} strokeWidth="4"/>
     <Line x1="330" y1="187" x2="330" y2="205" stroke={trim} strokeWidth="4"/>
   </G>}
   {c(9)&&<G>
     <Path d="M22 174 L45 160 L67 166 L46 184 Z M344 170 L373 158 L394 174 L370 185 Z" fill="#64885A" stroke="#E7D7A9" strokeWidth="3"/>
     {[25,382].map((x,i)=><G key={'expansion-'+i}><Circle cx={x} cy={167+i*5} r="11" fill="#67956D"/><Circle cx={x+5} cy={162+i*5} r="7" fill="#A3C78D"/></G>)}
   </G>}
   {c(10)&&<G>
     <Ellipse cx="280" cy="221" rx="23" ry="13" fill="#68B8BD" stroke="#F6E2B3" strokeWidth="4"/>
     <Ellipse cx="280" cy="221" rx="13" ry="7" fill="#A4E1EA" />
     <Line x1="280" y1="220" x2="280" y2="200" stroke="#B8F1F1" strokeWidth="3"/>
     <Circle cx="280" cy="199" r="5" fill="#E9FFFF"/>
     <Polygon points="343,146 352,136 361,146 352,155" fill="#FFF2BB" stroke="#9BD6E1" strokeWidth="2"/>
   </G>}
  </G>}
  {track==='house'&&<G>
   {c(1)&&<G>
     <Path d="M110 141 L201 99 L294 141" stroke="#E2C595" strokeWidth="5" fill="none"/>
     <Line x1="110" y1="141" x2="110" y2="201" stroke="#D8BC8B" strokeWidth="5"/>
     <Line x1="294" y1="141" x2="294" y2="203" stroke="#D8BC8B" strokeWidth="5"/>
   </G>}
   {c(2)&&<G>
     <Path d="M118 191 L200 219 L287 191 L205 164 Z" fill="#A47E60" stroke="#DBC6A1" strokeWidth="3"/>
     {[125,279].map((x,i)=><Line key={'post-'+i} x1={x} y1="135" x2={x} y2={i?195:202} stroke="#EED5A0" strokeWidth="5"/>)}
   </G>}
   {c(3)&&<G><Path d="M119 143 L204 110 L282 144 M119 143 L119 198 M282 144 L282 196" stroke="#DDC99C" strokeWidth="5" fill="none"/><Path d="M126 151 L199 121 L271 151" stroke={roofColor} strokeWidth="5" fill="none"/></G>}
   {c(4)&&<G>
     <Path d="M145 184 L174 175 L174 209 L145 221 Z" fill={wall} stroke={trim} strokeWidth="3"/>
     <Rect x="231" y="155" width={windows==='panorama'?41:25} height="25" rx={windows==='arched'?12:2} fill="#A6D9DE" stroke={trim} strokeWidth="3"/>
   </G>}
   {c(5)&&<G>
     <Polygon points="119,143 199,91 284,143 204,122" fill={roofColor} stroke={trim} strokeWidth="4"/>
     <Path d="M116 196 L139 184 L139 220 L116 227 Z" fill={wall} stroke={trim} strokeWidth="2"/>
     <Path d="M133 215 L169 199 L177 210 L143 227" fill="#D9BD98"/>
     <Path d="M148 210 L148 183 Q157 169 166 184 L166 203" fill={doorTint} stroke={trim} strokeWidth="2"/>
   </G>}
   {c(6)&&<G>
     <Path d="M283 165 L323 146 L349 158 L308 182 Z" fill={roofColor} stroke={trim} strokeWidth="3"/>
     <Path d="M309 183 L348 160 L348 205 L309 219 Z" fill={wall} stroke={trim} strokeWidth="3"/>
     <Rect x="321" y="174" width="16" height="19" rx={windows==='arched'?8:2} fill="#A5D8E1" stroke={trim} strokeWidth="2"/>
   </G>}
   {c(7)&&<G>
     <Path d="M152 90 L203 65 L263 92 L263 139 L204 162 L152 139 Z" fill={wall} stroke={trim} strokeWidth="3"/>
     <Polygon points="145,92 205,50 275,92 205,76" fill={roofColor} stroke={trim} strokeWidth="4"/>
     {[168,225].map((x,i)=><G key={'floor2-'+i}><Rect x={x} y="106" width="23" height="23" rx={windows==='arched'?11:2} fill="#A2D8E4" stroke={trim} strokeWidth="3"/><Line x1={x+12} y1="106" x2={x+12} y2="129" stroke={trim} strokeWidth="2"/></G>)}
   </G>}
   {c(8)&&<G>
     <Path d="M143 156 L200 174 L267 153" stroke="#F5DDB0" strokeWidth="5" fill="none"/>
     {[150,183,216,250].map((x,i)=><Line key={'balcony-'+i} x1={x} y1="153" x2={x} y2="174" stroke="#B5D5C5" strokeWidth="3"/>)}
     <Path d="M52 194 L90 174 L117 189 L79 209 Z" fill={roofColor} stroke={trim} strokeWidth="3"/>
     <Line x1="59" y1="194" x2="59" y2="216" stroke={trim} strokeWidth="3"/>
     <Line x1="108" y1="191" x2="108" y2="213" stroke={trim} strokeWidth="3"/>
   </G>}
   {c(9)&&<G>
     <Polygon points="167,73 207,55 237,72 198,89" fill="#315F80" stroke="#A6D7DE" strokeWidth="3"/>
     {[179,191,203].map((x,i)=><Line key={'solar-'+i} x1={x} y1={77-i%2*5} x2={x+25} y2={67-i%2*5} stroke="#83BED2" strokeWidth="1.5"/>)}
     <Ellipse cx="88" cy="223" rx="16" ry="7" fill="#5C956A"/><Circle cx="88" cy="213" r="13" fill="#8EBB78"/>
   </G>}
   {c(10)&&<G>
     <Path d="M91 187 L91 138 L117 128 L136 142 L136 201 Z M289 145 L306 127 L330 135 L330 190 L291 206 Z" fill={wall} stroke={trim} strokeWidth="3"/>
     <Polygon points="84,142 113,106 145,142" fill={roofColor} stroke={trim} strokeWidth="3"/>
     <Polygon points="283,141 308,104 337,141" fill={roofColor} stroke={trim} strokeWidth="3"/>
     <Ellipse cx="301" cy="227" rx="21" ry="9" fill="#69ABB8" stroke="#F2DEB1" strokeWidth="3"/>
     <Line x1="301" y1="225" x2="301" y2="211" stroke="#CCF8F1" strokeWidth="3"/>
     <Circle cx="301" cy="208" r="5" fill="#E5F7F4"/>
   </G>}
  </G>}
  {track==='cluster'&&<G>
   {c(1)&&<G>
     <Path d="M49 181 L110 155 L170 184 L107 212 Z M237 187 L305 158 L361 182 L295 213 Z" fill="none" stroke="#E0CF98" strokeWidth="3" strokeDasharray="7 4"/>
   </G>}
   {c(2)&&[0,1,2].map((i)=><G key={'hut-'+i}>
     <Path d={'M'+(45+i*100)+' '+(169+i%2*10)+' l23 -12 l25 12 l-22 14 Z'} fill={roofColor} stroke={trim} strokeWidth="3"/>
     <Path d={'M'+(55+i*100)+' '+(178+i%2*10)+' v19 l21 8 v-18'} fill={wall} stroke={trim} strokeWidth="2"/>
   </G>)}
   {c(3)&&<G><Polygon points="140,171 197,135 257,171 202,194" fill={roofColor} stroke={trim} strokeWidth="3"/><Line x1="147" y1="177" x2="147" y2="213" stroke={trim} strokeWidth="4"/><Line x1="251" y1="174" x2="251" y2="212" stroke={trim} strokeWidth="4"/></G>}
   {c(4)&&<G><Path d="M48 212 L163 235 L208 214 L365 198" stroke={paving} strokeWidth="11" fill="none"/><Path d="M210 124 L211 226" stroke="#C7BE9D" strokeWidth="8" fill="none"/></G>}
   {c(5)&&<G>
     <Polygon points="138,140 201,106 268,142 201,174" fill={roofColor} stroke={trim} strokeWidth="3"/>
     <Path d="M145 144 L201 175 L260 145 L260 199 L201 221 L145 201 Z" fill={wall} stroke={trim} strokeWidth="3"/>
     <Rect x="179" y="169" width="23" height="29" rx={door==='arched'?10:2} fill={doorTint} stroke={trim} strokeWidth="2"/>
   </G>}
   {c(6)&&<G>
     {[40,354].map((x,i)=><G key={'utility-'+i}><Line x1={x} y1={171+i*10} x2={x} y2={119+i*8} stroke="#D6CEB5" strokeWidth="4"/><Circle cx={x} cy={117+i*8} r="8" fill={light}/></G>)}
   </G>}
   {c(7)&&<G>
     <Path d="M70 189 L118 168 L162 189 L114 214 Z" fill="#5E8F79" stroke="#F3E6BF" strokeWidth="3"/>
     <Path d="M82 184 L151 193 M112 173 L113 206" stroke="#EDE3CC" strokeWidth="2"/>
     <Circle cx="115" cy="190" r="7" fill="none" stroke="#F6E9C4" strokeWidth="2"/>
   </G>}
   {c(8)&&<G>
     <Path d="M287 177 L326 157 L365 176 L328 198 Z" fill={roofColor} stroke={trim} strokeWidth="3"/>
     <Path d="M294 180 L328 200 L358 183 L358 217 L328 230 L294 216 Z" fill={wall} stroke={trim} strokeWidth="3"/>
     <Rect x="318" y="197" width="19" height="17" rx="2" fill="#A6D7E1" stroke={trim} strokeWidth="2"/>
   </G>}
   {c(9)&&<G>
     <Path d="M46 154 L80 132 L110 151 L78 173 Z" fill={roofColor} stroke={trim} strokeWidth="3"/>
     <Path d="M56 162 L78 176 L103 161 L103 197 L77 210 L56 195 Z" fill={wall} stroke={trim} strokeWidth="3"/>
     <Path d="M78 145 L78 131" stroke="#C7B1D9" strokeWidth="3"/><Circle cx="78" cy="129" r="5" fill="#CDEBD0"/>
   </G>}
   {c(10)&&<G>
     <Path d="M201 105 L201 52" stroke="#E9D5A7" strokeWidth="7"/>
     <Polygon points="184,57 201,31 218,57 201,70" fill="#E9E1AE" stroke="#C5E8EB" strokeWidth="3"/>
     <Circle cx="201" cy="35" r="12" fill="#A9E6E9" opacity=".85"/>
     {[118,279].map((x,i)=><G key={'hub-lamp-'+i}><Line x1={x} y1="175" x2={x} y2="141" stroke={trim} strokeWidth="4"/><Circle cx={x} cy="138" r="8" fill={light}/></G>)}
   </G>}
  </G>}
  {tier>=8&&yard==='bench'&&<G>
   <Rect x="58" y="211" width="38" height="5" rx="2" fill="#DFB983"/>
   <Rect x="61" y="202" width="33" height="5" rx="2" fill="#B88B61"/>
   <Line x1="64" y1="216" x2="64" y2="225" stroke="#E4CDA9" strokeWidth="3"/>
   <Line x1="91" y1="216" x2="91" y2="225" stroke="#E4CDA9" strokeWidth="3"/>
  </G>}
  {tier>=8&&yard==='pond'&&<G>
   <Ellipse cx="79" cy="215" rx="24" ry="10" fill="#67AFB8" stroke="#DAD8B2" strokeWidth="3"/>
   <Ellipse cx="77" cy="213" rx="13" ry="5" fill="#A7E1E7" opacity=".9"/>
  </G>}
  {tier>=8&&yard==='pergola'&&<G>
   <Path d="M52 185 L76 173 L101 186 L79 199 Z" fill={roofColor} stroke={trim} strokeWidth="3"/>
   <Line x1="58" y1="188" x2="58" y2="223" stroke={trim} strokeWidth="3"/>
   <Line x1="95" y1="188" x2="95" y2="224" stroke={trim} strokeWidth="3"/>
  </G>}
  {activeStage>0&&activeStage<4&&<G>
   <Path d="M163 135 L201 120 L239 137" stroke="#FBE0A0" strokeDasharray="7 5" strokeWidth="2" fill="none" opacity=".88"/>
   <Circle cx="201" cy="113" r="3" fill="#FFF3C0"/>
  </G>}
  {tier===10&&mastery>0&&<G>
   <Path d="M190 80 Q202 67 214 80" stroke="#9FEAE7" strokeWidth="3" fill="none"/>
   <Circle cx="203" cy="72" r="5" fill="#FDF0C2"/>
  </G>}
 </G>;
}
