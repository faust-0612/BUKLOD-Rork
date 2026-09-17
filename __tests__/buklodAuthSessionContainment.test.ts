describe('BUKLOD auth session containment', () => {
  const runtimeKey = '__BUKLOD_MAIN_AUTH_RUNTIME_R21__';

  function installMocks() {
    const signInWithPassword = jest.fn(
      async (credentials: any) => ({
        data: {
          user: {
            id: `user:${String(credentials?.email ?? credentials?.phone ?? '')}`,
          },
          session: {
            access_token: 'token',
          },
        },
        error: null,
      })
    );

    const signOut = jest.fn(async () => ({
      error: null,
    }));

    jest.doMock('@react-native-async-storage/async-storage', () => ({
      getItem: jest.fn(async () => null),
      setItem: jest.fn(async () => undefined),
      removeItem: jest.fn(async () => undefined),
    }));

    jest.doMock('@/lib/buklodAsyncTimeout', () => ({
      withBuklodTimeout: async (value: any) => await value,
    }));

    jest.doMock('@/lib/performance', () => ({
      clearInflight: jest.fn(),
      clearRealtimeRegistry: jest.fn(),
      invalidateCache: jest.fn(),
    }));

    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          signInWithPassword,
          signOut,
          getSession: jest.fn(async () => ({
            data: { session: null },
            error: null,
          })),
        },
      },
    }));

    return {
      signInWithPassword,
      signOut,
    };
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete (globalThis as any)[runtimeKey];
  });

  it('shares one in-flight password grant for concurrent submits', async () => {
    const { signInWithPassword } = installMocks();
    const { signInWithPasswordResilient } = require('@/lib/buklodAuthResilience');
    const credentials = {
      email: 'person@example.com',
      password: 'secret',
    };

    const [first, second] = await Promise.all([
      signInWithPasswordResilient(credentials),
      signInWithPasswordResilient(credentials),
    ]);

    expect(first).toBe(second);
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it('reuses a recent successful grant for the same credential', async () => {
    const { signInWithPassword } = installMocks();
    const { signInWithPasswordResilient } = require('@/lib/buklodAuthResilience');
    const credentials = {
      email: 'person@example.com',
      password: 'secret',
    };

    const first = await signInWithPasswordResilient(credentials);
    const second = await signInWithPasswordResilient(credentials);

    expect(second).toBe(first);
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it('does not reuse a grant for a different credential identity', async () => {
    const { signInWithPassword } = installMocks();
    const { signInWithPasswordResilient } = require('@/lib/buklodAuthResilience');

    await signInWithPasswordResilient({
      email: 'first@example.com',
      password: 'secret',
    });

    await signInWithPasswordResilient({
      email: 'second@example.com',
      password: 'secret',
    });

    expect(signInWithPassword).toHaveBeenCalledTimes(2);
  });

  it('clears the recent-grant shield on local sign-out', async () => {
    const {
      signInWithPassword,
      signOut,
    } = installMocks();
    const {
      signInWithPasswordResilient,
      signOutBuklodResilient,
    } = require('@/lib/buklodAuthResilience');
    const credentials = {
      email: 'person@example.com',
      password: 'secret',
    };

    await signInWithPasswordResilient(credentials);
    await signOutBuklodResilient();
    await signInWithPasswordResilient(credentials);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signInWithPassword).toHaveBeenCalledTimes(2);
  });
});
