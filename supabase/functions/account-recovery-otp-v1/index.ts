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
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function validPassword(value: string) {
  return value.length >= 8 && value.length <= 128;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
    !value.endsWith('@buklod.invalid');
}

function normalizePhone(value: unknown) {
  const raw = text(value).replace(/[^\d+]/g, '');
  if (/^\+639\d{9}$/.test(raw)) return raw;
  if (/^639\d{9}$/.test(raw)) return `+${raw}`;
  if (/^09\d{9}$/.test(raw)) return `+63${raw.slice(1)}`;
  return null;
}

function mobileVariants(value: string) {
  const digits = value.replace(/\D/g, '');
  return Array.from(
    new Set([
      value,
      digits,
      digits.startsWith('63') ? `0${digits.slice(2)}` : digits,
    ])
  );
}

function parseContact(
  value: unknown
): { channel: 'sms' | 'email'; value: string } | null {
  const raw = text(value);
  const phone = normalizePhone(raw);
  if (phone) return { channel: 'sms', value: phone };

  const email = raw.toLowerCase();
  if (validEmail(email)) return { channel: 'email', value: email };
  return null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function sixDigitCode() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(100000 + (value[0] % 900000));
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function maskedUsername(value: unknown) {
  const username = lower(value);
  if (!username) return 'BUKLOD account';
  return `@${username.slice(0, Math.min(2, username.length))}${
    username.length > 2 ? '••••' : '•'
  }`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, message: 'Method not allowed.' }, 405);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return json({ ok: false, message: 'Recovery service is not configured.' }, 500);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, message: 'Invalid request.' }, 400);
  }

  const action = text(body?.action);
  const rawIp = text(
    req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      'unknown'
  );

  const secretHash = (scope: string, value: string) =>
    sha256(`buklod-recovery-otp-v1:${scope}:${value}:${serviceKey}`);
  const ipHash = await secretHash('ip', rawIp || 'unknown');
  const contactHashOf = (value: string) => secretHash('contact', value);
  const otpHashOf = (challengeId: string, code: string) =>
    sha256(`buklod-otp-code-v1:${challengeId}:${code}:${serviceKey}`);
  const tokenHashOf = (challengeId: string, token: string) =>
    sha256(`buklod-recovery-token-v1:${challengeId}:${token}:${serviceKey}`);

  const audit = async (
    eventType: string,
    outcome: string,
    opts: { userId?: string | null; subjectHash?: string | null } = {}
  ) => {
    const { error } = await admin.from('buklod_account_recovery_events').insert({
      event_type: eventType,
      outcome,
      user_id: opts.userId ?? null,
      subject_hash: opts.subjectHash ?? null,
      ip_hash: ipHash,
    });
    if (error) console.error('OTP recovery audit failed', error);
  };

  const resolveAccounts = async (
    contact: { channel: 'sms' | 'email'; value: string }
  ) => {
    const select =
      'id,username,full_name,mobile,login_method,login_identifier,is_active';
    const results = new Map<string, any>();
    const addRows = (rows: any[] | null | undefined) => {
      for (const row of rows ?? []) {
        if (row?.id) results.set(row.id, row);
      }
    };

    if (contact.channel === 'email') {
      const { data, error } = await admin
        .from('profiles')
        .select(select)
        .eq('is_active', true)
        .eq('login_method', 'email')
        .ilike('login_identifier', contact.value)
        .limit(3);
      if (error) throw error;
      addRows(data);
      return Array.from(results.values());
    }

    const variants = mobileVariants(contact.value);
    const [loginRows, profileRows] = await Promise.all([
      admin
        .from('profiles')
        .select(select)
        .eq('is_active', true)
        .eq('login_method', 'mobile')
        .in('login_identifier', variants)
        .limit(3),
      admin
        .from('profiles')
        .select(select)
        .eq('is_active', true)
        .in('mobile', variants)
        .limit(3),
    ]);

    if (loginRows.error) throw loginRows.error;
    if (profileRows.error) throw profileRows.error;
    addRows(loginRows.data);
    addRows(profileRows.data);
    return Array.from(results.values());
  };

  const smsConfigured = () =>
    !!(
      Deno.env.get('TWILIO_ACCOUNT_SID') &&
      Deno.env.get('TWILIO_AUTH_TOKEN') &&
      Deno.env.get('TWILIO_VERIFY_SERVICE_SID')
    );

  const emailConfigured = () =>
    !!(Deno.env.get('RESEND_API_KEY') && Deno.env.get('RECOVERY_FROM_EMAIL'));

  const twilioStart = async (to: string) => {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const token = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const service = Deno.env.get('TWILIO_VERIFY_SERVICE_SID')!;
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${encodeURIComponent(
        service
      )}/Verifications`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, Channel: 'sms' }),
      }
    );
    if (!response.ok) {
      console.error('Twilio Verify start failed', response.status, await response.text());
      return false;
    }
    return true;
  };

  const twilioCheck = async (to: string, code: string) => {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const token = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const service = Deno.env.get('TWILIO_VERIFY_SERVICE_SID')!;
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${encodeURIComponent(
        service
      )}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, Code: code }),
      }
    );
    if (!response.ok) {
      console.error('Twilio Verify check failed', response.status, await response.text());
      return false;
    }
    const data = await response.json().catch(() => ({}));
    return data?.status === 'approved';
  };

  const sendEmailOtp = async (to: string, code: string) => {
    const key = Deno.env.get('RESEND_API_KEY')!;
    const from = Deno.env.get('RECOVERY_FROM_EMAIL')!;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Your BUKLOD recovery code',
        text: `Your BUKLOD password recovery code is ${code}. It expires in 5 minutes. If you did not request this, ignore this message.`,
        html: `<p>Your BUKLOD password recovery code is <strong style="font-size:24px;letter-spacing:4px">${code}</strong>.</p><p>It expires in 5 minutes. If you did not request this, ignore this message.</p>`,
      }),
    });
    if (!response.ok) {
      console.error('Recovery email send failed', response.status, await response.text());
      return false;
    }
    return true;
  };

  if (action === 'service_status') {
    return json({
      ok: true,
      smsReady: smsConfigured(),
      emailReady: emailConfigured(),
      usernameRecovery: false,
      adminFallback: true,
      otpExpiresMinutes: 5,
      maxAttempts: 5,
      resendCooldownSeconds: 45,
    });
  }

  if (action === 'request_otp') {
    const contact = parseContact(body?.contact);
    if (!contact) {
      return json(
        {
          ok: false,
          code: 'PHONE_OR_EMAIL_REQUIRED',
          message: 'Enter a valid mobile number or email address.',
        },
        400
      );
    }

    const providerReady =
      contact.channel === 'sms' ? smsConfigured() : emailConfigured();
    if (!providerReady) {
      return json(
        {
          ok: false,
          code: 'DELIVERY_NOT_CONFIGURED',
          channel: contact.channel,
          message:
            contact.channel === 'sms'
              ? 'SMS recovery is temporarily unavailable. Use email recovery or Admin Assistance.'
              : 'Email recovery is temporarily unavailable. Use Recovery PIN or Admin Assistance.',
        },
        503
      );
    }

    const contactHash = await contactHashOf(contact.value);
    const nowMs = Date.now();
    const cooldownSince = new Date(nowMs - 45_000).toISOString();
    const limitSince = new Date(nowMs - 15 * 60_000).toISOString();
    const [cooldown, contactCount, ipCount] = await Promise.all([
      admin
        .from('buklod_recovery_otp_challenges')
        .select('id', { count: 'exact', head: true })
        .eq('contact_hash', contactHash)
        .gte('created_at', cooldownSince),
      admin
        .from('buklod_recovery_otp_challenges')
        .select('id', { count: 'exact', head: true })
        .eq('contact_hash', contactHash)
        .gte('created_at', limitSince),
      admin
        .from('buklod_recovery_otp_challenges')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', limitSince),
    ]);

    if (cooldown.error || contactCount.error || ipCount.error) {
      return json({ ok: false, message: 'Recovery is temporarily unavailable.' }, 500);
    }
    if (Number(cooldown.count ?? 0) > 0) {
      return json(
        {
          ok: false,
          code: 'RESEND_COOLDOWN',
          retryAfterSeconds: 45,
          message: 'Please wait before requesting another code.',
        },
        429
      );
    }
    if (
      Number(contactCount.count ?? 0) >= 3 ||
      Number(ipCount.count ?? 0) >= 10
    ) {
      await audit('otp_request', 'rate_limited', { subjectHash: contactHash });
      return json(
        {
          ok: false,
          code: 'RATE_LIMITED',
          message:
            'Too many recovery requests. Try again later or use Admin Assistance.',
        },
        429
      );
    }

    let accounts: any[] = [];
    try {
      accounts = await resolveAccounts(contact);
    } catch (error) {
      console.error('OTP account lookup failed', error);
      return json({ ok: false, message: 'Recovery is temporarily unavailable.' }, 500);
    }

    const challengeId = crypto.randomUUID();
    const code = sixDigitCode();
    const expiresAt = new Date(nowMs + 5 * 60_000).toISOString();
    const provider = accounts.length
      ? contact.channel === 'sms'
        ? 'twilio_verify'
        : 'resend_otp'
      : 'dummy';
    const otpHash =
      provider === 'resend_otp' || provider === 'dummy'
        ? await otpHashOf(challengeId, code)
        : null;
    const userIds = accounts.map((account: any) => account.id);

    const { error: insertError } = await admin
      .from('buklod_recovery_otp_challenges')
      .insert({
        id: challengeId,
        channel: contact.channel,
        contact_hash: contactHash,
        user_ids: userIds,
        provider,
        otp_hash: otpHash,
        expires_at: expiresAt,
        ip_hash: ipHash,
      });
    if (insertError) {
      return json({ ok: false, message: 'Recovery is temporarily unavailable.' }, 500);
    }

    let delivered = true;
    if (accounts.length) {
      delivered =
        contact.channel === 'sms'
          ? await twilioStart(contact.value)
          : await sendEmailOtp(contact.value, code);
    }

    if (!delivered) {
      await admin
        .from('buklod_recovery_otp_challenges')
        .delete()
        .eq('id', challengeId);
      await audit('otp_request', 'delivery_failed', { subjectHash: contactHash });
      return json(
        {
          ok: false,
          code: 'DELIVERY_FAILED',
          message:
            'The recovery code could not be delivered. Try another recovery method or Admin Assistance.',
        },
        503
      );
    }

    await audit('otp_request', accounts.length ? 'accepted' : 'accepted_unmatched', {
      subjectHash: contactHash,
    });
    return json({
      ok: true,
      challengeId,
      channel: contact.channel,
      expiresInSeconds: 300,
      resendAfterSeconds: 45,
      message:
        'If an active BUKLOD account uses that phone number or email, a 6-digit recovery code has been sent.',
    });
  }

  if (action === 'verify_otp') {
    const challengeId = text(body?.challengeId);
    const code = text(body?.code);
    const contact = parseContact(body?.contact);
    if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(code) || !contact) {
      return json(
        { ok: false, code: 'INVALID_OTP', message: 'Invalid or expired recovery code.' },
        400
      );
    }

    const { data: challenge, error } = await admin
      .from('buklod_recovery_otp_challenges')
      .select(
        'id,channel,contact_hash,user_ids,provider,otp_hash,attempts,max_attempts,expires_at,verified_at,used_at'
      )
      .eq('id', challengeId)
      .maybeSingle();

    if (
      error ||
      !challenge ||
      challenge.used_at ||
      new Date(challenge.expires_at).getTime() <= Date.now()
    ) {
      return json(
        { ok: false, code: 'INVALID_OTP', message: 'Invalid or expired recovery code.' },
        400
      );
    }

    const incomingContactHash = await contactHashOf(contact.value);
    if (
      challenge.channel !== contact.channel ||
      !equal(incomingContactHash, String(challenge.contact_hash)) ||
      Number(challenge.attempts ?? 0) >= Number(challenge.max_attempts ?? 5)
    ) {
      return json(
        { ok: false, code: 'INVALID_OTP', message: 'Invalid or expired recovery code.' },
        400
      );
    }
    if (challenge.verified_at) {
      return json(
        {
          ok: false,
          code: 'OTP_ALREADY_VERIFIED',
          message: 'This code was already verified. Request a new code if needed.',
        },
        400
      );
    }

    let valid = false;
    if ((challenge.user_ids ?? []).length > 0 && challenge.provider === 'twilio_verify') {
      if (!smsConfigured()) {
        return json(
          { ok: false, message: 'SMS verification is temporarily unavailable.' },
          503
        );
      }
      valid = await twilioCheck(contact.value, code);
    } else if (
      (challenge.user_ids ?? []).length > 0 &&
      challenge.provider === 'resend_otp'
    ) {
      const incomingOtpHash = await otpHashOf(challengeId, code);
      valid =
        !!challenge.otp_hash &&
        equal(incomingOtpHash, String(challenge.otp_hash));
    }

    if (!valid) {
      const attempts = Number(challenge.attempts ?? 0) + 1;
      await admin
        .from('buklod_recovery_otp_challenges')
        .update({ attempts })
        .eq('id', challengeId)
        .is('verified_at', null);
      await audit(
        'otp_verify',
        attempts >= Number(challenge.max_attempts ?? 5) ? 'locked' : 'invalid',
        { subjectHash: String(challenge.contact_hash) }
      );
      return json(
        {
          ok: false,
          code:
            attempts >= Number(challenge.max_attempts ?? 5)
              ? 'OTP_LOCKED'
              : 'INVALID_OTP',
          message:
            attempts >= Number(challenge.max_attempts ?? 5)
              ? 'Too many incorrect codes. Request a new recovery code.'
              : 'Invalid or expired recovery code.',
        },
        attempts >= Number(challenge.max_attempts ?? 5) ? 429 : 400
      );
    }

    const recoveryToken = randomToken();
    const tokenHash = await tokenHashOf(challengeId, recoveryToken);
    const now = new Date().toISOString();
    const tokenExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const { data: claimed, error: claimError } = await admin
      .from('buklod_recovery_otp_challenges')
      .update({
        verified_at: now,
        recovery_token_hash: tokenHash,
        token_expires_at: tokenExpiresAt,
      })
      .eq('id', challengeId)
      .is('verified_at', null)
      .select('id,user_ids')
      .maybeSingle();

    if (claimError || !claimed) {
      return json(
        { ok: false, message: 'Recovery verification could not be completed.' },
        500
      );
    }

    const ids = claimed.user_ids ?? [];
    const { data: profiles } = ids.length
      ? await admin
          .from('profiles')
          .select('id,username,full_name,login_method,login_identifier')
          .in('id', ids)
          .eq('is_active', true)
      : { data: [] as any[] };

    const accounts = (profiles ?? []).map((profile: any) => ({
      accountId: profile.id,
      label: text(profile.full_name) || 'BUKLOD account',
      hint: maskedUsername(profile.username),
    }));

    await audit('otp_verify', 'success', {
      userId: accounts.length === 1 ? accounts[0].accountId : null,
      subjectHash: String(challenge.contact_hash),
    });
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

    if (
      !/^[0-9a-f-]{36}$/i.test(challengeId) ||
      recoveryToken.length < 32 ||
      !validPassword(newPassword)
    ) {
      return json(
        {
          ok: false,
          code: 'INVALID_RESET',
          message: 'The recovery session is invalid or the new password is not allowed.',
        },
        400
      );
    }

    const { data: challenge, error } = await admin
      .from('buklod_recovery_otp_challenges')
      .select(
        'id,user_ids,recovery_token_hash,verified_at,token_expires_at,used_at,contact_hash'
      )
      .eq('id', challengeId)
      .maybeSingle();

    if (
      error ||
      !challenge ||
      !challenge.verified_at ||
      challenge.used_at ||
      !challenge.token_expires_at ||
      new Date(challenge.token_expires_at).getTime() <= Date.now() ||
      !challenge.recovery_token_hash
    ) {
      return json(
        {
          ok: false,
          code: 'INVALID_RESET',
          message: 'The recovery session has expired. Request a new code.',
        },
        400
      );
    }

    const incomingTokenHash = await tokenHashOf(challengeId, recoveryToken);
    if (!equal(incomingTokenHash, String(challenge.recovery_token_hash))) {
      return json(
        {
          ok: false,
          code: 'INVALID_RESET',
          message: 'The recovery session is invalid or expired.',
        },
        400
      );
    }

    const ids: string[] = challenge.user_ids ?? [];
    if (!ids.length) {
      return json(
        {
          ok: false,
          code: 'INVALID_RESET',
          message: 'The recovery session is invalid or expired.',
        },
        400
      );
    }

    let userId = requestedAccountId;
    if (!userId && ids.length === 1) userId = ids[0];
    if (!userId && ids.length > 1) {
      return json(
        {
          ok: false,
          code: 'ACCOUNT_SELECTION_REQUIRED',
          message: 'Choose which BUKLOD account you want to recover.',
        },
        409
      );
    }
    if (!ids.includes(userId)) {
      return json(
        {
          ok: false,
          code: 'INVALID_ACCOUNT_SELECTION',
          message: 'The selected account is not part of this verified recovery session.',
        },
        400
      );
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('id,is_active')
      .eq('id', userId)
      .eq('is_active', true)
      .maybeSingle();
    if (!profile) {
      return json(
        {
          ok: false,
          code: 'ACCOUNT_UNAVAILABLE',
          message:
            'This BUKLOD account is not available for automatic recovery. Use Admin Assistance.',
        },
        400
      );
    }

    const claimedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await admin
      .from('buklod_recovery_otp_challenges')
      .update({ used_at: claimedAt, recovery_token_hash: null })
      .eq('id', challengeId)
      .is('used_at', null)
      .select('id')
      .maybeSingle();

    if (claimError || !claimed) {
      return json(
        {
          ok: false,
          code: 'ALREADY_USED',
          message: 'This recovery session has already been used.',
        },
        400
      );
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (passwordError) {
      console.error('OTP password reset failed', passwordError);
      await admin
        .from('buklod_recovery_otp_challenges')
        .update({
          used_at: null,
          recovery_token_hash: String(challenge.recovery_token_hash),
        })
        .eq('id', challengeId)
        .eq('used_at', claimedAt);
      return json(
        { ok: false, message: 'Password reset could not be completed.' },
        500
      );
    }

    await admin
      .from('buklod_recovery_credentials')
      .update({
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    await admin
      .from('buklod_account_recovery_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('status', ['pending', 'code_issued']);

    await audit('otp_password_reset', 'success', {
      userId,
      subjectHash: String(challenge.contact_hash),
    });
    return json({
      ok: true,
      message: 'Password changed successfully. You can now sign in with your BUKLOD account.',
    });
  }

  return json({ ok: false, message: 'Unknown recovery action.' }, 400);
});
