/* BUKLOD_CHARACTER_ENVIRONMENT_SYSTEM_PHASE1 */
import { supabase } from '@/lib/supabase';

export type BuklodWorldCharacterId =
  | 'phan' | 'quin' | 'van' | 'christian' | 'lhen'
  | 'jawo' | 'trudice' | 'ace' | 'mitch' | 'niel' | 'angel' | 'vhen' | 'elesur';

export type BuklodWorldDisplayMode = 'FULL' | 'MINIMAL';

export type BuklodWorldCharacter = {
  character_id: BuklodWorldCharacterId;
  display_name: string;
  character_kind: 'CORE' | 'SPECIAL';
  unlock_slot?: number;
  required_rank_order?: number;
  unlocked_at?: string | null;
  environment_key?: string;
  environment_name?: string;
  environment_tags?: string[];
  active?: boolean;
};

export type BuklodWorldEnvironmentStage = {
  key?: 'STARTER' | 'GROWING' | 'IDENTITY' | 'IMPACT' | 'LEGACY' | string;
  title?: string;
  min_level?: number;
  max_level?: number;
  description?: string;
};

export type BuklodWorldState = {
  initialized: boolean;
  starter_choices?: BuklodWorldCharacter[];
  starter_character_id?: BuklodWorldCharacterId;
  active_character_id?: BuklodWorldCharacterId;
  active_character_name?: string;
  character_level?: number;
  character_points_since_selection?: number;
  baseline_lifetime_points?: number;
  lifetime_points: number;
  circle_rank_order: number;
  circle_rank_name: string;
  display_mode?: BuklodWorldDisplayMode;
  environment?: {
    signature_key?: string;
    signature_name?: string;
    tags?: string[];
    stage?: BuklodWorldEnvironmentStage;
  };
  unlocked_characters?: BuklodWorldCharacter[];
  next_unlock?: {
    revealed: boolean;
    can_unlock: boolean;
    character_id: BuklodWorldCharacterId | null;
    display_name: string;
    character_kind: 'CORE' | 'SPECIAL';
    unlock_slot: number;
    required_rank_order: number;
  } | null;
  unlock_model?: string;
  selection_model?: string;
  world_model?: string;
};

export const CORE_WORLD_IDS: readonly BuklodWorldCharacterId[] = [
  'phan', 'quin', 'van', 'christian', 'lhen',
];

export const WORLD_NAMES: Record<BuklodWorldCharacterId, string> = {
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
  elesur: 'ELESUR',
};

export const WORLD_SIGNATURES: Record<BuklodWorldCharacterId, string> = {
  phan: 'Growth • Learning • Purpose',
  quin: 'Kindness • Creativity • Community',
  van: 'Joy • Faith • Service',
  christian: 'Leadership • People • Service',
  lhen: 'Mission • Education • Hope',
  jawo: 'Forest • Music • Nature',
  trudice: 'Sunday School • Classroom • Children',
  ace: 'Chess • Healthcare • Strategy',
  mitch: 'Tribal Art • Culture • Education',
  niel: 'Worship • Discipleship • Church Planting',
  angel: 'Stewardship • Finance • Planning',
  vhen: 'Agriculture • Business • Family',
  elesur: 'Faith • Teaching • Farming • Volunteer Service',
};

function normalize<T>(value: unknown): T {
  return value as T;
}

let cachedWorld: BuklodWorldState | null = null;
const worldListeners = new Set<(world: BuklodWorldState) => void>();

function publishWorld(world: BuklodWorldState) {
  cachedWorld = world;
  worldListeners.forEach((listener) => listener(world));
  return world;
}

async function rpc<T>(name: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, params ?? {});
  if (error) throw error;
  return normalize<T>(data);
}

export async function getMyBuklodWorldV3(force = false) {
  if (!force && cachedWorld) return cachedWorld;
  return publishWorld(await rpc<BuklodWorldState>('get_my_buklod_character_world_v3'));
}

async function mutateWorld(name: string, params: Record<string, unknown>) {
  return publishWorld(await rpc<BuklodWorldState>(name, params));
}

export function initializeMyBuklodWorldV3(starter: BuklodWorldCharacterId) {
  return mutateWorld('initialize_my_buklod_character_world_v3', {
    p_starter_character_id: starter,
  });
}

export function unlockMyBuklodCharacterV3(id: BuklodWorldCharacterId) {
  return mutateWorld('unlock_my_buklod_character_v3', {
    p_character_id: id,
  });
}

export function setMyBuklodCharacterActiveV3(id: BuklodWorldCharacterId) {
  return mutateWorld('set_my_buklod_character_active_v3', {
    p_character_id: id,
  });
}

export function setMyBuklodWorldDisplayModeV1(mode: BuklodWorldDisplayMode) {
  return mutateWorld('set_my_buklod_world_display_mode_v1', {
    p_mode: mode,
  });
}

export function subscribeMyBuklodWorldV3(listener: (world: BuklodWorldState) => void) {
  worldListeners.add(listener);
  if (cachedWorld) listener(cachedWorld);
  return () => worldListeners.delete(listener);
}

export function clearBuklodWorldCacheV3() {
  cachedWorld = null;
}

export function isCoreWorldCharacter(id?: BuklodWorldCharacterId | null) {
  return !!id && CORE_WORLD_IDS.includes(id);
}
