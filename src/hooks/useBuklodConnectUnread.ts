import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export function useBuklodConnectUnread() {
  const { profile } = useAuth();
  const profileId = (profile as any)?.id as string | undefined;
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!profileId) {
      setUnreadCount(0);
      return;
    }

    const { data, error } = await (supabase as any).rpc(
      'buklod_connect_unread_count'
    );

    if (error) {
      setUnreadCount(0);
      return;
    }

    const raw = Array.isArray(data) ? data[0] ?? 0 : data ?? 0;
    const numeric = Number(
      typeof raw === 'object'
        ? raw?.unread_count ?? raw?.count ?? 0
        : raw
    );

    setUnreadCount(Number.isFinite(numeric) ? Math.max(0, numeric) : 0);
  }, [profileId]);

  useEffect(() => {
    void refresh();
    if (!profileId) return;

    const channel = supabase
      .channel(`connect-unread-${profileId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'buklod_connect_direct_messages' },
        () => void refresh()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'buklod_connect_scope_messages' },
        () => void refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profileId, refresh]);

  return { unreadCount, refresh };
}
