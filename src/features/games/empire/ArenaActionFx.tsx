/** Original BUKLOD hit choreography. Drawn in the SAME SVG world-space as
 * the game, never a UI overlay unrelated to authoritative actions.
 */
import React,{memo} from 'react';
import {G,Path,Line,Circle,Ellipse,Rect,Text as SvgText,Polygon} from 'react-native-svg';
type Fx={
  seq:number;kind:string;type:string;x:number;y:number;
  fromX:number;fromY:number;targetX:number;targetY:number;
  style:string;progress:number;alpha:number;amount:number;
};
const palettes:Record<string,[string,string]>={
 heal:['#86ffd2','#f5ffe9'],
 guard:['#edd99d','#ffffe4'],
 supply:['#95f5ba','#e4ffe8'],
 blink:['#8bdeff','#dbf4ff'],
 burst:['#ff9b63','#fff6bc'],
 disrupt:['#d5a0ff','#f4e3ff'],
 forest:['#9effa6','#e9ffca'],
 golden:['#ffc66c','#fff6cb'],
 stone:['#9cd8fe','#effaff'],
 lumen:['#86f5e5','#e7ffff'],
 wisp:['#cca0ff','#f4e1ff'],
 forager:['#c8f391','#fbffd5'],
};
const color=(style:string)=>palettes[style]??['#f5d99a','#fff5d5'];
const dist=(a:number,b:number,c:number,d:number)=>Math.hypot(a-c,b-d);
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const part=Array.from({length:7},(_,i)=>({dx:Math.cos(i*Math.PI*2/7),dy:Math.sin(i*Math.PI*2/7)}));
function Streak({fx}:{fx:Fx}){
  const t=fx.progress,[outer,bright]=color(fx.style);
  const r=2+t*6, fade=fx.alpha;
  const slashA='M '+(fx.x-r)+' '+(fx.y+r*.7)+' Q '+(fx.x+r*.2)+' '+(fx.y-r*1.1)+' '+(fx.x+r)+' '+(fx.y-r*.65);
  const slashB='M '+(fx.x-r*.7)+' '+(fx.y-r*.4)+' Q '+(fx.x+r*.1)+' '+(fx.y+r*.6)+' '+(fx.x+r*.85)+' '+(fx.y+r*.7);
  return <G>
    <Path d={slashA} stroke={bright} strokeWidth={1.6*(1-t)+.25} opacity={fade}
      strokeLinecap="round" fill="none"/>
    <Path d={slashB} stroke={outer} strokeWidth={.95*(1-t)+.2} opacity={fade*.9}
      strokeLinecap="round" fill="none"/>
    {part.slice(0,6).map((p,i)=>{
      const px=fx.x+p.dx*(.9+5.5*t),py=fx.y+p.dy*(.9+4.5*t);
      return <Path key={i} d={'M '+px+' '+py+' l '+(p.dx*1.7)+' '+(p.dy*1.7)}
        stroke={i%2?bright:outer} strokeWidth={.32+.35*fade}
        opacity={fade*.85} strokeLinecap="round"/>;
    })}
    {fx.amount>0?<SvgText x={fx.x+2.3+t*1.2} y={fx.y-3.3-3*t}
      fontWeight="900" fontSize={2.3+fade*.45} fill={bright}
      stroke="#0c1a2c" strokeWidth=".28" opacity={fade}>{Math.round(fx.amount)}</SvgText>:null}
  </G>;
}
function Shatter({fx,castle=false}:{fx:Fx;castle?:boolean}){
  const [outer,bright]=castle?['#bca292','#ffe0ad']:color(fx.style);
  const t=fx.progress,r=castle?9:6;
  return <G>
    <Circle cx={fx.x} cy={fx.y} r={1+r*t} fill={outer} fillOpacity={.17*fx.alpha}
      stroke={bright} strokeWidth={.7*fx.alpha+.2} strokeOpacity={fx.alpha*.8}/>
    {part.map((p,i)=>{
      const k=castle?1.5:.8, travel=(.7+t*r)*k;
      const x=fx.x+p.dx*travel,y=fx.y+p.dy*travel-t*t*(castle?2.5:1.7);
      const size=(castle?2.15:1.4)*(1-t*.6);
      return <Polygon key={i}
        points={(x-size*.6)+','+(y+size*.5)+' '+x+','+(y-size)+' '+(x+size*.8)+','+(y+size*.1)}
        fill={i%3===0?bright:outer} stroke={bright} strokeWidth=".23"
        opacity={fx.alpha*(.82+(i%2)*.17)}/>;
    })}
    {castle?<Ellipse cx={fx.x} cy={fx.y+1.5} rx={4+r*t} ry={1.4+t*2}
      fill="#988a78" opacity={fx.alpha*.22}/>:null}
  </G>;
}
function Skill({fx}:{fx:Fx}){
  const t=fx.progress,[outer,bright]=color(fx.style);
  const r=2+9*t;
  const shield=fx.style==='guard'||fx.style==='heal'||fx.style==='supply';
  const path=shield?('M '+fx.x+' '+(fx.y-r*.8)+' l '+(r*.8)+' '+(r*.4)+' l '+(-r*.2)+' '+r+' l '+(-r*.6)+' '+(r*.5)+' l '+(-r*.6)+' '+(-r*.5)+' l '+(-r*.2)+' '+(-r)+' Z'):
    ('M '+(fx.x-r)+' '+fx.y+' Q '+fx.x+' '+(fx.y-r*.7)+' '+(fx.x+r)+' '+fx.y+' Q '+fx.x+' '+(fx.y+r*.8)+' '+(fx.x-r)+' '+fx.y);
  return <G>
    <Path d={path} fill={outer} fillOpacity={shield?fx.alpha*.12:0}
      stroke={bright} strokeWidth={(1-t)*1.5+.25} strokeOpacity={fx.alpha}/>
    <Circle cx={fx.x} cy={fx.y} r={r*.62} fill="none" stroke={outer}
      strokeWidth=".5" strokeDasharray="2 2" opacity={fx.alpha}/>
    {part.map((p,i)=><Path key={i} d={'M '+(fx.x+p.dx*(r*.65))+' '+(fx.y+p.dy*(r*.65))+
      ' l '+(p.dx*2)+' '+(p.dy*2)}
      stroke={i%2?outer:bright} strokeWidth=".5" opacity={fx.alpha}/>)}
    {dist(fx.fromX,fx.fromY,fx.targetX,fx.targetY)>2 &&
      dist(fx.fromX,fx.fromY,fx.targetX,fx.targetY)<18?
      <G>
        <Path d={'M '+fx.fromX+' '+fx.fromY+' Q '+lerp(fx.fromX,fx.targetX,.5)+' '+
          (lerp(fx.fromY,fx.targetY,.5)-3)+' '+fx.targetX+' '+fx.targetY}
          fill="none" stroke={outer} strokeWidth={1.5*fx.alpha}
          strokeLinecap="round" strokeDasharray="3 1.2"/>
        <Circle cx={lerp(fx.fromX,fx.targetX,t)} cy={lerp(fx.fromY,fx.targetY,t)}
          r={1.4+fx.alpha} fill={bright} fillOpacity={fx.alpha}/>
      </G>:null}
  </G>;
}
function Mining({fx}:{fx:Fx}){
  const [outer,bright]=color(fx.style);
  const t=fx.progress;
  return <G>
    <Path d={'M '+(fx.x-3)+' '+(fx.y-3)+' l '+(4*(1-t))+' '+(4*(1-t))}
      stroke="#ffe9bb" strokeWidth={.8*fx.alpha} strokeLinecap="round"/>
    {part.slice(0,5).map((p,i)=><Polygon key={i}
      points={(fx.x+p.dx*(1+5*t))+','+(fx.y+p.dy*(1+5*t))+' '+
       (fx.x+p.dx*(2+5*t)+.8)+','+(fx.y+p.dy*(1+5*t)-1)+' '+
       (fx.x+p.dx*(1+5*t)+1)+','+(fx.y+p.dy*(1+5*t)+.8)}
      fill={i%2?outer:bright} opacity={fx.alpha*.86}/>)}
  </G>;
}
function Loot({fx}:{fx:Fx}){
  const [outer,bright]=color(fx.style),t=fx.progress;
  return <G>
    <Circle cx={fx.x} cy={fx.y} r={2+8*t} fill="none"
      stroke={outer} strokeWidth={.9*fx.alpha} opacity={fx.alpha}/>
    {part.map((p,i)=>{
      const reach=1+(5*t);const x=fx.x+p.dx*reach,y=fx.y+p.dy*reach;
      return <G key={i}><Line x1={x-.8} y1={y} x2={x+.8} y2={y}
          stroke={bright} strokeWidth=".55" opacity={fx.alpha}/>
        <Line x1={x} y1={y-.8} x2={x} y2={y+.8}
          stroke={outer} strokeWidth=".55" opacity={fx.alpha}/></G>;
    })}
  </G>;
}
function Construction({fx}:{fx:Fx}){
  const t=fx.progress,[outer,bright]=color(fx.style);
  return <G>
    <Ellipse cx={fx.x} cy={fx.y+1.2} rx={2.2+7*t} ry={.8+2.8*t}
      fill="#cfbd99" opacity={fx.alpha*.22}/>
    {part.slice(0,6).map((p,i)=><Circle key={i}
      cx={fx.x+p.dx*(2+4*t)} cy={fx.y+p.dy*(2+3*t)-2*t}
      r={.35+fx.alpha*.6} fill={i%2?outer:bright} opacity={fx.alpha*.72}/>)}
    <Path d={'M '+(fx.x-1.5)+' '+(fx.y-4-3*t)+' v '+(4.5+t*3)+
      ' M '+(fx.x-3.2)+' '+(fx.y-3.7-3*t)+' h 3.6'}
      stroke={bright} strokeWidth={.4+fx.alpha*.7} opacity={fx.alpha}/>
  </G>;
}
function Level({fx}:{fx:Fx}){
  return <G>
    {part.map((p,i)=><Path key={i} d={'M '+(fx.x+p.dx*2)+' '+(fx.y+p.dy*2)+
      ' L '+(fx.x+p.dx*(2+8*fx.progress))+' '+(fx.y+p.dy*(2+8*fx.progress))}
      stroke={i%2?'#a0f9ff':'#ffefac'} strokeWidth={.65*fx.alpha}
      opacity={fx.alpha}/>)}
    <Circle cx={fx.x} cy={fx.y} r={2+fx.progress*10} fill="none"
      stroke="#ffeeaf" strokeWidth=".85" opacity={fx.alpha}/>
  </G>;
}
/** Render 8-16 brief effects; no timers, gesture handling or network. */
export const ArenaActionFx=memo(function ArenaActionFx({effects}:{effects:Fx[]}){
  return <G pointerEvents="none">
    {effects.map(fx=>{
      let render:React.ReactNode;
      switch(fx.kind){
        case 'hit':render=<Streak fx={fx}/>;break;
        case 'death':case 'boss_down':
          render=<Shatter fx={fx}/>;break;
        case 'tower_break':case 'building_break':case 'seal_break':
          render=<Shatter fx={fx} castle/>;break;
        case 'ability':case 'dash':case 'buff':case 'hazard':case 'trap':
          render=<Skill fx={fx}/>;break;
        case 'mining':render=<Mining fx={fx}/>;break;
        case 'loot':case 'item':render=<Loot fx={fx}/>;break;
        case 'build':case 'built':case 'repair':case 'upgrade':
          render=<Construction fx={fx}/>;break;
        case 'level_up':case 'seal_restore':case 'round':
          render=<Level fx={fx}/>;break;
        default:return null;
      }
      return <G key={'arena-action-fx-'+fx.seq}>{render}</G>;
    })}
  </G>;
});
