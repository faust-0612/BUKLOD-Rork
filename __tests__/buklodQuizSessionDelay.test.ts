jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(), getUser: jest.fn(), refreshSession: jest.fn() } },
}));
import { supabase } from '@/lib/supabase';
import { getValidatedMainAccessToken } from '@/lib/buklodQuizEntry';
const auth = supabase.auth as any;
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: { access_token: 'saved', expires_at: Date.now()/1000 + 300 } }, error: null });
});
afterEach(() => { jest.useRealTimers(); });
test('slow validation retains an unexpired saved token for server-side bridge validation', async () => {
  auth.getUser.mockImplementation(() => new Promise(() => {}));
  const check = getValidatedMainAccessToken();
  await jest.advanceTimersByTimeAsync(8001);
  await expect(check).resolves.toBe('saved');
  expect(auth.refreshSession).not.toHaveBeenCalled();
});
test('a transport error does not invalidate a saved session', async () => {
  auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
  await expect(getValidatedMainAccessToken()).resolves.toBe('saved');
});
test('expired token plus network failure asks to retry, not sign in', async () => {
  auth.getSession.mockResolvedValue({ data: { session: { access_token: 'expired', expires_at: 1 } }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
  await expect(getValidatedMainAccessToken()).rejects.toThrow('tap Quiz again');
});
test('definitive rejection and invalid refresh still require sign in', async () => {
  auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
  auth.refreshSession.mockResolvedValue({ data: { session: null }, error: { status: 400 } });
  await expect(getValidatedMainAccessToken()).rejects.toThrow('Sign in');
});

test('a ready direct handoff is preferred over the one-time Auth redirect', async () => {
  const { createBuklodQuizLaunchUrl } = require('@/lib/buklodQuizEntry') as typeof import('@/lib/buklodQuizEntry');
  auth.getUser.mockResolvedValue({ data: { user: { id: 'viewer' } }, error: null });
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      ok: true, launch_url: 'https://auth.invalid/verify',
      session_launch_url: 'https://quiz.invalid/?buklod_quiz_token_hash=test-only',
      session_launch_ready: true,
    }),
  })) as any;
  try {
    await expect(createBuklodQuizLaunchUrl({ source: 'buklod-main-profile' }))
      .resolves.toBe('https://quiz.invalid/?buklod_quiz_token_hash=test-only');
  } finally { global.fetch = originalFetch; }
});
