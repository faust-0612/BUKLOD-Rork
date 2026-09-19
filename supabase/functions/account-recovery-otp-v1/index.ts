import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-buklod-client, x-retry-count',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '3600',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
function text(v: unknown) { return String(v ?? '').trim(); }
function lower(v: unknown) { return text(v).toLowerCase(); }
function validPassword(v: string) { return v.length >= 8 && v.length <= 128; }
function validEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !v.endsWith('@buklod.invalid'); }
function validUsername(v: string) { return /^(?=.*[a-z])[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(v); }
function validDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
function namePart(v: unknown) { return text(v).replace(/\s+/g, ' '); }
function maskEmail(v: string) {
  const parts = v.split('@');
  const local = parts[0] || '';
  const domain = parts[1] || '';
  if (!local || !domain) return 'registered email';
  return local.slice(0, Math.min(2, local.length)) + (local.length > 2 ? '•••' : '') + '@' + domain;
}
function maskMobile(v: string) {
  const tail = v.replace(/\D/g, '').slice(-4);
  return tail ? '+63 ••• ••• ' + tail : 'registered mobile';
}

function normalizePhone(v: unknown) {
  const raw = text(v).replace(/[^\d+]/g, '');
  if (/^\+639\d{9}$/.test(raw)) return raw;
  if (/^639\d{9}$/.test(raw)) return `+${raw}`;
  if (/^09\d{9}$/.test(raw)) return `+63${raw.slice(1)}`;
  return null;
}
function parseContact(v: unknown): { channel: 'sms' | 'email'; value: string } | null {
  const raw = text(v);
  const p = normalizePhone(raw);
  if (p) return { channel: 'sms', value: p };
  const e = raw.toLowerCase();
  if (validEmail(e)) return { channel: 'email', value: e };
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
function sixDigitCode() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(100000 + (b[0] % 900000));
}
function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function maskedUsername(v: unknown) {
  const s = lower(v);
  if (!s) return 'BUKLOD account';
  return `@${s.slice(0, Math.min(2, s.length))}${s.length > 2 ? '••••' : '•'}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ ok: false, message: 'Recovery service is not configured.' }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, message: 'Invalid request.' }, 400); }
  const action = text(body?.action);

  const rawIp = text(req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown');
  const secretHash = (scope: string, value: string) => sha256(`buklod-recovery-otp-v1:${scope}:${value}:${serviceKey}`);
  const ipHash = await secretHash('ip', rawIp || 'unknown');
  const contactHashOf = (value: string) => secretHash('contact', value);
  const otpHashOf = (challengeId: string, code: string) => sha256(`buklod-otp-code-v1:${challengeId}:${code}:${serviceKey}`);
  const tokenHashOf = (challengeId: string, token: string) => sha256(`buklod-recovery-token-v1:${challengeId}:${token}:${serviceKey}`);

  async function deliveryKey() {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('buklod-recovery-delivery-v2:' + serviceKey),
    );
    return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  function bytesToB64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
  function b64ToBytes(v: string) { return Uint8Array.from(atob(v), c => c.charCodeAt(0)); }
  async function encryptContact(value: string) {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const key = await deliveryKey();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(value),
    );
    return { cipher: bytesToB64(new Uint8Array(encrypted)), iv: bytesToB64(iv) };
  }
  async function decryptContact(cipher: string, iv: string) {
    const key = await deliveryKey();
    const clear = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(iv) },
      key,
      b64ToBytes(cipher),
    );
    return new TextDecoder().decode(clear);
  }

  async function audit(eventType: string, outcome: string, opts: { userId?: string | null; subjectHash?: string | null } = {}) {
    const { error } = await admin.from('buklod_account_recovery_events').insert({
      event_type: eventType,
      outcome,
      user_id: opts.userId ?? null,
      subject_hash: opts.subjectHash ?? null,
      ip_hash: ipHash,
    });
    if (error) console.error('OTP recovery audit failed', error);
  }

  async function resolveAccounts(contact: { channel: 'sms' | 'email'; value: string }) {
    const fields = 'id,username,full_name,mobile,login_method,login_identifier,is_active';
    if (contact.channel === 'sms') {
      const digits = contact.value.replace(/[^0-9]/g, '');
      const variants = Array.from(new Set([contact.value, digits, digits.startsWith('63') ? '0' + digits.slice(2) : digits]));
      const loginRows = await admin.from('profiles').select(fields).eq('is_active', true).eq('login_method', 'mobile').in('login_identifier', variants).limit(3);
      if (loginRows.error) throw loginRows.error;
      const mobileRows = await admin.from('profiles').select(fields).eq('is_active', true).in('mobile', variants).limit(3);
      if (mobileRows.error) throw mobileRows.error;
      const unique = new Map<string, any>();
      for (const row of [...(loginRows.data ?? []), ...(mobileRows.data ?? [])]) if (row?.id) unique.set(row.id, row);
      return Array.from(unique.values()).slice(0, 3);
    }
    const result = await admin.from('profiles').select(fields).eq('is_active', true).eq('login_method', 'email').eq('login_identifier', contact.value).limit(3);
    if (result.error) throw result.error;
    return result.data ?? [];
  }

  async function lookupRate(subject: string) {
    const subjectHash = await secretHash('lookup', lower(subject) || 'invalid');
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const [s, i] = await Promise.all([
      admin.from('buklod_account_recovery_events').select('id', { count: 'exact', head: true })
        .eq('event_type', 'otp_auto_lookup').eq('subject_hash', subjectHash).gte('created_at', since),
      admin.from('buklod_account_recovery_events').select('id', { count: 'exact', head: true })
        .eq('event_type', 'otp_auto_lookup').eq('ip_hash', ipHash).gte('created_at', since),
    ]);
    if (s.error || i.error) return { blocked: true, subjectHash };
    const blocked = Number(s.count ?? 0) >= 8 || Number(i.count ?? 0) >= 30;
    await audit('otp_auto_lookup', blocked ? 'rate_limited' : 'attempt', { subjectHash });
    return { blocked, subjectHash };
  }

  async function profileRecoveryContact(profile: any) {
    const method = lower(profile?.login_method);
    const saved = text(profile?.login_identifier);
    const profileMobile = normalizePhone(profile?.mobile);
    const savedMobile = normalizePhone(saved);

    if (method === 'mobile') {
      const value = savedMobile || profileMobile;
      if (value) return { channel: 'sms' as const, value };
    }

    const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
    const authEmail = lower(authUser?.user?.email);
    if (method === 'email' && validEmail(authEmail)) {
      return { channel: 'email' as const, value: authEmail };
    }

    if (profileMobile) return { channel: 'sms' as const, value: profileMobile };
    if (validEmail(authEmail)) return { channel: 'email' as const, value: authEmail };
    return null;
  }

  async function resolveAutoTarget(payload: any) {
    const directRaw = text(payload?.contact || payload?.identifier || payload?.username);
    const directContact = parseContact(directRaw);
    if (directContact) {
      const accounts = await resolveAccounts(directContact);
      return {
        state: accounts.length ? 'matched' : 'not_matched',
        accounts,
        contact: directContact,
        matchMethod: directContact.channel === 'sms' ? 'mobile' : 'email',
        lookupSubject: 'direct:' + directContact.channel + ':' + directContact.value,
      };
    }

    const username = lower(directRaw);
    if (username && validUsername(username)) {
      const birthDate = text(payload?.birthDate);
      if (!validDate(birthDate)) {
        return {
          state: 'invalid',
          code: 'BIRTHDATE_REQUIRED',
          message: 'Enter the account birthday as YYYY-MM-DD to recover by username.',
          lookupSubject: 'username:' + username,
        };
      }
      const { data, error } = await admin.from('profiles')
        .select('id,username,full_name,mobile,login_method,login_identifier,birth_date,is_active')
        .or('username.eq.' + username + ',login_identifier.eq.' + username)
        .eq('is_active', true)
        .limit(3);
      if (error) throw error;
      const sameBirth = (data ?? []).filter((p: any) => text(p.birth_date) === birthDate);
      if (!sameBirth.length) {
        return { state: 'not_matched', accounts: [], contact: null, matchMethod: 'username_birthdate', lookupSubject: 'username:' + username + ':' + birthDate };
      }
      if (sameBirth.length !== 1) {
        return { state: 'ambiguous', accounts: sameBirth, contact: null, matchMethod: 'username_birthdate', lookupSubject: 'username:' + username + ':' + birthDate };
      }
      const contact = await profileRecoveryContact(sameBirth[0]);
      return {
        state: contact ? 'matched' : 'no_channel',
        accounts: sameBirth,
        contact,
        matchMethod: 'username_birthdate',
        lookupSubject: 'username:' + username + ':' + birthDate,
      };
    }

    const first = namePart(payload?.firstName);
    const middle = namePart(payload?.middleName);
    const surname = namePart(payload?.surname);
    const birthDate = text(payload?.birthDate);
    if (first || surname || birthDate) {
      if (first.length < 2 || surname.length < 2 || !validDate(birthDate) || /[%_]/.test(first + middle + surname)) {
        return {
          state: 'invalid',
          code: 'IDENTITY_REQUIRED',
          message: 'Enter first name, surname, and birthday as YYYY-MM-DD.',
          lookupSubject: 'identity:' + lower(first) + ':' + lower(surname) + ':' + birthDate,
        };
      }
      let q = admin.from('profiles')
        .select('id,username,full_name,mobile,login_method,login_identifier,birth_date,is_active')
        .ilike('first_name', first)
        .ilike('surname', surname)
        .eq('birth_date', birthDate)
        .eq('is_active', true)
        .limit(3);
      if (middle) q = q.ilike('middle_name', middle);
      const { data, error } = await q;
      if (error) throw error;
      if (!(data ?? []).length) {
        return { state: 'not_matched', accounts: [], contact: null, matchMethod: 'identity_birthdate', lookupSubject: 'identity:' + lower(first) + ':' + lower(middle) + ':' + lower(surname) + ':' + birthDate };
      }
      if ((data ?? []).length !== 1) {
        return { state: 'ambiguous', accounts: data ?? [], contact: null, matchMethod: 'identity_birthdate', lookupSubject: 'identity:' + lower(first) + ':' + lower(middle) + ':' + lower(surname) + ':' + birthDate };
      }
      const contact = await profileRecoveryContact((data ?? [])[0]);
      return {
        state: contact ? 'matched' : 'no_channel',
        accounts: data ?? [],
        contact,
        matchMethod: 'identity_birthdate',
        lookupSubject: 'identity:' + lower(first) + ':' + lower(middle) + ':' + lower(surname) + ':' + birthDate,
      };
    }

    return {
      state: 'invalid',
      code: 'RECOVERY_IDENTIFIER_REQUIRED',
      message: 'Enter your registered email, mobile number, or username. If you forgot your login, enter your name and birthday.',
      lookupSubject: 'invalid',
    };
  }

  async function smsConfigured() {
    return !!(Deno.env.get('TWILIO_ACCOUNT_SID') && Deno.env.get('TWILIO_AUTH_TOKEN') && Deno.env.get('TWILIO_VERIFY_SERVICE_SID'));
  }
  async function emailConfigured() {
    return !!(Deno.env.get('RESEND_API_KEY') && Deno.env.get('RECOVERY_FROM_EMAIL'));
  }
  async function twilioStart(to: string) {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const token = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const service = Deno.env.get('TWILIO_VERIFY_SERVICE_SID')!;
    const r = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(service)}/Verifications`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, Channel: 'sms' }),
    });
    if (!r.ok) {
      console.error('Twilio Verify start failed', r.status, await r.text());
      return false;
    }
    return true;
  }
  async function twilioCheck(to: string, code: string) {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const token = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const service = Deno.env.get('TWILIO_VERIFY_SERVICE_SID')!;
    const r = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(service)}/VerificationCheck`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, Code: code }),
    });
    if (!r.ok) {
      console.error('Twilio Verify check failed', r.status, await r.text());
      return false;
    }
    const data = await r.json().catch(() => ({}));
    return data?.status === 'approved';
  }
  async function sendEmailOtp(to: string, code: string) {
    const key = Deno.env.get('RESEND_API_KEY')!;
    const from = Deno.env.get('RECOVERY_FROM_EMAIL')!;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Your BUKLOD recovery code',
        text: `Your BUKLOD password recovery code is ${code}. It expires in 5 minutes. If you did not request this, ignore this message.`,
        html: `<p>Your BUKLOD password recovery code is <strong style="font-size:24px;letter-spacing:4px">${code}</strong>.</p><p>It expires in 5 minutes. If you did not request this, ignore this message.</p>`,
      }),
    });
    if (!r.ok) {
      console.error('Recovery email send failed', r.status, await r.text());
      return false;
    }
    return true;
  }

  if (action === 'service_status') {
    return json({
      ok: true,
      smsReady: await smsConfigured(),
      emailReady: await emailConfigured(),
      usernameRecovery: true,
      identityRecovery: true,
      autoRejectUnmatched: true,
      adminFallback: true,
      otpExpiresMinutes: 5,
      maxAttempts: 5,
      resendCooldownSeconds: 45,
    });
  }

  if (action === 'request_otp') {
    let target: any;
    try {
      target = await resolveAutoTarget(body);
    } catch (e) {
      console.error('Automatic recovery lookup failed', e);
      return json({ ok: false, message: 'Recovery is temporarily unavailable.' }, 500);
    }

    const lookupGate = await lookupRate(target?.lookupSubject ?? 'invalid');
    if (lookupGate.blocked) {
      return json({ ok: false, code: 'RATE_LIMITED', message: 'Too many recovery attempts. Please wait before trying again.' }, 429);
    }

    if (target.state === 'invalid') {
      return json({ ok: false, code: target.code ?? 'INVALID_RECOVERY_INPUT', message: target.message ?? 'Check the recovery information and try again.' }, 400);
    }
    if (target.state === 'not_matched') {
      await audit('otp_auto_lookup', 'not_matched', { subjectHash: lookupGate.subjectHash });
      return json({
        ok: false,
        code: 'NOT_MATCHED',
        matched: false,
        message: 'NOT MATCHED — the information entered does not match an active BUKLOD account. Check it and try again.',
      }, 404);
    }
    if (target.state === 'ambiguous') {
      await audit('otp_auto_lookup', 'ambiguous', { subjectHash: lookupGate.subjectHash });
      return json({
        ok: false,
        code: 'ADMIN_FALLBACK_REQUIRED',
        matched: true,
        adminFallback: true,
        message: 'More than one account matches those details. Use Admin Help so the correct account can be recovered safely.',
      }, 409);
    }
    if (target.state === 'no_channel' || !target.contact) {
      await audit('otp_auto_lookup', 'no_delivery_channel', {
        userId: target.accounts?.length === 1 ? target.accounts[0]?.id : null,
        subjectHash: lookupGate.subjectHash,
      });
      return json({
        ok: false,
        code: 'ADMIN_FALLBACK_REQUIRED',
        matched: true,
        adminFallback: true,
        message: 'Account matched, but no registered recovery email or mobile number is available. Use Admin Help.',
      }, 409);
    }

    const contact = target.contact as { channel: 'sms' | 'email'; value: string };
    const accounts = Array.isArray(target.accounts) ? target.accounts : [];
    const providerReady = contact.channel === 'sms' ? await smsConfigured() : await emailConfigured();
    if (!providerReady) {
      const msg = contact.channel === 'sms'
        ? 'Account matched, but SMS recovery is temporarily unavailable. Try a registered email if available or use Admin Help.'
        : 'Account matched, but email recovery is temporarily unavailable. Try a registered mobile number if available or use Admin Help.';
      return json({ ok: false, code: 'DELIVERY_NOT_CONFIGURED', matched: true, adminFallback: true, message: msg }, 503);
    }

    const contactHash = await contactHashOf(contact.value);
    const nowMs = Date.now();
    const cooldownSince = new Date(nowMs - 45_000).toISOString();
    const limitSince = new Date(nowMs - 15 * 60_000).toISOString();
    const [cooldown, contactCount, ipCount] = await Promise.all([
      admin.from('buklod_recovery_otp_challenges').select('id', { count: 'exact', head: true }).eq('contact_hash', contactHash).gte('created_at', cooldownSince),
      admin.from('buklod_recovery_otp_challenges').select('id', { count: 'exact', head: true }).eq('contact_hash', contactHash).gte('created_at', limitSince),
      admin.from('buklod_recovery_otp_challenges').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', limitSince),
    ]);
    if (cooldown.error || contactCount.error || ipCount.error) return json({ ok: false, message: 'Recovery is temporarily unavailable.' }, 500);
    if (Number(cooldown.count ?? 0) > 0) return json({ ok: false, code: 'RESEND_COOLDOWN', matched: true, retryAfterSeconds: 45, message: 'Account matched. Please wait before requesting another code.' }, 429);
    if (Number(contactCount.count ?? 0) >= 3 || Number(ipCount.count ?? 0) >= 10) {
      await audit('otp_request', 'rate_limited', { subjectHash: contactHash });
      return json({ ok: false, code: 'RATE_LIMITED', matched: true, message: 'Too many recovery-code requests. Try again later or use Admin Help.' }, 429);
    }

    const challengeId = crypto.randomUUID();
    const code = sixDigitCode();
    const expiresAt = new Date(nowMs + 5 * 60_000).toISOString();
    const provider = contact.channel === 'sms' ? 'twilio_verify' : 'resend_otp';
    const otpHash = provider === 'resend_otp' ? await otpHashOf(challengeId, code) : null;
    const userIds = accounts.map((a: any) => a.id);
    const encryptedContact = await encryptContact(contact.value);

    const { error: insertError } = await admin.from('buklod_recovery_otp_challenges').insert({
      id: challengeId,
      channel: contact.channel,
      contact_hash: contactHash,
      user_ids: userIds,
      provider,
      otp_hash: otpHash,
      expires_at: expiresAt,
      ip_hash: ipHash,
      contact_ciphertext: encryptedContact.cipher,
      contact_iv: encryptedContact.iv,
      match_method: target.matchMethod,
    });
    if (insertError) {
      console.error('Recovery challenge insert failed', insertError);
      return json({ ok: false, message: 'Recovery is temporarily unavailable.' }, 500);
    }

    const delivered = contact.channel === 'sms'
      ? await twilioStart(contact.value)
      : await sendEmailOtp(contact.value, code);
    if (!delivered) {
      await admin.from('buklod_recovery_otp_challenges').delete().eq('id', challengeId);
      await audit('otp_request', 'delivery_failed', { subjectHash: contactHash });
      return json({
        ok: false,
        code: 'DELIVERY_FAILED',
        matched: true,
        adminFallback: true,
        message: 'Account matched, but the recovery code could not be delivered. Try another recovery method or Admin Help.',
      }, 503);
    }

    await audit('otp_request', 'matched_and_sent', {
      userId: userIds.length === 1 ? userIds[0] : null,
      subjectHash: contactHash,
    });
    const maskedDestination = contact.channel === 'sms' ? maskMobile(contact.value) : maskEmail(contact.value);
    return json({
      ok: true,
      matched: true,
      challengeId,
      channel: contact.channel,
      maskedDestination,
      matchMethod: target.matchMethod,
      expiresInSeconds: 300,
      resendAfterSeconds: 45,
      message: 'Account matched. A 6-digit recovery code was sent to ' + maskedDestination + '.',
    });
  }

  if (action === 'verify_otp') {
    const challengeId = text(body?.challengeId);
    const code = text(body?.code);
    if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(code)) {
      return json({ ok: false, code: 'INVALID_OTP', message: 'Invalid or expired recovery code.' }, 400);
    }

    const { data: ch, error } = await admin.from('buklod_recovery_otp_challenges')
      .select('id,channel,contact_hash,user_ids,provider,otp_hash,attempts,max_attempts,expires_at,verified_at,used_at,contact_ciphertext,contact_iv')
      .eq('id', challengeId).maybeSingle();
    if (error || !ch || ch.used_at || new Date(ch.expires_at).getTime() <= Date.now()) {
      return json({ ok: false, code: 'INVALID_OTP', message: 'Invalid or expired recovery code.' }, 400);
    }

    let contact = parseContact(body?.contact);
    if (!contact && ch.contact_ciphertext && ch.contact_iv) {
      try {
        const recovered = await decryptContact(String(ch.contact_ciphertext), String(ch.contact_iv));
        contact = parseContact(recovered);
      } catch (e) {
        console.error('Recovery delivery contact decrypt failed', e);
      }
    }
    if (!contact) {
      return json({ ok: false, code: 'INVALID_OTP', message: 'This recovery challenge is no longer valid. Request a new code.' }, 400);
    }

    const incomingContactHash = await contactHashOf(contact.value);
    if (ch.channel !== contact.channel || !equal(incomingContactHash, String(ch.contact_hash)) || Number(ch.attempts ?? 0) >= Number(ch.max_attempts ?? 5)) {
      return json({ ok: false, code: 'INVALID_OTP', message: 'Invalid or expired recovery code.' }, 400);
    }
    if (ch.verified_at) return json({ ok: false, code: 'OTP_ALREADY_VERIFIED', message: 'This code was already verified. Request a new code if needed.' }, 400);

    let valid = false;
    if ((ch.user_ids ?? []).length > 0 && ch.provider === 'twilio_verify') {
      if (!(await smsConfigured())) return json({ ok: false, message: 'SMS verification is temporarily unavailable.' }, 503);
      valid = await twilioCheck(contact.value, code);
    } else if ((ch.user_ids ?? []).length > 0 && ch.provider === 'resend_otp') {
      const incomingOtpHash = await otpHashOf(challengeId, code);
      valid = !!ch.otp_hash && equal(incomingOtpHash, String(ch.otp_hash));
    }

    if (!valid) {
      const attempts = Number(ch.attempts ?? 0) + 1;
      await admin.from('buklod_recovery_otp_challenges').update({ attempts }).eq('id', challengeId).is('verified_at', null);
      await audit('otp_verify', attempts >= Number(ch.max_attempts ?? 5) ? 'locked' : 'invalid', { subjectHash: String(ch.contact_hash) });
      return json({ ok: false, code: attempts >= Number(ch.max_attempts ?? 5) ? 'OTP_LOCKED' : 'INVALID_OTP', message: attempts >= Number(ch.max_attempts ?? 5) ? 'Too many incorrect codes. Request a new recovery code.' : 'Invalid or expired recovery code.' }, attempts >= Number(ch.max_attempts ?? 5) ? 429 : 400);
    }

    const recoveryToken = randomToken();
    const tokenHash = await tokenHashOf(challengeId, recoveryToken);
    const now = new Date().toISOString();
    const tokenExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const { data: claimed, error: claimError } = await admin.from('buklod_recovery_otp_challenges')
      .update({ verified_at: now, recovery_token_hash: tokenHash, token_expires_at: tokenExpiresAt })
      .eq('id', challengeId).is('verified_at', null).select('id,user_ids').maybeSingle();
    if (claimError || !claimed) return json({ ok: false, message: 'Recovery verification could not be completed.' }, 500);

    const ids = claimed.user_ids ?? [];
    const { data: profiles } = ids.length
      ? await admin.from('profiles').select('id,username,full_name,login_method,login_identifier').in('id', ids).eq('is_active', true)
      : { data: [] as any[] };
    const accounts = (profiles ?? []).map((p: any) => ({
      accountId: p.id,
      label: text(p.full_name) || 'BUKLOD account',
      hint: maskedUsername(p.username),
    }));
    await audit('otp_verify', 'success', { userId: accounts.length === 1 ? accounts[0].accountId : null, subjectHash: String(ch.contact_hash) });
    return json({
      ok: true,
      recoveryToken,
      tokenExpiresInSeconds: 600,
      accountSelectionRequired: accounts.length > 1,
      accounts,
    });
  }

  if (action === 'reset_password') {
    const challengeId = text(body?.challengeId);
    const recoveryToken = text(body?.recoveryToken);
    const requestedAccountId = text(body?.accountId);
    const newPassword = String(body?.newPassword ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(challengeId) || recoveryToken.length < 32 || !validPassword(newPassword)) {
      return json({ ok: false, code: 'INVALID_RESET', message: 'The recovery session is invalid or the new password is not allowed.' }, 400);
    }
    const { data: ch, error } = await admin.from('buklod_recovery_otp_challenges')
      .select('id,user_ids,recovery_token_hash,verified_at,token_expires_at,used_at,contact_hash')
      .eq('id', challengeId).maybeSingle();
    if (error || !ch || !ch.verified_at || ch.used_at || !ch.token_expires_at || new Date(ch.token_expires_at).getTime() <= Date.now() || !ch.recovery_token_hash) {
      return json({ ok: false, code: 'INVALID_RESET', message: 'The recovery session has expired. Request a new code.' }, 400);
    }
    const incomingTokenHash = await tokenHashOf(challengeId, recoveryToken);
    if (!equal(incomingTokenHash, String(ch.recovery_token_hash))) {
      return json({ ok: false, code: 'INVALID_RESET', message: 'The recovery session is invalid or expired.' }, 400);
    }
    const ids: string[] = ch.user_ids ?? [];
    if (!ids.length) return json({ ok: false, code: 'INVALID_RESET', message: 'The recovery session is invalid or expired.' }, 400);
    let userId = requestedAccountId;
    if (!userId && ids.length === 1) userId = ids[0];
    if (!userId && ids.length > 1) return json({ ok: false, code: 'ACCOUNT_SELECTION_REQUIRED', message: 'Choose which BUKLOD account you want to recover.' }, 409);
    if (!ids.includes(userId)) return json({ ok: false, code: 'INVALID_ACCOUNT_SELECTION', message: 'The selected account is not part of this verified recovery session.' }, 400);

    const { data: p } = await admin.from('profiles').select('id,is_active').eq('id', userId).eq('is_active', true).maybeSingle();
    if (!p) return json({ ok: false, code: 'ACCOUNT_UNAVAILABLE', message: 'This BUKLOD account is not available for automatic recovery. Use Admin Assistance.' }, 400);

    const claimedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await admin.from('buklod_recovery_otp_challenges')
      .update({ used_at: claimedAt, recovery_token_hash: null })
      .eq('id', challengeId).is('used_at', null).select('id').maybeSingle();
    if (claimError || !claimed) return json({ ok: false, code: 'ALREADY_USED', message: 'This recovery session has already been used.' }, 400);

    const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (passwordError) {
      console.error('OTP password reset failed', passwordError);
      await admin.from('buklod_recovery_otp_challenges').update({ used_at: null, recovery_token_hash: String(ch.recovery_token_hash) }).eq('id', challengeId).eq('used_at', claimedAt);
      return json({ ok: false, message: 'Password reset could not be completed.' }, 500);
    }

    await admin.from('buklod_recovery_credentials').update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() }).eq('user_id', userId);
    await admin.from('buklod_account_recovery_requests').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('user_id', userId).in('status', ['pending', 'code_issued']);
    await audit('otp_password_reset', 'success', { userId, subjectHash: String(ch.contact_hash) });
    return json({ ok: true, message: 'Password changed successfully. You can now sign in with your BUKLOD account.' });
  }

  return json({ ok: false, message: 'Unknown recovery action.' }, 400);
});
