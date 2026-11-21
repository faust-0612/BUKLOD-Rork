import React from 'react';
import {StyleSheet,View} from 'react-native';
import Svg,{Defs,LinearGradient,Stop,Ellipse,Path,Polygon,Rect,Line,Circle,G} from 'react-native-svg';
import {visualPhaseForWorkshop,type WorkshopProgress,type WorkshopStyle,type WorkshopTrack} from './worldWorkshopEngine';

/**
 * Genuine level/stage-reactive vector diorama on top of the licensed local
 * Genesis world backdrop. Every element is illustrative, never a land receipt.
 * It starts with vacant markers, not a prebuilt mansion.
 */
export default function WorldConstructionDiorama({track,progress,styleId}:{
 track:WorkshopTrack;progress:WorkshopProgress;styleId:WorkshopStyle;
}){
 const tier=Math.min(10,progress.level);
 const stage=visualPhaseForWorkshop(progress);
 const colors=styleId==='tropical'
  ?{wall:'#CBA27A',shade:'#88664D',roof:'#3B6447',frame:'#8A5437',soil:'#437255',light:'#F8D8A1'}
  :styleId==='nature'
  ?{wall:'#A6C2A3',shade:'#557D63',roof:'#234E41',frame:'#557254',soil:'#54845A',light:'#E8F2BD'}
  :{wall:'#D6C5A8',shade:'#8C9483',roof:'#445E61',frame:'#9D7753',soil:'#55745B',light:'#FFE6AC'};
 const house=track==='house';
 const cluster=track==='cluster';
 const buildingX=cluster?5:house?0:-5;
 return <View pointerEvents="none" style={styles.root} accessibilityLabel={
  track+' level '+tier+', construction stage '+progress.stage+', mastery '+progress.mastery
 }>
  <Svg viewBox="0 0 240 180" width="100%" height="100%">
   <Defs>
    <LinearGradient id="earth" x1="0" x2="1" y1="0" y2="1">
     <Stop offset="0" stopColor="#A9BB8A"/><Stop offset=".58" stopColor={colors.soil}/>
     <Stop offset="1" stopColor="#1A4839"/>
    </LinearGradient>
    <LinearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
     <Stop offset="0" stopColor={colors.wall}/><Stop offset="1" stopColor={colors.shade}/>
    </LinearGradient>
    <LinearGradient id="roof" x1="0" x2="1" y1="0" y2="1">
     <Stop offset="0" stopColor="#879C83"/><Stop offset=".7" stopColor={colors.roof}/>
     <Stop offset="1" stopColor="#213C3D"/>
    </LinearGradient>
   </Defs>
   <Ellipse cx="120" cy="162" rx="99" ry="14" fill="#061C20" opacity=".42"/>
   <Path d="M12 133 L118 88 L230 128 L127 175 Z" fill="url(#earth)" stroke="#C5E2A5" strokeWidth="2"/>
   <Path d="M28 134 L118 99 L214 132 L125 166 Z" fill="none" stroke="#E9D5A2" strokeDasharray="7 6" strokeWidth={tier===0?2:1.1} opacity=".85"/>
   {/* Level zero = ground survey stakes, a true rudimentary beginning. */}
   {[{x:26,y:132},{x:117,y:96},{x:214,y:131},{x:125,y:167}].map((p,i)=>
    <G key={i}><Line x1={p.x} y1={p.y} x2={p.x} y2={p.y-17} stroke={colors.frame} strokeWidth="4"/>
     <Circle cx={p.x} cy={p.y-18} r="3" fill={colors.light}/></G>)}
   {stage>=1?<>
    <Path d="M53 132 L118 111 L186 133 L123 154 Z" fill="#778775" stroke="#D7C398" strokeWidth="3"/>
    <Path d="M53 132 L123 154 L123 160 L53 138 Z" fill="#7D7865"/>
    <Path d="M123 154 L186 133 L186 139 L123 160 Z" fill="#A7997E"/>
   </>:null}
   {stage>=2?<>
    {[{x:57,y:131},{x:121,y:111},{x:183,y:132},{x:122,y:153}].map((p,i)=>
     <G key={i}><Line x1={p.x} y1={p.y} x2={p.x} y2={p.y-50} stroke={colors.frame} strokeWidth="5"/>
       <Circle cx={p.x} cy={p.y-51} r="2.6" fill="#F1DBAC"/></G>)}
    <Path d="M57 82 L121 62 L183 83 L122 105 Z" fill="none" stroke={colors.frame} strokeWidth="4"/>
    <Path d="M57 82 L183 132 M183 83 L57 131" fill="none" stroke={colors.frame} strokeWidth="2" opacity=".8"/>
   </>:null}
   {stage>=3 && track!=='lot'?<>
     <Polygon points="57,83 122,105 122,153 57,131" fill="url(#wall)" stroke={colors.frame} strokeWidth="1.5"/>
     <Polygon points="122,105 183,83 183,132 122,153" fill={colors.shade} stroke={colors.frame} strokeWidth="1.5"/>
     <Polygon points="109,121 121,125 121,149 109,145" fill="#273D39" stroke="#E8D8AB" strokeWidth="1.5"/>
     <Polygon points="72,98 91,104 91,118 72,112" fill="#B7E3DC" stroke="#F0E7C9" strokeWidth="2"/>
     <Path d="M81 101 L81 115" stroke="#6B8D89" strokeWidth="1.6"/>
     <Polygon points="146,109 167,101 167,116 146,124" fill="#B2E4D9" stroke="#F8E5C8" strokeWidth="2"/>
     <Line x1="156" y1="105" x2="156" y2="120" stroke="#54756D" strokeWidth="1.3"/>
   </>:null}
   {stage>=3 && track==='lot'?<>
     <Path d="M40 129 L113 101 L206 132 L132 167" fill="none" stroke={colors.frame} strokeWidth="6" strokeDasharray="9 3"/>
     <Path d="M72 133 L113 115 L163 133 L124 151 Z" fill="#A6A477" opacity=".7"/>
     {[0,1,2].map((i)=><Path key={i} d={'M'+(88+i*14)+' '+(126+i*2)+' l18 -6'} stroke="#C1D6A1" strokeWidth="3"/>)}
   </>:null}
   {stage>=4 && track!=='lot'?<>
     <Polygon points="47,80 118,48 195,79 122,110" fill="url(#roof)" stroke="#D8C9A5" strokeWidth="2"/>
     <Path d="M47 80 L122 110 L195 79" stroke="#29463B" strokeWidth="5" fill="none"/>
     <Path d="M62 79 L119 53 L183 78" fill="none" stroke={colors.light} strokeWidth="2" opacity=".45"/>
   </>:null}
   {stage>=4 && track==='lot'?<>
     <Path d="M45 130 L124 156 L202 133" stroke="#ECD5A0" strokeWidth="5" fill="none"/>
     <Path d="M123 153 L123 173" stroke="#CFB47D" strokeWidth="5"/>
   </>:null}
   {stage>=5?<>
     <Path d="M117 154 L150 162 L166 175 L121 174 Z" fill="#D8C5A0" opacity=".95"/>
     {[34,202].map((x,i)=><G key={i}>
      <Path d={'M'+x+' 131 l-8 -13 q8 -24 19 0 Z'} fill="#315C45" stroke="#AFD39F" strokeWidth="2"/>
      <Path d={'M'+x+' 134 v12'} stroke="#7F7352" strokeWidth="4"/>
     </G>)}
     <Circle cx="42" cy="151" r="5" fill="#E4D48B"/>
     <Circle cx="196" cy="149" r="6" fill="#E0F0AA"/>
   </>:null}
   {cluster&&tier>=5?<G opacity=".96">
    <Polygon points="23,125 48,116 67,121 43,130" fill="#E2D1AF"/>
    <Polygon points="23,114 47,101 68,115 43,127" fill={colors.roof} stroke="#D5DBB5" strokeWidth="2"/>
    <Polygon points="182,129 206,119 225,130 201,138" fill="#D2B78C"/>
    <Polygon points="182,117 205,107 225,119 202,130" fill={colors.roof} stroke="#D5DBB5" strokeWidth="2"/>
   </G>:null}
   {tier>=8 && track!=='lot'?<G>
    <Rect x="128" y="99" width="4" height="4" fill="#EDE0B4"/>
    <Path d="M101 72 v-22 l18 -9 18 9 v21" fill="none" stroke={colors.frame} strokeWidth="4"/>
   </G>:null}
   {/* Temporary physical worksite cues vary at EACH construction stage and clear
       after completion without ever removing the permanent structure. */}
   {progress.stage>=1?<G>
     <Rect x="27" y="138" width="23" height="14" rx="2" fill="#B69260" stroke="#F5D49A" strokeWidth="1.5"/>
     <Path d="M27 145 h23 M38 138 v14" stroke="#7B603F" strokeWidth="1.5"/>
   </G>:null}
   {progress.stage>=2?<G>
     <Path d="M48 125 L124 98 L195 124" stroke="#E7C886" strokeWidth="2" strokeDasharray="5 4" fill="none"/>
     <Circle cx="48" cy="125" r="3" fill="#FFF0BE"/>
     <Circle cx="195" cy="124" r="3" fill="#FFF0BE"/>
   </G>:null}
   {progress.stage>=3?<G>
     <Path d="M62 120 v-41 h122 v41 M62 96 h122" stroke="#D6B37B" strokeWidth="3" opacity=".86" fill="none"/>
     <Path d="M62 80 l30 40 M182 80 l-31 40" stroke="#EACB9A" strokeWidth="2" opacity=".75"/>
   </G>:null}
   {progress.stage>=4?<G>
     <Path d="M54 82 L122 58 L191 82" stroke="#F3DDA5" strokeWidth="4" fill="none"/>
     <Path d="M63 85 L118 63 L181 85" stroke="#B4CFAD" strokeWidth="2" fill="none"/>
   </G>:null}
   {progress.mastery>0?<G>
     <Circle cx="119" cy="30" r="9" fill="#F8EAC2" opacity=".8"/>
     <Path d="M119 12 v6 M119 42 v7 M100 30 h9 M130 30 h9" stroke="#F9E0A5" strokeWidth="2.5"/>
   </G>:null}
  </Svg>
 </View>;
}
const styles=StyleSheet.create({
 root:{width:'40%',height:'45%',position:'absolute',left:'30%',top:'34%'},
});
