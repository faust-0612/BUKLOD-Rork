/** Offline-only public/personal navigation shortcuts. Authorization remains in route guards. */
export type BuklodFeatureLink = {
  id: string;
  title: string;
  route: string;
  aliases: readonly string[];
};
export const BUKLOD_FEATURE_LINKS: readonly BuklodFeatureLink[] = [
  { id: 'wall', title: 'Community Wall', route: '/buklod', aliases: ['post', 'magpost', 'community', 'feed', 'photo'] },
  { id: 'connect', title: 'Connect', route: '/messages', aliases: ['chat', 'message', 'usapan', 'mensahe', 'tawag'] },
  { id: 'cluster', title: 'My Cluster', route: '/clusters', aliases: ['grupo', 'members', 'kasapi', 'how to join cluster', 'paano sumali sa cluster'] },
  { id: 'profile', title: 'Profile', route: '/me', aliases: ['account', 'ako', 'personal'] },
  { id: 'settings', title: 'Settings', route: '/settings', aliases: ['gear', 'ayos', 'configure', 'setting'] },
  { id: 'bible', title: 'Bible & Reading', route: '/bible', aliases: ['bible', 'basa', 'pagbasa', 'daily reading', 'salita ng dios', 'verses'] },
  { id: 'prayer', title: 'Prayer', route: '/prayer', aliases: ['panalangin', 'prayer', 'dasal', 'pray'] },
  { id: 'kingdom', title: 'BUKLOD Kingdom', route: '/games', aliases: ['kingdom', 'game', 'laro', 'map', 'reward'] },
  { id: 'contribution', title: 'Community Contribution', route: '/community-contribution', aliases: ['kontribusyon', 'bayanihan', 'contribute', 'qmp', 'earnings', 'puntos','monetization','monetize','income','admob','revenue','withdrawal','payout','earnings summary','how to earn','paano kumita', 'monetization', 'monetisation', 'how to earn', 'paano kumita', 'income', 'revenue', 'admob', 'withdrawal', 'payout'] },
  { id: 'security', title: 'Password & Recovery', route: '/account/security', aliases: ['password', 'pass', 'reset', 'recover', 'security', 'palit password', 'how to change password', 'paano palitan ang password'] },
  { id: 'language', title: 'App Language', route: '/preferences/language', aliases: ['wika', 'tagalog', 'english', 'salita'] },
  { id: 'drawer', title: 'My Drawer', route: '/drawer', aliases: ['files', 'notes', 'scan', 'saved', 'documents', 'dokumento'] },
  { id: 'health', title: 'Health Center', route: '/profile/buklod-health', aliases: ['health', 'consult', 'kalusugan', 'doktor', 'how to consult', 'paano magpakonsulta', 'imci', 'child health'] },
  { id: 'support', title: 'Live Support', route: '/support/live', aliases: ['tulong', 'help', 'problema', 'report issue', 'bsoc', 'how to report a problem', 'paano magreport', 'technical support'] },
  { id: 'guide', title: 'How to use BUKLOD', route: '/settings/navigation-help', aliases: ['paano gamitin', 'navigation', 'tutorial', 'guide', 'how to', 'find features'] },
  { id: 'notification', title: 'Notifications', route: '/notifications', aliases: ['abiso', 'alert', 'update'] },
  { id: 'rank', title: 'Circle Rank & Levels', route: '/points/progression', aliases: ['rank','ranking','level','level up','badge','progression','character rank','circle rank','monthly rank','overall rank','leaderboard','ranggo','how to check my rank','my rank','overall rank','monthly rank','leaderboard','ranggo'] },
  { id: 'attendance', title: 'Attendance', route: '/profile/attendance-qr', aliases: ['attendance','present','check in','qr attendance'] },
  { id: 'lesson', title: 'Lessons & Formation', route: '/learn', aliases: ['lesson','lessons','formation','training','course','pagsasanay'] },
  { id: 'music', title: 'BUKLOD Music', route: '/personal-home/radio', aliases: ['music','song','tugtog','radio','audio'] },
  { id: 'referral', title: 'Referral & Invitations', route: '/life/invite', aliases: ['refer','referral','invite','invitations','invitation code'] },
  { id: 'bayanihan', title: 'Bayanihan', route: '/bayanihan', aliases: ['bayanihan','fund','donation','volunteer'] },
  { id: 'support_ticket', title: 'My Support Requests', route: '/support/live', aliases: ['my request','support case','ticket','bsoc','problem','help desk'] },
  { id: 'privacy_settings', title: 'Privacy & Account Security', route: '/settings', aliases: ['private','privacy','lock profile','security','recovery pin'] },
  { id: 'privacy', title: 'Privacy', route: '/privacy', aliases: ['privacy', 'pribado', 'lock'] },
  { id:'imci', title:'IMCI Child Health', route:'/profile/buklod-health', aliases:['imci','childhood illness','child health','pediatric care','baby care'] },
  { id:'activity', title:'My Posts & Activity', route:'/me', aliases:['my posts','activities','my activities','my post cards','posts ko'] },
  { id:'announcements', title:'Public Announcements', route:'/hub', aliases:['announcement','announcements','public notice','bulletin','advisory'] },
];

export function normalizeBuklodFeatureSearch(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim().replace(/\s+/g, ' ');
}

const QUESTION_WORDS=new Set(['how','what','where','when','do','does','can','i','you','me','my','is','are','the','to','in','of','for','with','and','show','find','see','check','open','paano','ko','ang','ng','sa','na','ba','mga','nasa','nasaan','pwede','pwedeng','makita','yung','ung','ano','saan']);
/** No network, no behavior tracking, no privileged/admin destinations and no private content search. */
export function findBuklodFeatures(query: string, maxResults = 5): BuklodFeatureLink[] {
  const q = normalizeBuklodFeatureSearch(query);
  if (q.length < 2) return [];
  const max = Number.isFinite(maxResults) ? Math.max(0, Math.floor(maxResults)) : 5;
  const tokens=q.split(' ').filter(t=>t.length>=2&&!QUESTION_WORDS.has(t));
  if(!tokens.length)return [];
  const score=(item:BuklodFeatureLink):number=>{
    const names=[item.title,...item.aliases].map(normalizeBuklodFeatureSearch);
    if(names.some(s=>s===q))return 100;
    if(names.some(s=>s.startsWith(q)))return 80;
    if(names.some(s=>s.includes(q)))return 60;
    const coverage=tokens.filter(t=>names.some(s=>s.split(' ').some(w=>w===t||w.startsWith(t)||t.length>4&&t.startsWith(w)&&w.length>3))).length;
    if(coverage===tokens.length)return 50+coverage*5;
    if(coverage>0)return 15+Math.round(30*coverage/tokens.length);
    return 0;
  };
  return BUKLOD_FEATURE_LINKS.map(item=>({item,rank:score(item)}))
    .filter(row=>row.rank>0).sort((a,b)=>b.rank-a.rank)
    .slice(0,max).map(row=>row.item);
}
