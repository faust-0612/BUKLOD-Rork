import { supabase } from '@/lib/supabase';
import { acquireSharedRealtimeSubscription } from '@/lib/performance';

export type BuklodPublicPostChanged = {
  post_id?: string;
  operation?: string;
  visibility_revoked?: boolean;
};

/**
 * A single shared listener for the canonical public Community topic.
 * Wall, Marites and scoped mirrors must never join this topic separately:
 * Supabase Realtime closes/replaces duplicate topic subscriptions.
 */
export function subscribeBuklodPublicPostChanges(
  onChange: (event: BuklodPublicPostChanged) => void,
): () => void {
  return acquireSharedRealtimeSubscription<BuklodPublicPostChanged>(
    'buklod:public-community:posts:shared-v1',
    onChange,
    emit => {
      const channel = supabase
        .channel('buklod:public-community:posts', {
          config: { private: false },
        })
        .on('broadcast', { event: 'post_changed' }, (message: any) => {
          const payload = message?.payload;
          if (payload && typeof payload === 'object') {
            emit(payload as BuklodPublicPostChanged);
          }
        })
        .subscribe();
      return () => { void supabase.removeChannel(channel); };
    },
  );
}
