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
    icon: 'home-variant-outline', accent: '#97E9D3', destination: '/personal-home',
    entries: [
      { label: 'Personal Home', route: '/personal-home', description: 'Your personal space' },
      { label: 'My Profile', route: '/me', description: 'Identity, rank and posts' },
      { label: 'My Points', route: '/points', description: 'Participation, rank and character' },
      { label: 'Radio', route: '/personal-home/radio', description: 'Personal audio and radio' },
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
    icon: 'account-group-outline', accent: '#B4F2B6', destination: '/clusters',
    entries: [
      { label: 'Community Village', route: '/community-village', description: 'Explore personal lot, home, community estate, business and development previews' },
      { label: 'Clusters', route: '/clusters', description: 'Join and contribute in your cluster' },
      { label: 'Organizations', route: '/organizations', description: 'Organization and sub-organization' },
      { label: 'Bayanihan', route: '/bayanihan', description: 'Real-world community action' },
    ],
  },
  {
    id: 'growth', title: 'Growth', tagline: 'Learn, practice and progress',
    icon: 'book-open-page-variant-outline', accent: '#D9B5FF', destination: '/learn',
    entries: [
      { label: 'Learning', route: '/learn', description: 'Lessons and learning tracks' },
      { label: 'Progression', route: '/points/progression', description: 'Rank and character milestones' },
      { label: 'Children’s Stories', route: '/children-stories', description: 'Stories and family learning' },
      { label: 'Bible', route: '/bible', description: 'Bible and reading', faithOnly: true },
      { label: 'Life', route: '/life', description: 'Faith and life journey', faithOnly: true },
    ],
  },
  {
    id: 'kingdom', title: 'Character Kingdom', tagline: 'Characters, nature realms, growth and collectibles',
    icon: 'castle', accent: '#FFD49E', destination: '/games',
    entries: [
      { label: 'Living Kingdom', route: '/games', description: 'World, games and creation' },
      { label: 'Collection', route: '/games/genesis-collection', description: 'Owned items and collectibles' },
      { label: 'Practice', route: '/games/practice', description: 'Learn to play without risk' },
    ],
  },
  {
    id: 'empire-arena', title: 'Empire Arena', tagline: 'A separate competitive battlefield inside BUKLOD',
    icon: 'shield-sword-outline', accent: '#FFBE89', destination: '/games/empire-arena',
    entries: [
      { label: 'Empire Arena', route: '/games/empire-arena', description: 'Landscape action battles: offline practice; ranked locked until safe live verification' },
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
    ],
  },
] as const);
export function visibleBuklodMapDestinations(district: BuklodMapDistrict, showFaith: boolean) {
  return district.entries.filter(entry => !entry.faithOnly || showFaith);
}
export function getBuklodMapDistrict(id: string) {
  return BUKLOD_MAP_DISTRICTS.find(district => district.id === id) ?? BUKLOD_MAP_DISTRICTS[0];
}
