/**
 * BUKLOD World V1 discovery catalog.
 * The gateway is intentionally a navigation layer: no existing routes, entitlements,
 * community-scoped access controls, or financial contracts are replaced here.
 */
export type WorldDistrict =
  | 'social' | 'community' | 'growth' | 'world' | 'services' | 'economy';
export type WorldDestination = {
  id: string;
  label: string;
  description: string;
  icon: string;
  district: WorldDistrict;
  route: string | null;
  /** Null means a design-only preview; it must never pretend to be a live service. */
  state: 'available' | 'preview';
};
export type WorldPurpose = {
  id: string;
  question: string;
  subtitle: string;
  icon: string;
  destinationIds: readonly string[];
};

export const WORLD_DESTINATIONS: readonly WorldDestination[] = [
  { id:'wall', label:'Community Wall', description:'Tuklasin ang mga balita at usapan ng komunidad.',icon:'post-outline',district:'social',route:'/buklod',state:'available' },
  { id:'connect', label:'Connect Hub', description:'Makipag-usap sa mga taong kakilala at konektado sa iyo.',icon:'chat-processing-outline',district:'social',route:'/messages',state:'available' },
  { id:'cluster', label:'Cluster Village', description:'Sumali at makibahagi sa iyong mga community.',icon:'account-group-outline',district:'community',route:'/clusters',state:'available' },
  { id:'bayanihan', label:'Bayanihan', description:'Tumulong at makibahagi sa mga community initiatives.',icon:'hand-heart-outline',district:'community',route:'/bayanihan',state:'available' },
  { id:'faith', label:'Faith & Reflection', description:'Pagbabasa, pagninilay at spiritual growth.',icon:'sprout-outline',district:'growth',route:'/bible',state:'available' },
  { id:'learning', label:'Learning Center', description:'Mga lesson, learning at personal development.',icon:'school-outline',district:'growth',route:'/learn',state:'available' },
  { id:'stories', label:'Children’s Stories', description:'Mga kuwento para sa bata at pamilya.',icon:'book-open-page-variant-outline',district:'growth',route:'/children-stories',state:'available' },
  { id:'kingdom', label:'Kingdom Arena', description:'Mga laro at Character/Kingdom experience.',icon:'chess-king',district:'world',route:'/games',state:'available' },
  { id:'myworld', label:'My Land & Home', description:'Ihanda ang iyong virtual lupa, bahay, farm at shared residence.',icon:'home-city-outline',district:'world',route:null,state:'preview' },
  { id:'resource', label:'Resources & Building', description:'Blueprints, materials at collaborative construction.',icon:'hammer-wrench',district:'world',route:null,state:'preview' },
  { id:'market', label:'Market Street', description:'Buksan ang Market mula sa Focus Apps.',icon:'storefront-outline',district:'economy',route:'/profile/focus-apps',state:'available' },
  { id:'business', label:'Business District', description:'Mga negosyo at business workspaces sa Focus Apps.',icon:'domain',district:'economy',route:'/profile/focus-apps',state:'available' },
  { id:'government', label:'Government Hall', description:'Government community access sa existing Focus Apps.',icon:'bank-outline',district:'services',route:'/profile/focus-apps',state:'available' },
  { id:'health', label:'Health Center', description:'Health information at available health services.',icon:'heart-pulse',district:'services',route:'/profile/buklod-health',state:'available' },
  { id:'family', label:'Family Home', description:'Family features at permitted household workspaces.',icon:'home-heart',district:'community',route:'/profile/focus-apps',state:'available' },
  { id:'support', label:'Help & Support', description:'Magpatulong at mag-ulat ng concern.',icon:'lifebuoy',district:'services',route:'/support/live',state:'available' },
  { id:'profile', label:'My Profile', description:'Ang iyong identity, posts at progress.',icon:'account-circle-outline',district:'services',route:'/me',state:'available' },
  { id:'contribution', label:'Community Contribution', description:'Points, participation at iyong economy information.',icon:'chart-timeline-variant',district:'economy',route:'/community-contribution',state:'available' },
] as const;

export const WORLD_PURPOSES: readonly WorldPurpose[] = [
  { id:'company',question:'May makasama',subtitle:'Kilalanin ang mga tao at communities.',icon:'account-group-outline',destinationIds:['connect','cluster','wall','bayanihan'] },
  { id:'communicate',question:'Makipag-ugnayan',subtitle:'Usapan, updates at komunidad.',icon:'chat-outline',destinationIds:['connect','wall','cluster'] },
  { id:'play',question:'Maglaro',subtitle:'Kingdom at cooperative experiences.',icon:'gamepad-variant-outline',destinationIds:['kingdom','myworld','cluster'] },
  { id:'grow',question:'Matuto at lumago',subtitle:'Knowledge, faith at paglago.',icon:'book-open-variant',destinationIds:['learning','faith','stories'] },
  { id:'help',question:'Tumulong o humingi',subtitle:'Bayanihan at tunay na support.',icon:'hand-heart-outline',destinationIds:['bayanihan','support','cluster'] },
  { id:'build',question:'Bumuo ng mundo',subtitle:'Lupa, bahay, resources at community.',icon:'home-city-outline',destinationIds:['myworld','resource','cluster','contribution'] },
  { id:'trade',question:'Magnegosyo o makipag-trade',subtitle:'Business, Market at world trade.',icon:'storefront-outline',destinationIds:['market','business','resource','contribution'] },
  { id:'explore',question:'Tuklasin lahat',subtitle:'Lahat ng BUKLOD destinations.',icon:'compass-outline',destinationIds:['wall','connect','cluster','kingdom','faith','market','government','myworld'] },
] as const;

export const WORLD_MAP_PINS = [
  { id:'cluster',x:4,y:14 },
  { id:'faith',x:39,y:8 },
  { id:'kingdom',x:71,y:14 },
  { id:'connect',x:5,y:43 },
  { id:'wall',x:68,y:45 },
  { id:'myworld',x:12,y:73 },
  { id:'market',x:69,y:75 },
] as const;

export function worldDestinationById(id: string): WorldDestination | null {
  return WORLD_DESTINATIONS.find(item => item.id === id) ?? null;
}
export function worldPurposeById(id: string): WorldPurpose | null {
  return WORLD_PURPOSES.find(item => item.id === id) ?? null;
}
export function destinationsForPurpose(id: string): WorldDestination[] {
  const purpose = worldPurposeById(id);
  if (!purpose) return [];
  return purpose.destinationIds
    .map(worldDestinationById)
    .filter((item): item is WorldDestination => item !== null);
}
export function destinationsByDistrict(district: WorldDistrict): WorldDestination[] {
  return WORLD_DESTINATIONS.filter(item => item.district === district);
}
