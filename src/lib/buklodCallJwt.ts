/**
 * Expiry guard for Stream and Supabase JWTs in React Native and browsers.
 * Decodes only the public JWT payload; never trusts it for authorization.
 * No atob/Buffer dependency: Hermes may not expose either global.
 */
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function isBuklodCallJwtExpired(token: string, skewSeconds = 90): boolean {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload || payload.length > 16_384) return true;

    let bits = 0;
    let value = 0;
    let decoded = '';
    for (const character of payload) {
      const index = BASE64URL.indexOf(character);
      if (index < 0) return true;
      value = (value << 6) | index;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        decoded += String.fromCharCode((value >>> bits) & 0xff);
      }
    }
    const expirySeconds = Number(JSON.parse(decoded)?.exp);
    if (!Number.isFinite(expirySeconds) || expirySeconds <= 0) return true;
    return expirySeconds * 1000 <= Date.now() + Math.max(0, skewSeconds) * 1000;
  } catch {
    // Never send an uninspectable token as a fallback for an expired one.
    return true;
  }
}
