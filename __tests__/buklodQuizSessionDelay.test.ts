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
