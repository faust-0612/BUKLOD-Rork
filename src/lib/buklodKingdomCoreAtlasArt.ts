/** Owner-supplied Library artwork, preprocessed into compact, deterministic 3x2 sheets.
 * One sheet per class, six items per sheet. Never used as entitlement proof.
 */
import type { ImageSourcePropType } from 'react-native';
export const CORE_ATLAS_ART: Readonly<Record<string,ImageSourcePropType>> = {
  'weapons':require('../../assets/images/kingdom-item-atlas/weapons.webp'),
  'relic':require('../../assets/images/kingdom-item-atlas/relic.webp'),
  'treasure':require('../../assets/images/kingdom-item-atlas/treasure.webp'),
  'resource':require('../../assets/images/kingdom-item-atlas/resource.webp'),
  'consumable':require('../../assets/images/kingdom-item-atlas/consumable.webp'),
  'utility':require('../../assets/images/kingdom-item-atlas/utility.webp'),
  'collection':require('../../assets/images/kingdom-item-atlas/collection.webp'),
  'emblem':require('../../assets/images/kingdom-item-atlas/emblem.webp'),
  'armor':require('../../assets/images/kingdom-item-atlas/armor.webp'),
  'accessory':require('../../assets/images/kingdom-item-atlas/accessory.webp'),
  'character-evolution':require('../../assets/images/kingdom-item-atlas/character-evolution.webp'),
  'companion':require('../../assets/images/kingdom-item-atlas/companion.webp'),
  'skill':require('../../assets/images/kingdom-item-atlas/skill.webp'),
  'crafting':require('../../assets/images/kingdom-item-atlas/crafting.webp'),
  'kingdom-building':require('../../assets/images/kingdom-item-atlas/kingdom-building.webp'),
  'exploration':require('../../assets/images/kingdom-item-atlas/exploration.webp'),
  'quest':require('../../assets/images/kingdom-item-atlas/quest.webp'),
  'season':require('../../assets/images/kingdom-item-atlas/season.webp'),
  'prestige':require('../../assets/images/kingdom-item-atlas/prestige.webp'),
  'profile-cosmetics':require('../../assets/images/kingdom-item-atlas/profile-cosmetics.webp'),
};
export const CORE_ATLAS_CELL = {width:176,height:150,columns:3,rows:2} as const;
