/** Optional offline-only navigation help. No private or privileged feature indexing. */
// Keep the on-device help index standalone; Node/Android both work offline.
const normalizeBuklodFeatureSearch = (value: string) =>
  value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

export const BUKLOD_NAV_HELP = [
  { id: 'home', title: 'Home', icon: 'home-outline', route: '/hub', aliases: ['daily', 'araw-araw', 'tahanan', 'pinned'], body: 'Find your daily essentials, feature search and pinned shortcuts without needing an internet connection.' },
  { id: 'cluster', title: 'Cluster', icon: 'account-group-outline', route: '/clusters', aliases: ['grupo', 'organization', 'scope', 'church'], body: 'Open your authorized Cluster or Organization. Each workspace has its own Home, Community and Connect.' },
  { id: 'wall', title: 'Wall', icon: 'view-dashboard-outline', route: '/buklod', aliases: ['post', 'feed', 'community wall', 'magpost'], body: 'Read or create public posts. Secondary actions are in a More menu and long-press is optional.' },
  { id: 'connect', title: 'Connect', icon: 'message-text-outline', route: '/messages', aliases: ['chat', 'message', 'tawag', 'conversation', 'gif'], body: 'Your personal and scoped chats, calls and attachments. Confirm the active conversation before sending.' },
  { id: 'profile', title: 'Profile', icon: 'account-circle-outline', route: '/me', aliases: ['account', 'ako', 'personal', 'progress'], body: 'See your identity, progress, communities and Focus Apps. Settings stays visible as a gear.' },
  { id: 'drawer', title: 'My Drawer', icon: 'folder-outline', route: '/drawer', aliases: ['files', 'notes', 'dokumento', 'scan'], body: 'My Drawer stores your own notes and files. It is not the app navigation drawer.' },
  { id: 'shortcuts', title: 'Pinned shortcuts', icon: 'star-outline', route: '/hub', aliases: ['favorites', 'recent', 'search', 'tulong'], body: 'Find a Feature supports Filipino and English terms; tap a star to pin up to four shortcuts.' },
  { id: 'accessibility', title: 'Keyboard & accessibility', icon: 'keyboard-outline', route: '/settings', aliases: ['font', 'gif', 'keyboard', 'gboard', 'text', 'talkback'], body: 'BUKLOD inputs follow phone font settings. Attach GIFs in supported composers, preview, then Send. Every long-press action has a visible alternative.' },
  { id: 'offline', title: 'Offline & recovery', icon: 'wifi-off', route: '/hub', aliases: ['walang internet', '3g', 'retry', 'loading', 'draft'], body: 'Help, feature search and saved shortcuts remain on-device. Reconnect and retry failed online content without duplicate posting.' },
] as const;

export type BuklodNavigationHelpItem = typeof BUKLOD_NAV_HELP[number];
export function findBuklodNavigationHelp(query: string): readonly BuklodNavigationHelpItem[] {
  const normalized = normalizeBuklodFeatureSearch(query);
  if (normalized.length < 2) return BUKLOD_NAV_HELP;
  return BUKLOD_NAV_HELP.filter(item =>
    [item.title, item.body, ...item.aliases].some(value =>
      normalizeBuklodFeatureSearch(value).includes(normalized)
    )
  );
}
