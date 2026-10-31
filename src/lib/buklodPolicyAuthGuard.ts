/** Pure guards: an offline snapshot is not an authenticated online Supabase session. */
export function mayRestoreOfflineAuthSnapshot(status: string): boolean {
  return status === 'offline';
}
export function hasMatchingPolicySession(
  session: { access_token?: string; user?: { id?: string } } | null | undefined,
  expectedUserId: string
): boolean {
  return Boolean(expectedUserId && session?.user?.id === expectedUserId &&
    typeof session?.access_token === 'string' && session.access_token.length > 0);
}
export function allRequiredPoliciesAccepted(
  policies: ReadonlyArray<{ accepted: boolean }>
): boolean {
  return policies.every(p => p.accepted === true);
}
