/**
 * BUKLOD Season 2: read-only progression and cross-world design contract.
 * IMPORTANT: This module can quote requirements and preview cosmetic links.
 * It CANNOT credit BP, Diamonds, Shards, materials, land, inventory or PvP rank.
 * Only separate authenticated backend transactions, based on VERIFIED events,
 * may mint or consume ledger-backed entitlements. This file is safe offline.
 */
export const GENESIS_WORLDS = Object.freeze(['kingdom', 'arena', 'house']);
export const MAJOR_DEVELOPMENT_LEVELS = 10;
export const BUILD_STAGES_PER_LEVEL = 5;

const isMastery = value => Number.isSafeInteger(value) && value >= 1;
const toSafe = n => Number.isSafeInteger(n) && n >= 0 ? n : null;

/**
 * Design estimate, NOT a new reward authority. Kingdom progression is not
 * the existing one-time Mastery Check (+2 BP once per qualifying game).
 * This model grants ZERO BP by itself, at every Mastery and on every replay.
 */
export function quoteKingdomMastery(mastery) {
  if (!isMastery(mastery)) throw new RangeError('Mastery must be a positive safe integer');
  const root = Math.sqrt(mastery);
  const requiredXp = toSafe(Math.round(400 + 50 * mastery + 100 * root));
  const challengeXp = toSafe(Math.round(50 + 3 * mastery + 20 * root));
  const completionScore = toSafe(Math.round(100 + 60 * Math.log2(mastery + 1)));
  if (requiredXp === null || challengeXp === null || completionScore === null) {
    // Do not manufacture incorrect large integer economy quotes on JS clients.
    return Object.freeze({ mastery, authority:'estimate_only', precisionLimited:true,
      requiredXp:null, challengeXp:null, completionScore:null,
      expectedChallenges:null, mechanicsComplexity:null, bpGranted:0 });
  }
  return Object.freeze({
    mastery, authority:'estimate_only', precisionLimited:false,
    requiredXp, challengeXp, completionScore,
    expectedChallenges:Math.ceil(requiredXp / challengeXp),
    // Complexity eventually plateaus; layouts, constraints and team tactics rotate.
    mechanicsComplexity:Math.min(9, 2 + Math.floor(Math.log2(mastery + 1) / 2)),
    bpGranted:0,
  });
}

/** Estate advancement already belongs to constructionPlan + verified estate RPC.
 * We do NOT duplicate the estate cost or issue House XP here. */
export function houseProgressionPolicy() {
  return Object.freeze({ majorLevels:MAJOR_DEVELOPMENT_LEVELS,
    stagesPerLevel:BUILD_STAGES_PER_LEVEL, mastery:'unbounded',
    rewardAuthority:'verified_estate_rpc', scoreAuthority:'estate_development_xp',
    existingPlan:'constructionPlan.mjs', noArenaParticipationRequired:true,
  });
}

/** Preview-only cosmetic bridges; stable names are not actual owned items.
 * Each event MUST be independently verified by the backend before any grant.
 * Event replay must be idempotently constrained per user+event+unlock in SQL.
 */
const COSMETIC_LINKS = Object.freeze({
  'kingdom.mastery.25':Object.freeze([
    Object.freeze({destination:'house',cosmetic:'artisan_pergola_blueprint'}),
    Object.freeze({destination:'arena',cosmetic:'verdant_lobby_banner'}),
  ]),
  'kingdom.mastery.100':Object.freeze([
    Object.freeze({destination:'house',cosmetic:'mastery_fountain_blueprint'}),
    Object.freeze({destination:'arena',cosmetic:'kingdom_veteran_emblem'}),
  ]),
  'house.mastery.10':Object.freeze([
    Object.freeze({destination:'kingdom',cosmetic:'homestead_village_arch'}),
    Object.freeze({destination:'arena',cosmetic:'homecoming_lobby_banner'}),
  ]),
  'arena.ranked.first_win':Object.freeze([
    Object.freeze({destination:'kingdom',cosmetic:'arena_honor_stand'}),
    Object.freeze({destination:'house',cosmetic:'first_victory_trophy_shelf'}),
  ]),
});

const EMPTY_LINKS = Object.freeze([]);
/** Returns NON-SPENDABLE design candidates, not grantable inventory. */
export function previewCrossWorldCosmetics(canonicalVerifiedEventName) {
  if (typeof canonicalVerifiedEventName !== 'string') return EMPTY_LINKS;
  return Object.prototype.hasOwnProperty.call(COSMETIC_LINKS, canonicalVerifiedEventName)
    ? COSMETIC_LINKS[canonicalVerifiedEventName] : EMPTY_LINKS;
}

/** Client never changes PvP stats based on House, Kingdom, BP or crafting.
 * Final arena balance, matchmaking and escrow remain on the Arena authority. */
export function rankedArenaWorldBonus() { return 0; }

export const CROSS_WORLD_RULES = Object.freeze({
  entryGates:Object.freeze({kingdom:'normal_session',arena:'normal_session',house:'normal_session'}),
  permanentCosmeticUnlockAuthority:'verified_server_event_and_atomic_receipt',
  sourceOwnership:'character_system',
  rankingAuthority:'arena_ranked_server',
  houseAuthority:'estate_server',
  bpFromWorldTravel:0,
  bpFromMasteryLevel:0,
  rankedStatBonusFromOutsideArena:0,
  practiceLootIsTradable:false,
  clientMayGrantRewards:false,
  purchasesCreateLifetimeBp:false,
});
