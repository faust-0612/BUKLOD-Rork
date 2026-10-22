import type { BodyId, CatalogItem, Equipment, SlotId } from './types';
import { getItem } from './catalog';

export type HairSilhouette =
  | 'knot'
  | 'braid'
  | 'waves'
  | 'crest'
  | 'crop'
  | 'sweep'
  | 'locs'
  | 'warden';

const SLOT_GLYPH: Record<SlotId, string> = {
  base: 'account-outline',
  face: 'emoticon-happy-outline',
  hair: 'content-cut',
  top: 'tshirt-crew-outline',
  bottom: 'human-male-height-variant',
  shoes: 'shoe-formal',
  accessory: 'bag-personal-outline',
  badge: 'medal-outline',
  special: 'shimmer',
  background: 'image-outline',
};

const ITEM_GLYPH: Record<string, string> = {
  base_female: 'human-female',
  base_male: 'human-male',
  face_natural: 'emoticon-happy-outline',
  face_marks: 'flower-outline',
  face_sigil: 'star-four-points',
  f_hair_knot: 'hair-dryer',
  f_hair_braid: 'content-cut',
  f_hair_waves: 'waves',
  f_hair_crest: 'crown-outline',
  m_hair_crop: 'content-cut',
  m_hair_sweep: 'weather-windy',
  m_hair_locs: 'link-variant',
  m_hair_warden: 'horse-variant',
  top_warrior: 'tshirt-crew-outline',
  top_tunic: 'tshirt-crew',
  top_jacket: 'hanger',
  top_mantle: 'tshirt-v',
  top_regalia: 'shield-star-outline',
  bottom_warrior: 'human-male-height-variant',
  bottom_wrap: 'unfold-more-horizontal',
  bottom_long: 'human-female',
  bottom_greaves: 'shield-outline',
  shoes_warrior: 'foot-print',
  shoes_sandals: 'shoe-formal',
  shoes_boots: 'shoe-sneaker',
  shoes_gilded: 'shoe-cleat',
  acc_none: 'close-circle-outline',
  acc_satchel: 'bag-personal-outline',
  acc_stole: 'tie',
  acc_lenses: 'glasses',
  acc_bracer: 'arm-flex-outline',
  badge_none: 'close-circle-outline',
  badge_seed: 'sprout-outline',
  badge_hands: 'handshake-outline',
  badge_crown: 'crown-outline',
  fx_none: 'close-circle-outline',
  fx_aura: 'shimmer',
  fx_ascend: 'weather-night',
  bg_covenant: 'image-filter-hdr',
  bg_verdant: 'pine-tree',
  bg_skyward: 'castle',
};

export function catalogItemGlyph(item: CatalogItem): string {
  return ITEM_GLYPH[item.id] ?? SLOT_GLYPH[item.slot];
}

export function hairSilhouette(itemId: string | null, body: BodyId): HairSilhouette {
  switch (itemId) {
    case 'f_hair_braid':
      return 'braid';
    case 'f_hair_waves':
      return 'waves';
    case 'f_hair_crest':
      return 'crest';
    case 'm_hair_sweep':
      return 'sweep';
    case 'm_hair_locs':
      return 'locs';
    case 'm_hair_warden':
      return 'warden';
    case 'm_hair_crop':
      return 'crop';
    case 'f_hair_knot':
      return 'knot';
    default:
      return body === 'female' ? 'knot' : 'crop';
  }
}

export function equippedLook(equipment: Equipment, body: BodyId) {
  const base = getItem(equipment.base);
  const face = getItem(equipment.face);
  const hair = getItem(equipment.hair);
  const top = getItem(equipment.top);
  const bottom = getItem(equipment.bottom);
  const shoes = getItem(equipment.shoes);
  const accessory = getItem(equipment.accessory);
  const badge = getItem(equipment.badge);
  const special = getItem(equipment.special);
  const background = getItem(equipment.background);

  return {
    body,
    skin: body === 'female'
      ? { fill: '#E7C19C', shade: '#C48A62', line: '#8C5A3A' }
      : { fill: '#D6AE84', shade: '#B07F55', line: '#7A4F32' },
    baseSwatch: base?.swatch ?? (['#3A4A44', '#8AA398'] as const),
    faceId: face?.id ?? 'face_natural',
    hairId: hair?.id ?? (body === 'female' ? 'f_hair_knot' : 'm_hair_crop'),
    hairStyle: hairSilhouette(hair?.id ?? null, body),
    hairColor: hair?.swatch?.[1] ?? '#3A4A44',
    hairShade: hair?.swatch?.[0] ?? '#2A3531',
    topId: top?.id ?? 'top_warrior',
    topColor: top?.swatch ?? (['#3A4A44', '#8AA398'] as const),
    bottomId: bottom?.id ?? 'bottom_warrior',
    bottomColor: bottom?.swatch ?? (['#3A4A44', '#8AA398'] as const),
    shoesId: shoes?.id ?? 'shoes_warrior',
    shoesColor: shoes?.swatch ?? (['#3A4A44', '#8AA398'] as const),
    accessoryId: accessory?.id ?? 'acc_none',
    accessoryColor: accessory?.swatch?.[1] ?? '#EBDCC0',
    badgeId: badge?.id ?? 'badge_none',
    badgeGlyph: badge ? catalogItemGlyph(badge) : 'medal-outline',
    badgeColor: badge?.swatch?.[1] ?? '#4FBF6B',
    effect: special?.effect ?? 'none',
    effectColor: special?.swatch?.[1] ?? '#4FBF6B',
    stageSwatch: background?.swatch ?? (['#C8901F', '#F0B429'] as const),
    stageName: background?.name ?? 'Covenant Plaza',
  };
}
