/**
 * BUKLOD Character Lab — core domain types.
 *
 * This module is deliberately framework-free: no React, no React Native, no DOM.
 * The exact same files are consumed by the web mirror and by the Expo port, so
 * nothing here may import a renderer.
 */

/** Wardrobe slots, in the order they are composited (see LAYER_ORDER). */
export type SlotId =
  | 'background'
  | 'base'
  | 'bottom'
  | 'shoes'
  | 'top'
  | 'face'
  | 'hair'
  | 'accessory'
  | 'badge'
  | 'special';

/** Selectable base bodies. */
export type BodyId = 'female' | 'male';

/** Filter groups used by MY COLLECTION. */
export type CollectionGroup =
  | 'clothing'
  | 'accessories'
  | 'badges'
  | 'backgrounds'
  | 'special';

/**
 * Visual state of a single wardrobe item for the current progression context.
 * Every state is carried by text + icon in the UI, never by colour alone.
 */
export type ItemVisualState = 'equipped' | 'available' | 'newly_unlocked' | 'locked';

/** Reactions the character can play. Driven by events, never looped. */
export type ReactionId =
  | 'neutral'
  | 'happy'
  | 'proud'
  | 'thankful'
  | 'welcome'
  | 'celebrate'
  | 'new_item'
  | 'milestone';

/**
 * A code-driven visual effect attached to the SPECIAL slot. These are rendered
 * by the renderer (glow rings, orbiting stars) rather than by an image layer.
 */
export type SpecialEffectId = 'none' | 'aura' | 'ascend';

/** One customization item in the data-driven catalog. */
export interface CatalogItem {
  readonly id: string;
  readonly slot: SlotId;
  readonly name: string;
  /** Short, truthful flavour line shown in the collection detail sheet. */
  readonly blurb: string;
  /** Lifetime BUKLOD Points required. 0 = starter item, always unlocked. */
  readonly unlockAtLifetime: number;
  readonly group: CollectionGroup;
  /** Bodies this item is offered for. Omitted = offered for every body. */
  readonly bodies?: readonly BodyId[];
  /**
   * Asset manifest key per body for body-specific layers (garments, hair),
   * or a single `shared` key for body-agnostic layers (badges, face marks).
   */
  readonly asset?: Partial<Record<BodyId, string>> & { readonly shared?: string };
  /**
   * Layers flagged `head` ride with the head group, so they follow the idle
   * head movement instead of sliding against it (face marks, eyewear).
   */
  readonly attach?: 'head';
  /** SPECIAL slot only: which code-driven effect this item enables. */
  readonly effect?: SpecialEffectId;
  /** BACKGROUND slot only: which stage environment this item selects. */
  readonly stage?: string;
  /** Palette hint used for thumbnails and locked-state placeholders. */
  readonly swatch: readonly [string, string];
  /** Optional warrior rank 0 (Novice) .. 5 (Legend) for sort + UI badges. */
  readonly warriorRank?: number;
}

/** The currently equipped item id per slot. `null` = nothing equipped. */
export type Equipment = Record<SlotId, string | null>;

/** A progression tier derived purely from lifetime points. */
export interface Tier {
  readonly index: number;
  readonly name: string;
  readonly minLifetime: number;
  /** Short line describing what the tier represents in BUKLOD terms. */
  readonly meaning: string;
}

/** Progression snapshot. Lifetime is permanent; available is spendable. */
export interface ProgressionState {
  /** Permanent progression. Only this value gates unlocks. */
  readonly lifetimePoints: number;
  /** Spendable balance. May decrease; never affects unlocks. */
  readonly availablePoints: number;
}

/** An item resolved against a progression context, ready to render. */
export interface ResolvedItem {
  readonly item: CatalogItem;
  readonly state: ItemVisualState;
  readonly isUnlocked: boolean;
  /** Points still needed, 0 when unlocked. */
  readonly pointsRemaining: number;
  /** Pre-formatted requirement line, e.g. "Unlock at 500 Lifetime Points". */
  readonly requirementLabel: string;
}
