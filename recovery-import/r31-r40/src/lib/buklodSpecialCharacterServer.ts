/* BUKLOD_CHARACTER_R38E_SPECIAL_SERIES1_SERVER_CLIENT
 * Thin authenticated RPC client only.
 * Server remains authoritative for pursuit, discovery, unlock, entitlement and active selection.
 * No client fragment-award API exists here.
 */
import { supabase } from '@/lib/supabase';
import type { BuklodSpecialCharacterId } from '@/lib/buklodSpecialCharacters';

export type BuklodSpecialCharacterDiscoveryState =
  | 'LOCKED'
  | 'CLUES_AVAILABLE'
  | 'FRAGMENT_PROGRESS'
  | 'READY_TO_DISCOVER'
  | 'READY_TO_UNLOCK'
  | 'OWNED_INACTIVE'
  | 'ACTIVE';

export type BuklodSpecialCharacterEntitlement = {
  kind: string;
  key: string;
  granted_at: string;
};

export type BuklodSpecialCharacterServerState = {
  character_id: BuklodSpecialCharacterId;
  display_name: string;
  series_no: number;
  roles: string[];
  personality: string;
  stage_titles: string[];
  unlock_model: 'PARTICIPATION_JOURNEY_FRAGMENTS';
  required_fragments: number;
  fragment_count: number;
  participation_met: boolean;
  meaningful_journey_met: boolean;
  qualification_met: boolean;
  state: BuklodSpecialCharacterDiscoveryState;
  discovered_at: string | null;
  unlocked_at: string | null;
  active: boolean;
  entitlements: BuklodSpecialCharacterEntitlement[];
};

type StateEnvelope = {
  series: number;
  unlock_model: 'PARTICIPATION_JOURNEY_FRAGMENTS';
  manual_discover: boolean;
  manual_unlock: boolean;
  characters: BuklodSpecialCharacterServerState[];
};

export type BuklodSpecialCharacterStateMap =
  Partial<Record<BuklodSpecialCharacterId, BuklodSpecialCharacterServerState>>;

export type BuklodSpecialCharacterPursuitState = {
  pursuit_character_id: BuklodSpecialCharacterId | null;
  pursuit_active: boolean;
};

function rpcError(error: { message?: string } | null, fallback: string) {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

export async function getMyBuklodSpecialCharacterState(): Promise<BuklodSpecialCharacterStateMap> {
  const { data, error } = await supabase.rpc(
    'get_my_buklod_special_character_state_v1',
  );
  rpcError(error, 'Unable to load Special Character progress.');

  const envelope = (data ?? {}) as unknown as Partial<StateEnvelope>;
  const map: BuklodSpecialCharacterStateMap = {};
  for (const item of envelope.characters ?? []) {
    if (item?.character_id) {
      map[item.character_id] = item;
    }
  }
  return map;
}

export async function getMyBuklodSpecialCharacterPursuit(): Promise<BuklodSpecialCharacterPursuitState> {
  const { data, error } = await supabase.rpc(
    'get_my_buklod_special_character_pursuit_v1',
  );
  rpcError(error, 'Unable to load the tracked Special Character journey.');

  const state = (data ?? {}) as unknown as Partial<BuklodSpecialCharacterPursuitState>;
  return {
    pursuit_character_id: state.pursuit_character_id ?? null,
    pursuit_active: Boolean(state.pursuit_active),
  };
}

export async function setMyBuklodSpecialCharacterPursuit(
  characterId: BuklodSpecialCharacterId | null,
) {
  const { data, error } = await supabase.rpc(
    'set_my_buklod_special_character_pursuit_v1',
    { p_character_id: characterId },
  );
  rpcError(error, 'Unable to update the tracked Special Character journey.');
  return data;
}

export async function discoverMyBuklodSpecialCharacter(
  characterId: BuklodSpecialCharacterId,
) {
  const { data, error } = await supabase.rpc(
    'discover_my_buklod_special_character_v1',
    { p_character_id: characterId },
  );
  rpcError(error, 'Unable to discover this Special Character.');
  return data as unknown as BuklodSpecialCharacterServerState;
}

export async function unlockMyBuklodSpecialCharacter(
  characterId: BuklodSpecialCharacterId,
) {
  const { data, error } = await supabase.rpc(
    'unlock_my_buklod_special_character_v1',
    { p_character_id: characterId },
  );
  rpcError(error, 'Unable to unlock this Special Character.');
  return data as unknown as BuklodSpecialCharacterServerState;
}

export async function setMyBuklodSpecialCharacterActive(
  characterId: BuklodSpecialCharacterId | null,
) {
  const { data, error } = await supabase.rpc(
    'set_my_buklod_special_character_active_v1',
    { p_character_id: characterId },
  );
  rpcError(error, 'Unable to update the active Special Character.');
  return data;
}
