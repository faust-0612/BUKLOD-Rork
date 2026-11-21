/** BUKLOD Arena 2.5D capital citadels: visual armor stages and seal health.
 * Only the engine's team HP/breached flag drives the ruin state. */
import React,{memo} from 'react';
import {G,Path,Polygon,Rect,Circle,Ellipse,Line,Text as SvgText} from 'react-native-svg';
type Seal={hp:number;maxHp:number;breached:boolean};
type Props={width:number;height:number;elapsed:number;
  seals:{A:Seal;B:Seal};localTeam:'A'|'B'};
const cap=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const path=(x:number,y:number,p:number[][])=>'M '+p.map(v=>(x+v[0])+' '+(y+v[1])).join(' L ')+' Z';
function Citadel({x,y,team,seal,elapsed,localTeam}:{
  x:number;y:number;team:'A'|'B';seal:Seal;elapsed:number;localTeam:'A'|'B'
}){
  const enemy=team!==localTeam;
  const breached=seal.breached||seal.hp<=0;
  const hp=cap(seal.hp/Math.max(1,seal.maxHp));
  const tower=enemy?'#7f384b':'#387c82',light=enemy?'#ff9c83':'#9bfaf1';
  const pulse=.6+.3*Math.sin(elapsed/530+(team==='A'?0:2));
  return <G>
    <Ellipse cx={x} cy={y+7} rx="13" ry="4.5" fill="#061d29" opacity=".62"/>
    <Path d={path(x,y,[[-11,5],[-10,-2],[-7,-5],[0,-8],[7,-5],[10,-2],[11,5],[4,8],[-4,8]])}
      fill={breached?'#605c5b':tower} stroke="#ddc8a1" strokeWidth=".62"/>
    {!breached?<G>
      <Polygon points={[[x-8,y-3],[x-6,y-9],[x-4,y-3]].map(p=>p.join(',')).join(' ')}
        fill={light} stroke="#e9e7be" strokeWidth=".38"/>
      <Polygon points={[[x+4,y-3],[x+6,y-9],[x+8,y-3]].map(p=>p.join(',')).join(' ')}
        fill={light} stroke="#e9e7be" strokeWidth=".38"/>
      <Path d={path(x,y,[[-5,4],[-5,-4],[0,-8],[5,-4],[5,4]])}
        fill={enemy?'#a74f63':'#56a59a'} stroke="#f5dba9" strokeWidth=".6"/>
      <Path d={path(x,y,[[0,-12],[3,-7],[0,-3],[-3,-7]])}
        fill={enemy?'#ef6770':'#69e4ee'} stroke="#fff3c7" strokeWidth=".6"/>
      <Circle cx={x} cy={y-7.5} r={3.8+1.3*pulse}
        fill={light} fillOpacity={pulse*.12} stroke={light} strokeOpacity={pulse*.74}
        strokeWidth=".45"/>
      <Path d={'M '+(x-11)+' '+(y-2)+' v -6 M '+(x+11)+' '+(y-2)+' v -6'}
        stroke="#e9dbb3" strokeWidth=".7"/>
      <Path d={path(x,y,[[-11,-8],[-8,-7],[-11,-5]])} fill={enemy?'#d66b75':'#78c9b6'}/>
      <Path d={path(x,y,[[11,-8],[8,-7],[11,-5]])} fill={enemy?'#d66b75':'#78c9b6'}/>
      {hp<.5?<G>
        <Path d={'M '+(x-4)+' '+(y+2)+' l 2 -3 -2 -2 2 -3'}
          stroke="#f9b3a0" strokeWidth=".65" fill="none"/>
        <Path d={'M '+(x+2)+' '+(y+4)+' l -1 -3 3 -2'}
          stroke="#ffe1b6" strokeWidth=".45" fill="none"/>
      </G>:null}
    </G>:<G>
      <Path d={path(x,y,[[-8,5],[-5,0],[-1,3],[2,-3],[5,3],[9,5]])}
        fill="#80746c" stroke="#ba9a89" strokeWidth=".6"/>
      {[[-6,2],[7,3],[-3,-3],[2,4]].map(([dx,dy],i)=>
        <Polygon key={i}
          points={[[x+dx-1.8,y+dy+.5],[x+dx,y+dy-2],[x+dx+2,y+dy+1.4]].map(p=>p.join(',')).join(' ')}
          fill={i%2?'#b1a093':'#776c6d'} stroke="#e0b7a3" strokeWidth=".25"/>)}
      <Circle cx={x} cy={y-3} r={2.4+pulse*1.6}
        fill={light} fillOpacity=".19" stroke="#ffd49b" strokeWidth=".5"
        strokeDasharray="2 2"/>
    </G>}
    <Rect x={x-9} y={y+9.5} width="18" height="1.1" rx=".35" fill="#11283a"/>
    <Rect x={x-9} y={y+9.5} width={18*hp} height="1.1" rx=".35"
      fill={hp<.28?'#ff7c7a':enemy?'#ffc497':'#92f9d9'}/>
    <SvgText x={x} y={y+12.8} fontSize="2.4" fontWeight="900"
      textAnchor="middle" fill={light}>{breached?'BREACHED':team==='A'?'A CAPITAL':'B CAPITAL'}</SvgText>
  </G>;
}
export const ArenaBaseArt=memo(function ArenaBaseArt({width,height,seals,elapsed,localTeam}:Props){
  return <G pointerEvents="none">
    <Citadel x={14} y={height/2} team="A" seal={seals.A}
      elapsed={elapsed} localTeam={localTeam}/>
    <Citadel x={width-14} y={height/2} team="B" seal={seals.B}
      elapsed={elapsed} localTeam={localTeam}/>
  </G>;
});
