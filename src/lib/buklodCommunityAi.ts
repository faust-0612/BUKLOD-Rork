import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

type CommunityModerationTarget = 'root' | 'dugtong';

type CommunityTakeawayResult = {
  summary?: string;
  takeaway_id?: string;
  is_public?: boolean;
};

export async function moderateBuklodCommunityContent(
  target: CommunityModerationTarget,
  id: string,
) {
  const normalizedId = String(id ?? '').trim();
  if (!normalizedId) return;

  const { data, error } = await withBuklodTimeout<any>(
    supabase.functions.invoke(
      'buklod-community-ai',
      {
        body: {
          action: target === 'root' ? 'moderate_root' : 'moderate_dugtong',
          id: normalizedId,
        },
      },
    ),
    28_000,
    'Community AI moderation'
  );

  if (error) throw error;
  return data;
}

/**
 * Community posts should feel instant. The fast local Privacy Shield and
 * backend hard guards run before/at write time; AI moderation is a second
 * asynchronous safety pass that may hide content after publish when needed.
 */
export function queueBuklodCommunityModeration(
  target: CommunityModerationTarget,
  id: string,
) {
  void moderateBuklodCommunityContent(target, id).catch(() => {
    // Deliberately fail-open for ordinary publishing. Moderation failures are
    // recorded server-side when the Edge Function can run, while obvious
    // unsafe text is still blocked by local/backend guards.
  });
}

export async function generateBuklodCommunityTakeaway(
  postId: string,
  publish = false,
): Promise<CommunityTakeawayResult> {
  const { data, error } = await withBuklodTimeout<any>(
    supabase.functions.invoke(
      'buklod-community-ai',
      {
        body: {
          action: 'takeaway',
          post_id: postId,
          publish,
        },
      },
    ),
    28_000,
    'Community AI Takeaway'
  );

  if (error) throw error;
  return (data ?? {}) as CommunityTakeawayResult;
}
