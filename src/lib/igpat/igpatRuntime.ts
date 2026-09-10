import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export type IgpatFeedbackKind =
  | 'not_interested'
  | 'show_fewer'
  | 'dont_recommend_creator'
  | 'hide';

export type IgpatAnalyticsEvent =
  | 'impression'
  | 'start'
  | 'watch'
  | 'complete'
  | 'replay'
  | 'skip'
  | 'pulse'
  | 'comment'
  | 'save'
  | 'share'
  | 'follow'
  | 'report'
  | 'not_interested'
  | 'publish_start'
  | 'publish_success'
  | 'publish_fail'
  | 'draft_save'
  | 'quick_edit'
  | 'arena_open'
  | 'relay'
  | 'pass'
  | 'capsule'
  | 'mosaic'
  | 'memory_echo'
  | 'ad_impression'
  | 'ad_complete'
  | 'ad_click';

export type IgpatBondKind = 'relay' | 'pass' | 'capsule' | 'mosaic' | 'memory_echo';

export type IgpatArenaMode =
  | 'duel'
  | 'prove_it'
  | 'squad_battle'
  | 'king_of_the_hill'
  | 'hard_mode'
  | 'iron_streak'
  | 'ranked_season'
  | 'boss_challenge'
  | 'last_man_standing'
  | 'bounty_challenge';

const PREFIX = '@buklod_igpat_r7';
const feedbackKey = `${PREFIX}:feedback`;
const savedKey = `${PREFIX}:saved`;
const draftsKey = `${PREFIX}:drafts`;

function isMissingContract(error: unknown) {
  const message = String((error as any)?.message ?? error ?? '').toLowerCase();
  return (
    message.includes('could not find the function') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  );
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function trackIgpatEvent(input: {
  event: IgpatAnalyticsEvent;
  postId?: string | null;
  creatorId?: string | null;
  feedSource?: string | null;
  watchMs?: number | null;
  meta?: Record<string, unknown>;
}) {
  try {
    const { error } = await (supabase as any).rpc('igpat_track_event_v1', {
      p_event_name: input.event,
      p_post_id: input.postId ?? null,
      p_creator_id: input.creatorId ?? null,
      p_feed_source: input.feedSource ?? null,
      p_watch_ms: Math.max(0, Math.floor(Number(input.watchMs ?? 0))),
      p_meta: input.meta ?? {},
    });
    if (error && !isMissingContract(error)) {
      console.warn('IGPAT analytics:', error.message);
    }
  } catch {}
}

export async function setIgpatFeedback(input: {
  kind: IgpatFeedbackKind;
  postId?: string | null;
  creatorId?: string | null;
}) {
  const local = await readJson<Array<typeof input>>(feedbackKey, []);
  const next = [input, ...local.filter(row => !(
    row.kind === input.kind &&
    row.postId === input.postId &&
    row.creatorId === input.creatorId
  ))].slice(0, 500);
  await writeJson(feedbackKey, next);

  try {
    const { error } = await (supabase as any).rpc('igpat_set_feedback_v1', {
      p_feedback_kind: input.kind,
      p_post_id: input.postId ?? null,
      p_creator_id: input.creatorId ?? null,
    });
    if (error && !isMissingContract(error)) throw error;
  } catch (error) {
    if (!isMissingContract(error)) throw error;
  }

  await trackIgpatEvent({
    event: input.kind === 'not_interested' ? 'not_interested' : 'skip',
    postId: input.postId,
    creatorId: input.creatorId,
    meta: { feedback_kind: input.kind },
  });
}

export async function getIgpatFeedback() {
  return readJson<Array<{
    kind: IgpatFeedbackKind;
    postId?: string | null;
    creatorId?: string | null;
  }>>(feedbackKey, []);
}

export async function setIgpatSaved(postId: string, saved: boolean) {
  const local = new Set(await readJson<string[]>(savedKey, []));
  if (saved) local.add(postId);
  else local.delete(postId);
  await writeJson(savedKey, Array.from(local));

  try {
    const { error } = await (supabase as any).rpc('igpat_set_saved_v1', {
      p_post_id: postId,
      p_saved: saved,
    });
    if (error && !isMissingContract(error)) throw error;
  } catch (error) {
    if (!isMissingContract(error)) throw error;
  }

  await trackIgpatEvent({ event: 'save', postId, meta: { saved } });
}

export async function getIgpatSavedIds(): Promise<string[]> {
  try {
    const { data, error } = await (supabase as any).rpc('igpat_get_saved_v1');
    if (!error && Array.isArray(data)) {
      const ids = data.map((row: any) => String(row?.post_id ?? row)).filter(Boolean);
      await writeJson(savedKey, ids);
      return ids;
    }
  } catch {}
  return readJson<string[]>(savedKey, []);
}

export type IgpatDraft = {
  id: string;
  uri: string;
  caption: string;
  audience: string;
  coverUri?: string | null;
  trimStartMs?: number;
  trimEndMs?: number | null;
  speed?: number;
  textOverlay?: string;
  captionsEnabled?: boolean;
  audioLabel?: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function saveIgpatDraft(draft: IgpatDraft) {
  const drafts = await readJson<IgpatDraft[]>(draftsKey, []);
  await writeJson(draftsKey, [draft, ...drafts.filter(row => row.id !== draft.id)].slice(0, 20));
  await trackIgpatEvent({ event: 'draft_save', meta: { draft_id: draft.id } });
}

export async function loadIgpatDrafts() {
  return readJson<IgpatDraft[]>(draftsKey, []);
}

export async function deleteIgpatDraft(id: string) {
  const drafts = await readJson<IgpatDraft[]>(draftsKey, []);
  await writeJson(draftsKey, drafts.filter(row => row.id !== id));
}

export async function createIgpatBond(input: {
  kind: IgpatBondKind;
  postId: string;
  targetId?: string | null;
  message?: string | null;
  unlockAt?: string | null;
}) {
  const rpc = `igpat_create_${input.kind}_v1`;
  const { data, error } = await (supabase as any).rpc(rpc, {
    p_post_id: input.postId,
    p_target_id: input.targetId ?? null,
    p_message: input.message ?? null,
    p_unlock_at: input.unlockAt ?? null,
  });
  if (error) {
    if (isMissingContract(error)) {
      throw new Error('IGPAT Bond backend update is not installed yet.');
    }
    throw error;
  }
  await trackIgpatEvent({
    event: input.kind === 'memory_echo' ? 'memory_echo' : input.kind,
    postId: input.postId,
  });
  return data;
}

export async function createIgpatArenaChallenge(input: {
  mode: IgpatArenaMode;
  postId?: string | null;
  opponentUserId?: string | null;
  squadId?: string | null;
  title?: string | null;
}) {
  const { data, error } = await (supabase as any).rpc('igpat_create_arena_challenge_v1', {
    p_mode: input.mode,
    p_post_id: input.postId ?? null,
    p_opponent_user_id: input.opponentUserId ?? null,
    p_squad_id: input.squadId ?? null,
    p_title: input.title ?? null,
  });
  if (error) {
    if (isMissingContract(error)) {
      throw new Error('IGPAT Arena backend update is not installed yet.');
    }
    throw error;
  }
  await trackIgpatEvent({ event: 'arena_open', postId: input.postId, meta: { mode: input.mode } });
  return data;
}

export function igpatCanonicalUrl(postId: string) {
  return `https://buklod.expo.app/igpat?post=${encodeURIComponent(postId)}`;
}
