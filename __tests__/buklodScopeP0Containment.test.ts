describe('BUKLOD P0 scope request containment', () => {
  const userId = 'user-p0';

  function installMocks() {
    const rpc = jest.fn(async (name: string) => {
      if (name === 'buklod_my_scopes') {
        return {
          data: [
            {
              scope_id: 'public-scope',
              scope_type: 'PUBLIC',
              name: 'Public',
              role_keys: [],
              is_admin: false,
              feature_keys: [],
              is_active_scope: true,
            },
          ],
          error: null,
        };
      }

      if (name === 'buklod_set_active_scope') {
        return { data: null, error: null };
      }

      return { data: null, error: null };
    });

    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getSession: jest.fn(async () => ({
            data: {
              session: {
                user: { id: userId },
              },
            },
          })),
        },
        rpc,
      },
    }));

    return { rpc };
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('collapses concurrent buklod_my_scopes calls for the same signed-in user', async () => {
    const { rpc } = installMocks();
    const { getMyBuklodScopes } = require('@/lib/buklodScope');

    const [first, second] = await Promise.all([
      getMyBuklodScopes(),
      getMyBuklodScopes(),
    ]);

    expect(first).toEqual(second);
    expect(
      rpc.mock.calls.filter(([name]) => name === 'buklod_my_scopes')
    ).toHaveLength(1);
  });

  it('does not persist an already-confirmed active scope again', async () => {
    const { rpc } = installMocks();
    const {
      getMyBuklodScopes,
      setBuklodActiveScope,
    } = require('@/lib/buklodScope');

    await getMyBuklodScopes();
    await setBuklodActiveScope('public-scope');

    expect(
      rpc.mock.calls.filter(([name]) => name === 'buklod_set_active_scope')
    ).toHaveLength(0);
  });

  it('collapses concurrent writes when a new active scope is selected', async () => {
    const { rpc } = installMocks();
    const { setBuklodActiveScope } = require('@/lib/buklodScope');

    await Promise.all([
      setBuklodActiveScope('org-scope'),
      setBuklodActiveScope('org-scope'),
    ]);

    expect(
      rpc.mock.calls.filter(([name]) => name === 'buklod_set_active_scope')
    ).toHaveLength(1);
  });
});
