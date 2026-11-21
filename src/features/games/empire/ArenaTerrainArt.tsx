/** Original Genesis map collision-readable 2.5D terrain. These decorate
 * authoritative cover obstacles; object boundaries never change physics. */
import React,{memo} from 'react';
import {G,Path,Circle,Ellipse,Line,Polygon} from 'react-native-svg';
type Scene='genesis_rift'|'aurora_foundry'|'verdant_fracture';
type Props={cover:[number,number,number][];sceneId:Scene;elapsed:number;
  worldWidth:number;worldHeight:number};
const palettes={
 genesis_rift:{rock:'#685783',edge:'#b7abf9',light:'#f7dfff',aura:'#b19afe'},
 aurora_foundry:{rock:'#387a91',edge:'#94cddf',light:'#d6ffff',aura:'#90e9f9'},
 verdant_fracture:{rock:'#346653',edge:'#8ada99',light:'#e4ffc5',aura:'#77edb5'},
};
function Obstacle({x,y,r,index,sceneId,elapsed}:{
  x:number;y:number;r:number;index:number;sceneId:Scene;elapsed:number
}){
  const p=palettes[sceneId],t=.55+.4*Math.sin(elapsed/1100+index*2);
  const forest=sceneId==='verdant_fracture',ice=sceneId==='aurora_foundry';
  const height=r*(forest?1.4:ice?1.5:1.3);
  return <G>
    <Ellipse cx={x} cy={y+r*.4} rx={r*1.25} ry={r*.75}
      fill="#071c2b" opacity=".45"/>
    {forest?<G>
      <Path d={'M '+(x-r*.17)+' '+(y+r*.6)+' V '+(y-height*.7)+
        ' Q '+(x-r*.6)+' '+(y-height*.8)+' '+(x-r*.8)+' '+(y-height*1.1)}
        fill="none" stroke="#846f52" strokeWidth={Math.max(.7,r*.38)} strokeLinecap="round"/>
      <Path d={'M '+(x+r*.18)+' '+(y+r*.6)+' V '+(y-height*.6)+
        ' L '+(x+r*.8)+' '+(y-height*.85)}
        fill="none" stroke="#6f594a" strokeWidth={Math.max(.7,r*.3)} strokeLinecap="round"/>
      <Ellipse cx={x} cy={y-height*.9} rx={r*.9} ry={r*.62}
        fill="#247c60" stroke={p.edge} strokeWidth=".3"/>
      <Ellipse cx={x-r*.36} cy={y-height*.9-r*.25} rx={r*.56} ry={r*.37}
        fill="#409d75" opacity=".9"/>
      <Circle cx={x+r*.3} cy={y-height*.94} r={r*.2}
        fill={p.light} opacity={t*.54}/>
      <Path d={'M '+(x-r*.8)+' '+(y+r*.6)+' q '+(-r*.6)+' '+(-r*.4)+' '+(-r*.5)+' '+(-r*.9)+
        ' M '+(x+r*.45)+' '+(y+r*.4)+' q '+r*.7+' '+(-r*.5)+' '+r*.8+' '+(-r*.9)}
        fill="none" stroke="#93d59d" strokeWidth=".27" opacity=".65"/>
    </G>:ice?<G>
      <Polygon points={[
        [x-r*.95,y+r*.5],[x-r*.72,y-height*.66],[x+r*.11,y-height*1.22],
        [x+r*.83,y-height*.35],[x+r*.91,y+r*.65]].map(p=>p.join(',')).join(' ')}
        fill="#397d91" stroke={p.edge} strokeWidth=".38"/>
      <Polygon points={[
        [x+r*.11,y-height*1.22],[x+r*.83,y-height*.35],[x+r*.15,y+r*.49],
        [x-r*.2,y-height*.4]].map(p=>p.join(',')).join(' ')}
        fill="#82bdd3" opacity=".93"/>
      <Path d={'M '+(x-r*.63)+' '+(y+r*.4)+' L '+(x+r*.11)+' '+(y-height*1.22)}
        fill="none" stroke={p.light} strokeWidth=".42" opacity={t}/>
      <Circle cx={x+r*.1} cy={y-height*.4} r={r*.13} fill={p.light} opacity={t}/>
    </G>:<G>
      <Polygon points={[
        [x-r*.92,y+r*.62],[x-r*.55,y-height*.25],[x-r*.17,y-height*1.3],
        [x+r*.49,y-height*.75],[x+r*.9,y+r*.6]].map(p=>p.join(',')).join(' ')}
        fill={p.rock} stroke={p.edge} strokeWidth=".55"/>
      <Polygon points={[
        [x-r*.17,y-height*1.3],[x+r*.49,y-height*.75],
        [x+r*.16,y+r*.43]].map(p=>p.join(',')).join(' ')}
        fill="#bba2e6" opacity=".72"/>
      <Path d={'M '+(x-r*.17)+' '+(y-height*1.3)+
        ' L '+(x-r*.2)+' '+(y+r*.18)+' l '+r*.4+' '+r*.21}
        stroke={p.light} strokeWidth=".41" fill="none"/>
      <Circle cx={x-r*.16} cy={y-height*.6} r={r*.22}
        fill={p.aura} opacity={t*.6}/>
    </G>}
  </G>;
}
export const ArenaTerrainArt=memo(function ArenaTerrainArt({cover,sceneId,elapsed,worldWidth,worldHeight}:Props){
  const palette=palettes[sceneId];
  const m=Math.min(worldWidth,worldHeight);
  // Deterministic visual details for each map; no RNG, backend or per-frame
  // asset allocation. Cover outlines remain readable for movement planning.
  return <G pointerEvents="none">
    {Array.from({length:26},(_,i)=>{
      const x=((i*101+17)%89+5)/100*worldWidth;
      const y=((i*67+23)%83+8)/100*worldHeight;
      const r=Math.min(1.3,m*.008);
      return <G key={'ground-fragment-'+i}>
        <Path d={'M '+(x-r)+' '+y+' q '+r+' '+(-r*.65)+' '+r*2+' '+(-r*.08)}
          stroke={palette.edge} strokeWidth=".22" opacity=".17" fill="none"/>
        <Circle cx={x+r*.4} cy={y-r*.6} r=".16" fill={palette.light}
          opacity={.18+.1*Math.sin(elapsed/1450+i)}/>
      </G>;
    })}
    {cover.map(([x,y,r],i)=><Obstacle key={'terrain-'+i} x={x} y={y} r={r}
      index={i} sceneId={sceneId} elapsed={elapsed}/>)}
  </G>;
});
