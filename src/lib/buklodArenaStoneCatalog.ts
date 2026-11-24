// Generated from canonical Unity stone identity, missions and the 39-game mastery catalog.
export const ARENA_STONES = [
  {
    "heroId": "phan",
    "displayName": "Phan",
    "stone": "Jasper",
    "color": "#B64C39",
    "mission": "Builder's Legacy",
    "kingdomLocation": "Ancient Ruins",
    "games": [
      "phan-enterprise-builder",
      "phan-trade-master",
      "phan-market-match"
    ]
  },
  {
    "heroId": "quin",
    "displayName": "Quin",
    "stone": "Sapphire",
    "color": "#245BCC",
    "mission": "Seeker of Truth",
    "kingdomLocation": "Lost Temples",
    "games": [
      "quin-discovery-expedition",
      "quin-guessing-quest",
      "quin-code-breaker"
    ]
  },
  {
    "heroId": "van",
    "displayName": "Van",
    "stone": "Agate",
    "color": "#C69B69",
    "mission": "Guardian's Bond",
    "kingdomLocation": "Guardian Villages",
    "games": [
      "van-living-city-dispatch",
      "van-sudoku-master",
      "van-mind-challenge"
    ]
  },
  {
    "heroId": "christian",
    "displayName": "Christian",
    "stone": "Emerald",
    "color": "#149653",
    "mission": "Leader's Triumph",
    "kingdomLocation": "Frontier Strongholds",
    "games": [
      "christian-civic-leadership",
      "christian-bible-crown",
      "christian-scripture-word-search"
    ]
  },
  {
    "heroId": "lhen",
    "displayName": "Lhen",
    "stone": "Onyx",
    "color": "#44444D",
    "mission": "Harmony of Souls",
    "kingdomLocation": "Harmony Chambers",
    "games": [
      "lhen-rhythm-journey",
      "lhen-melody-memory",
      "lhen-beat-composer"
    ]
  },
  {
    "heroId": "ace",
    "displayName": "Ace",
    "stone": "Carnelian",
    "color": "#E45229",
    "mission": "Healer's Courage",
    "kingdomLocation": "Healing Outposts",
    "games": [
      "ace-rescue-grid",
      "ace-chess-master",
      "ace-tower-tactics"
    ]
  },
  {
    "heroId": "ellusur",
    "displayName": "ELESUR",
    "stone": "Chrysolite",
    "color": "#A3BC40",
    "mission": "Beacon of Wisdom",
    "kingdomLocation": "Wisdom Sanctuaries",
    "games": [
      "elesur-village-builder",
      "elesur-domino-village",
      "elesur-bridge-puzzle"
    ]
  },
  {
    "heroId": "jawo",
    "displayName": "Jawo",
    "stone": "Beryl",
    "color": "#5DC4AE",
    "mission": "Nature's Symphony",
    "kingdomLocation": "Enchanted Forests",
    "games": [
      "jawo-forest-trail",
      "jawo-trail-maze",
      "jawo-nature-match"
    ]
  },
  {
    "heroId": "mitch",
    "displayName": "Mitch",
    "stone": "Topaz",
    "color": "#E7B339",
    "mission": "Creator's Masterpiece",
    "kingdomLocation": "Artisan Workshops",
    "games": [
      "mitch-restore-mural",
      "mitch-block-forge",
      "mitch-color-merge"
    ]
  },
  {
    "heroId": "niel",
    "displayName": "Niel",
    "stone": "Chrysoprase",
    "color": "#70C675",
    "mission": "Voice of Conviction",
    "kingdomLocation": "Trials of Conviction",
    "games": [
      "niel-mission-trail",
      "niel-expedition-puzzle",
      "niel-word-explorer"
    ]
  },
  {
    "heroId": "angel",
    "displayName": "Angel",
    "stone": "Jacinth",
    "color": "#C64A25",
    "mission": "Keeper of Balance",
    "kingdomLocation": "Treasury Vaults",
    "games": [
      "angel-kingdom-treasury",
      "angel-number-vault",
      "angel-treasure-merge"
    ]
  },
  {
    "heroId": "vhen",
    "displayName": "Vhen",
    "stone": "Amethyst",
    "color": "#8850C7",
    "mission": "Seeds of Tomorrow",
    "kingdomLocation": "Cultivation Gardens",
    "games": [
      "vhen-farm-to-market",
      "vhen-harvest-match",
      "vhen-farm-merge"
    ]
  },
  {
    "heroId": "trudice",
    "displayName": "Trudice",
    "stone": "Diamond",
    "color": "#B5D8EA",
    "mission": "Light of Knowledge",
    "kingdomLocation": "Knowledge Towers",
    "games": [
      "trudice-playground-memory",
      "trudice-picture-pairs",
      "trudice-word-garden"
    ]
  }
] as const;
export type ArenaStoneId = typeof ARENA_STONES[number]['heroId'];
export const ARENA_STONE_IDS = new Set<string>(ARENA_STONES.map(s=>s.heroId));
export function stoneRecipe(heroId: string): ArenaStoneId[] {
 const i=ARENA_STONES.findIndex(s=>s.heroId===heroId);
 return i<0?[]:[ARENA_STONES[(i+12)%13].heroId,ARENA_STONES[(i+1)%13].heroId];
}
