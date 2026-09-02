import {
  isExactScopeAdmin,
  isScopeAdmin,
  scopeHasRole,
} from '@/lib/buklodAccess';
import type { BuklodScope } from '@/lib/buklodScope';
import {
  formatScopeTypeLabel,
  isSubOrganizationScope,
} from '@/lib/buklodScope';
import { focusAppForPathname } from '@/lib/buklodFoundation';
import {
  canManageExactScope,
  isActiveMembershipStatus,
  isPendingMembershipStatus,
  membershipStatusFromRow,
  organizationScopeParams,
  readOrganizationScopeId,
} from '@/lib/buklodOrganization';

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

describe('BUKLOD shared access foundation', () => {
  it('does not treat scoped org admin as System Admin', () => {
    const orgAdmin = scope({
      is_admin: true,
      role_keys: ['org_admin'],
    });

    expect(isExactScopeAdmin(orgAdmin)).toBe(true);
    expect(isScopeAdmin(orgAdmin)).toBe(true);
    expect(scopeHasRole(orgAdmin, 'system_admin')).toBe(false);
  });

  it('keeps System Admin as a separate identity from exact-scope admin roles', () => {
    const member = scope({
      is_admin: false,
      role_keys: ['member'],
    });

    expect(isExactScopeAdmin(member)).toBe(false);
    expect(isScopeAdmin(member)).toBe(false);
  });

  it('does not inherit parent admin onto a child scope', () => {
    const child = scope({
      scope_id: 'child-1',
      parent_scope_id: 'parent-1',
      is_admin: false,
      role_keys: ['member'],
    });

    expect(isExactScopeAdmin(child)).toBe(false);
    expect(canManageExactScope('child-1', ['parent-1'])).toBe(false);
    expect(canManageExactScope('child-1', ['child-1'])).toBe(true);
  });

  it('labels canonical scopes without introducing Church as a UI type', () => {
    expect(formatScopeTypeLabel('ORGANIZATION')).toBe('Organization');
    expect(
      formatScopeTypeLabel('ORGANIZATION', null, 'parent-1')
    ).toBe('Sub-organization');
    expect(formatScopeTypeLabel('CLUSTER')).toBe('Cluster');
    expect(formatScopeTypeLabel('CHURCH')).toBe('Location');
    expect(formatScopeTypeLabel('LOCAL')).toBe('Location');
    expect(
      isSubOrganizationScope({
        scope_type: 'ORGANIZATION',
        parent_scope_id: 'parent-1',
      })
    ).toBe(true);
  });
});

describe('BUKLOD organization route helpers', () => {
  it('reads every organization scope id alias', () => {
    expect(
      readOrganizationScopeId({ organization: 'aaa' })
    ).toBe('aaa');
    expect(
      readOrganizationScopeId({ scopeId: 'bbb' })
    ).toBe('bbb');
    expect(
      readOrganizationScopeId({ organization_id: 'ccc' })
    ).toBe('ccc');
    expect(
      organizationScopeParams('xyz').organization
    ).toBe('xyz');
    expect(organizationScopeParams('xyz').scopeId).toBe('xyz');
  });

  it('does not treat missing membership status as ACTIVE', () => {
    expect(isActiveMembershipStatus(undefined)).toBe(false);
    expect(isActiveMembershipStatus('PENDING')).toBe(false);
    expect(isPendingMembershipStatus('PENDING')).toBe(true);
    expect(
      membershipStatusFromRow({ status: undefined })
    ).toBe('');
    expect(
      isActiveMembershipStatus(
        membershipStatusFromRow({ membership_status: 'ACTIVE' })
      )
    ).toBe(true);
  });
});

describe('BUKLOD focus-app routing', () => {
  it('maps Faculty screens onto the shared faculty entitlement', () => {
    expect(focusAppForPathname('/profile/buklod-faculty')).toBe(
      'faculty'
    );
    expect(
      focusAppForPathname('/profile/buklod-faculty-class')
    ).toBe('faculty');
    expect(focusAppForPathname('/profile/buklod-business')).toBe(
      'business'
    );
    expect(focusAppForPathname('/giving')).toBeNull();
    expect(focusAppForPathname('/scope/attendance')).toBeNull();
  });
});
