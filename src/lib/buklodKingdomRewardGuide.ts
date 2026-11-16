/** Existing BUKLOD character collectible reward guide.
 * Copy describes only current account-bound actions, not future exchange rights.
 */
export type KingdomRelicKind = 'expression' | 'speech' | 'profile_frame' | 'visual_effect' | 'title_badge';
export type KingdomRelicGuide = Readonly<{
  name: string;
  where: string;
  benefit: string;
  tradeRule: 'BOUND';
}>;

export const KINGDOM_RELIC_GUIDE: Readonly<Record<KingdomRelicKind, KingdomRelicGuide>> = {
  expression: { name: 'Character Expression', where: 'Character showcase', benefit: 'Equip an expression collectible on this character.', tradeRule: 'BOUND' },
  speech: { name: 'Character Dialogue', where: 'Character showcase', benefit: 'Equip a character dialogue collectible.', tradeRule: 'BOUND' },
  profile_frame: { name: 'Profile Frame', where: 'Character / profile presentation', benefit: 'Equip a character-owned profile-frame collectible.', tradeRule: 'BOUND' },
  visual_effect: { name: 'Visual Effect', where: 'Kingdom character showcase', benefit: 'Equip a character visual-effect collectible.', tradeRule: 'BOUND' },
  title_badge: { name: 'Title Badge', where: 'Legacy collection / character showcase', benefit: 'Equip an earned title-badge collectible.', tradeRule: 'BOUND' },
};

export const KINGDOM_RELIC_KIND_BY_INDEX: readonly KingdomRelicKind[] = [
  'expression', 'speech', 'profile_frame', 'visual_effect', 'title_badge',
] as const;

export function getKingdomRelicGuide(kind: KingdomRelicKind | null | undefined, itemIndex: number): KingdomRelicGuide {
  const key = kind ?? KINGDOM_RELIC_KIND_BY_INDEX[itemIndex - 1];
  if (!key || !Object.hasOwn(KINGDOM_RELIC_GUIDE, key)) {
    throw new Error('Unknown relic type');
  }
  return KINGDOM_RELIC_GUIDE[key];
}

export function characterRelicRequirement(input: {
  requiredLevel: number;
  currentLevel: number;
  characterName: string;
  serverVerifiedActive: boolean | null;
}): string {
  const { requiredLevel, currentLevel, characterName, serverVerifiedActive } = input;
  if (!Number.isInteger(requiredLevel) || requiredLevel < 1 || requiredLevel > 20) {
    throw new Error('Invalid relic level');
  }
  if (serverVerifiedActive === null) return 'Checking verified character eligibility';
  if (!serverVerifiedActive) return 'Switch to ' + characterName + ' to claim or equip';
  if (currentLevel < requiredLevel) {
    return 'Reach ' + characterName + ' Level ' + requiredLevel +
      ' • ' + (requiredLevel - currentLevel) + ' levels remaining';
  }
  return characterName + ' Level ' + requiredLevel + ' reached • eligible to claim';
}

/** Trade policy for current legacy collectibles and account-bound achievements. */
export function legacyItemTransferPolicy(): 'NOT_TRADABLE' { return 'NOT_TRADABLE'; }

/** Planned trades may ONLY use separately minted, server-confirmed duplicate cosmetics. */
export function canOfferCosmeticTrade(input: {
  category: 'earned_badge' | 'character_story_item' | 'kingdom_power' | 'cosmetic_duplicate';
  verifiedQuantity: number;
  equippedQuantity: number;
  tradeFeatureEnabled: boolean;
  accountVerified: boolean;
}): boolean {
  if (!input.tradeFeatureEnabled || !input.accountVerified ||
      input.category !== 'cosmetic_duplicate') return false;
  return Number.isSafeInteger(input.verifiedQuantity) &&
    Number.isSafeInteger(input.equippedQuantity) &&
    input.equippedQuantity >= 0 &&
    input.verifiedQuantity - input.equippedQuantity >= 2;
}
