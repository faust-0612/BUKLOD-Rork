/* BUKLOD_CHARACTER_SELECTION_V2_WEB_RECOVERY */
/* BUKLOD_CHARACTER_SELECTION_V2_SERVER_CONTRACT_R2 */
import { supabase } from '@/lib/supabase';

export type BuklodCoreCharacterId =
  | 'phan'
  | 'quin'
  | 'van'
  | 'christian'
  | 'lhen';

export type BuklodSpecialCharacterId =
  | 'jawo'
  | 'trudice'
  | 'ace'
  | 'mitch'
  | 'niel'
  | 'angel'
  | 'vhen'
  | 'ellusur';

export type BuklodCharacterId =
  | BuklodCoreCharacterId
  | BuklodSpecialCharacterId;

export type BuklodCharacterSelectionV2State = {
  active_character_id: BuklodCharacterId;
  character_level: number;
  character_points_since_selection: number;
  baseline_lifetime_points: number;
  lifetime_points: number;
  circle_rank_order: number;
  circle_rank_name: string;
  visible_special_character_ids: BuklodSpecialCharacterId[];
  selection_model: string;
  special_gate_model: string;
};

type ServerSpecialState = {
  id?: unknown;
  character_id?: unknown;
  unlocked?: unknown;
  required_rank_order?: unknown;
};

type ServerSelectionState = {
  active_character_id?: unknown;
  active_character_lifetime_points_at_selection?: unknown;
  baseline_lifetime_points?: unknown;
  lifetime_points?: unknown;
  rank_order?: unknown;
  circle_rank_order?: unknown;
  rank_name?: unknown;
  circle_rank_name?: unknown;
  character_points_since_selection?: unknown;
  character_level?: unknown;
  next_character_level_points?: unknown;
  base_character_ids?: unknown;
  special_characters?: unknown;
  visible_special_character_ids?: unknown;
  selection_model?: unknown;
  special_gate_model?: unknown;
};

export const CORE_CHARACTER_ORDER: readonly BuklodCoreCharacterId[] = [
  'phan',
  'quin',
  'van',
  'christian',
  'lhen',
] as const;

/** Presentation / unlock order by accepted Circle Rank table. */
export const SPECIAL_CHARACTER_ORDER: readonly BuklodSpecialCharacterId[] = [
  'ace',
  'ellusur',
  'jawo',
  'mitch',
  'niel',
  'angel',
  'vhen',
  'trudice',
] as const;

export const SPECIAL_REQUIRED_RANK_ORDER: Record<
  BuklodSpecialCharacterId,
  number
> = {
  ace: 5,
  ellusur: 6,
  jawo: 7,
  mitch: 8,
  niel: 9,
  angel: 10,
  vhen: 11,
  trudice: 13,
};

export const CHARACTER_DISPLAY_NAME: Record<BuklodCharacterId, string> = {
  phan: 'Phan',
  quin: 'Quin',
  van: 'Van',
  christian: 'Christian',
  lhen: 'Lhen',
  jawo: 'Jawo',
  trudice: 'Trudice',
  ace: 'Ace',
  mitch: 'Mitch',
  niel: 'Niel',
  angel: 'Angel',
  vhen: 'Vhen',
  // Keep the persisted/server id stable while using the approved display name.
  ellusur: 'ELESUR',
};

const ALL_CHARACTER_IDS = new Set<string>([
  ...CORE_CHARACTER_ORDER,
  ...SPECIAL_CHARACTER_ORDER,
]);

const cache = new Map<string, BuklodCharacterSelectionV2State>();
const inflight = new Map<string, Promise<BuklodCharacterSelectionV2State>>();
const listeners = new Set<(
  userId: string,
  state: BuklodCharacterSelectionV2State,
) => void>();

/** Bumps on every publish so every visible Character surface remounts art. */
let selectionRevision = 0;

export type BuklodCharacterDisplayOverride = {
  character_id: BuklodCharacterId;
  character_level: number;
};

let displayOverride: BuklodCharacterDisplayOverride | null = null;
const displayListeners = new Set<(next: BuklodCharacterDisplayOverride | null) => void>();

export function getBuklodCharacterSelectionRevision() {
  return selectionRevision;
}

export function getBuklodCharacterDisplayOverride() {
  return displayOverride;
}

export function setBuklodCharacterDisplayOverride(
  next: BuklodCharacterDisplayOverride | null,
) {
  if (
    next &&
    (!ALL_CHARACTER_IDS.has(next.character_id) ||
      !Number.isFinite(next.character_level))
  ) {
    return;
  }

  displayOverride = next
    ? {
        character_id: next.character_id,
        character_level: Math.max(
          1,
          Math.min(20, Math.floor(Number(next.character_level) || 1)),
        ),
      }
    : null;
  selectionRevision += 1;
  displayListeners.forEach((listener) => listener(displayOverride));
  // Also nudge selection listeners so mounted art re-reads override + revision.
  cache.forEach((state, userId) => {
    listeners.forEach((listener) => listener(userId, state));
  });
}

export function subscribeBuklodCharacterDisplayOverride(
  listener: (next: BuklodCharacterDisplayOverride | null) => void,
) {
  displayListeners.add(listener);
  return () => displayListeners.delete(listener);
}

export function resolveBuklodCharacterDisplay(
  state: BuklodCharacterSelectionV2State | null | undefined,
): { character_id: BuklodCharacterId; character_level: number; revision: number } | null {
  if (displayOverride) {
    return {
      character_id: displayOverride.character_id,
      character_level: displayOverride.character_level,
      revision: selectionRevision,
    };
  }
  if (!state) return null;
  return {
    character_id: state.active_character_id,
    character_level: state.character_level,
    revision: selectionRevision,
  };
}

function toSpecialId(value: unknown): BuklodSpecialCharacterId | null {
  const id = String(value ?? '').toLowerCase();
  return SPECIAL_CHARACTER_ORDER.includes(id as BuklodSpecialCharacterId)
    ? (id as BuklodSpecialCharacterId)
    : null;
}

function normalizeVisibleSpecials(row: ServerSelectionState) {
  if (Array.isArray(row.visible_special_character_ids)) {
    return row.visible_special_character_ids
      .map(toSpecialId)
      .filter((id): id is BuklodSpecialCharacterId => Boolean(id));
  }

  if (!Array.isArray(row.special_characters)) {
    return [] as BuklodSpecialCharacterId[];
  }

  return (row.special_characters as ServerSpecialState[])
    .filter((item) => Boolean(item?.unlocked))
    .map((item) => toSpecialId(item?.id ?? item?.character_id))
    .filter((id): id is BuklodSpecialCharacterId => Boolean(id));
}

function normalizeState(value: unknown): BuklodCharacterSelectionV2State {
  const row = (value ?? {}) as ServerSelectionState;
  const rawId = String(row.active_character_id ?? 'phan').toLowerCase();
  const active = (
    ALL_CHARACTER_IDS.has(rawId) ? rawId : 'phan'
  ) as BuklodCharacterId;

  return {
    active_character_id: active,
    character_level: Math.max(
      1,
      Math.min(20, Number(row.character_level ?? 1) || 1),
    ),
    character_points_since_selection: Math.max(
      0,
      Number(row.character_points_since_selection ?? 0) || 0,
    ),
    baseline_lifetime_points: Math.max(
      0,
      Number(
        row.active_character_lifetime_points_at_selection ??
          row.baseline_lifetime_points ??
          0,
      ) || 0,
    ),
    lifetime_points: Math.max(0, Number(row.lifetime_points ?? 0) || 0),
    circle_rank_order: Math.max(
      1,
      Number(row.rank_order ?? row.circle_rank_order ?? 1) || 1,
    ),
    circle_rank_name: String(
      row.rank_name ?? row.circle_rank_name ?? 'Circle Starter V',
    ),
    visible_special_character_ids: normalizeVisibleSpecials(row),
    selection_model: String(
      row.selection_model ?? 'ATOMIC_RESET_LEVEL_1_V2',
    ),
    special_gate_model: String(
      row.special_gate_model ?? 'CANONICAL_CIRCLE_RANK_PLUS_2_STEPS',
    ),
  };
}

function publish(userId: string, state: BuklodCharacterSelectionV2State) {
  cache.set(userId, state);
  selectionRevision += 1;
  // Server selection is the live profile truth. Clear temporary customize previews.
  if (displayOverride) {
    displayOverride = null;
    displayListeners.forEach((listener) => listener(null));
  }
  listeners.forEach((listener) => listener(userId, state));
}

export function getCachedBuklodCharacterSelectionV2(
  userId?: string | null,
): BuklodCharacterSelectionV2State | null {
  if (!userId) return null;
  return cache.get(userId) ?? null;
}

// Local session validation does not add a network request for a valid session.
async function ensureCharacterSession(userId: string): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) {
    throw new Error('Character session unavailable. Please sign in again.');
  }
  let session = data.session;
  if (!session.expires_at || session.expires_at * 1000 <= Date.now() + 60000) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session || refreshed.data.session.user.id !== userId) {
      throw new Error('Unable to refresh Character session. Check your connection and retry.');
    }
    session = refreshed.data.session;
  }
  if (!session.access_token) throw new Error('Character session unavailable. Please sign in again.');
}

export async function getMyBuklodCharacterSelectionV2(
  userId?: string | null,
  force = false,
): Promise<BuklodCharacterSelectionV2State> {
  if (!userId) {
    throw new Error('Authentication required');
  }

  // A forced refresh bypasses cache, but joins an already running refresh.
  const pending = inflight.get(userId);
  if (pending) return pending;
  if (!force) {
    const cached = cache.get(userId);
    if (cached) return cached;
  }

  const request = (async () => {
    await ensureCharacterSession(userId);
    const { data, error } = await (supabase as any).rpc(
      'get_my_buklod_character_selection_v2',
    );

    if (error) {
      throw new Error(
        error.message || 'Unable to load BUKLOD Character selection.',
      );
    }

    const state = normalizeState(data);
    publish(userId, state);
    return state;
  })();

  inflight.set(userId, request);
  try {
    return await request;
  } finally {
    inflight.delete(userId);
  }
}

export async function setMyBuklodCharacterActiveV2(
  userId: string | null | undefined,
  characterId: BuklodCharacterId,
): Promise<BuklodCharacterSelectionV2State> {
  if (!userId) {
    throw new Error('Authentication required');
  }

  await ensureCharacterSession(userId);
  const { data, error } = await (supabase as any).rpc(
    'set_my_buklod_character_active_v2',
    { p_character_id: characterId },
  );

  if (error) {
    throw new Error(error.message || 'Unable to change BUKLOD Character.');
  }

  const state = normalizeState(data);
  publish(userId, state);
  return state;
}

export function subscribeBuklodCharacterSelectionV2(
  listener: (
    userId: string,
    state: BuklodCharacterSelectionV2State,
  ) => void,
) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

