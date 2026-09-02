import {
  assetKeyFor,
  CATALOG,
  LAYER_ORDER,
} from '@/lib/character-lab-core/catalog';
import { LAYER_PLACEMENTS, placementFor } from '@/lib/character-lab-core/assets';
import type { BodyId, SlotId } from '@/lib/character-lab-core/types';

/** How cleanly a catalog item layers on the calibrated body frame. */
export type LayerCompatibility =
  | 'COMPATIBLE_LAYER'
  | 'PRESET_ONLY'
  | 'INCOMPATIBLE';

/** Production manifest entry for positioning Rork wardrobe assets. */
export type CharacterManifestEntry = {
  id: string;
  name: string;
  category: SlotId;
  asset: string | null;
  compatibleBase: readonly BodyId[] | 'both';
  compatibility: LayerCompatibility;
  anchorX: number;
  anchorY: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  zIndex: number;
  lifetimePointsRequired: number;
  enabled: boolean;
  maleTransform?: Partial<{
    scale: number;
    offsetX: number;
    offsetY: number;
    anchorX: number;
    anchorY: number;
  }>;
  femaleTransform?: Partial<{
    scale: number;
    offsetX: number;
    offsetY: number;
    anchorX: number;
    anchorY: number;
  }>;
};

const SLOT_Z: Record<SlotId, number> = {
  background: 0,
  base: 10,
  bottom: 20,
  shoes: 30,
  top: 40,
  face: 50,
  hair: 60,
  accessory: 70,
  badge: 80,
  special: 90,
};

function layerZIndex(slot: SlotId): number {
  const base = SLOT_Z[slot];
  const order = LAYER_ORDER.indexOf(slot);
  return order >= 0 ? base + order : base;
}

/** Audit placement metadata for layering quality. */
function assessCompatibility(
  assetKey: string | null,
  slot: SlotId
): LayerCompatibility {
  if (!assetKey) {
    if (slot === 'background' || slot === 'special' || slot === 'badge') {
      return 'COMPATIBLE_LAYER';
    }
    return 'PRESET_ONLY';
  }

  const placement = LAYER_PLACEMENTS[assetKey];
  if (!placement) return 'PRESET_ONLY';

  if (assetKey.startsWith('shoes_')) {
    if (placement.left < 0 || placement.width > 100) {
      return 'PRESET_ONLY';
    }
    if (assetKey === 'shoes_m_gilded') {
      return 'PRESET_ONLY';
    }
  }

  if (placement.top + placement.height > 102) {
    return 'PRESET_ONLY';
  }

  if (placement.left < -2 || placement.left + placement.width > 102) {
    return 'PRESET_ONLY';
  }

  return 'COMPATIBLE_LAYER';
}

/** Data-driven manifest derived from the portable Rork catalog + atlas placements. */
export const CHARACTER_MANIFEST: CharacterManifestEntry[] = CATALOG.map(
  (item) => {
    const femaleKey = assetKeyFor(item, 'female');
    const maleKey = assetKeyFor(item, 'male');
    const sharedKey = item.asset?.shared ?? null;
    const assetKey = femaleKey ?? maleKey ?? sharedKey;
    const placement = assetKey ? placementFor(assetKey) : null;
    const compatibility = assessCompatibility(assetKey, item.slot);

    const entry: CharacterManifestEntry = {
      id: item.id,
      name: item.name,
      category: item.slot,
      asset: assetKey,
      compatibleBase: item.bodies ?? 'both',
      compatibility,
      anchorX: placement
        ? placement.left + placement.width / 2
        : 50,
      anchorY: placement
        ? placement.top + placement.height / 2
        : 50,
      offsetX: placement?.left ?? 0,
      offsetY: placement?.top ?? 0,
      scale: placement ? placement.width / 100 : 1,
      zIndex: layerZIndex(item.slot),
      lifetimePointsRequired: item.unlockAtLifetime,
      enabled: compatibility !== 'INCOMPATIBLE',
    };

    if (item.id === 'shoes_sandals') {
      entry.femaleTransform = {
        scale: 1,
        offsetX: -0.6,
        offsetY: 0,
        anchorX: 50,
        anchorY: 100,
      };
      entry.maleTransform = {
        scale: 1,
        offsetX: -1.2,
        offsetY: 0,
        anchorX: 50,
        anchorY: 100,
      };
    }
    if (item.id === 'shoes_boots') {
      entry.femaleTransform = {
        scale: 0.98,
        offsetX: 0,
        offsetY: 0,
        anchorX: 50,
        anchorY: 100,
      };
      entry.maleTransform = {
        scale: 0.98,
        offsetX: 2.3,
        offsetY: 0,
        anchorX: 50,
        anchorY: 100,
      };
    }
    if (item.id === 'shoes_gilded') {
      entry.femaleTransform = {
        scale: 0.98,
        offsetX: 0,
        offsetY: 0,
        anchorX: 50,
        anchorY: 100,
      };
      entry.maleTransform = {
        scale: 0.97,
        offsetX: 0,
        offsetY: 0,
        anchorX: 50,
        anchorY: 100,
      };
    }

    return entry;
  }
);

export function manifestForItem(
  itemId: string
): CharacterManifestEntry | null {
  return CHARACTER_MANIFEST.find((row) => row.id === itemId) ?? null;
}

export function manifestForAssetKey(
  assetKey: string
): CharacterManifestEntry | null {
  return (
    CHARACTER_MANIFEST.find((row) => row.asset === assetKey) ?? null
  );
}

/** Compatibility summary for QA / device verification. */
export const ASSET_COMPATIBILITY_TABLE: readonly {
  id: string;
  assetKey: string | null;
  compatibility: LayerCompatibility;
  note?: string;
}[] = CHARACTER_MANIFEST.map((row) => ({
  id: row.id,
  assetKey: row.asset,
  compatibility: row.compatibility,
  note:
    row.compatibility === 'PRESET_ONLY'
      ? row.category === 'shoes'
        ? 'Needs footBaseline anchor or dev calibration'
        : 'Shared/stage asset — not a body layer'
      : undefined,
}));
