import { useEffect,useState } from 'react';
import { subscribeBuklodStreamVideoClient } from '@/lib/buklodStreamVideoClient';
const ACTIVE = new Set(['ringing','joining','joined','reconnecting','migrating']);
export function useBuklodVideoCallBusy(){
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let callsSub:{unsubscribe:()=>void}|undefined;
    let stateSubs:Array<{unsubscribe:()=>void}>=[];
    const unsubscribe=subscribeBuklodStreamVideoClient(client=>{
      callsSub?.unsubscribe();stateSubs.forEach(s=>s.unsubscribe());stateSubs=[];
      if(!client){setBusy(false);return;}
      callsSub=client.state.calls$.subscribe(calls=>{
        stateSubs.forEach(s=>s.unsubscribe());stateSubs=[];
        const sync=()=>setBusy(calls.some(call=>ACTIVE.has(String(call.state.callingState).toLowerCase())));
        stateSubs=calls.map(call=>call.state.callingState$.subscribe(sync));
        sync();
      });
    });
    return()=>{unsubscribe();callsSub?.unsubscribe();stateSubs.forEach(s=>s.unsubscribe());};
  },[]);
  return busy;
}
