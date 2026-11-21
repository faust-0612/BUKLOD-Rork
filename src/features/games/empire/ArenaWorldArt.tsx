/** Layered 2.5D Arena graphics. State is authoritative; all drawing is visual only. */
import React from 'react';
import {G,Circle,Ellipse,Rect,Path,Line,Text as SvgText} from 'react-native-svg';
type Obj={id:string;x:number;y:number;hp?:number;maxHp?:number;alive?:boolean;team?:'A'|'B'|null;
kind?:string;level?:number;status?:string;stage?:string;progress?:number;upgrading?:{progress:number}|null;
stock?:number;capacity?:number;type?:string;expires?:number;item?:{tier?:number};effect?:string;rarity?:string;itemId?:string;ownerHero?:string|null};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
const shape=(x:number,y:number,parts:number[][])=>'M '+parts.map(p=>(x+p[0])+' '+(y+p[1])).join(' L ')+' Z';
const teamColor=(team?:string|null)=>team==='A'?'#81dfdc':'#faafbf';
function Health({item,y}:{item:Obj;y:number}){
  if(item.hp==null||item.maxHp==null||item.hp>=item.maxHp)return null;
  const value=clamp(item.hp/Math.max(1,item.maxHp),0,1);
  return <G><Rect x={item.x-3.4} y={y} width={6.8} height=".65" fill="#09212c"/>
    <Rect x={item.x-3.4} y={y} width={6.8*value} height=".65"
      fill={value<.28?'#fc877c':'#a2ffc4'}/></G>;
}
export function ArenaStructureArt({towers,buildings,elapsed}:{
  towers:Obj[];buildings:Obj[];elapsed:number
}){
  return <G>
    {towers.map(t=>{
      const active=t.alive!==false&&(t.hp??0)>0;
      const hue=teamColor(t.team),level=clamp(t.level??1,1,5);
      return <G key={'tower-'+t.id}>
        <Ellipse cx={t.x} cy={t.y+2.3} rx="4.5" ry="1.3" fill="#051426" opacity=".6"/>
        {!active?<Path d={shape(t.x,t.y,[[-3,1],[-1.4,-1.4],[.2,1.1],[1.8,-.5],[3,2.2]])}
          fill="#776d6b" stroke="#c8a49a" strokeWidth=".45"/>:<G>
          <Path d={shape(t.x,t.y,[[-3.2,2.6],[-3.1,-1],[0,-3.6],[3.1,-1],[3.2,2.6]])}
            fill={t.team==='A'?'#426e8a':'#85465e'} stroke={hue} strokeWidth=".58"/>
          <Rect x={t.x-2.7} y={t.y-4} width="5.4" height="1.9" rx=".35"
            fill={t.team==='A'?'#9ebdc9':'#dbb2b6'} stroke="#fae4b4" strokeWidth=".42"/>
          {[0,1,2].map(i=><Rect key={i} x={t.x-2.3+i*1.8} y={t.y-5.2}
            width="1.1" height="1.65" fill={t.team==='A'?'#4b829c':'#9c6274'}/>)}
          <Path d={shape(t.x,t.y,[[-1.1,2.6],[-1.1,.4],[0,-.6],[1.1,.4],[1.1,2.6]])}
            fill="#0b2235" stroke="#d9ba85" strokeWidth=".3"/>
          <Path d={'M '+t.x+' '+(t.y-5.3)+' v -'+(1+level*.45)}
            stroke="#ffeed2" strokeWidth=".45"/>
          <Circle cx={t.x} cy={t.y-6.2-level*.45} r={.65+level*.12}
            fill={hue} opacity={.7+.22*Math.sin(elapsed/330)}/>
          {level>=3?<Circle cx={t.x} cy={t.y-2.5} r="1.1" fill="none"
            stroke="#ffe096" strokeWidth=".5"/>:null}
          {t.upgrading?<G><Circle cx={t.x} cy={t.y-.7} r="5.8" fill="none"
            stroke="#ffe9ad" strokeWidth=".72" strokeDasharray="1 1.5"/>
            <Circle cx={t.x} cy={t.y-.7} r={1+3*clamp(t.upgrading.progress,0,1)}
              fill="none" stroke="#72eace" strokeWidth=".9"/></G>:null}
          <Health item={t} y={t.y+3.4}/>
        </G>}
      </G>;
    })}
    {buildings.map(b=>{
      const active=b.alive!==false&&(b.hp??0)>0,working=b.status==='building';
      const progress=clamp(b.progress??1,0,1),hue=teamColor(b.team);
      const accent=b.team==='A'?'#6a9f9b':'#bc7482';
      return <G key={'building-'+b.id}>
        <Ellipse cx={b.x} cy={b.y+2.5} rx="4.2" ry="1.35" fill="#061529" opacity=".56"/>
        {!active?<Path d={shape(b.x,b.y,[[-3,1],[0,-1],[2,-.4],[3,2],[-2,2.3]])}
          fill="#706f6b" stroke="#c7a69a" strokeWidth=".38"/>:<G>
          <Rect x={b.x-2.8} y={b.y-.7} width="5.6" height="3.2"
            fill={working?'#627270':accent} stroke="#e3d1a4" strokeWidth=".48"/>
          {working&&progress<.34?<G>
            <Line x1={b.x-3.2} y1={b.y-.6} x2={b.x+3.2} y2={b.y-.6}
              stroke="#f1d092" strokeWidth=".65"/>
            <Line x1={b.x-3.2} y1={b.y-.6} x2={b.x-3.2} y2={b.y-4.4}
              stroke="#f1d092" strokeWidth=".65"/>
          </G>:<G>
            <Path d={shape(b.x,b.y,[[-3.6,-.7],[0,-4.9],[3.6,-.7]])}
              fill={b.kind==='workshop'?'#83b5c6':b.team==='A'?'#afe0c9':'#eac0a9'}
              stroke="#ffebbd" strokeWidth=".5"/>
            {b.kind==='barracks'?<G><Line x1={b.x} y1={b.y-5.1}
              x2={b.x} y2={b.y-7.4} stroke="#f9f0c9" strokeWidth=".5"/>
              <Path d={shape(b.x,b.y,[[0,-7.2],[2.2,-6.6],[0,-5.7]])}
                fill="#ea8a7b"/></G>:b.kind==='workshop'?<G>
              <Line x1={b.x+1.3} y1={b.y-4.9} x2={b.x+1.3} y2={b.y-7.6}
                stroke="#d4f7e9" strokeWidth=".8"/>
              <Line x1={b.x+.5} y1={b.y-7.6} x2={b.x+2.4} y2={b.y-7.6}
                stroke="#e6e0a5" strokeWidth=".65"/>
            </G>:b.kind==='watchtower'?<Circle cx={b.x} cy={b.y-4.8}
              r="1.1" fill="#f3df9e"/>:<G>
              <Rect x={b.x-1.5} y={b.y+.2} width="3" height="2.2"
                fill="#5e4c44" stroke="#d5b98d" strokeWidth=".35"/>
              <Line x1={b.x-1.5} y1={b.y+1} x2={b.x+1.5} y2={b.y+1}
                stroke="#d6bc8f" strokeWidth=".4"/>
            </G>}
          </G>}
          {working?<G><Circle cx={b.x} cy={b.y-.4} r="5.1" fill="none"
            stroke="#efcf84" strokeWidth=".65" strokeDasharray="1 1.4"/>
            <Rect x={b.x-3.3} y={b.y+3.3} width="6.6" height=".6" fill="#243c43"/>
            <Rect x={b.x-3.3} y={b.y+3.3} width={6.6*progress} height=".6" fill="#a4eec1"/>
          </G>:<Health item={b} y={b.y+3.4}/>}
          <Circle cx={b.x+2.7} cy={b.y-4} r=".55" fill={hue} opacity=".85"/>
        </G>}
      </G>;
    })}
  </G>;
}
const creatureColors:Record<string,string>={
 forest:'#a7f6b0',golden:'#f6d774',stone:'#bde7ff',
 lumen:'#96f8f3',forager:'#d3f4a1',wisp:'#eda9ff',
 stalker:'#f994a6',shellkeeper:'#b6d2ff'
};
export function ArenaWildlifeArt({creatures,elapsed}:{creatures:Obj[];elapsed:number}){
  return <G>{creatures.filter(c=>c.alive!==false&&(c.hp??0)>0).map((c,i)=>{
    const color=creatureColors[c.kind??'']??'#d6bbf2';
    const boss=c.kind==='stalker'||c.kind==='shellkeeper',r=boss?4.3:2.6;
    const phase=.5+.5*Math.sin(elapsed/630+i);
    return <G key={'wildlife-'+c.id}>
      <Circle cx={c.x} cy={c.y} r={r+1.2+phase*.8}
        fill={color} opacity={.14+.14*phase}/>
      <Circle cx={c.x} cy={c.y} r={r} fill="#3e3155" stroke={color}
        strokeWidth={boss?.85:.62}/>
      {boss?<G>
        <Path d={shape(c.x,c.y,[[-3,.8],[-1.7,-3],[0,-1.5],[1.7,-3],[3,.8],[0,2.5]])}
          fill="#845b91" stroke={color} strokeWidth=".4"/>
        <Circle cx={c.x-.8} cy={c.y} r=".36" fill="#fff4cd"/>
        <Circle cx={c.x+.8} cy={c.y} r=".36" fill="#fff4cd"/>
      </G>:c.kind==='forest'||c.kind==='forager'?<Path
        d={shape(c.x,c.y,[[0,-2],[-1.5,-.2],[0,1.7],[1.5,-.2]])}
        fill={color} stroke="#fffcd8" strokeWidth=".3"/>:
        c.kind==='stone'?<Path
        d={shape(c.x,c.y,[[0,-2],[1.8,-.1],[0,1.8],[-1.8,-.1]])}
        fill={color} stroke="#fff" strokeWidth=".4"/>:
        <G><Circle cx={c.x} cy={c.y} r="1.3" fill={color}/>
          <Circle cx={c.x-.45} cy={c.y-.45} r=".38" fill="#fff"/></G>}
      {boss?<Health item={c} y={c.y+5.3}/>:null}
    </G>;
  })}</G>;
}
const pickupGlyphs:Record<string,string>={health:'HP',mana:'MP',shield:'SH',xp:'XP',wood:'WD',gold:'AU',stone:'ST',haste:'SP',fury:'AT',guard:'DF',regen:'RG',cooldown:'CD'};
const pickupHues:Record<string,string>={health:'#7df2ab',mana:'#91caff',shield:'#b8f9f1',xp:'#ffe2a2',wood:'#abefab',gold:'#ffd87f',stone:'#c9d5ee',haste:'#9ee8ff',fury:'#ff9a8b',guard:'#d2baff',regen:'#9cffce',cooldown:'#dec9ff'};
export function ArenaResourceLootArt({nodes,loot,elapsed}:{nodes:Obj[];loot:Obj[];elapsed:number}){
  return <G>
    {nodes.filter(n=>(n.stock??0)>0).map((n,i)=>{
      const wood=n.type==='wood',gold=n.type==='gold';
      const hue=wood?'#a9efb5':gold?'#f4db8e':'#b9dffa';
      return <G key={'node-'+n.id}>
        <Ellipse cx={n.x} cy={n.y+1.4} rx="3.5" ry="1.25" fill="#071a2a" opacity=".55"/>
        <Circle cx={n.x} cy={n.y-.2} r="4.5" fill={hue}
          opacity={.12+.16*Math.abs(Math.sin(elapsed/940+i))}/>
        {wood?<G><Rect x={n.x-.5} y={n.y} width="1" height="3" fill="#795a42"/>
          <Path d={shape(n.x,n.y,[[0,-3.7],[-2.1,-.6],[-1,-.6],[-2.6,.5],[2.6,.5],[1,-.6],[2.1,-.6]])}
            fill="#2a9069" stroke={hue} strokeWidth=".5"/></G>:
          gold?<G><Path d={shape(n.x,n.y,[[-2,1.3],[-1.1,-2.5],[.6,-3.2],[2,1],[.5,2]])}
            fill="#aa8044" stroke={hue} strokeWidth=".5"/>
            <Path d={shape(n.x,n.y,[[0,-2.8],[.7,-.2],[-.6,1.6]])}
              fill="#f9e7aa"/></G>:
          <G><Path d={shape(n.x,n.y,[[0,-3.1],[2.1,-.5],[1.1,2.1],[-1.6,1.7],[-2,-.5]])}
            fill="#668fab" stroke={hue} strokeWidth=".5"/>
            <Path d={shape(n.x,n.y,[[0,-3.1],[.7,-.1],[-1.6,1.7],[-2,-.5]])}
              fill="#d1ecf7"/></G>}
      </G>;
    })}
    {loot.filter(l=>!l.expires||l.expires>elapsed).map((l,i)=>{
      const rate=1+.1*Math.sin(elapsed/330+i);
      const field=l.kind==='field_pickup';
      const hue=field?(pickupHues[l.effect??'']??'#ffe6a5'):l.kind==='equipment'?'#ffe6a5':l.kind==='consumable'?'#98eedb':'#acdafa';
      return <G key={'loot-'+l.id}
        transform={'translate('+l.x+','+l.y+') scale('+rate+')'}>
        <Circle r="3.8" fill="#091b2d" stroke={hue} strokeWidth=".65"/>
        {field?<G>
          <Circle r="2.8" fill={hue} opacity=".91"/>
          <Circle r={l.rarity==='radiant'?5.2:l.rarity==='charged'?4.8:4.3}
            fill="none" stroke={hue} strokeWidth=".45"
            strokeDasharray={l.rarity==='field'?'1.1 1.1':'none'} opacity=".85"/>
          <Path d="M-4 -3L-3.1 -4M3 4L4 3" stroke="#fff9d9" strokeWidth=".65"/>
          <SvgText x="0" y=".7" fontSize="1.6" fontWeight="bold"
            fill="#09212a" textAnchor="middle">{pickupGlyphs[l.effect??'']??'PK'}</SvgText>
        </G>:l.kind==='equipment'?<Path d="M0 -2.3L1.4 -.6L.5 2.1L-.5 2.1L-1.4 -.6Z"
          fill={hue} stroke="#fff3c8" strokeWidth=".4"/>:
          l.kind==='consumable'?<G><Rect x="-1.2" y="-1.5" width="2.4" height="3.2"
            rx=".4" fill="#4ebca8"/><Path d="M-1 0h2M0 -1v2"
            stroke="#fff" strokeWidth=".4"/></G>:
          <Path d="M-2 1.2L-1 -1L1 -1.8L2 1.2Z" fill={hue}/>}
        {(l.rarity==='radiant'||(l.item?.tier??1)>2)?<Circle r="4.4" fill="none" stroke="#f9d99a"
          strokeWidth=".6" strokeDasharray="1 2"/>:null}
      </G>;
    })}
  </G>;
}
