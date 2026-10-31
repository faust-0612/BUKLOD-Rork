/**
 * Public Cluster invitation links.
 *
 * Use HTTPS for anything shared outside BUKLOD: Android messaging apps do not
 * reliably linkify custom schemes. Keep accepting the original custom scheme
 * so QR codes / messages shared by earlier clients remain valid.
 */
export const BUKLOD_CLUSTER_INVITE_ORIGIN = 'https://buklod.expo.app';

const CLUSTER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildClusterInviteWebUrl(scopeId: string): string {
  const id = String(scopeId ?? '').trim();
  return `${BUKLOD_CLUSTER_INVITE_ORIGIN}/clusters/${encodeURIComponent(id)}?fromInvite=1`;
}

/**
 * A staging/classroom binary must not share a production HTTPS destination.
 * Only the production main scheme is backed by the public web invitation URL.
 */
export function buildClusterInviteUrlForScheme(
  scopeId: string,
  scheme = 'buklod'
): string {
  const normalized = String(scheme || 'buklod').trim().toLowerCase();
  if (normalized === 'buklod') return buildClusterInviteWebUrl(scopeId);

  // No assumed staging or classroom web host until separately verified.
  return `${normalized}://clusters/${encodeURIComponent(String(scopeId ?? '').trim())}`;
}

export function parseClusterInviteLink(value: string): string | null {
  const input = String(value ?? '').trim();
  if (!input) return null;

  // Never accept lookalike hosts or arbitrary URLs containing "/clusters/".
  const match = [
    /^https:\/\/buklod\.expo\.app\/clusters\/([^/?#]+)\/?(?:[?#].*)?$/i,
    /^buklod(?:-staging)?:\/\/clusters\/([^/?#]+)\/?(?:[?#].*)?$/i,
    /^\/?clusters\/([^/?#]+)\/?(?:[?#].*)?$/i,
  ].map(pattern => input.match(pattern)).find(Boolean);

  if (!match?.[1]) return null;

  try {
    const id = decodeURIComponent(match[1]);
    return CLUSTER_UUID.test(id) ? id : null;
  } catch {
    return null;
  }
}
