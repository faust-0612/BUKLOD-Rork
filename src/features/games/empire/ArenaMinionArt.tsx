import React from 'react';
import {G, Circle, Ellipse, Path, Rect, Line} from 'react-native-svg';

/** Lightweight animated battle silhouettes for Genesis minions.
 * High-resolution production concept PNG/WebP lives in the handoff asset pack.
 * SVG keeps first-frame, offline and weak-network rendering deterministic.
 */
type Team='A'|'B';
type Minion={id:string;team:Team;kind:string;x:number;y:number;hp:number;maxHp:number;
  alive?:boolean;shield?:number;attackAt?:number;healAt?:number;deathAt?:number};
type Props={minions:Minion[];elapsed:number;localTeam:Team};

export function ArenaMinionArt({minions,elapsed,localTeam}:Props){
  return <G>
    {minions.map((m,i)=>{
      if(m.alive===false && (m.deathAt==null||elapsed-m.deathAt>800))return null;
      const solar=m.team==='A',ally=m.team===localTeam;
      const accent=solar?'#72ff95':'#76d5ff';
      const metal=solar?'#f3d78b':'#a893d9';
      const armor=solar?'#38865b':'#5b3c93';
      const dark=solar?'#112d28':'#261940';
      const phase=Math.sin(elapsed/180+i*.77);
      const firing=typeof m.attackAt==='number'&&elapsed-m.attackAt<400;
      const healing=typeof m.healAt==='number'&&elapsed-m.healAt<440;
      const dead=m.alive===false||m.hp<=0;
      const y=m.y+(dead?1:.16*phase);
      const facing=solar?1:-1;
      const scale=m.kind==='siege_breaker'?1.28:m.kind==='mender'?.92:1;
      return <G key={m.id} transform={`translate(${m.x} ${y}) scale(${facing*scale} ${scale})`}
        opacity={dead?Math.max(.1,1-(elapsed-(m.deathAt??elapsed))/800):1}>
        <Ellipse cx="0" cy="2.6" rx="2.5" ry=".65" fill="#031421" opacity=".58"/>
        {firing?<Circle cx="0" cy="-.8" r="4.6" fill={accent} opacity=".25"/>:null}
        {healing?<Circle cx="0" cy="-.4" r="4.8" fill="none" stroke="#d4ffbc" strokeWidth=".55"/>:null}
        <Path d="M -1.8 -2 L -1.6 1.5 L -.7 2.3 L 1.5 2.3 L 1.9 -2 Z"
          fill={armor} stroke={metal} strokeWidth=".34"/>
        <Rect x="-1.35" y="1.3" width=".85" height="1.65" rx=".2" fill={metal}/>
        <Rect x=".45" y="1.3" width=".85" height="1.65" rx=".2" fill={metal}/>
        {m.kind==='vanguard'?<G>
          <Path d="M -1.65 -2.2 L -1.4 -3.85 L -.4 -4.7 L 1.2 -3.8 L 1.3 -2.25 Z"
            fill={metal} stroke={dark} strokeWidth=".42"/>
          <Path d="M -1.5 -3 L -.25 -3.6 L 1.15 -3" stroke={accent} strokeWidth=".55" fill="none"/>
          <Line x1="-2" y1="-2" x2="-3.4" y2="1.7" stroke={metal} strokeWidth=".55"/>
          <Path d="M -3.4 1.7 L -3.8 -.5 L -4.8 -.3 L -3.5 -2.6 L -2.4 -.6 Z" fill={accent}/>
          <Path d="M 1.05 -2.5 L 3.7 -1.8 L 3.4 1.7 L 1.6 2.6 L .75 .5 Z"
            fill={metal} stroke={dark} strokeWidth=".42"/>
          <Path d="M 2.2 -.8 L 2.6 -.1 L 2.2 .8 L 1.7 -.1 Z" fill={accent}/>
        </G>:m.kind==='ranger'?<G>
          <Path d="M -2.1 -2.9 L -1.3 -4.65 L -.15 -5.2 L 1.7 -3.2 L 1.3 -2.1 L -1.5 -2 Z"
            fill={armor} stroke={metal} strokeWidth=".55"/>
          <Path d="M -.95 -3.1 L .8 -3.1" stroke={accent} strokeWidth=".65"/>
          <Line x1="-2.5" y1="-.4" x2="3.5" y2="-.4" stroke={metal} strokeWidth=".8"/>
          <Path d="M -2.15 -2 L 1.4 -.6 L -2.15 .9" fill="none" stroke={accent} strokeWidth=".58"/>
          <Path d="M 1.5 -.7 L 4.1 -.4 L 1.5 -.1" fill={accent}/>
        </G>:m.kind==='mender'?<G>
          <Path d="M -2.2 -2.7 L -1 -5 L .9 -5.1 L 2 -2.7 L 1.15 -1.9 L -1.3 -1.9 Z"
            fill={metal} stroke={armor} strokeWidth=".58"/>
          <Circle cy="-3.05" cx=".1" r=".8" fill="#ffefd5"/>
          <Circle cy="-3.15" cx=".25" r=".27" fill={accent}/>
          <Line x1="-2.7" y1="-3.9" x2="-2.7" y2="2.5" stroke={metal} strokeWidth=".65"/>
          <Path d="M -2.7 -6.2 L -1.7 -5 L -2.7 -3.9 L -3.7 -5 Z" fill={accent} stroke={metal} strokeWidth=".35"/>
          <Circle cx="-2.7" cy="-5.1" r="1.6" fill={accent} opacity={.16+.09*Math.abs(phase)}/>
        </G>:<G>
          <Path d="M -2.2 -2.4 L -2 -4.8 L -.5 -5.4 L 1.8 -4.5 L 2.4 -2.2 Z"
            fill={metal} stroke={dark} strokeWidth=".5"/>
          <Circle cx=".1" cy="-3.2" r=".85" fill={dark} stroke={accent} strokeWidth=".4"/>
          <Line x1="-1.5" y1="-.1" x2="4.2" y2="1.4" stroke={metal} strokeWidth=".75"/>
          <Path d="M 2.9 -.1 L 5 -.8 L 5.8 1.2 L 3.9 2.6 L 2.7 1.2 Z"
            fill={accent} stroke={metal} strokeWidth=".6"/>
        </G>}
        <Rect x="-2.2" y="-7.2" width="4.4" height=".53" rx=".2" fill="#31172c"/>
        <Rect x="-2.2" y="-7.2" width={4.4*Math.max(0,Math.min(1,m.hp/Math.max(1,m.maxHp)))} height=".53" rx=".2"
          fill={ally?'#8cff9b':'#ff987e'}/>
        {m.shield&&m.shield>0?<Circle cy="-1" r="3.4" fill="none" stroke={accent} opacity=".7" strokeWidth=".24"/>:null}
      </G>;
    })}
  </G>;
}
