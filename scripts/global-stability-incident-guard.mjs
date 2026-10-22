// Read-only incident aggregation. No database writes, grants, retries or OTA.
export function groupPermissionIncidents(events, windowMs = 120000) {
  const sorted = [...events].filter(x => Number.isFinite(Date.parse(x.timestamp)) && typeof x.message === 'string' && /permission denied/i.test(x.message)).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
  const incidents=[];
  for(const event of sorted) {
    const time=Date.parse(event.timestamp);
    let current=incidents[incidents.length-1];
    if(!current || time-current.lastMs>windowMs) {
      current={start:event.timestamp,end:event.timestamp,lastMs:time,count:0,resources:new Set()};
      incidents.push(current);
    }
    current.count++;
    current.end=event.timestamp;
    current.lastMs=time;
    const match=event.message.match(/permission denied for (?:function|table) ([a-zA-Z0-9_]+)/i);
    if(match) current.resources.add(match[1]);
  }
  return incidents.map(({lastMs,resources,...incident})=>({...incident,resourceCount:resources.size,resources:[...resources],crossModule:resources.size>=3}));
}
