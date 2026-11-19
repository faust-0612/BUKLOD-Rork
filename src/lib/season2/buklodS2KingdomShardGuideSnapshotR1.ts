/**
 * Immutable Kingdom Shard reference snapshot copied from the existing
 * buklodKingdomShards.ts catalog at 2026-11-19.
 * Pure values only: importing this guide cannot load Supabase or AsyncStorage,
 * purchase, redeem, alter inventory, or mix Shards with Season 2 Tokens.
 * Focused tests MUST compare this with the canonical module on each change.
 */
export const S2_KINGDOM_SHARD_GUIDE_SNAPSHOT='2026-11-19' as const;
export const S2_KINGDOM_SHARD_REFERENCE=Object.freeze([
 {key:'wisdom_lens',name:'Wisdom Lens',description:'See one practice answer hint when you need help.',price:2},
 {key:'guardian_shield',name:'Guardian Shield',description:'Protect correct answers when retrying a practice challenge.',price:3},
 {key:'explorer_compass',name:'Explorer Compass',description:'Rule out two wrong answers per practice question.',price:2},
 {key:'aura_emerald',name:'Emerald Aura',description:'Permanently illuminate your practice hero card.',price:10},
] as const);
export const S2_KINGDOM_SHARD_EARNING_SOURCES=Object.freeze([
 {id:'first_verified_game_mastery',shards:1,limit:'ONCE_PER_GAME_ID',
  criteria:'Only when a credited Kingdom mastery attempt has a matching official +2 BP game_first_qualified immutable ledger entry; client score alone is NOT evidence.'},
 {id:'redeemed_canonical_character_collectible',shards:2,limit:'ONCE_PER_COLLECTIBLE_ID',
  criteria:'Only if the canonical public.buklod_character_collectible_state record belongs to this user and has non-null redeemed_at.'},
] as const);
export const S2_KINGDOM_SHARD_EARNING_AUDIT='Verified source SQL function private.buklod_kingdom_sync_shards_v1(uuid) exists in inspected BUKLOD MAIN 2026-11-19. Per-user entitlement is independently validated.' as const;
export const S2_KINGDOM_SHARD_GUIDE_STATUS='CANONICAL_CATALOG_SNAPSHOT_SERVER_REQUIRED' as const;
