/** Offline, privacy-preserving navigation hints; not a paid AI endpoint. */
export function resolveBuklodGuideDestination(input:string,showFaith:boolean) {
  const q=String(input||'').toLowerCase().slice(0,150);
  if(/arena|laban|battle|pvp|fight|combat/.test(q))return {label:'Empire Arena',route:'/games/empire-arena'};
  if(/character|kingdom|collectible|evolution|equipment|inventory/.test(q))return {label:'Character Kingdom',route:'/games'};
  if(/cluster|organi|barangay|community|komunidad|village|scope/.test(q))return {label:'Community Village',route:'/season2/community-village'};
  if(/post|wall|marites|reels|video|feed/.test(q))return {label:'Community Hall',route:'/buklod'};
  if(/message|chat|kausap|call|ptt|connect/.test(q))return {label:'Connect Center',route:'/messages'};
  if(/market|business|trade|bili|benta|negosyo/.test(q))return {label:'Marketplace',route:'/profile/buklod-market'};
  if(/bayanihan|donat|giving|volunteer|tulong sa komunidad/.test(q))return {label:'Bayanihan Center',route:'/bayanihan'};
  if(/government|health|school|focus apps|serbisyo|gobyerno/.test(q))return {label:'Focus Apps Center',route:'/profile/focus-apps'};
  if(/bible|dasal|verse|scripture|kl|lesson|learn|knowledge/.test(q))
    return {label:'Knowledge Sanctuary',route:showFaith?'/bible':'/learn'};
  if(/rank|achievement|points|bp|reward/.test(q))return {label:'Achievement Hall',route:'/points/progression'};
  if(/bahay|home|house|lot|garden|pamilya|kwarto|personal/.test(q))return {label:'My Home',route:'/season2/my-world'};
  return {label:'World Map',route:'/buklod-map'};
}
