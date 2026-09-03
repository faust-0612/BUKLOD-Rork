import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function validDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
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
  const secretHash = (scope: string, value: string) => sha256(`buklod-recovery-v3:${scope}:${value}:${serviceKey}`);
  const ipHash = await secretHash('ip', rawIp || 'unknown');
  const pinHash = (userId: string, pin: string) => sha256(`buklod-pin-v1:${userId}:${pin}:${serviceKey}`);
  const oldCodeHash = (userId: string, code: string) => sha256(`buklod-admin-code-v1:${userId}:${code.toUpperCase()}:${serviceKey}`);
  const lookupCodeHash = (code: string) => sha256(`buklod-admin-code-lookup-v2:${code.toUpperCase()}:${serviceKey}`);

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
      const { data, error } = await admin.from('profiles').select(profileSelect).eq('login_method', 'email').eq('login_identifier', id.value).eq('is_active', true).limit(2);
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
    if (requestId) await admin.from('buklod_account_recovery_requests').update({ status: 'completed', completed_at: now }).eq('id', requestId);
    else await admin.from('buklod_account_recovery_requests').update({ status: 'completed', completed_at: now }).eq('user_id', profile.id).in('status', ['pending', 'code_issued']);
    return { loginMethod: lower(profile.login_method) || 'account', loginIdentifier: loginIdentifier(profile), loginHint: loginHint(profile) };
  }

  if (action === 'recovery_status') {
    const user = await authUser();
    if (!user) return json({ ok: false, message: 'Sign in first.' }, 401);
    const [{ data: c }, { data: p }] = await Promise.all([
      admin.from('buklod_recovery_credentials').select('pin_set_at,locked_until').eq('user_id', user.id).maybeSingle(),
      admin.from('profiles').select(profileSelect).eq('id', user.id).maybeSingle(),
    ]);
    return json({ ok: true, pinConfigured: !!c?.pin_set_at, pinSetAt: c?.pin_set_at ?? null, lockedUntil: c?.locked_until ?? null, loginMethod: lower(p?.login_method) || null, loginHint: p ? loginHint(p) : null });
  }

  if (action === 'set_pin') {
    const user = await authUser();
    if (!user) return json({ ok: false, message: 'Sign in first.' }, 401);
    const pin = text(body?.pin);
    if (!/^\d{6}$/.test(pin)) return json({ ok: false, message: 'Recovery PIN must contain exactly 6 digits.' }, 400);
    if (/^(\d)\1{5}$/.test(pin) || ['123456','654321','000000','111111','121212'].includes(pin)) return json({ ok: false, message: 'Choose a less predictable Recovery PIN.' }, 400);
    const now = new Date().toISOString();
    const { error } = await admin.from('buklod_recovery_credentials').upsert({ user_id: user.id, pin_hash: await pinHash(user.id, pin), pin_set_at: now, failed_attempts: 0, locked_until: null, updated_at: now }, { onConflict: 'user_id' });
    if (error) return json({ ok: false, message: 'Could not save Recovery PIN.' }, 500);
    await event('pin_set', 'success', { userId: user.id, actorId: user.id });
    return json({ ok: true, pinSetAt: now });
  }

  if (action === 'request_admin_recovery') {
    const raw = text(body?.identifier || body?.username);
    const identityKey = `${lower(body?.firstName)}|${lower(body?.middleName)}|${lower(body?.surname)}|${text(body?.birthDate)}`;
    const gate = await rate('request_admin_recovery', raw || identityKey || 'invalid', 60, 3, 12);
    const generic = 'Your request was received. If we can match the account, a BUKLOD System Admin can assist after identity verification.';
    if (gate.blocked) return json({ ok: true, message: generic });

    let profile: any = null;
    try { profile = raw ? await byIdentifier(raw) : await byIdentity(); }
    catch (e) { console.error('Recovery match failed', e); return json({ ok: false, message: 'Could not submit the recovery request right now.' }, 500); }

    if (profile?.id) {
      const now = new Date().toISOString();
      const { data: rows, error: le } = await admin.from('buklod_account_recovery_requests').select('id,status').eq('user_id', profile.id).in('status', ['pending','code_issued']).order('created_at', { ascending: false }).limit(1);
      if (le) return json({ ok: false, message: 'Could not submit the recovery request right now.' }, 500);
      if (rows?.[0]?.status === 'code_issued') await admin.from('buklod_admin_recovery_codes').update({ used_at: now }).eq('user_id', profile.id).is('used_at', null);
      const snapshot = lower(profile.username) || loginIdentifier(profile) || 'buklod-account';
      let requestId = rows?.[0]?.id ?? null;
      if (requestId) {
        const { error } = await admin.from('buklod_account_recovery_requests').update({ username: snapshot, status: 'pending', requested_at: now, created_at: now, reviewed_by: null, reviewed_at: null, completed_at: null }).eq('id', requestId);
        if (error) return json({ ok: false, message: 'Could not submit the recovery request right now.' }, 500);
      } else {
        const { data, error } = await admin.from('buklod_account_recovery_requests').insert({ user_id: profile.id, username: snapshot, status: 'pending', requested_at: now, created_at: now }).select('id').maybeSingle();
        if (error && error.code !== '23505') return json({ ok: false, message: 'Could not submit the recovery request right now.' }, 500);
        requestId = data?.id ?? null;
      }
      await event('request_admin_recovery_result', 'matched', { userId: profile.id, requestId, subjectHash: gate.subjectHash });
    } else {
      await event('request_admin_recovery_result', 'no_unique_match', { subjectHash: gate.subjectHash });
    }
    return json({ ok: true, message: generic });
  }

  if (action === 'recover_with_pin') {
    const raw = text(body?.identifier || body?.username);
    const id = identifier(raw);
    const pin = text(body?.pin);
    const password = String(body?.newPassword ?? '');
    if (!id || !/^\d{6}$/.test(pin) || !validPassword(password)) return json({ ok: false, message: 'Check your login, Recovery PIN, and new password.' }, 400);
    const gate = await rate('recover_with_pin', `${id.kind}:${id.value}`, 30, 10, 30);
    if (gate.blocked) return json({ ok: false, message: 'Too many recovery attempts. Try again later or use Admin Assistance.' }, 429);

    const profile = await byIdentifier(raw);
    if (!profile?.id) return json({ ok: false, message: 'The login or Recovery PIN does not match. Use Admin Assistance if needed.' }, 400);
    const { data: c, error: ce } = await admin.from('buklod_recovery_credentials').select('pin_hash,failed_attempts,locked_until').eq('user_id', profile.id).maybeSingle();
    if (ce) return json({ ok: false, message: 'Recovery is temporarily unavailable.' }, 500);
    if (!c?.pin_hash) return json({ ok: false, message: 'PIN recovery is unavailable for these details. Use Admin Assistance.' }, 400);
    if (c.locked_until && new Date(c.locked_until).getTime() > Date.now()) return json({ ok: false, message: 'Recovery PIN is temporarily locked. Use Admin Assistance or try again later.' }, 429);

    const incoming = await pinHash(profile.id, pin);
    if (!equal(incoming, String(c.pin_hash))) {
      const failed = Number(c.failed_attempts ?? 0) + 1;
      const lock = failed >= 5;
      await admin.from('buklod_recovery_credentials').update({ failed_attempts: lock ? 0 : failed, locked_until: lock ? new Date(Date.now() + 1800000).toISOString() : null, updated_at: new Date().toISOString() }).eq('user_id', profile.id);
      await event('recover_with_pin_result', lock ? 'locked' : 'invalid', { userId: profile.id, subjectHash: gate.subjectHash });
      return json({ ok: false, message: lock ? 'Too many failed PIN attempts. PIN recovery is locked for 30 minutes.' : 'The login or Recovery PIN does not match. Use Admin Assistance if needed.' }, lock ? 429 : 400);
    }

    try {
      const login = await finish(profile, password);
      await event('recover_with_pin_result', 'success', { userId: profile.id, subjectHash: gate.subjectHash });
      return json({ ok: true, ...login });
    } catch (e) { console.error('PIN reset failed', e); return json({ ok: false, message: 'Password reset could not be completed.' }, 500); }
  }

  if (action === 'admin_list_requests') {
    const user = await authUser();
    if (!user || !(await systemAdmin(user.id))) return json({ ok: false, message: 'System Admin access required.' }, 403);
    const { data: rows, error } = await admin.from('buklod_account_recovery_requests').select('id,user_id,username,status,created_at,requested_at').eq('status', 'pending').order('created_at', { ascending: true });
    if (error) return json({ ok: false, message: 'Could not load recovery requests.' }, 500);
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const { data: profiles } = ids.length ? await admin.from('profiles').select(profileSelect).in('id', ids) : { data: [] as any[] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return json({ ok: true, requests: (rows ?? []).map((r: any) => {
      const p: any = map.get(r.user_id);
      return { ...r, full_name: p?.full_name ?? null, login_method: lower(p?.login_method) || 'unknown', login_hint: p ? loginHint(p) : 'BUKLOD account', mobile_hint: p?.mobile ? maskMobile(phone(p.mobile) || p.mobile) : null, birth_date: p?.birth_date ?? null };
    }) });
  }

  if (action === 'admin_issue_code') {
    const user = await authUser();
    if (!user || !(await systemAdmin(user.id))) return json({ ok: false, message: 'System Admin access required.' }, 403);
    const requestId = text(body?.requestId);
    const { data: rr } = await admin.from('buklod_account_recovery_requests').select('id,user_id,status').eq('id', requestId).maybeSingle();
    if (!rr || rr.status !== 'pending') return json({ ok: false, message: 'Pending recovery request not found.' }, 404);
    const code = randomCode();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 1800000).toISOString();
    await admin.from('buklod_admin_recovery_codes').update({ used_at: now }).eq('user_id', rr.user_id).is('used_at', null);
    const { error } = await admin.from('buklod_admin_recovery_codes').insert({ request_id: rr.id, user_id: rr.user_id, code_hash: await oldCodeHash(rr.user_id, code), code_lookup_hash: await lookupCodeHash(code), expires_at: expiresAt, created_by: user.id });
    if (error) return json({ ok: false, message: 'Could not issue recovery code.' }, 500);
    await admin.from('buklod_account_recovery_requests').update({ status: 'code_issued', reviewed_by: user.id, reviewed_at: now }).eq('id', rr.id).eq('status', 'pending');
    await event('admin_issue_code', 'success', { userId: rr.user_id, requestId, actorId: user.id });
    return json({ ok: true, code, expiresAt });
  }

  if (action === 'admin_reject_request') {
    const user = await authUser();
    if (!user || !(await systemAdmin(user.id))) return json({ ok: false, message: 'System Admin access required.' }, 403);
    const requestId = text(body?.requestId);
    const now = new Date().toISOString();
    const { data: rr, error } = await admin.from('buklod_account_recovery_requests').update({ status: 'rejected', reviewed_by: user.id, reviewed_at: now, completed_at: now }).eq('id', requestId).eq('status', 'pending').select('id,user_id').maybeSingle();
    if (error || !rr) return json({ ok: false, message: 'Pending recovery request not found.' }, 404);
    await admin.from('buklod_admin_recovery_codes').update({ used_at: now }).eq('user_id', rr.user_id).is('used_at', null);
    await event('admin_reject_request', 'success', { userId: rr.user_id, requestId, actorId: user.id });
    return json({ ok: true });
  }

  if (action === 'recover_with_admin_code') {
    const code = text(body?.code).toUpperCase();
    const password = String(body?.newPassword ?? '');
    if (!/^[A-Z2-9]{10}$/.test(code) || !validPassword(password)) return json({ ok: false, message: 'Check the one-time code and new password.' }, 400);
    const gate = await rate('recover_with_admin_code', code, 15, 8, 25);
    if (gate.blocked) return json({ ok: false, message: 'Too many recovery-code attempts. Try again later or request a new code.' }, 429);
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
      await event('recover_with_admin_code_result', 'success', { userId: p.id, requestId: rc.request_id, subjectHash: gate.subjectHash });
      return json({ ok: true, ...login });
    } catch (e) {
      console.error('Admin code reset failed', e);
      await admin.from('buklod_admin_recovery_codes').update({ used_at: null }).eq('id', rc.id);
      return json({ ok: false, message: 'Password reset could not be completed.' }, 500);
    }
  }

  return json({ ok: false, message: 'Unknown recovery action.' }, 400);
});
