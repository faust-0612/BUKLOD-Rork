/** BUKLOD Arena feedback timeline — an event RECEIPT, not a reward system.
 * Numbers, source coordinates and badges come only from committed simulation /
 * ranked snapshot events. No local currency, items or ledger can be minted.
 */
export const ARENA_FEEDBACK_TTL_MS = 1500;
export const ARENA_RESOURCE_KINDS = Object.freeze(['wood','gold','stone']);
const num=n=>typeof n==='number'&&Number.isFinite(n)?n:0;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const cap=(n,low,high)=>Math.max(low,Math.min(high,n));
function point(event,actor){
 return {x:finite(event.x)?event.x:actor?.x??0,y:finite(event.y)?event.y:actor?.y??0};
}
function receipt(event,kind,amount,where,actor,now){
 return {id:event.seq+':'+kind+':'+where,seq:event.seq,kind,amount,
   where,source:point(event,actor),age:cap((now-event.time)/ARENA_FEEDBACK_TTL_MS,0,1),
   tier:cap(num(event.tier)||1,1,4),
   name:typeof event.name==='string'?event.name.slice(0,48):kind};
}
export function arenaFeedbackReceipts(state,seat,now=state?.elapsed,limit=14){
 if(!state||!state.players?.[seat]||!Array.isArray(state.events))return [];
 const actor=state.players[seat];
 const team=actor.team;
 const results=[];
 const recent=state.events.slice(-56);
 for(const e of recent){
  if(!e||!Number.isSafeInteger(e.seq)||!finite(e.time)||e.time>now||
      now-e.time>=ARENA_FEEDBACK_TTL_MS)continue;
  const local=e.actor===seat;
  if(e.type==='mine'&&local&&ARENA_RESOURCE_KINDS.includes(e.kind)&&num(e.amount)>0){
    results.push(receipt(e,e.kind,num(e.amount),'carry',actor,now));
  }else if(e.type==='deposit'&&local){
    for(const kind of ARENA_RESOURCE_KINDS){
      const amount=num(e.resources?.[kind]);
      if(amount>0)results.push(receipt(e,kind,amount,'bank',actor,now));
    }
  }else if(e.type==='loot'&&local){
    if(e.kind==='resources'){
      for(const kind of ARENA_RESOURCE_KINDS){
        const amount=num(e.resources?.[kind]);
        if(amount>0)results.push(receipt(e,kind,amount,'carry',actor,now));
      }
    }else results.push(receipt(e,e.kind==='equipment'?'equip':e.kind==='consumable'?'consume':e.kind||'item',
      1,'inventory',actor,now));
  }else if(e.type==='buff'&&local){
    results.push(receipt(e,e.kind||'buff',1,'buff',actor,now));
  }else if(e.type==='equipment_equip'&&local){
    results.push(receipt(e,'equip',1,'inventory',actor,now));
  }else if(e.type==='level_up'&&local){
    results.push(receipt(e,'level',Math.max(1,num(e.level)),'level',actor,now));
  }else if(e.type==='tower_upgrade'&&e.team===team){
    const tower=state.towers?.find(t=>t.id===e.tower);
    results.push(receipt(e,'upgrade',Math.max(1,num(e.level)||num(tower?.level)),'upgrade',tower||actor,now));
  }else if(e.type==='construction_complete'&&e.team===team){
    const building=state.buildings?.find(b=>b.id===e.building||b.id===e.id);
    results.push(receipt(e,'build',1,'upgrade',building||actor,now));
  }
 }
 return results.slice(-Math.max(0,Math.min(18,num(limit)||14)));
}
export function arenaResourceCounts(state,seat){
 const p=state?.players?.[seat];
 const stock=state?.teams?.[p?.team]?.resources;
 const carrying=p?.bag;
 const get=v=>Object.fromEntries(ARENA_RESOURCE_KINDS.map(k=>[k,cap(num(v?.[k]),0,999999)]));
 return {stock:get(stock),carrying:get(carrying)};
}
