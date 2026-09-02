import type { BuklodScope } from '@/lib/buklodScope';
import {
  buklodNotificationTarget,
  canonicalScopeKind,
  isBuklodFaithPersonalRoute,
  parseScopedWorkspaceSection,
  readRouteScopeId,
  resolveScopeContextSync,
  scopeHasActiveMembership,
} from '@/lib/buklodScopeRoute';

function scope(partial: Partial<BuklodScope>): BuklodScope {
  return {
    scope_id: 'scope-1',
    scope_type: 'ORGANIZATION',
    name: 'Test Org',
    role_keys: [],
    is_admin: false,
    feature_keys: [],
    ...partial,
  };
}

describe('buklodScopeRoute', () => {
  it('prefers explicit route scope id over active scope', () => {
    const orgA = scope({ scope_id: 'org-a', membership_status: 'ACTIVE' });
    const orgB = scope({ scope_id: 'org-b', membership_status: 'ACTIVE' });

    const resolution = resolveScopeContextSync({
      routeScopeId: 'org-b',
      activeScope: orgA,
      scopes: [orgA, orgB],
      scopesLoading: false,
    });

    expect(resolution.access).toBe('authorized');
    expect(resolution.scope?.scope_id).toBe('org-b');
  });

  it('treats missing route scope as not found', () => {
    const resolution = resolveScopeContextSync({
      routeScopeId: 'missing-scope',
      activeScope: null,
      scopes: [],
      scopesLoading: false,
    });

    expect(resolution.access).toBe('not_found');
  });

  it('keeps loading separate from unauthorized', () => {
    const resolution = resolveScopeContextSync({
      activeScope: null,
      scopes: [],
      scopesLoading: true,
    });

    expect(resolution.access).toBe('loading');
  });

  it('labels sub-organization canonical kind', () => {
    expect(
      canonicalScopeKind(
        scope({
          parent_scope_id: 'parent-1',
        })
      )
    ).toBe('SUB_ORGANIZATION');
  });

  it('normalizes active membership status', () => {
    expect(
      scopeHasActiveMembership(
        scope({ membership_status: 'active' })
      )
    ).toBe(true);
  });

  it('routes MZB scoped notifications to canonical scope connect', () => {
    const mzbScope = scope({
      scope_id: 'mzb-1',
      is_mzb_organization: true,
      membership_status: 'ACTIVE',
    });

    const target = buklodNotificationTarget(
      'scope_message',
      { scope_id: 'mzb-1' },
      {
        scopes: [mzbScope],
        mzbCanonicalScopeId: 'mzb-1',
      }
    );

    expect(target?.path).toBe(
      '/scope?section=connect&scopeId=mzb-1'
    );
    expect(target?.scopeId).toBe('mzb-1');
  });

  it('reads route scope aliases', () => {
    expect(
      readRouteScopeId({
        organizationId: 'org-123',
      })
    ).toBe('org-123');
  });

  it('parses scoped workspace section from route', () => {
    expect(
      parseScopedWorkspaceSection(
        '/scope?section=connect&scopeId=org-1'
      )
    ).toBe('connect');
  });

  it('treats bible, word, and devotional as faith personal routes', () => {
    expect(isBuklodFaithPersonalRoute('/bible')).toBe(true);
    expect(isBuklodFaithPersonalRoute('/bible/read')).toBe(true);
    expect(isBuklodFaithPersonalRoute('/word')).toBe(true);
    expect(isBuklodFaithPersonalRoute('/devotional/abc')).toBe(true);
    expect(isBuklodFaithPersonalRoute('/inspire')).toBe(true);
    expect(isBuklodFaithPersonalRoute('/scope/buklod-lesson')).toBe(false);
  });
});
