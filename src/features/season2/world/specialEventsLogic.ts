/** Display-only, source-authoritative event projection. No BP, QMP or Diamonds minted here. */
export type SpecialEventSource = 'city'|'church';
export type SpecialEventState = 'live'|'upcoming'|'ended'|'schedule-unconfirmed';
export type SpecialEventItem={
 key:string;id:string;title:string;description:string|null;category:string;
 startsAt:string|null;endsAt:string|null;location:string|null;
 source:SpecialEventSource;route:string|null;verified:boolean;requiresRsvp?:boolean;
};
export function deriveSpecialEventState(event:Pick<SpecialEventItem,'startsAt'|'endsAt'>,nowMs:number):SpecialEventState {
 const start=event.startsAt?Date.parse(event.startsAt):NaN;
 const end=event.endsAt?Date.parse(event.endsAt):NaN;
 if(!Number.isFinite(start))return 'schedule-unconfirmed';
 if(Number.isFinite(end)&&end<nowMs)return 'ended';
 if(start>nowMs)return 'upcoming';
 // Never infer LIVE without an explicit legitimate end time.
 if(Number.isFinite(end)&&nowMs<=end)return 'live';
 return 'schedule-unconfirmed';
}
export function normalizeSpecialEventRows(rows:readonly SpecialEventItem[],nowMs:number):SpecialEventItem[]{
 const seen=new Set<string>();
 return rows.filter(event=>{
  if(!event.id.trim()||!event.title.trim()||seen.has(event.key))return false;
  seen.add(event.key);
  const started=event.startsAt?Date.parse(event.startsAt):NaN;
  // Old announcements are not presented as current.
  if(Number.isFinite(started)&&started<nowMs-30*86400000)return false;
  return true;
 }).sort((a,b)=>{
  const phaseA=deriveSpecialEventState(a,nowMs)==='live'?0:1;
  const phaseB=deriveSpecialEventState(b,nowMs)==='live'?0:1;
  if(phaseA!==phaseB)return phaseA-phaseB;
  const ta=a.startsAt?Date.parse(a.startsAt):Number.MAX_SAFE_INTEGER;
  const tb=b.startsAt?Date.parse(b.startsAt):Number.MAX_SAFE_INTEGER;
  return (Number.isFinite(ta)?ta:Number.MAX_SAFE_INTEGER)-(Number.isFinite(tb)?tb:Number.MAX_SAFE_INTEGER);
 }).slice(0,45);
}
export function safeEventLabel(v:unknown,max=180):string {
 return typeof v==='string'?v.trim().slice(0,max):'';
}
