import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';

export type IgpatBondRecipient = {
  id: string;
  name: string;
  isSelf: boolean;
};

export async function loadIgpatBondRecipients(userId: string): Promise<IgpatBondRecipient[]> {
  const safeUserId = String(userId ?? '').trim();
  if (!safeUserId) return [];

  const [{ data: selfProfile, error: selfError }, { data: follows, error: followsError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,full_name,first_name,username')
      .eq('id', safeUserId)
      .maybeSingle(),
    supabase
      .from('buklod_user_follows')
      .select('followed_user_id')
      .eq('follower_id', safeUserId),
  ]);

  if (selfError) throw selfError;
  if (followsError) throw followsError;

  const followedIds = Array.from(new Set(
    (follows ?? [])
      .map(row => String(row.followed_user_id ?? '').trim())
      .filter(Boolean)
      .filter(id => id !== safeUserId)
  ));

  const result: IgpatBondRecipient[] = [];
  if (selfProfile?.id) {
    const raw = selfProfile.full_name || selfProfile.first_name || selfProfile.username || 'Me';
    result.push({
      id: safeUserId,
      name: resolvePersonDisplayName(String(raw), safeUserId),
      isSelf: true,
    });
  } else {
    result.push({ id: safeUserId, name: 'Me', isSelf: true });
  }

  if (!followedIds.length) return result;

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id,full_name,first_name,username')
    .in('id', followedIds);
  if (profileError) throw profileError;

  const byId = new Map((profiles ?? []).map(row => [String(row.id), row]));
  for (const id of followedIds) {
    const profile = byId.get(id);
    if (!profile) continue;
    const raw = profile.full_name || profile.first_name || profile.username || 'BUKLOD Member';
    result.push({
      id,
      name: resolvePersonDisplayName(String(raw), id),
      isSelf: false,
    });
  }

  return result;
}
