/**
 * Canonical BUKLOD Home contexts. A label of "Home" does not imply shared
 * account ownership, state or financial queries.
 *
 * Compatibility routes are preserved; no personal wallet is mounted by
 * organization/cluster or family dashboards.
 */
export const BUKLOD_HOME_SURFACES = {
  PUBLIC_HUB: {
    id: 'public-hub',
    label: 'BUKLOD Hub',
    route: '/(tabs)/hub',
    context: 'PUBLIC_APP',
  },
  SCOPE_HOME: {
    id: 'scope-home',
    label: 'Scope Home',
    route: '/scope',
    context: 'MEMBERSHIP_SCOPE',
  },
  FAMILY_HOME: {
    id: 'family-home',
    label: 'BUKLOD Bahay',
    route: '/personal-home',
    context: 'HOUSEHOLD',
  },
  RETIRED_PUBLIC_HOME: {
    id: 'retired-public-home',
    label: 'Retired Public Home',
    route: '/(tabs)/home',
    context: 'REDIRECT_ONLY',
  },
} as const;

export const BUKLOD_PERSONAL_EARNINGS_ROUTE = '/bayanihan' as const;
export const BUKLOD_PERSONAL_CONTRIBUTION_ROUTE = '/community-contribution' as const;
