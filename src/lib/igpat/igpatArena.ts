import { supabase } from '@/lib/supabase';
import type { IgpatArenaMode } from '@/lib/igpat/igpatRuntime';

export type IgpatArenaChallenge = {
  id: string;
  creator_user_id: string;
  mode: IgpatArenaMode;
  post_id?: string | null;
  opponent_user_id?: string | null;
  squad_id?: string | null;
  title?: string | null;
  status: 'OPEN' | 'ACCEPTED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  winner_user_id?: string | null;
  respect_score?: number | null;
  created_at: string;
  completed_at?: string | null;
};

function readable(error: unknown, fallback: string) {
  const message = String((error as any)?.message ?? error ?? '').trim();
  if (message.toLowerCase().includes('does not exist') || message.toLowerCase().includes('schema cache')) {
    return 'IGPAT Arena backend update is not installed yet.';
  }
  return message || fallback;
}

export async function listIgpatArenaChallenges(limit = 40): Promise<IgpatArenaChallenge[]> {
  const { data, error } = await (supabase as any)
    .from('igpat_arena_challenges')
    .select('id,creator_user_id,mode,post_id,opponent_user_id,squad_id,title,status,winner_user_id,respect_score,created_at,completed_at')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(80, limit)));
  if (error) throw new Error(readable(error, 'Unable to load Arena challenges.'));
  return (data ?? []) as IgpatArenaChallenge[];
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw new Error(readable(error, 'Arena action failed.'));
  return data;
}

export async function acceptIgpatArenaChallenge(challengeId: string) {
  return rpc('igpat_accept_arena_challenge_v1', { p_challenge_id: challengeId });
}

export async function submitIgpatArenaResult(input: {
  challengeId: string;
  postId?: string | null;
  completionNote?: string | null;
}) {
  return rpc('igpat_submit_arena_result_v1', {
    p_challenge_id: input.challengeId,
    p_post_id: input.postId ?? null,
    p_completion_note: input.completionNote ?? '',
  });
}

export async function completeIgpatArenaChallenge(challengeId: string, winnerUserId?: string | null) {
  return rpc('igpat_complete_arena_challenge_v1', {
    p_challenge_id: challengeId,
    p_winner_user_id: winnerUserId ?? null,
  });
}

export async function rematchIgpatArenaChallenge(challengeId: string) {
  return rpc('igpat_rematch_arena_challenge_v1', { p_challenge_id: challengeId });
}

export async function giveIgpatArenaRespect(challengeId: string, resultUserId: string) {
  return rpc('igpat_give_arena_respect_v1', {
    p_challenge_id: challengeId,
    p_result_user_id: resultUserId,
  });
}
