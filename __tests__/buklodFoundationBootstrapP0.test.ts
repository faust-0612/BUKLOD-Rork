describe('BUKLOD P0 Foundation bootstrap containment', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete (globalThis as any).__BUKLOD_FOUNDATION_PERMISSION_SNAPSHOT_R4__;
  });

  function installMocks() {
    const rpc = jest.fn(async (name: string) => {
      if (name === 'buklod_my_permission_snapshot_v1') {
        // Keep the request open for one microtask so concurrent callers overlap.
        await Promise.resolve();
        return {
          data: [],
          error: null,
        };
      }

      return {
        data: null,
        error: null,
      };
    });

    const getSession = jest.fn(async () => ({
      data: {
        session: {
          user: {
            id: 'user-p0-foundation',
          },
        },
      },
    }));

    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getSession,
        },
        rpc,
      },
    }));

    jest.doMock('@/lib/buklodFoundation', () => ({
      BUKLOD_FOCUS_APP_CATALOG: {},
      BUKLOD_FOCUS_APP_REGISTRY: [],
      buildFoundationAuthorities: jest.fn(() => ({
        isSystemAdmin: false,
        isScopedAdmin: false,
        mergedRoleKeys: [],
      })),
      getMyBuklodFoundationWorkspaces: jest.fn(async () => []),
      resolveFoundationFocusApps: jest.fn(async () => ({
        focusApps: [],
        workspaces: [],
        authorities: {
          isSystemAdmin: false,
          isScopedAdmin: false,
          mergedRoleKeys: [],
        },
      })),
    }));

    jest.doMock('@/lib/buklodOrganizationFocusApps', () => ({
      canUseOrganizationFocusApp: jest.fn(async () => true),
      resolveOrganizationIdFromScope: jest.fn(() => null),
    }));

    return {
      rpc,
      getSession,
    };
  }

  it('collapses concurrent Foundation permission snapshot loads into one RPC', async () => {
    const { rpc } = installMocks();
    const { resolveFoundationFocusAppsFast } = await import(
      '@/lib/buklodFoundationFast'
    );

    const options = {
      isSystemAdmin: false,
      scopes: [],
      activeScope: null,
      workspaces: [],
    } as const;

    const [first, second, third] = await Promise.all([
      resolveFoundationFocusAppsFast(options),
      resolveFoundationFocusAppsFast(options),
      resolveFoundationFocusAppsFast(options),
    ]);

    expect(first).toEqual(second);
    expect(second).toEqual(third);
    expect(
      rpc.mock.calls.filter(
        ([name]) => name === 'buklod_my_permission_snapshot_v1'
      )
    ).toHaveLength(1);
  });

  it('reuses the same runtime permission snapshot during the 30-second presentation window', async () => {
    const { rpc } = installMocks();
    const { resolveFoundationFocusAppsFast } = await import(
      '@/lib/buklodFoundationFast'
    );

    const options = {
      isSystemAdmin: false,
      scopes: [],
      activeScope: null,
      workspaces: [],
    } as const;

    await resolveFoundationFocusAppsFast(options);
    await resolveFoundationFocusAppsFast(options);

    expect(
      rpc.mock.calls.filter(
        ([name]) => name === 'buklod_my_permission_snapshot_v1'
      )
    ).toHaveLength(1);
  });
});
