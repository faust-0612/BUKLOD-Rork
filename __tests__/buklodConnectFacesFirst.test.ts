jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: { user: { id: 'viewer' } } } })) }, rpc: jest.fn() },
}));
import { supabase } from '@/lib/supabase';
import { loadConnectSuggestedContacts, enrichConnectSuggestedContactsWithNotes } from '@/lib/buklodConnectSuggestedContacts';
const rpc = supabase.rpc as jest.Mock;
beforeEach(() => { jest.clearAllMocks(); });
test('base faces return without requesting notes or ranks', async () => {
  rpc.mockResolvedValue({ data: [{ user_id: 'peer', full_name: 'Peer', avatar_url: 'https://avatars.invalid/peer.jpg' }], error: null });
  const rows = await loadConnectSuggestedContacts();
  expect(rows[0].avatar_url).toBe('https://avatars.invalid/peer.jpg');
  expect(rpc.mock.calls.map(call => call[0])).toEqual(['buklod_connect_suggested_contacts_v1']);
});
test('notes and ranks start in parallel after base faces are available', async () => {
  const resolvers: Record<string, (value: any) => void> = {};
  rpc.mockImplementation((name: string) => new Promise(resolve => { resolvers[name] = resolve; }));
  const work = enrichConnectSuggestedContactsWithNotes([{
    user_id: 'peer', full_name: 'Peer', avatar_url: 'https://avatars.invalid/peer.jpg',
    shared_scope_label: null, rank_name: null, thread_id: null, unread_count: 0, quick_note: null,
  }]);
  expect(Object.keys(resolvers).sort()).toEqual(['get_buklod_connect_status_notes_v1','get_member_circle_ranks_v1'].sort());
  resolvers.get_member_circle_ranks_v1({ data: [{ user_id: 'peer', rank_name: 'Rank' }], error: null });
  resolvers.get_buklod_connect_status_notes_v1({ data: [{ user_id: 'peer', quick_note: 'Note' }], error: null });
  await expect(work).resolves.toEqual([expect.objectContaining({ rank_name: 'Rank', quick_note: 'Note', avatar_url: 'https://avatars.invalid/peer.jpg' })]);
});
