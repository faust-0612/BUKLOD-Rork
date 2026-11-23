/** Original, resolution-independent Genesis estate design assets.
 * Every picker option renders a distinct real thumbnail; these are preview
 * visuals only. Verified application still goes through the server RPC.
 */
import React from 'react';
import Svg,{Circle,Defs,Ellipse,G,Line,LinearGradient,Path,Polygon,Rect,Stop} from 'react-native-svg';
import type {EstateCosmetics} from './estateProgressClient';

type Family=keyof EstateCosmetics;
type Props={family:Family;choice:string;size?:number};
const PAINT:Record<string,readonly [string,string,string]>={
 stone:['#D9C8A6','#6D766D','#F2E0B5'],
 timber:['#B98958','#795537','#F4D49D'],
 garden:['#B2D6A7','#457D67','#E9F7C2'],
 slate:['#A2BDCD','#435D70','#E7F2FC'],
 clay:['#D6A581','#975947','#FFE1B5'],
 light:['#E2DED5','#7184A6','#FFFBDF'],
};
const palette=(choice:string)=>PAINT[choice]??PAINT.stone;
export default function EstateCosmeticTile({family,choice,size=51}:Props){
 const [wall,dark,trim]=palette(choice);
 const gold='#F6D89B',aqua='#8CDCE0';
 const roof=choice==='hip'?'#607C73':choice==='terrace'?'#AEBEAB':'#536D68';
 return <Svg width={size} height={Math.round(size*.78)} viewBox="0 0 88 69" accessible={false}>
  <Defs>
   <LinearGradient id="tile-night" x1="0" x2="1" y1="0" y2="1">
    <Stop offset="0" stopColor="#285249"/><Stop offset="1" stopColor="#102B33"/>
   </LinearGradient>
   <LinearGradient id="tile-earth" x1="0" x2="0" y1="0" y2="1">
    <Stop offset="0" stopColor="#82B27A"/><Stop offset="1" stopColor="#3C765E"/>
   </LinearGradient>
  </Defs>
  <Rect x="1" y="1" width="86" height="67" rx="11" fill="url(#tile-night)" stroke="#678B7D" strokeWidth="1"/>
  <Ellipse cx="45" cy="53" rx="32" ry="9" fill="#06191B" opacity=".6"/>
  <Polygon points="10,43 45,25 80,43 45,62" fill="url(#tile-earth)" stroke="#B4C59B" strokeWidth="1.4"/>
  {family==='finish'&&<G>
   <Path d="M23 32 L46 21 L68 32 L68 50 L46 60 L23 50Z" fill={wall} stroke={trim} strokeWidth="2"/>
   <Path d="M46 21 L46 60 L68 50 L68 32Z" fill={dark} opacity=".84"/>
   <Polygon points="20,33 44,16 71,32 47,44" fill={choice==='clay'?'#A46148':choice==='light'?'#A7B6DB':'#365653'} stroke={trim} strokeWidth="2"/>
   <Rect x="28" y="40" width="9" height="10" rx="2" fill={aqua} stroke={trim}/>
   <Path d="M54 43 L62 40 L62 51 L54 54Z" fill={gold} opacity=".86"/>
  </G>}
  {family==='roof'&&<G>
   <Path d="M19 37 L45 24 L71 37 L71 51 L45 62 L19 51Z" fill="#D3BA94" stroke="#FFE4AB" strokeWidth="1.5"/>
   {choice==='gable'?<G><Polygon points="15,38 44,14 75,37 45,29" fill={roof} stroke={gold} strokeWidth="2.5"/><Path d="M15 38 L44 14 L45 29" fill="#3B6057" stroke={gold} strokeWidth="1"/></G>:null}
   {choice==='hip'?<G><Polygon points="14,38 34,22 53,19 75,37 44,43" fill="#557466" stroke={gold} strokeWidth="2"/><Path d="M34 22 L44 43 L53 19" fill="none" stroke="#E9F2D7" strokeWidth="1.5"/></G>:null}
   {choice==='terrace'?<G><Polygon points="16,35 47,19 75,35 44,51" fill="#94BDB1" stroke={gold} strokeWidth="2"/><Path d="M16 35 L16 40 L44 55 L75 40 L75 35" fill="none" stroke={gold} strokeWidth="2"/><Rect x="40" y="25" width="10" height="7" rx="1" fill="#D3E5DD"/></G>:null}
  </G>}
  {family==='ground'&&<G>
   {choice==='stone'?Array.from({length:6},(_,i)=><Polygon key={i} points={(18+i*9)+',44 '+(24+i*9)+',39 '+(31+i*9)+',43 '+(26+i*9)+',49'} fill={i%2?'#D4D1BE':'#999D93'} stroke="#F0E6CC" strokeWidth=".9"/>):null}
   {choice==='grass'?Array.from({length:11},(_,i)=><Path key={i} d={'M'+(16+i*6)+' '+(42+i%3*3)+' l3 -9 l4 7'} stroke={i%2?'#B4E68A':'#38774B'} strokeWidth="2" fill="none" strokeLinecap="round"/>):null}
   {choice==='flower'?Array.from({length:8},(_,i)=><G key={i}><Line x1={20+i*7} y1={48-i%3*3} x2={20+i*7} y2={38-i%3*3} stroke="#4A9456" strokeWidth="2"/><Circle cx={20+i*7} cy={37-i%3*3} r="4" fill={i%2?'#FCB5C9':'#FFE2A0'}/><Circle cx={20+i*7} cy={37-i%3*3} r="1.4" fill="#FFF7DA"/></G>):null}
  </G>}
  {family==='fence'&&<G>
   <Path d="M12 42 L44 26 L76 42 M12 49 L44 34 L76 49" stroke={choice==='iron'?'#C7D7D8':'#B08C5B'} strokeWidth={choice==='iron'?2:4} fill="none"/>
   {Array.from({length:7},(_,i)=><G key={i}>
    <Line x1={15+i*10} y1={38-(i<=3?i*4:(6-i)*4)} x2={15+i*10} y2={54-(i<=3?i*4:(6-i)*4)}
      stroke={choice==='iron'?'#C6D9E0':choice==='hedge'?'#2F6240':'#DFC28C'} strokeWidth={choice==='wood'?5:2.8} strokeLinecap="round"/>
    {choice==='hedge'?<Circle cx={15+i*10} cy={35-(i<=3?i*4:(6-i)*4)} r="6" fill={i%2?'#6CA76C':'#448458'}/>:null}
    {choice==='iron'?<Circle cx={15+i*10} cy={38-(i<=3?i*4:(6-i)*4)} r="2" fill={gold}/>:null}
   </G>)}
  </G>}
  {family==='windows'&&<G>
   <Path d="M25 22 L59 22 L63 55 L25 55Z" fill="#DCC79D" stroke={gold} strokeWidth="2"/>
   <Rect x={choice==='panorama'?22:31} y={choice==='arched'?23:26} width={choice==='panorama'?44:27} height={choice==='arched'?31:24} rx={choice==='arched'?13:2} fill={aqua} stroke="#F6EBCD" strokeWidth="3"/>
   {choice==='classic'?<Path d="M44 26 L44 50 M31 38 L58 38" stroke="#F9EECE" strokeWidth="2"/>:null}
   {choice==='panorama'?<G><Line x1="36" y1="26" x2="36" y2="50" stroke={gold} strokeWidth="1.5"/><Line x1="52" y1="26" x2="52" y2="50" stroke={gold} strokeWidth="1.5"/></G>:null}
   {choice==='arched'?<Path d="M31 37 L58 37" stroke={gold} strokeWidth="1.4"/>:null}
   <Path d="M37 30 L29 44" stroke="#F9FFFF" strokeWidth="3" opacity=".45"/>
  </G>}
  {family==='lights'&&<G>
   <Ellipse cx="44" cy="54" rx="22" ry="9" fill={choice==='starlight'?'#B2E3FF':choice==='garden'?'#C2FAA2':'#FFDB87'} opacity=".32"/>
   {choice==='garden'?<G><Line x1="44" y1="27" x2="44" y2="51" stroke="#D6D4AE" strokeWidth="5"/><Path d="M31 31 Q44 16 57 31Z" fill="#B5DB9B" stroke="#EEF6CE" strokeWidth="2"/><Circle cx="44" cy="33" r="8" fill="#E7FFBB"/></G>:null}
   {choice==='warm'?<G><Line x1="44" y1="22" x2="44" y2="50" stroke={gold} strokeWidth="4"/><Path d="M34 23 L54 23 L52 39 L36 39 Z" fill="#FBCB75" stroke="#FFF0B9" strokeWidth="2"/><Circle cx="44" cy="31" r="6" fill="#FFF5C5"/></G>:null}
   {choice==='starlight'?<G><Path d="M44 13 L49 28 L64 32 L49 37 L44 51 L39 37 L24 32 L39 28Z" fill="#D6F6FF" stroke="#9CE0FF" strokeWidth="2"/><Circle cx="44" cy="32" r="5" fill="#FFFFFF"/></G>:null}
  </G>}
  {family==='door'&&<G>
   <Path d="M26 51 L26 25 Q43 8 62 25 L62 51Z" fill="#D6BC96" stroke={gold} strokeWidth="2"/>
   {choice==='arched'?<Path d="M31 51 L31 27 Q43 12 57 27 L57 51Z" fill="#8B573A" stroke="#EFCA91" strokeWidth="2"/>:<Rect x="31" y="23" width="27" height="28" rx="2" fill={choice==='glass'?'#89CFE2':'#94613D'} stroke="#FAE3AE" strokeWidth="2"/>}
   {choice==='wood'?<G><Line x1="40" y1="24" x2="40" y2="50" stroke="#DFB37A" strokeWidth="1.5"/><Line x1="49" y1="24" x2="49" y2="50" stroke="#DFB37A" strokeWidth="1.5"/></G>:null}
   {choice==='glass'?<Path d="M38 28 L33 41 M53 29 L44 44" stroke="#E6FFFF" strokeWidth="3" opacity=".8"/>:null}
   <Circle cx="53" cy="39" r="1.5" fill={gold}/>
  </G>}
  {family==='path'&&<G>
   <Path d="M18 58 L36 28 L51 28 L73 57 L60 59 L51 43 L39 43 L32 59Z" fill={choice==='brick'?'#BB7C61':choice==='pavers'?'#DCCFAF':'#908F84'} stroke={gold} strokeWidth="1.8"/>
   {Array.from({length:4},(_,i)=><G key={i}>
    <Path d={'M'+(30-i*3)+' '+(35+i*5)+' h'+(27+i*5)} stroke={choice==='brick'?'#F6C5A1':'#EBE1D2'} strokeWidth={choice==='gravel'?1:2}/>
    {choice==='brick'?<Line x1={43+i%2*8} y1={35+i*5} x2={43+i%2*8} y2={40+i*5} stroke="#774C43" strokeWidth="1.5"/>:null}
    {choice==='gravel'?<Circle cx={42+i*6} cy={34+i*5} r="2.5" fill="#D2D0BD"/>:null}
   </G>)}
  </G>}
  {family==='yard'&&<G>
   {choice==='bench'?<G><Path d="M23 34 L55 23 L69 29 L37 41Z" fill="#C38D55" stroke="#FFE2A5" strokeWidth="2"/><Path d="M23 41 L55 30 L69 36 L37 48Z" fill="#DCA76B" stroke={gold} strokeWidth="1.5"/><Line x1="32" y1="45" x2="32" y2="55" stroke={gold} strokeWidth="3"/><Line x1="63" y1="38" x2="63" y2="49" stroke={gold} strokeWidth="3"/></G>:null}
   {choice==='pond'?<G><Ellipse cx="44" cy="45" rx="27" ry="13" fill="#619FA0" stroke={gold} strokeWidth="3"/><Ellipse cx="44" cy="44" rx="21" ry="9" fill="#9FDCE0"/><Path d="M31 44 Q44 36 57 44" fill="none" stroke="#F2FFFF" strokeWidth="1.5"/><Circle cx="58" cy="41" r="3" fill="#F6C4C7"/></G>:null}
   {choice==='pergola'?<G><Line x1="24" y1="32" x2="24" y2="53" stroke="#DBC493" strokeWidth="4"/><Line x1="64" y1="32" x2="64" y2="53" stroke="#DBC493" strokeWidth="4"/><Polygon points="16,31 44,14 73,31 44,43" fill="#A27C53" stroke={gold} strokeWidth="2"/><Path d="M25 27 L52 39 M38 19 L64 34" stroke="#FFDF9B" strokeWidth="3"/><Path d="M21 33 Q29 39 31 48" stroke="#5FBC74" strokeWidth="3" fill="none"/></G>:null}
  </G>}
  <Circle cx="74" cy="11" r="2" fill={gold} opacity=".8"/>
 </Svg>;
}
