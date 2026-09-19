import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-buklod-client, x-retry-count, traceparent, tracestate, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '3600',
};

const profileSelect = 'id,username,full_name,first_name,middle_name,surname,suffix,birth_date,mobile,login_method,login_identifier,is_active';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
function text(v: unknown) { return String(v ?? '').trim(); }
function lower(v: unknown) { return text(v).toLowerCase(); }
function namePart(v: unknown) { return text(v).replace(/\s+/g, ' '); }
function validPassword(v: string) { return v.length >= 8 && v.length <= 128; }
function validUsername(v: string) { return /^(?=.*[a-z])[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(v); }
function realEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !v.endsWith('@buklod.invalid'); }
function validUuid(v: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }
function validDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
function phone(v: unknown) {
  const raw = text(v).replace(/[^\d+]/g, '');
  if (/^\+639\d{9}$/.test(raw)) return raw;
  if (/^639\d{9}$/.test(raw)) return `+${raw}`;
  if (/^09\d{9}$/.test(raw)) return `+63${raw.slice(1)}`;
  return null;
}
type Identifier = { kind: 'username' | 'mobile' | 'email'; value: string };
function identifier(v: unknown): Identifier | null {
  const raw = text(v);
  const mobile = phone(raw);
  if (mobile) return { kind: 'mobile', value: mobile };
  const clean = raw.toLowerCase();
  if (realEmail(clean)) return { kind: 'email', value: clean };
  if (validUsername(clean)) return { kind: 'username', value: clean };
  return null;
}
async function sha256(v: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}
function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function bytesToB64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function b64ToBytes(v: string) { return Uint8Array.from(atob(v), c => c.charCodeAt(0)); }
function mobileVariants(v: string) {
  const digits = v.replace(/\D/g, '');
  return Array.from(new Set([v, digits, digits.startsWith('63') ? `0${digits.slice(2)}` : digits]));
}
function loginIdentifier(p: any) {
  const method = lower(p?.login_method);
  const saved = text(p?.login_identifier);
  const username = lower(p?.username);
  const mobile = phone(p?.mobile);
  if (method === 'username') return username || saved.toLowerCase();
  if (method === 'mobile') return phone(saved) || mobile || saved;
  if (method === 'email') return saved.toLowerCase();
  return username || mobile || saved;
}
function maskEmail(v: string) {
  const [local, domain] = v.split('@');
  if (!local || !domain) return 'Email account';
  return `${local.slice(0, Math.min(2, local.length))}${local.length > 2 ? '•••' : ''}@${domain}`;
}
function maskMobile(v: string) {
  const tail = v.replace(/\D/g, '').slice(-4);
  return tail ? `+63 ••• ••• ${tail}` : 'Mobile account';
}
function maskUsername(v: string) {
  if (!v) return 'Username account';
  return `@${v.slice(0, Math.min(2, v.length))}${v.length > 2 ? '••••' : '•'}`;
}
function loginHint(p: any) {
  const method = lower(p?.login_method);
  const value = loginIdentifier(p);
  if (method === 'email') return maskEmail(value);
  if (method === 'mobile') return maskMobile(value);
  if (method === 'username') return maskUsername(value);
  if (phone(value)) return maskMobile(value);
  if (realEmail(value.toLowerCase())) return maskEmail(value.toLowerCase());
  return value ? maskUsername(value.toLowerCase()) : 'BUKLOD account';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ ok: false, message: 'Recovery service is not configured.' }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, message: 'Invalid request.' }, 400); }
  const action = text(body?.action);
  const rawIp = text(req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown');
  const secretHash = (scope: string, value: string) => sha256(`buklod-recovery-v4:${scope}:${value}:${serviceKey}`);
  const ipHash = await secretHash('ip', rawIp || 'unknown');
  const oldCodeHash = (userId: string, code: string) => sha256(`buklod-admin-code-v1:${userId}:${code.toUpperCase()}:${serviceKey}`);
  const lookupCodeHash = (code: string) => sha256(`buklod-admin-code-lookup-v2:${code.toUpperCase()}:${serviceKey}`);
  const clientTokenHash = (token: string) => secretHash('client-token', token);

  async function encryptionKey() {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`buklod-recovery-delivery-v1:${serviceKey}`));
    return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  async function encryptCode(code: string) {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const key = await encryptionKey();
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(code));
    return { cipher: bytesToB64(new Uint8Array(encrypted)), iv: bytesToB64(iv) };
  }
  async function decryptCode(cipher: string, iv: string) {
    const key = await encryptionKey();
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(iv) }, key, b64ToBytes(cipher));
    return new TextDecoder().decode(clear);
  }
  async function event(eventType: string, outcome: string, opts: { userId?: string | null; requestId?: string | null; actorId?: string | null; subjectHash?: string | null } = {}) {
    const { error } = await admin.from('buklod_account_recovery_events').insert({
      event_type: eventType,
      outcome,
      user_id: opts.userId ?? null,
      request_id: opts.requestId ?? null,
      actor_id: opts.actorId ?? null,
      subject_hash: opts.subjectHash ?? null,
      ip_hash: ipHash,
    });
    if (error) console.error('Recovery audit write failed', error);
  }
  async function rate(eventType: string, subject: string, minutes: number, subjectLimit: number, ipLimit: number) {
    const subjectHash = await secretHash('subject', `${eventType}:${subject}`);
    const since = new Date(Date.now() - minutes * 60000).toISOString();
    const [s, i] = await Promise.all([
      admin.from('buklod_account_recovery_events').select('id', { count: 'exact', head: true }).eq('event_type', eventType).eq('subject_hash', subjectHash).gte('created_at', since),
      admin.from('buklod_account_recovery_events').select('id', { count: 'exact', head: true }).eq('event_type', eventType).eq('ip_hash', ipHash).gte('created_at', since),
    ]);
    if (s.error || i.error) return { blocked: true, subjectHash };
    const blocked = Number(s.count ?? 0) >= subjectLimit || Number(i.count ?? 0) >= ipLimit;
    await event(eventType, blocked ? 'rate_limited' : 'attempt', { subjectHash });
    return { blocked, subjectHash };
  }
  async function requestRecoveryRate(subject: string, minutes: number, subjectLimit: number, ipLimit: number) {
    const attemptEventType = 'request_admin_recovery_v4';
    const resultEventType = 'request_admin_recovery_v4_result';
    const subjectHash = await secretHash('subject', `${attemptEventType}:${subject}`);
    const since = new Date(Date.now() - minutes * 60000).toISOString();

    const [s, i] = await Promise.all([
      admin.from('buklod_account_recovery_events')
        .select('request_id,created_at')
        .eq('event_type', resultEventType)
        .eq('subject_hash', subjectHash)
        .not('request_id', 'is', null)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(200),
      admin.from('buklod_account_recovery_events')
        .select('request_id,created_at')
        .eq('event_type', resultEventType)
        .eq('ip_hash', ipHash)
        .not('request_id', 'is', null)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(500),
    ]);

    if (s.error || i.error) {
      console.error('Recovery request rate check failed', s.error ?? i.error);
      return { blocked: false, checkError: true, subjectHash, retryAfterSeconds: 0 };
    }

    const distinct = (rows: any[] | null) => {
      const seen = new Set<string>();
      const accepted: { id: string; createdAt: number }[] = [];
      for (const row of rows ?? []) {
        const id = text(row?.request_id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const createdAt = new Date(String(row?.created_at ?? '')).getTime();
        if (!Number.isFinite(createdAt)) continue;
        accepted.push({ id, createdAt });
      }
      return accepted;
    };

    const subjectRequests = distinct(s.data as any[] | null);
    const ipRequests = distinct(i.data as any[] | null);
    const blockedBySubject = subjectRequests.length >= subjectLimit;
    const blockedByIp = ipRequests.length >= ipLimit;
    const blocked = blockedBySubject || blockedByIp;

    let retryAfterSeconds = 0;
    const now = Date.now();
    const windowMs = minutes * 60000;
    if (blockedBySubject && subjectRequests[0]) {
      retryAfterSeconds = Math.max(
        retryAfterSeconds,
        Math.ceil((subjectRequests[0].createdAt + windowMs - now) / 1000),
      );
    }
    if (blockedByIp && ipRequests[0]) {
      retryAfterSeconds = Math.max(
        retryAfterSeconds,
        Math.ceil((ipRequests[0].createdAt + windowMs - now) / 1000),
      );
    }

    await event(attemptEventType, blocked ? 'rate_limited' : 'attempt', { subjectHash });
    return {
      blocked,
      checkError: false,
      subjectHash,
      retryAfterSeconds: Math.max(0, retryAfterSeconds),
    };
  }

  async function authUser() {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    const token = auth.slice(7).trim();
    if (!token) return null;
    const client = createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data, error } = await client.auth.getUser(token);
    return error ? null : data.user;
  }
  async function systemAdmin(userId: string) {
    const { data: p } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (p?.role === 'system_admin') return true;
    const { data: r } = await admin.from('user_roles').select('user_id').eq('user_id', userId).eq('role', 'system_admin').eq('is_active', true).maybeSingle();
    return !!r;
  }
  async function byIdentifier(raw: unknown) {
    const id = identifier(raw);
    if (!id) return null;
    if (id.kind === 'username') {
      const { data, error } = await admin.from('profiles').select(profileSelect).or(`username.eq.${id.value},login_identifier.eq.${id.value}`).eq('is_active', true).limit(2);
      if (error) throw error;
      return (data ?? []).length === 1 ? data![0] : null;
    }
    if (id.kind === 'email') {
      const { data, error } = await admin.from('profiles').select(profileSelect).eq('login_method', 'email').ilike('login_identifier', id.value).eq('is_active', true).limit(2);
      if (error) throw error;
      return (data ?? []).length === 1 ? data![0] : null;
    }
    const variants = mobileVariants(id.value);
    const { data: a, error: ae } = await admin.from('profiles').select(profileSelect).eq('login_method', 'mobile').in('login_identifier', variants).eq('is_active', true).limit(2);
    if (ae) throw ae;
    if ((a ?? []).length === 1) return a![0];
    if ((a ?? []).length > 1) return null;
    const { data: b, error: be } = await admin.from('profiles').select(profileSelect).in('mobile', variants).eq('is_active', true).limit(2);
    if (be) throw be;
    return (b ?? []).length === 1 ? b![0] : null;
  }
  async function byIdentity() {
    const first = namePart(body?.firstName);
    const middle = namePart(body?.middleName);
    const surname = namePart(body?.surname);
    const birth = text(body?.birthDate);
    if (first.length < 2 || surname.length < 2 || /[%_]/.test(`${first}${middle}${surname}`) || !validDate(birth)) return null;
    let q = admin.from('profiles').select(profileSelect).ilike('first_name', first).ilike('surname', surname).eq('birth_date', birth).eq('is_active', true).limit(3);
    if (middle) q = q.ilike('middle_name', middle);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).length === 1 ? data![0] : null;
  }
  async function finish(profile: any, password: string, requestId?: string | null) {
    const { error } = await admin.auth.admin.updateUserById(profile.id, { password });
    if (error) throw error;
    await admin.from('buklod_recovery_credentials').update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() }).eq('user_id', profile.id);
    const now = new Date().toISOString();
    if (requestId) {
      await admin.from('buklod_account_recovery_requests').update({
        status: 'completed', completed_at: now,
        recovery_code_ciphertext: null, recovery_code_iv: null,
        recovery_code_expires_at: null,
      }).eq('id', requestId);
    } else {
      await admin.from('buklod_account_recovery_requests').update({ status: 'completed', completed_at: now }).eq('user_id', profile.id).in('status', ['pending', 'code_issued']);
    }
    return { loginMethod: lower(profile.login_method) || 'account', loginIdentifier: loginIdentifier(profile), loginHint: loginHint(profile) };
  }

  if (action === 'request_admin_recovery') {
    const raw = text(body?.identifier || body?.username);
    const first = namePart(body?.firstName);
    const middle = namePart(body?.middleName);
    const surname = namePart(body?.surname);
    const birth = text(body?.birthDate);
    const identityKey = `${lower(first)}|${lower(middle)}|${lower(surname)}|${birth}`;
    const gate = await requestRecoveryRate(raw || identityKey || 'invalid', 60, 3, 12);
    const generic = 'Your request was received. Keep this screen open while a BUKLOD System Admin verifies the account.';
    if (gate.checkError) return json({ ok: false, message: 'Could not check the recovery request limit right now. Please try again.' }, 503);
    if (gate.blocked) return json({
      ok: true,
      message: generic,
      waiting: false,
      rateLimited: true,
      retryAfterSeconds: gate.retryAfterSeconds,
    });

    const token = randomToken();
    const tokenHash = await clientTokenHash(token);
    const tokenExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    let profile: any = null;
    try { profile = raw ? await byIdentifier(raw) : await byIdentity(); }
    catch (e) { console.error('Recovery match failed', e); return json({ ok: false, message: 'Could not submit the recovery request right now.' }, 500); }

    const now = new Date().toISOString();
    let requestId: string | null = null;
    if (profile?.id) {
      const { data: rows, error: le } = await admin.from('buklod_account_recovery_requests').select('id,status').eq('user_id', profile.id).in('status', ['pending','code_issued']).order('created_at', { ascending: false }).limit(1);
      if (le) return json({ ok: false, message: 'Could not submit the recovery request right now.' }, 500);
      const existing = rows?.[0] ?? null;
      if (existing?.status === 'code_issued') await admin.from('buklod_admin_recovery_codes').update({ used_at: now }).eq('user_id', profile.id).is('used_at', null);
      const write = {
        user_id: profile.id,
        username: lower(profile.username) || loginIdentifier(profile) || 'buklod-account',
        status: 'pending', requested_at: now,
        reviewed_by: null, reviewed_at: null, completed_at: null,
        match_status: 'matched', submitted_identifier: raw || null,
        submitted_first_name: first || null, submitted_middle_name: middle || null,
        submitted_surname: surname || null, submitted_birth_date: validDate(birth) ? birth : null,
        subject_hash: gate.subjectHash,
        client_token_hash: tokenHash, client_token_expires_at: tokenExpiresAt,
        recovery_code_ciphertext: null, recovery_code_iv: null,
        recovery_code_expires_at: null, recovery_code_retrieved_at: null,
      };
      if (existing?.id) {
        const { error } = await admin.from('buklod_account_recovery_requests').update(write).eq('id', existing.id);
        if (error) return json({ ok: false, message: 'Could not submit the recovery request right now.' }, 500);
        requestId = existing.id;
      } else {
        const { data, error } = await admin.from('buklod_account_recovery_requests').insert({ ...write, created_at: now }).select('id').maybeSingle();
        if (error) return json({ ok: false, message: 'Could not submit the recovery request right now.' }, 500);
        requestId = data?.id ?? null;
      }
      await event('request_admin_recovery_v4_result', 'matched', { userId: profile.id, requestId, subjectHash: gate.subjectHash });
    } else {
      await event('request_admin_recovery_v4_result', 'not_matched_auto_rejected', {
        subjectHash: gate.subjectHash,
      });
      return json({
        ok: false,
        code: 'NOT_MATCHED',
        waiting: false,
        matched: false,
        message: 'NOT MATCHED — the information entered does not match an active BUKLOD account. Check it and try again.',
      }, 404);
    }

    if (!requestId) return json({ ok: false, message: 'Could not create a recovery session.' }, 500);
    return json({ ok: true, message: generic, waiting: true, requestId, requestToken: token, sessionExpiresAt: tokenExpiresAt, pollAfterMs: 4000 });
  }

  if (action === 'recovery_request_status') {
    const requestId = text(body?.requestId);
    const token = text(body?.requestToken).toLowerCase();
    if (!validUuid(requestId) || !/^[0-9a-f]{64}$/.test(token)) return json({ ok: false, state: 'invalid', message: 'Recovery session is invalid.' }, 400);
    const hash = await clientTokenHash(token);
    const { data: rr, error } = await admin.from('buklod_account_recovery_requests')
      .select('id,status,client_token_expires_at,recovery_code_ciphertext,recovery_code_iv,recovery_code_expires_at,recovery_code_retrieved_at')
      .eq('id', requestId).eq('client_token_hash', hash).maybeSingle();
    if (error) return json({ ok: false, state: 'error', message: 'Could not check recovery status.' }, 500);
    if (!rr) return json({ ok: false, state: 'invalid', message: 'Recovery session is invalid.' }, 404);
    if (!rr.client_token_expires_at || new Date(rr.client_token_expires_at).getTime() <= Date.now()) return json({ ok: true, state: 'session_expired', message: 'Recovery session expired. Submit a new request.' });
    if (rr.status === 'pending') return json({ ok: true, state: 'waiting', message: 'Waiting for System Admin verification.' });
    if (rr.status === 'rejected' || rr.status === 'cancelled') return json({ ok: true, state: 'rejected', message: 'This recovery request was not verified. Submit a new request if needed.' });
    if (rr.status === 'completed') return json({ ok: true, state: 'completed', message: 'This recovery request has already been completed.' });
    if (rr.status !== 'code_issued') return json({ ok: true, state: 'waiting' });
    if (!rr.recovery_code_expires_at || new Date(rr.recovery_code_expires_at).getTime() <= Date.now()) return json({ ok: true, state: 'code_expired', message: 'The recovery code expired. Submit a new request.' });
    if (!rr.recovery_code_ciphertext || !rr.recovery_code_iv) return json({ ok: false, state: 'error', message: 'Verified code delivery is unavailable. Submit a new request.' }, 500);
    try {
      const code = await decryptCode(String(rr.recovery_code_ciphertext), String(rr.recovery_code_iv));
      if (!/^[A-Z2-9]{10}$/.test(code)) throw new Error('invalid decrypted code');
      if (!rr.recovery_code_retrieved_at) {
        await admin.from('buklod_account_recovery_requests').update({ recovery_code_retrieved_at: new Date().toISOString() }).eq('id', rr.id).is('recovery_code_retrieved_at', null);
        await event('recovery_code_auto_delivery', 'success', { requestId: rr.id });
      }
      return json({ ok: true, state: 'verified', code, codeExpiresAt: rr.recovery_code_expires_at, message: 'Account verified. Your one-time recovery code is ready.' });
    } catch (e) {
      console.error('Recovery code decrypt failed', e);
      return json({ ok: false, state: 'error', message: 'Could not retrieve the verified recovery code.' }, 500);
    }
  }

  if (action === 'admin_list_requests') {
    const user = await authUser();
    if (!user || !(await systemAdmin(user.id))) return json({ ok: false, message: 'System Admin access required.' }, 403);
    const { data: rows, error } = await admin.from('buklod_account_recovery_requests')
      .select('id,user_id,username,status,created_at,requested_at,match_status,submitted_identifier,submitted_first_name,submitted_middle_name,submitted_surname,submitted_birth_date,client_token_expires_at,client_token_hash')
      .eq('status', 'pending').order('created_at', { ascending: true });
    if (error) return json({ ok: false, message: 'Could not load recovery requests.' }, 500);
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean))];
    const { data: profiles } = ids.length ? await admin.from('profiles').select(profileSelect).in('id', ids) : { data: [] as any[] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const nowMs = Date.now();
    return json({ ok: true, requests: (rows ?? []).map((r: any) => {
      const p: any = r.user_id ? map.get(r.user_id) : null;
      const submittedName = [r.submitted_first_name, r.submitted_middle_name, r.submitted_surname].filter(Boolean).join(' ').trim();
      const needsMatch = !r.user_id || r.match_status === 'needs_match';
      const autoReady = !!r.client_token_hash && !!r.client_token_expires_at && new Date(r.client_token_expires_at).getTime() > nowMs;
      return {
        id: r.id, user_id: r.user_id, username: r.username, status: r.status,
        created_at: r.created_at, requested_at: r.requested_at,
        match_status: r.match_status, needs_match: needsMatch,
        auto_delivery_ready: autoReady,
        full_name: p?.full_name ?? (submittedName || (needsMatch ? 'NEEDS ACCOUNT MATCH' : null)),
        login_method: p ? (lower(p.login_method) || 'unknown') : 'needs_match',
        login_hint: p ? loginHint(p) : (r.submitted_identifier ? `Submitted: ${r.submitted_identifier}` : 'Submitted identity details require admin matching'),
        mobile_hint: p?.mobile ? maskMobile(phone(p.mobile) || p.mobile) : null,
        birth_date: p?.birth_date ?? r.submitted_birth_date ?? null,
      };
    }) });
  }

  if (action === 'admin_verify_request') {
    const user = await authUser();
    if (!user || !(await systemAdmin(user.id))) return json({ ok: false, message: 'System Admin access required.' }, 403);
    const requestId = text(body?.requestId);
    if (!validUuid(requestId)) return json({ ok: false, message: 'Invalid recovery request.' }, 400);
    const { data: rr } = await admin.from('buklod_account_recovery_requests')
      .select('id,user_id,status,match_status,client_token_hash,client_token_expires_at')
      .eq('id', requestId).maybeSingle();
    if (!rr || rr.status !== 'pending') return json({ ok: false, message: 'Pending recovery request not found.' }, 404);
    if (!rr.user_id || rr.match_status === 'needs_match') return json({ ok: false, message: 'Verify and match the member account first before approval.' }, 409);
    if (!rr.client_token_hash || !rr.client_token_expires_at || new Date(rr.client_token_expires_at).getTime() <= Date.now()) {
      return json({ ok: false, message: 'The member recovery screen is no longer waiting. Ask the member to submit a new Admin Help request.' }, 409);
    }

    const code = randomCode();
    const encrypted = await encryptCode(code);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await admin.from('buklod_admin_recovery_codes').update({ used_at: now }).eq('user_id', rr.user_id).is('used_at', null);
    const { data: inserted, error: codeError } = await admin.from('buklod_admin_recovery_codes').insert({
      request_id: rr.id, user_id: rr.user_id,
      code_hash: await oldCodeHash(rr.user_id, code),
      code_lookup_hash: await lookupCodeHash(code),
      expires_at: expiresAt, created_by: user.id,
    }).select('id').maybeSingle();
    if (codeError || !inserted) return json({ ok: false, message: 'Could not generate the one-time recovery code.' }, 500);

    const { data: updated, error: updateError } = await admin.from('buklod_account_recovery_requests').update({
      status: 'code_issued', reviewed_by: user.id, reviewed_at: now,
      recovery_code_ciphertext: encrypted.cipher,
      recovery_code_iv: encrypted.iv,
      recovery_code_expires_at: expiresAt,
      recovery_code_retrieved_at: null,
    }).eq('id', rr.id).eq('status', 'pending').select('id').maybeSingle();
    if (updateError || !updated) {
      await admin.from('buklod_admin_recovery_codes').update({ used_at: now }).eq('id', inserted.id);
      return json({ ok: false, message: 'Could not finalize recovery verification.' }, 500);
    }
    await event('admin_verify_request_v4', 'success', { userId: rr.user_id, requestId: rr.id, actorId: user.id });
    return json({ ok: true, deliveredAutomatically: true, expiresAt, message: 'Account verified. The one-time code will appear automatically on the member recovery screen.' });
  }

  if (action === 'admin_reject_request') {
    const user = await authUser();
    if (!user || !(await systemAdmin(user.id))) return json({ ok: false, message: 'System Admin access required.' }, 403);
    const requestId = text(body?.requestId);
    const now = new Date().toISOString();
    const { data: rr, error } = await admin.from('buklod_account_recovery_requests').update({ status: 'rejected', reviewed_by: user.id, reviewed_at: now, completed_at: now, recovery_code_ciphertext: null, recovery_code_iv: null, recovery_code_expires_at: null }).eq('id', requestId).eq('status', 'pending').select('id,user_id').maybeSingle();
    if (error || !rr) return json({ ok: false, message: 'Pending recovery request not found.' }, 404);
    if (rr.user_id) await admin.from('buklod_admin_recovery_codes').update({ used_at: now }).eq('user_id', rr.user_id).is('used_at', null);
    await event('admin_reject_request_v4', 'success', { userId: rr.user_id, requestId, actorId: user.id });
    return json({ ok: true });
  }

  if (action === 'recover_with_admin_code') {
    const code = text(body?.code).toUpperCase();
    const password = String(body?.newPassword ?? '');
    if (!/^[A-Z2-9]{10}$/.test(code) || !validPassword(password)) return json({ ok: false, message: 'Check the one-time code and new password.' }, 400);
    const gate = await rate('recover_with_admin_code_v4', code, 15, 8, 25);
    if (gate.blocked) return json({ ok: false, message: 'Too many recovery-code attempts. Try again later or submit a new request.' }, 429);
    const now = new Date().toISOString();
    const lookup = await lookupCodeHash(code);
    const { data: rc } = await admin.from('buklod_admin_recovery_codes').select('id,request_id,user_id,code_hash').eq('code_lookup_hash', lookup).is('used_at', null).gt('expires_at', now).maybeSingle();
    if (!rc) return json({ ok: false, message: 'Invalid or expired recovery code.' }, 400);
    const expected = await oldCodeHash(rc.user_id, code);
    if (!equal(expected, String(rc.code_hash))) return json({ ok: false, message: 'Invalid or expired recovery code.' }, 400);
    const { data: p } = await admin.from('profiles').select(profileSelect).eq('id', rc.user_id).eq('is_active', true).maybeSingle();
    if (!p) return json({ ok: false, message: 'Invalid or expired recovery code.' }, 400);
    const claimedAt = new Date().toISOString();
    const { data: claimed } = await admin.from('buklod_admin_recovery_codes').update({ used_at: claimedAt }).eq('id', rc.id).is('used_at', null).select('id').maybeSingle();
    if (!claimed) return json({ ok: false, message: 'Recovery code has already been used.' }, 400);
    try {
      const login = await finish(p, password, rc.request_id);
      await event('recover_with_admin_code_v4_result', 'success', { userId: p.id, requestId: rc.request_id, subjectHash: gate.subjectHash });
      return json({ ok: true, ...login });
    } catch (e) {
      console.error('Admin code reset failed', e);
      await admin.from('buklod_admin_recovery_codes').update({ used_at: null }).eq('id', rc.id);
      return json({ ok: false, message: 'Password reset could not be completed.' }, 500);
    }
  }

  return json({ ok: false, message: 'Unknown recovery action.' }, 400);
});
