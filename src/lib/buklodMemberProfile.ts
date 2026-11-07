import { buklodInstantPush } from '@/lib/buklodInstantNavigation';
import { tryOpenBuklodDesktopDock } from '@/lib/buklodDesktopContextDock';

import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { MARITES_POST_MARKER } from '@/lib/buklodMaritesBoard';

export type MemberPublicProfile = {
  user_id: string;
  is_self: boolean;
  is_locked: boolean;
  can_view_details: boolean;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  quick_note: string | null;
  member_since: string | null;
  shared_scope_labels: string[];
};

function mapProfileRow(
  row: Record<string, unknown> | null,
  userId: string,
): MemberPublicProfile | null {
  if (!row) {
    return null;
  }

  const shared = Array.isArray(row.shared_scope_labels)
    ? row.shared_scope_labels
        .map(label => String(label ?? '').trim())
        .filter(Boolean)
    : [];

  return {
    user_id: String(row.user_id ?? userId),
    is_self: Boolean(row.is_self),
    is_locked: Boolean(row.is_locked),
    can_view_details: Boolean(row.can_view_details),
    display_name: resolvePersonDisplayName(
      {
        full_name: String(row.display_name ?? ''),
        username: row.username ? String(row.username) : null,
      },
      userId,
    ),
    username: row.username ? String(row.username) : null,
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    quick_note: row.quick_note ? String(row.quick_note) : null,
    member_since: row.member_since ? String(row.member_since) : null,
    shared_scope_labels: shared,
  };
}

async function loadMemberPublicProfileDirect(
  userId: string,
): Promise<MemberPublicProfile | null> {
  const { data: authData } = await supabase.auth.getUser();
  const viewerId = authData.user?.id ?? null;

  const [profileResult, prefsResult, statusResult] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, created_at')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('buklod_user_preferences')
        .select('profile_locked')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('buklod_profile_status')
        .select('quick_note')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

  if (profileResult.error || !profileResult.data) {
    return null;
  }

  const locked = Boolean(
    (prefsResult.data as { profile_locked?: boolean } | null)
      ?.profile_locked,
  );
  const isSelf = viewerId === userId;
  const profile = profileResult.data;

  if (locked && !isSelf) {
    return {
      user_id: userId,
      is_self: false,
      is_locked: true,
      can_view_details: false,
      display_name: resolvePersonDisplayName(profile, userId),
      username: null,
      avatar_url: null,
      quick_note: null,
      member_since: null,
      shared_scope_labels: [],
    };
  }

  const createdAt = profile.created_at
    ? new Date(String(profile.created_at))
    : null;

  return {
    user_id: userId,
    is_self: isSelf,
    is_locked: locked,
    can_view_details: true,
    display_name: resolvePersonDisplayName(profile, userId),
    username: profile.username ? String(profile.username) : null,
    avatar_url: profile.avatar_url
      ? String(profile.avatar_url)
      : null,
    quick_note: statusResult.data?.quick_note
      ? String(statusResult.data.quick_note)
      : null,
    member_since:
      createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toLocaleDateString(undefined, {
            month: 'short',
            year: 'numeric',
          })
        : null,
    shared_scope_labels: [],
  };
}

export async function loadMemberCommunityPosts(
  userId: string,
  viewerId?: string | null,
): Promise<MemberPublicPost[]> {
  const id = String(userId ?? '').trim();
  if (!id) {
    return [];
  }

  const isSelf = Boolean(viewerId && viewerId === id);

  const { data, error } = await supabase
    .from('community_posts')
    .select(
      'id, user_id, body, media_path, media_mime_type, media_size_bytes, created_at, author_only, audience, is_hidden'
    )
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(40);

  let rows = data ?? [];

  if (error) {
    const fallback = await supabase
      .from('community_posts')
      .select(
        'id,user_id,body,media_path,media_mime_type,media_size_bytes,created_at,author_only,audience,is_hidden'
      )
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(40);

    if (fallback.error) {
      console.warn('Member posts:', fallback.error.message);
      return [];
    }

    rows = fallback.data ?? [];
  }

  const visible = rows.filter((row: any) => {
    if (row?.is_hidden) {
      return false;
    }

    if (row?.author_only && !isSelf) {
      return false;
    }

    if (String(row.body ?? '').includes(MARITES_POST_MARKER)) {
      return false;
    }

    const audience = String(row?.audience ?? 'public')
      .trim()
      .toLowerCase();

    if (!isSelf && audience && audience !== 'public') {
      return false;
    }

    return true;
  });

  const postIds = visible
    .map((row: any) => String(row.id ?? ''))
    .filter(Boolean);

  let mediaByPost: Record<string, any[]> = {};

  if (postIds.length) {
    const { data: mediaRows, error: mediaError } = await (
      supabase as any
    ).rpc('get_buklod_post_media_v1', {
      p_post_ids: postIds,
    });

    if (!mediaError) {
      for (const row of mediaRows ?? []) {
        const postId = String(row?.post_id ?? '');
        if (!postId) {
          continue;
        }
        if (!mediaByPost[postId]) {
          mediaByPost[postId] = [];
        }
        mediaByPost[postId].push(row);
      }
    }
  }

  return Promise.all(
    visible.map(async (row: any) => {
      const postId = String(row.id);
      const mediaRows = (mediaByPost[postId] ?? []).filter(
        (item: any) =>
          !String(item?.media_mime_type ?? '')
            .toLowerCase()
            .startsWith('video/')
      );
      const firstMedia = mediaRows[0];
      const path = String(
        firstMedia?.media_path ?? row.media_path ?? ''
      ).trim();

      let mediaUrl: string | null = null;
      if (path) {
        const { data: signed } = await supabase.storage
          .from('community-media')
          .createSignedUrl(path, 3600);
        mediaUrl = signed?.signedUrl ?? null;
      }

      return {
        id: postId,
        body: String(row.body ?? '').trim(),
        created_at: String(row.created_at ?? ''),
        media_url: mediaUrl,
        is_video: String(row.media_mime_type ?? '')
          .toLowerCase()
          .startsWith('video/'),
      };
    })
  );
}

export type MemberPublicPost = {
  id: string;
  body: string;
  created_at: string;
  media_url: string | null;
  is_video: boolean;
};

export function memberProfilePath(userId: string) {
  return `/member/${userId}` as const;
}

export function visitMemberProfile(
  userId?: string | null,
  displayName?: string | null,
) {
  const id = String(userId ?? '').trim();
  if (!id) {
    return;
  }

  // Desktop contextual preview first; full page requires explicit Expand.
  if (tryOpenBuklodDesktopDock({
    kind: 'profile', userId: id, displayName: displayName?.trim() || '',
  })) return;

  buklodInstantPush({
    pathname: '/member/[id]',
    params: {
      id,
      name: displayName?.trim() || '',
    },
  } as never);
}

export function openMemberConnect(
  userId: string,
  displayName: string,
) {
  if (tryOpenBuklodDesktopDock({
    kind: 'direct', threadId: 'new',
    targetUserId: userId, otherUserName: displayName,
  })) return;

  buklodInstantPush({
    pathname: '/connect/personal/[threadId]',
    params: {
      threadId: 'new',
      targetUserId: userId,
      otherUserName: displayName,
    },
  } as never);
}

export async function loadMemberPublicProfile(
  userId: string,
): Promise<MemberPublicProfile | null> {
  const id = String(userId ?? '').trim();
  if (!id) {
    return null;
  }

  const { data, error } = await (supabase as any).rpc(
    'get_buklod_member_public_profile_v1',
    { p_user_id: id },
  );

  if (!error && data) {
    return mapProfileRow(data as Record<string, unknown>, id);
  }

  return loadMemberPublicProfileDirect(id);
}

export async function loadMyProfileLocked(): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc(
    'get_my_profile_locked_v1',
  );

  if (!error) {
    return Boolean(data);
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) {
    return false;
  }

  const { data: prefs } = await supabase
    .from('buklod_user_preferences')
    .select('profile_locked')
    .eq('user_id', userId)
    .maybeSingle();

  return Boolean(
    (prefs as { profile_locked?: boolean } | null)?.profile_locked,
  );
}

export async function setMyProfileLocked(locked: boolean) {
  const { error } = await (supabase as any).rpc(
    'set_my_profile_locked_v1',
    { p_locked: locked },
  );

  if (error) {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      throw error;
    }

    const { error: upsertError } = await supabase
      .from('buklod_user_preferences')
      .upsert({
        user_id: userId,
        profile_locked: locked,
      });

    if (upsertError) {
      throw upsertError;
    }
  }
}
