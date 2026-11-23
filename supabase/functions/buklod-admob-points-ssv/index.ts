/**
 * AdMob rewarded-points SSV webhook. Public URL, but ZERO public credit authority:
 * every callback must carry Google's ECDSA P-256 signature, a configured unit ID,
 * a fresh timestamp, user id and server-issued one-use nonce.
 *
 * Set AdMob rewarded unit -> Server-side verification callback to this function.
 * Required Edge secret: BUKLOD_ADMOB_REWARDED_UNIT_ID (numeric suffix or full unit).
 * Deploy with verify_jwt=false ONLY for this signed Google callback.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

type GoogleKey = { keyId: number; base64: string };
const GOOGLE_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const MAX_TIMESTAMP_DRIFT_MS = 30 * 60 * 1000;
const KEY_CACHE_MS = 12 * 60 * 60 * 1000;
let cachedKeys: GoogleKey[] = [];
let cachedUntil = 0;

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
function base64ToBytes(data: string) {
  const normal = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normal + '='.repeat((4 - normal.length % 4) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
// Google's SSV ECDSA signatures are ASN.1 DER; WebCrypto expects IEEE-P1363 r||s.
export function derSignatureToP1363(der: Uint8Array): Uint8Array {
  let p = 0;
  function readLength(): number {
    if (p >= der.length) throw Error('Bad DER length');
    const first = der[p++];
    if (first < 128) return first;
    const count = first & 0x7f;
    if (!count || count > 2 || p + count > der.length) throw Error('Bad DER length');
    let length = 0;
    for (let i = 0; i < count; i++) length = length * 256 + der[p++];
    return length;
  }
  if (der[p++] !== 0x30) throw Error('Not an ECDSA DER sequence');
  const end = p + readLength();
  if (end !== der.length) throw Error('Malformed ECDSA DER sequence');
  function readInteger(): Uint8Array {
    if (der[p++] !== 0x02) throw Error('Not a DER INTEGER');
    const length = readLength();
    if (length < 1 || p + length > end) throw Error('Invalid DER INTEGER');
    let integer = der.slice(p, p + length);
    p += length;
    while (integer.length > 1 && integer[0] === 0) integer = integer.slice(1);
    if (integer.length > 32) throw Error('ECDSA INTEGER is too long');
    const part = new Uint8Array(32);
    part.set(integer, 32 - integer.length);
    return part;
  }
  const r = readInteger(), s = readInteger();
  if (p !== end) throw Error('Trailing DER data');
  const signature = new Uint8Array(64);
  signature.set(r, 0); signature.set(s, 32);
  return signature;
}
async function getGoogleKeys(): Promise<GoogleKey[]> {
  if (cachedKeys.length && Date.now() < cachedUntil) return cachedKeys;
  const response = await fetch(GOOGLE_KEYS_URL, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Error('Google verification keys unavailable');
  const json = await response.json();
  const list = Array.isArray(json.keys) ? json.keys.filter(
    (k: unknown): k is GoogleKey =>
      !!k && typeof k === 'object' &&
      typeof (k as GoogleKey).keyId === 'number' &&
      typeof (k as GoogleKey).base64 === 'string',
  ) : [];
  if (!list.length) throw Error('Google verification key set empty');
  cachedKeys = list;
  cachedUntil = Date.now() + KEY_CACHE_MS;
  return list;
}
export async function verifyGoogleSsvUrl(url: URL): Promise<URLSearchParams> {
  const raw = url.search.startsWith('?') ? url.search.slice(1) : url.search;
  const match = raw.match(/^(.*)&signature=([^&]+)&key_id=(\d+)$/);
  if (!match || !match[1] || match[1].includes('&signature=') ||
      match[1].includes('&key_id=')) throw Error('Bad SSV envelope');
  const params = new URLSearchParams(raw);
  const unique = ['signature', 'key_id', 'user_id', 'custom_data',
    'transaction_id', 'timestamp', 'ad_unit'];
  if (unique.some((name) => params.getAll(name).length !== 1)) {
    throw Error('Missing or duplicated SSV parameter');
  }
  const keyId = Number(match[3]);
  const keys = await getGoogleKeys();
  const trustedKey = keys.find((candidate) => candidate.keyId === keyId);
  if (!trustedKey) throw Error('Unknown SSV verification key');
  const spki = base64ToBytes(trustedKey.base64);
  const publicKey = await crypto.subtle.importKey(
    'spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
  );
  const signature = derSignatureToP1363(base64ToBytes(match[2]));
  const verified = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, publicKey, signature,
    new TextEncoder().encode(match[1]),
  );
  if (!verified) throw Error('Invalid AdMob signature');
  return params;
}

Deno.serve(async (request) => {
  if (request.method !== 'GET') return respond(405, { ok: false });
  const unit = Deno.env.get('BUKLOD_ADMOB_REWARDED_UNIT_ID')?.trim();
  const serviceUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!unit || !serviceUrl || !serviceKey) return respond(503, { ok: false, reason: 'not_configured' });

  let params: URLSearchParams;
  try {
    params = await verifyGoogleSsvUrl(new URL(request.url));
  } catch {
    // Never trust a self-reported client "earned" event; signature is mandatory.
    return respond(403, { ok: false, reason: 'invalid_signature' });
  }

  const expectedUnit = unit.split('/').at(-1);
  const adUnit = params.get('ad_unit') ?? '';
  const userId = params.get('user_id') ?? '';
  const nonce = params.get('custom_data') ?? '';
  const transactionId = params.get('transaction_id') ?? '';
  const timestampRaw = params.get('timestamp') ?? '';
  const timestamp = Number(timestampRaw);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (adUnit !== expectedUnit || !uuid.test(userId) || !uuid.test(nonce) ||
      !/^[a-zA-Z0-9_-]{12,128}$/.test(transactionId) ||
      !/^\d{13}$/.test(timestampRaw) || !Number.isFinite(timestamp) ||
      Math.abs(Date.now() - timestamp) > MAX_TIMESTAMP_DRIFT_MS) {
    return respond(403, { ok: false, reason: 'invalid_reward_context' });
  }

  try {
    const supabase = createClient(serviceUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase.rpc('confirm_buklod_ad_points_bonus_ssv_v1', {
      p_nonce: nonce, p_user_id: userId, p_transaction_id: transactionId,
    });
    if (error) {
      // Transient failures should be retried by AdMob. No partial credit occurs.
      return respond(503, { ok: false, reason: 'confirmation_unavailable' });
    }
    return respond(200, { ok: data?.credited === true, already_processed: data?.already_processed === true });
  } catch {
    return respond(503, { ok: false, reason: 'confirmation_unavailable' });
  }
});
