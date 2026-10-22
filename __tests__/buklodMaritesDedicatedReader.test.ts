jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    storage: { from: jest.fn(() => ({ createSignedUrl: jest.fn(async (path: string) => ({ data: { signedUrl: 'https://media.invalid/' + path } })) })) },
  },
}));
jest.mock('@/lib/buklodPersonDisplay', () => ({ hydratePersonNamesOnRows: jest.fn() }));
jest.mock('@/lib/buklodCommunityPostMedia', () => ({}));
import { supabase } from '@/lib/supabase';
import { loadCommunityMaritesStories } from '@/lib/buklodMaritesBoard';
import { resolveMaritesVisibleRows } from '@/lib/buklodMaritesFeedPages';
const rpc = supabase.rpc as jest.Mock;
const story = {
  id: 'photo', user_id: 'peer', author_name: 'Peer', body: '',
  created_at: '2026-10-18T00:00:00Z',
  media_items: [{ media_path: 'peer/marites-photo.jpg', media_mime_type: 'image/jpeg' }],
};
beforeEach(() => { jest.clearAllMocks(); });
function response(value: any) {
  return { abortSignal: jest.fn(() => Promise.resolve(value)) };
}
test('unmarked photo story is classified after media paths arrive', async () => {
  rpc.mockReturnValue(response({ data: [story], error: null }));
  const progress = jest.fn();
  const result = await loadCommunityMaritesStories(null, 'viewer', 20, progress);
  expect(rpc).toHaveBeenCalledWith('get_buklod_marites_feed_v1', expect.objectContaining({ p_limit: 20 }));
  expect(result.stories).toHaveLength(1);
  expect(result.stories[0].photo_paths).toEqual(['peer/marites-photo.jpg']);
  expect(progress).toHaveBeenCalled();
  expect(result.refreshFailed).toBe(false);
});
test('a failed later page preserves already loaded stories', async () => {
  rpc.mockReturnValueOnce(response({ data: [story], error: null }))
    .mockReturnValueOnce(response({ data: null, error: { message: 'offline' } }));
  const result = await loadCommunityMaritesStories(null, 'viewer', 1);
  expect(result.stories.map(row => row.id)).toEqual(['community:photo']);
  expect(result.refreshFailed).toBe(true);
  expect(rpc).toHaveBeenLastCalledWith('get_buklod_marites_feed_v1', expect.objectContaining({ p_offset: 1 }));
});
test('a shorter failed refresh adds new identities without losing cached stories', () => {
  const result = resolveMaritesVisibleRows({
    current: [{ id: 'a' }, { id: 'b' }], incoming: [{ id: 'c' }], refreshFailed: true,
  });
  expect(result.rows.map(row => row.id)).toEqual(['a', 'b', 'c']);
  expect(result.markFresh).toBe(false);
});
