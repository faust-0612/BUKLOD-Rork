import { getBuklodCircleRankArt } from '@/lib/buklodCircleRankArt';

/** Cosmetic scope only: never a member rank or a persisted identity. */
export const OFFICIAL_COSMETIC_ACCESS = 'official-cosmetic-access' as const;
export function hasOfficialCosmeticAccess(value:unknown):boolean {return value===OFFICIAL_COSMETIC_ACCESS;}

/** Text-only post appearance; never changes the app's seasonal theme or grants rank. */
export type WallPostDesign = { readonly id:string; readonly name:string; readonly group:string; readonly minFamilyIndex:number; readonly minRankOrder:number; readonly start:string; readonly end:string; readonly ink:string; readonly motif:'rays'|'orbit'|'leaves'|'stars'|'frame' };
export const WALL_POST_DESIGNS: readonly WallPostDesign[] = [
  {
    "id": "emerald-faith",
    "name": "Emerald Faith",
    "group": "active",
    "minFamilyIndex": 1,
    "minRankOrder": 6,
    "start": "#103D30",
    "end": "#17604B",
    "ink": "#FFFFFF",
    "motif": "rays"
  },
  {
    "id": "sapphire-dawn",
    "name": "Sapphire Dawn",
    "group": "active",
    "minFamilyIndex": 1,
    "minRankOrder": 8,
    "start": "#102B54",
    "end": "#215D91",
    "ink": "#FFFFFF",
    "motif": "orbit"
  },
  {
    "id": "garden-of-hope",
    "name": "Garden of Hope",
    "group": "active",
    "minFamilyIndex": 1,
    "minRankOrder": 10,
    "start": "#DCEED5",
    "end": "#FAF5DA",
    "ink": "#183C29",
    "motif": "leaves"
  },
  {
    "id": "amethyst-sky",
    "name": "Amethyst Sky",
    "group": "steady",
    "minFamilyIndex": 2,
    "minRankOrder": 11,
    "start": "#30205D",
    "end": "#634C93",
    "ink": "#FFFFFF",
    "motif": "stars"
  },
  {
    "id": "crystal-waters",
    "name": "Crystal Waters",
    "group": "steady",
    "minFamilyIndex": 2,
    "minRankOrder": 13,
    "start": "#123A54",
    "end": "#216A83",
    "ink": "#FFFFFF",
    "motif": "orbit"
  },
  {
    "id": "quiet-moon",
    "name": "Quiet Moon",
    "group": "steady",
    "minFamilyIndex": 2,
    "minRankOrder": 15,
    "start": "#E8E4F3",
    "end": "#F8F5FF",
    "ink": "#3B285F",
    "motif": "rays"
  },
  {
    "id": "golden-light",
    "name": "Golden Light",
    "group": "builder",
    "minFamilyIndex": 3,
    "minRankOrder": 16,
    "start": "#F5D482",
    "end": "#FFF1CF",
    "ink": "#4C3212",
    "motif": "rays"
  },
  {
    "id": "bronze-legacy",
    "name": "Bronze Legacy",
    "group": "builder",
    "minFamilyIndex": 3,
    "minRankOrder": 18,
    "start": "#4D2B20",
    "end": "#835331",
    "ink": "#FFFFFF",
    "motif": "frame"
  },
  {
    "id": "architects-dawn",
    "name": "Architect's Dawn",
    "group": "builder",
    "minFamilyIndex": 3,
    "minRankOrder": 20,
    "start": "#EEE4D3",
    "end": "#FDF9F0",
    "ink": "#493722",
    "motif": "frame"
  },
  {
    "id": "aurora-blessing",
    "name": "Aurora Blessing",
    "group": "impact",
    "minFamilyIndex": 4,
    "minRankOrder": 21,
    "start": "#083E43",
    "end": "#16705F",
    "ink": "#FFFFFF",
    "motif": "orbit"
  },
  {
    "id": "ocean-of-grace",
    "name": "Ocean of Grace",
    "group": "impact",
    "minFamilyIndex": 4,
    "minRankOrder": 23,
    "start": "#113B60",
    "end": "#216D80",
    "ink": "#FFFFFF",
    "motif": "rays"
  },
  {
    "id": "living-paradise",
    "name": "Living Paradise",
    "group": "impact",
    "minFamilyIndex": 4,
    "minRankOrder": 25,
    "start": "#D3F0E7",
    "end": "#F0F7D5",
    "ink": "#153D36",
    "motif": "leaves"
  },
  {
    "id": "ember-crown",
    "name": "Ember Crown",
    "group": "vanguard",
    "minFamilyIndex": 5,
    "minRankOrder": 26,
    "start": "#551A22",
    "end": "#914330",
    "ink": "#FFFFFF",
    "motif": "frame"
  },
  {
    "id": "sunrise-victory",
    "name": "Sunrise Victory",
    "group": "vanguard",
    "minFamilyIndex": 5,
    "minRankOrder": 28,
    "start": "#FFE0A5",
    "end": "#F7B779",
    "ink": "#4D2119",
    "motif": "rays"
  },
  {
    "id": "crimson-valour",
    "name": "Crimson Valour",
    "group": "vanguard",
    "minFamilyIndex": 5,
    "minRankOrder": 30,
    "start": "#531931",
    "end": "#802D53",
    "ink": "#FFFFFF",
    "motif": "stars"
  },
  {
    "id": "royal-nebula",
    "name": "Royal Nebula",
    "group": "prime",
    "minFamilyIndex": 6,
    "minRankOrder": 31,
    "start": "#101D52",
    "end": "#2C4A8D",
    "ink": "#FFFFFF",
    "motif": "stars"
  },
  {
    "id": "celestial-throne",
    "name": "Celestial Throne",
    "group": "prime",
    "minFamilyIndex": 6,
    "minRankOrder": 33,
    "start": "#E5EDFF",
    "end": "#FFF0C8",
    "ink": "#20325C",
    "motif": "frame"
  },
  {
    "id": "infinity-orbit",
    "name": "Infinity Orbit",
    "group": "prime",
    "minFamilyIndex": 6,
    "minRankOrder": 35,
    "start": "#101D39",
    "end": "#265F80",
    "ink": "#FFFFFF",
    "motif": "orbit"
  },
  {
    "id": "genesis-of-light",
    "name": "Genesis of Light",
    "group": "prime-elite",
    "minFamilyIndex": 7,
    "minRankOrder": 36,
    "start": "#1C153B",
    "end": "#563F78",
    "ink": "#FFFFFF",
    "motif": "stars"
  },
  {
    "id": "eternal-crown",
    "name": "Eternal Crown",
    "group": "prime-elite",
    "minFamilyIndex": 7,
    "minRankOrder": 38,
    "start": "#FFF1C8",
    "end": "#E7CA82",
    "ink": "#422B12",
    "motif": "frame"
  },
  {
    "id": "divine-cosmos",
    "name": "Divine Cosmos",
    "group": "prime-elite",
    "minFamilyIndex": 7,
    "minRankOrder": 40,
    "start": "#201835",
    "end": "#604376",
    "ink": "#FFFFFF",
    "motif": "orbit"
  }
];

export function resolveWallPostDesign(id: unknown): WallPostDesign | null {
  return typeof id === 'string' ? WALL_POST_DESIGNS.find(d => d.id === id) ?? null : null;
}
/** Presentation-only picker gate: server must independently verify the author rank on writes. */
export function availableWallPostDesigns(rankName?: string | null): readonly WallPostDesign[] {
  if(hasOfficialCosmeticAccess(rankName))return WALL_POST_DESIGNS;
  const rank = getBuklodCircleRankArt(rankName);
  return rank ? WALL_POST_DESIGNS.filter(d => d.minRankOrder <= rank.order) : [];
}
export function canSelectWallPostDesign(id: unknown, rankName?: string | null): boolean {
  if (id === null || id === 'none') return true;
  return availableWallPostDesigns(rankName).some(d => d.id === id);
}
/** Media and older posts always fall back to the regular caption. Readers need no rank privilege. */
export function visibleWallPostDesign(id: unknown, hasMedia: boolean): WallPostDesign | null {
  return hasMedia ? null : resolveWallPostDesign(id);
}

/** Separate typography/animation capabilities: existing post readers are never gated. */
export const WALL_FONT_PRESETS = [
  {id:'standard',label:'Standard',minRankOrder:1},
  {id:'bold',label:'Clean bold',minRankOrder:2},
  {id:'serif',label:'Elegant serif',minRankOrder:8},
  {id:'editorial',label:'Framed editorial',minRankOrder:18},
  {id:'royal',label:'Royal lettering',minRankOrder:28},
  {id:'cosmic',label:'Cosmic title',minRankOrder:33},
  {id:'divine',label:'Divine lettering',minRankOrder:38},
] as const;
export type WallFontId = typeof WALL_FONT_PRESETS[number]['id'];
export function wallFontForViewer(id:unknown): WallFontId {
  return WALL_FONT_PRESETS.find(f=>f.id===id)?.id ?? 'standard';
}
export function canSelectWallFont(id:unknown,rankName?:string|null):boolean {
  const font=WALL_FONT_PRESETS.find(f=>f.id===id);
  const rank=getBuklodCircleRankArt(rankName);
  return !!font && (hasOfficialCosmeticAccess(rankName)|| (!!rank && rank.order>=font.minRankOrder));
}
export function wallDesignMotionAllowed(design:WallPostDesign,rankName?:string|null):boolean {
  const rank=getBuklodCircleRankArt(rankName);
  return hasOfficialCosmeticAccess(rankName)|| (!!rank && rank.order>=Math.max(design.minRankOrder,design.minFamilyIndex*5+2));
}
