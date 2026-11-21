/**
 * Single, predictable Season 2 map taxonomy. A screen belongs to exactly one
 * district. Routes are existing Expo Router destinations, not invented URLs.
 * Administrative access remains delegated to Focus Apps and server-side roles.
 */
export type BuklodMapDestination = Readonly<{
  label: string;
  route: string;
  description: string;
  faithOnly?: boolean;
}>;
export type BuklodMapDistrict = Readonly<{
  id: string;
  title: string;
  tagline: string;
  icon: string;
  accent: string;
  destination: string;
  entries: readonly BuklodMapDestination[];
}>;
export const BUKLOD_MAP_DISTRICTS: readonly BuklodMapDistrict[] = Object.freeze([
  {
    id: 'my-place', title: 'My Place', tagline: 'Your home, identity and daily life',
    icon: 'home-variant-outline', accent: '#97E9D3', destination: '/season2/my-world',
    entries: [
      { label: 'My World (Lot + House)', route: '/season2/my-world', description: 'Own development map and local customization' },
      { label: 'Household Rooms', route: '/personal-home', description: 'Existing family and household tools' },
      { label: 'My Profile', route: '/me', description: 'Identity, rank and posts' },
      { label: 'My Points', route: '/points', description: 'Participation, rank and character' },
      { label: 'Radio', route: '/personal-home/radio', description: 'Personal audio and radio' },
      { label: 'Reminders', route: '/personal-home/reminders', description: 'Personal reminders' },
      { label: 'Budget', route: '/personal-home/budget', description: 'Personal budget tools' },
    ],
  },
  {
    id: 'community', title: 'Community', tagline: 'See and share what matters',
    icon: 'earth', accent: '#F9DBA5', destination: '/buklod',
    entries: [
      { label: 'Public Wall', route: '/buklod', description: 'Feed, posts and Today\'s Best' },
      { label: 'Reels', route: '/reels', description: 'Videos and creator posts' },
      { label: 'Invite Friends', route: '/life/invite', description: 'Invite people to participate' },
    ],
  },
  {
    id: 'connect', title: 'Connect', tagline: 'Talk, gather and respond',
    icon: 'message-text-outline', accent: '#98D4FF', destination: '/messages',
    entries: [
      { label: 'Messages & Calls', route: '/messages', description: 'Personal and community chat' },
      { label: 'Notifications', route: '/notifications', description: 'Your latest interactions' },
    ],
  },
  {
    id: 'communities', title: 'Communities', tagline: 'Grow with real people',
    icon: 'account-group-outline', accent: '#B4F2B6', destination: '/season2/community-village',
    entries: [
      { label: 'Community Village', route: '/season2/community-village', description: 'Interactive village development map' },
      { label: 'Clusters', route: '/clusters', description: 'Join and contribute in your cluster' },
      { label: 'Organizations', route: '/organizations', description: 'Organization and sub-organization' },
      { label: 'Bayanihan', route: '/bayanihan', description: 'Real-world community action' },
      { label: 'Discover Communities', route: '/community/discover', description: 'Find communities and circles' },
    ],
  },
  {
    id: 'growth', title: 'Growth', tagline: 'Learn, practice and progress',
    icon: 'book-open-page-variant-outline', accent: '#D9B5FF', destination: '/learn',
    entries: [
      { label: 'Learning', route: '/learn', description: 'Lessons and learning tracks' },
      { label: 'Progression', route: '/points/progression', description: 'Rank and character milestones' },
      { label: 'Season Journey', route: '/points/season2-guide', description: 'Season story and guided milestones' },
      { label: 'Children’s Stories', route: '/children-stories', description: 'Stories and family learning' },
      { label: 'Bible', route: '/bible', description: 'Bible and reading', faithOnly: true },
      { label: 'Life', route: '/life', description: 'Faith and life journey', faithOnly: true },
    ],
  },
  {
    id: 'kingdom', title: 'Character Kingdom', tagline: 'Characters, realms and earned collectibles',
    icon: 'castle', accent: '#FFD49E', destination: '/games',
    entries: [
      { label: 'Character Kingdom', route: '/games', description: 'Explore the 13 character realms' },
      { label: 'Verified Character Progress', route: '/games/legacy', description: 'View official character achievements' },
      { label: 'Collection Vault', route: '/games/genesis-collection', description: 'Items and character collectibles' },
      { label: 'Game Practice', route: '/games/practice', description: 'Practice existing character games' },
    ],
  },
  {
    id: 'arena', title: 'Empire Arena', tagline: 'Separate real-time battle destination',
    icon: 'shield-sword-outline', accent: '#F1BA90', destination: '/games/empire-arena',
    entries: [
      { label: 'Empire Arena', route: '/games/empire-arena', description: 'In-app landscape battles; practice available, ranked access stays server-gated' },
    ],
  },
  {
    id: 'market', title: 'Market & Economy', tagline: 'Trade, build and understand value',
    icon: 'storefront-outline', accent: '#A9E3EC', destination: '/profile/buklod-market',
    entries: [
      { label: 'Market', route: '/profile/buklod-market', description: 'Discover and trade' },
      { label: 'Business', route: '/profile/buklod-business', description: 'Register and manage business' },
      { label: 'Economy Guide', route: '/points/economy', description: 'BP, QMP and legitimate rewards' },
      { label: 'Community Contribution', route: '/community-contribution', description: 'Qualified monthly participation and impact' },
    ],
  },
  {
    id: 'services', title: 'Services', tagline: 'Find help and practical tools',
    icon: 'compass-outline', accent: '#E0ECFF', destination: '/profile/focus-apps',
    entries: [
      { label: 'Focus Apps', route: '/profile/focus-apps', description: 'Government, education and other focus areas' },
      { label: 'Health', route: '/profile/buklod-health', description: 'Health Center' },
      { label: 'Family Workspace', route: '/profile/buklod-family', description: 'Family and household tools' },
      { label: 'Support', route: '/support', description: 'Help and concerns' },
      { label: 'Live Support', route: '/support/live', description: 'Request help from BUKLOD support' },
      { label: 'About BUKLOD', route: '/about-buklod', description: 'Vision, principles and community' },
      { label: 'Settings', route: '/settings', description: 'Privacy, sound and preferences' },
      { label: 'Navigation Help', route: '/settings/navigation-help', description: 'Learn where every door leads' },
    ],
  },
] as const);
export function visibleBuklodMapDestinations(district: BuklodMapDistrict, showFaith: boolean) {
  return district.entries.filter(entry => !entry.faithOnly || showFaith);
}
export function getBuklodMapDistrict(id: string) {
  return BUKLOD_MAP_DISTRICTS.find(district => district.id === id) ?? BUKLOD_MAP_DISTRICTS[0];
}
