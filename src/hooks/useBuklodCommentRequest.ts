import { useMemo, useRef, useState } from 'react';
export function useBuklodCommentRequest(accountId?: string | null, scopeId = 'public') {
  const active = useRef<object | null>(null);
  const [state, setState] = useState<{ owner: object | null; status: 'loading' | 'ready' | 'error'; denied: boolean }>({ owner: null, status: 'loading', denied: false });
  const controller = useMemo(() => {
    let selectedPost = ''; let sequence = 0;
    const owner = {};
    const current = (ticket: { postId: string; sequence: number }) => active.current === owner && selectedPost === ticket.postId && sequence === ticket.sequence;
    return {
      owner,
      open(postId: string) { selectedPost = postId; sequence++; setState({ owner, status: 'loading', denied: false }); },
      begin(postId: string) { if (selectedPost !== postId || active.current !== owner) return { postId, sequence: -1 }; const ticket = { postId, sequence: ++sequence }; if (selectedPost === postId && active.current === owner) setState({ owner, status: 'loading', denied: false }); return ticket; },
      current,
      success(ticket: { postId: string; sequence: number }) { if (!current(ticket)) return false; setState({ owner, status: 'ready', denied: false }); return true; },
      fail(ticket: { postId: string; sequence: number }, error?: { code?: string; status?: number }) { if (!current(ticket)) return false; const denied = error?.code === '42501' || error?.code === 'P0001' || error?.code === 'PGRST301' || error?.status === 401 || error?.status === 403; setState({ owner, status: 'error', denied }); return true; },
    };
  }, [accountId, scopeId]);
  active.current = controller.owner;
  const belongs = state.owner === controller.owner;
  const status = belongs ? state.status : 'loading';
  return { controller, status, visible: belongs && !state.denied, emptyText: status === 'loading' ? 'Loading comments...' : status === 'error' ? 'Comments could not be loaded. Reopen to retry.' : 'No comments yet.' };
}
