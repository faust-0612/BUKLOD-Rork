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
  { id: 'cluster', title: 'My Cluster', route: '/clusters', aliases: ['grupo', 'members', 'kasapi'] },
  { id: 'profile', title: 'Profile', route: '/me', aliases: ['account', 'ako', 'personal'] },
  { id: 'settings', title: 'Settings', route: '/settings', aliases: ['gear', 'ayos', 'configure', 'setting'] },
  { id: 'security', title: 'Password & Recovery', route: '/account/security', aliases: ['password', 'pass', 'reset', 'recover', 'security', 'palit password'] },
  { id: 'language', title: 'App Language', route: '/preferences/language', aliases: ['wika', 'tagalog', 'english', 'salita'] },
  { id: 'drawer', title: 'My Drawer', route: '/drawer', aliases: ['files', 'notes', 'scan', 'saved', 'documents', 'dokumento'] },
  { id: 'health', title: 'Health Center', route: '/profile/buklod-health', aliases: ['health', 'consult', 'kalusugan', 'doktor'] },
  { id: 'support', title: 'Live Support', route: '/support/live', aliases: ['tulong', 'help', 'problema', 'report issue', 'bsoc'] },
  { id: 'notification', title: 'Notifications', route: '/notifications', aliases: ['abiso', 'alert', 'update'] },
  { id: 'privacy', title: 'Privacy', route: '/privacy', aliases: ['privacy', 'pribado', 'lock'] },
];

export function normalizeBuklodFeatureSearch(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim().replace(/\s+/g, ' ');
}

/** No network, no behavior tracking, no privileged/admin destinations and no private content search. */
export function findBuklodFeatures(query: string, maxResults = 5): BuklodFeatureLink[] {
  const q = normalizeBuklodFeatureSearch(query);
  if (q.length < 2) return [];
  const max = Number.isFinite(maxResults) ? Math.max(0, Math.floor(maxResults)) : 5;
  return BUKLOD_FEATURE_LINKS.filter(item =>
    [item.title, ...item.aliases].some(part => normalizeBuklodFeatureSearch(part).includes(q))
  ).slice(0, max);
}
