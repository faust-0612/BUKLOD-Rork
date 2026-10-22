jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), storage: { from: jest.fn(() => ({
    getPublicUrl: (path: string) => ({ data: { publicUrl: 'https://avatars.invalid/' + path } }),
  })) } },
}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

test('a cold module restores the saved actual URL without guessing avatar.jpg', async () => {
  await AsyncStorage.setItem('buklod:public-avatar-urls:v2', JSON.stringify([
    ['saved-peer', { url: 'https://avatars.invalid/actual-versioned.png', at: Date.now() }],
  ]));
  const cache = require('@/lib/buklodAvatarCache') as typeof import('@/lib/buklodAvatarCache');
  await expect(cache.resolveAvatarUrl('saved-peer')).resolves.toBe('https://avatars.invalid/actual-versioned.png');
  expect(supabase.rpc).not.toHaveBeenCalled();
});
test('concurrent misses share one avatar read', async () => {
  let resolve!: (value: any) => void;
  (supabase.rpc as jest.Mock).mockImplementation(() => new Promise(r => { resolve = r; }));
  const cache = require('@/lib/buklodAvatarCache') as typeof import('@/lib/buklodAvatarCache');
  const first = cache.resolveAvatarUrl('new-peer');
  const second = cache.resolveAvatarUrl('new-peer');
  for (let i=0;i<10;i++) await Promise.resolve();
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  resolve({ data: [{ user_id: 'new-peer', avatar_url: 'new-peer/actual.png' }], error: null });
  await expect(first).resolves.toBe('https://avatars.invalid/new-peer/actual.png');
  await expect(second).resolves.toBe('https://avatars.invalid/new-peer/actual.png');
});
