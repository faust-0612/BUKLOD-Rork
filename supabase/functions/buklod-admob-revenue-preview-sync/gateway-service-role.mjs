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


// PRECONDITION: only call behind verify_jwt=true. Supabase's API gateway also
// verifies modern sb_secret_ service-role keys via minted compatibility tokens.
// The handler receives the original opaque key, not the gateway's minted JWT.
// Compare ONLY against this project's server-held SUPABASE_SERVICE_ROLE_KEY;
// never accept publishable keys, arbitrary role claims or client-supplied roles.
// A fixed-width comparison avoids leaking matching prefix length via early exit.
export function hasGatewayVerifiedServiceRoleSecretKey(token, expectedServerKey) {
  if (typeof token !== 'string' || typeof expectedServerKey !== 'string'
      || !/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(expectedServerKey)
      || token.length !== expectedServerKey.length) return false;
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expectedServerKey.charCodeAt(i);
  }
  return mismatch === 0;
}
