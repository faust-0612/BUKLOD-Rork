// PRECONDITION: Edge Function is deployed with verify_jwt=true.
// The Supabase gateway MUST cryptographically verify signature, expiry and
// project before passing Authorization to the handler. This helper merely
// checks the already-verified JWT's privileged role; it is NOT a verifier.
// Never use this helper for a public endpoint or with verify_jwt=false.
export function hasGatewayVerifiedServiceRoleClaims(token, nowSeconds = Date.now() / 1000) {
  if (typeof token !== 'string') return false;
  const segments = token.split('.');
  if (segments.length !== 3 || segments.some((segment) => !segment)) return false;
  try {
    const claims = JSON.parse(atob(segments[1].replace(/-/g, '+').replace(/_/g, '/')));
    return claims?.role === 'service_role' &&
      typeof claims.exp === 'number' &&
      Number.isFinite(claims.exp) &&
      claims.exp > nowSeconds &&
      (claims.nbf === undefined || (typeof claims.nbf === 'number' && claims.nbf <= nowSeconds));
  } catch {
    return false;
  }
}
