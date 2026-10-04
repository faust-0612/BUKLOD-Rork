import { supabase } from '@/lib/supabase';

export async function notifyBuklodCommunityMentions(input: {
  postId: string;
  mentionedUserIds: string[];
  context: 'post' | 'comment';
}) {
  const postId = String(input.postId ?? '').trim();
  const mentionedUserIds = [
    ...new Set(
      input.mentionedUserIds
        .map(id => String(id ?? '').trim())
        .filter(Boolean),
    ),
  ].slice(0, 20);

  if (!postId || !mentionedUserIds.length) {
    return;
  }

  const { error } = await (supabase as any).rpc(
    'notify_buklod_community_mentions_v1',
    {
      p_post_id: postId,
      p_mentioned_user_ids: mentionedUserIds,
      p_context: input.context,
    },
  );

  if (error) {
    console.warn(
      'BUKLOD mention notification:',
      error.message ?? error,
    );
  }
}
