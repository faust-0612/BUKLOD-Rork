/** Original scalable resource emblems for construction wallets and blueprints. */
import React from 'react';
import Svg,{Circle,Defs,Ellipse,G,LinearGradient,Path,Polygon,Rect,Stop} from 'react-native-svg';
type Kind='development_xp'|'timber'|'stone'|'metal';
export default function EstateResourceEmblem({kind,size=28}:{kind:Kind;size?:number}){
 return <Svg width={size} height={size} viewBox="0 0 64 64">
  <Defs>
   <LinearGradient id="emblem-bg" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#3B695D"/><Stop offset="1" stopColor="#142E32"/></LinearGradient>
   <LinearGradient id="emblem-metal" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#F3F0D4"/><Stop offset=".47" stopColor="#8EA5AD"/><Stop offset="1" stopColor="#435F6B"/></LinearGradient>
   <LinearGradient id="emblem-crystal" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FDE6AD"/><Stop offset=".6" stopColor="#A7D9D0"/><Stop offset="1" stopColor="#467C80"/></LinearGradient>
  </Defs>
  <Circle cx="32" cy="33" r="30" fill="url(#emblem-bg)" stroke="#B8A57E" strokeWidth="2"/>
  <Ellipse cx="32" cy="50" rx="20" ry="5" fill="#062A29" opacity=".48"/>
  {kind==='development_xp'&&<G>
    <Path d="M32 5 L40 21 L57 27 L41 35 L35 54 L28 39 L10 31 L25 23 Z" fill="url(#emblem-crystal)" stroke="#FCEFC4" strokeWidth="2"/>
    <Path d="M32 8 L33 34 L53 27 M32 34 L34 51 M32 34 L12 31" fill="none" stroke="#FFF6CF" strokeWidth="1.5" opacity=".85"/>
    <Circle cx="32" cy="33" r="5" fill="#FFF7DE"/>
  </G>}
  {kind==='timber'&&<G>
    <Path d="M11 32 L37 16 L49 23 L23 40 Z" fill="#CBA172" stroke="#F7DEAB" strokeWidth="2"/>
    <Path d="M23 40 L49 23 L49 35 L23 52 Z" fill="#774B32" stroke="#D7A36B" strokeWidth="2"/>
    <Path d="M11 32 L23 40 L23 52 L11 44 Z" fill="#E3BD89" stroke="#FAE5BC" strokeWidth="1.5"/>
    <Ellipse cx="18" cy="41" rx="4" ry="6" fill="none" stroke="#A5744B" strokeWidth="1.5"/>
    <Path d="M20 45 C26 35 35 31 42 29" stroke="#F5CC91" strokeWidth="1.6" fill="none" opacity=".8"/>
  </G>}
  {kind==='stone'&&<G>
    <Polygon points="13,42 22,23 40,13 54,32 46,49 23,52" fill="#9DAEB0" stroke="#E9E5CF" strokeWidth="2"/>
    <Polygon points="22,23 40,13 32,39 13,42" fill="#E2D6BE"/>
    <Polygon points="40,13 54,32 46,49 32,39" fill="#6C8A91"/>
    <Path d="M22 23 L32 39 L23 52 M32 39 L46 49" stroke="#D6E6DE" strokeWidth="1.6" fill="none"/>
  </G>}
  {kind==='metal'&&<G>
    <Path d="M12 35 L38 20 L53 31 L28 47 Z" fill="url(#emblem-metal)" stroke="#F6E8CA" strokeWidth="2"/>
    <Path d="M28 47 L53 31 L53 40 L28 54 Z" fill="#66818B" stroke="#DDE4D7" strokeWidth="2"/>
    <Path d="M12 35 L28 47 L28 54 L12 43 Z" fill="#BCC4BD" stroke="#F5EBD3" strokeWidth="1.5"/>
    <Path d="M18 34 L38 23 L47 30" stroke="#FFFFFF" strokeWidth="1.5" fill="none" opacity=".9"/>
  </G>}
 </Svg>;
}
