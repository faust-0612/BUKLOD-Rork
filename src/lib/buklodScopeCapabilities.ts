import type { BuklodScope } from '@/lib/buklodScope';
import { isMzbOrganizationScope } from '@/lib/buklodMzbOrganization';

export type ScopeCapabilityKey =
  | 'home'
  | 'community'
  | 'connect'
  | 'manage'
  | 'members'
  | 'functionalRoles'
  | 'admins'
  | 'inviteMember'
  | 'membershipRequests'
  | 'events'
  | 'attendance'
  | 'files'
  | 'announcements'
  | 'analytics'
  | 'settings'
  | 'childScopes'
  | 'faithPanel'
  | 'mzbWidgets';

export type ScopeCapabilities = Record<
  ScopeCapabilityKey,
  boolean
>;

type Input = {
  scope: Pick<
    BuklodScope,
    | 'scope_id'
    | 'scope_type'
    | 'parent_scope_id'
    | 'is_admin'
    | 'show_faith_content'
    | 'is_mzb_organization'
  >;
  isExactScopeAdmin?: boolean;
  isSystemAdmin?: boolean;
};

/**
 * Single capability resolver for scoped workspace features.
 */
export function getScopeCapabilities(
  input: Input
): ScopeCapabilities {
  const type = String(input.scope.scope_type ?? '')
    .trim()
    .toUpperCase();

  const isOrgOrCluster =
    type === 'ORGANIZATION' || type === 'CLUSTER';

  const canManage =
    Boolean(input.scope.is_admin) ||
    Boolean(input.isExactScopeAdmin) ||
    Boolean(input.isSystemAdmin);

  const isMzb = isMzbOrganizationScope(input.scope);

  return {
    home: true,
    community: isOrgOrCluster || type === 'LOCAL' || type === 'CHURCH',
    connect: isOrgOrCluster || type !== 'PUBLIC',
    manage: isOrgOrCluster && canManage,
    members: isOrgOrCluster,
    functionalRoles: isOrgOrCluster && canManage,
    admins: type === 'ORGANIZATION' && canManage,
    inviteMember: type === 'ORGANIZATION' && canManage,
    membershipRequests: type === 'ORGANIZATION' && canManage,
    events: isOrgOrCluster,
    attendance: isOrgOrCluster,
    files: isOrgOrCluster && canManage,
    announcements: isOrgOrCluster,
    analytics: isOrgOrCluster && canManage,
    settings: type === 'ORGANIZATION' && canManage,
    childScopes:
      type === 'ORGANIZATION' &&
      canManage &&
      !input.scope.parent_scope_id,
    faithPanel: Boolean(input.scope.show_faith_content),
    mzbWidgets: isMzb,
  };
}
