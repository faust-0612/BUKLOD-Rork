/** Privacy-safe, offline routing hints: no external AI service or new reward authority. */
export function resolveBuklodGuideDestination(input:string,showFaith:boolean) {
 const q=String(input||'').toLowerCase().slice(0,150);
 if(/special event|event|pagtitipon|pista|festival|paligsahan|programa|celebration|tournament/.test(q))
  return {label:'Special Events',route:'/season2/special-events'};
 if(/arena|laban|battle|pvp|fight|combat/.test(q))
  return {label:'Hero Arena',route:'/games/empire-arena'};
 if(/maglaro|laro|games?|kingdom|character|collectible|equipment|inventory/.test(q))
  return {label:'Kingdom at Hero Arena',route:'/season2/games'};
 if(/gusto.*makasama|may makasama|kasama|kaibigan|join cluster|mag-join/.test(q))
  return {label:'Cluster',route:'/clusters'};
 if(/my community|community land|cluster land|organization land|pabahay ng komunidad/.test(q))
  return {label:'My Community',route:'/season2/community-village'};
 if(/university|faculty|classroom|teacher|quiz|exam/.test(q))
  return {label:'University',route:'/season2/university'};
 if(/church|abaka|buklod lesson|prayer|dasal|word/.test(q))
  return {label:showFaith?'Church':'Learnings',route:showFaith?'/season2/church':'/season2/learnings'};
 if(/makipag-usap|usapan|post|wall|marites|reels|video|feed/.test(q))
  return {label:'Community Wall',route:'/buklod'};
 if(/message|chat|call|ptt|connect|private/.test(q))
  return {label:'Connect',route:'/messages'};
 if(/bible|verse|scripture|talata|bibliya|biblia/.test(q))
  return {label:showFaith?'Bible':'Learnings',route:showFaith?'/bible':'/season2/learnings'};
 if(/reading|basa|matuto|learn|knowledge|kl|kuwento|story|children|lesson/.test(q))
  return {label:'Learnings',route:'/season2/learnings'};
 if(/cluster|organi|barangay|community|komunidad|village|scope/.test(q))
  return {label:'Cluster',route:'/clusters'};
 if(/market|business|trade|bili|benta|negosyo/.test(q))
  return {label:'Marketplace',route:'/profile/buklod-market'};
 if(/bayanihan|donat|giving|volunteer|tulong/.test(q))
  return {label:'Bayanihan',route:'/bayanihan'};
 if(/kalusugan|clinic|ospital|health|medical/.test(q))
  return {label:'Health Center',route:'/profile/buklod-health'};
 if(/government|focus apps|office|serbisyo|gobyerno/.test(q))
  return {label:'Office Building',route:'/profile/focus-apps'};
 if(/road|kalsada|tulay|bridge|streetlight|flood|drainage|farm|palayan|park|palaruan|facility|building/.test(q))
  return {label:'My Community',route:'/season2/community-village'};
 if(/rank|achievement|points|bp|reward/.test(q))
  return {label:'Achievement Hall',route:'/points/progression'};
 if(/bahay|home|house|lot|garden|pamilya|kwarto|personal/.test(q))
  return {label:'My House',route:'/season2/my-world'};
 return {label:'BUKLOD Map',route:'/buklod-map'};
}
