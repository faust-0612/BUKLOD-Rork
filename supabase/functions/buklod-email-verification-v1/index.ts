import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '3600',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function html(title: string, message: string, ok: boolean) {
  const safeTitle = title.replace(/[<>&"']/g, '');
  const safeMessage = message.replace(/[<>&"']/g, '');
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title></head><body style="font-family:system-ui,-apple-system,sans-serif;background:#f6f7f8;margin:0;padding:32px;color:#1d2522"><main style="max-width:560px;margin:8vh auto;background:#fff;border-radius:18px;padding:28px;box-shadow:0 8px 30px rgba(0,0,0,.08)"><div style="font-size:42px">${ok ? '✓' : '!'}</div><h1 style="margin:12px 0 8px">${safeTitle}</h1><p style="font-size:17px;line-height:1.55">${safeMessage}</p><p style="color:#66736d;margin-top:24px">You may close this page and return to BUKLOD.</p></main></body></html>`,
    {
      status: ok ? 200 : 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function validRealEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.endsWith('@buklod.invalid');
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RECOVERY_FROM_EMAIL');

  if (!supabaseUrl || !serviceRoleKey) {
    return req.method === 'GET'
      ? html('Verification unavailable', 'BUKLOD email verification is not configured.', false)
      : json({ ok: false, code: 'SERVICE_NOT_CONFIGURED', message: 'Email verification is not configured.' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (req.method === 'GET') {
    const requestUrl = new URL(req.url);
    const challengeId = text(requestUrl.searchParams.get('challenge'));
    const token = text(requestUrl.searchParams.get('token'));

    if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^[0-9a-f]{64}$/i.test(token)) {
      return html('Invalid verification link', 'This BUKLOD email verification link is invalid.', false);
    }

    const { data: challenge, error: challengeError } = await admin
      .from('buklod_email_verification_challenges')
      .select('id,user_id,email_hash,token_hash,expires_at,verified_at')
      .eq('id', challengeId)
      .maybeSingle();

    if (challengeError || !challenge) {
      return html('Invalid verification link', 'This BUKLOD email verification link could not be found.', false);
    }

    if (challenge.verified_at) {
      return html('Email already verified', 'Your email address has already been verified for BUKLOD.', true);
    }

    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      return html('Verification link expired', 'This verification link has expired. A new link will be sent when verification is requested again.', false);
    }

    const incomingHash = await sha256(`buklod-email-verification-v1:${challengeId}:${token}:${serviceRoleKey}`);
    if (!equal(incomingHash, String(challenge.token_hash))) {
      return html('Invalid verification link', 'This BUKLOD email verification link is invalid.', false);
    }

    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(challenge.user_id);
    const email = lower(authUser?.user?.email);
    if (authError || !authUser?.user || !validRealEmail(email)) {
      return html('Verification unavailable', 'The email on this BUKLOD account is not available for verification.', false);
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id,login_method,is_active')
      .eq('id', challenge.user_id)
      .maybeSingle();

    if (profileError || !profile || !profile.is_active || lower(profile.login_method) !== 'email') {
      return html('Verification unavailable', 'This account does not currently require BUKLOD email verification.', false);
    }

    const currentEmailHash = await sha256(email);
    if (!equal(currentEmailHash, String(challenge.email_hash))) {
      return html('Email changed', 'The email address on this BUKLOD account has changed. Use the newest verification email.', false);
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await admin
      .from('buklod_email_verifications')
      .upsert(
        {
          user_id: challenge.user_id,
          email_hash: currentEmailHash,
          verified_at: now,
          method: 'EMAIL_LINK',
          updated_at: now,
        },
        { onConflict: 'user_id' },
      );

    if (upsertError) {
      console.error('BUKLOD email verification upsert failed', upsertError);
      return html('Verification unavailable', 'BUKLOD could not finish email verification. Please try the newest link again.', false);
    }

    await admin
      .from('buklod_email_verification_challenges')
      .update({ verified_at: now })
      .eq('id', challengeId)
      .is('verified_at', null);

    return html('Email verified', 'Your email address is verified. Admin approval can now proceed when applicable.', true);
  }

  if (req.method !== 'POST') {
    return json({ ok: false, message: 'Method not allowed.' }, 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, message: 'Invalid request.' }, 400);
  }

  if (text(body?.action) !== 'dispatch') {
    return json({ ok: false, message: 'Unknown action.' }, 400);
  }

  if (!resendKey || !fromEmail) {
    return json({ ok: false, code: 'EMAIL_NOT_CONFIGURED', message: 'Email delivery is not configured.' }, 503);
  }

  const dispatchId = text(body?.dispatchId);
  const dispatchToken = text(body?.token);
  if (!/^[0-9a-f-]{36}$/i.test(dispatchId) || !/^[0-9a-f]{64}$/i.test(dispatchToken)) {
    return json({ ok: false, message: 'Invalid dispatch request.' }, 400);
  }

  const { data: dispatch, error: dispatchError } = await admin
    .from('buklod_email_verification_dispatches')
    .select('id,user_id,dispatch_token_hash,expires_at,delivery_status,completed_at')
    .eq('id', dispatchId)
    .maybeSingle();

  if (dispatchError || !dispatch) {
    return json({ ok: false, message: 'Verification dispatch not found.' }, 404);
  }

  if (dispatch.completed_at || dispatch.delivery_status === 'SENT') {
    return json({ ok: true, alreadySent: true });
  }

  if (new Date(dispatch.expires_at).getTime() <= Date.now()) {
    await admin
      .from('buklod_email_verification_dispatches')
      .update({ delivery_status: 'EXPIRED', completed_at: new Date().toISOString() })
      .eq('id', dispatchId);
    return json({ ok: false, message: 'Verification dispatch expired.' }, 400);
  }

  const incomingDispatchHash = await sha256(dispatchToken);
  if (!equal(incomingDispatchHash, String(dispatch.dispatch_token_hash))) {
    return json({ ok: false, message: 'Invalid dispatch token.' }, 403);
  }

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(dispatch.user_id);
  const email = lower(authUser?.user?.email);
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,login_method,is_active')
    .eq('id', dispatch.user_id)
    .maybeSingle();

  if (authError || profileError || !authUser?.user || !profile || !profile.is_active || lower(profile.login_method) !== 'email' || !validRealEmail(email)) {
    await admin
      .from('buklod_email_verification_dispatches')
      .update({ delivery_status: 'SKIPPED', completed_at: new Date().toISOString(), last_error: 'ACCOUNT_NOT_ELIGIBLE' })
      .eq('id', dispatchId);
    return json({ ok: false, message: 'Account is not eligible for real-email verification.' }, 400);
  }

  const emailHash = await sha256(email);
  const { data: existingVerification } = await admin
    .from('buklod_email_verifications')
    .select('email_hash,verified_at')
    .eq('user_id', dispatch.user_id)
    .maybeSingle();

  if (existingVerification?.verified_at && equal(String(existingVerification.email_hash), emailHash)) {
    await admin
      .from('buklod_email_verification_dispatches')
      .update({ delivery_status: 'SKIPPED', completed_at: new Date().toISOString(), last_error: null })
      .eq('id', dispatchId);
    return json({ ok: true, alreadyVerified: true });
  }

  const challengeId = crypto.randomUUID();
  const verificationToken = randomToken();
  const verificationTokenHash = await sha256(`buklod-email-verification-v1:${challengeId}:${verificationToken}:${serviceRoleKey}`);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: challengeInsertError } = await admin
    .from('buklod_email_verification_challenges')
    .insert({
      id: challengeId,
      user_id: dispatch.user_id,
      email_hash: emailHash,
      token_hash: verificationTokenHash,
      expires_at: expiresAt,
      dispatch_id: dispatchId,
    });

  if (challengeInsertError) {
    console.error('BUKLOD email verification challenge insert failed', challengeInsertError);
    return json({ ok: false, message: 'Could not create verification challenge.' }, 500);
  }

  const verifyUrl = `${supabaseUrl}/functions/v1/buklod-email-verification-v1?challenge=${encodeURIComponent(challengeId)}&token=${encodeURIComponent(verificationToken)}`;
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: 'Verify your BUKLOD email address',
      text: `Verify your BUKLOD email address by opening this link: ${verifyUrl}\n\nThis link expires in 7 days. If you did not create or update a BUKLOD account, ignore this message.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Verify your BUKLOD email address</h2><p>Confirm that this email belongs to your BUKLOD account before Admin approval.</p><p><a href="${verifyUrl}" style="display:inline-block;background:#176b4d;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">VERIFY EMAIL</a></p><p style="color:#66736d">This link expires in 7 days. If you did not create or update a BUKLOD account, ignore this message.</p></div>`,
    }),
  });

  if (!emailResponse.ok) {
    const providerError = await emailResponse.text();
    console.error('BUKLOD verification email send failed', emailResponse.status, providerError);
    await admin.from('buklod_email_verification_challenges').delete().eq('id', challengeId);
    await admin
      .from('buklod_email_verification_dispatches')
      .update({ delivery_status: 'FAILED', completed_at: new Date().toISOString(), last_error: `RESEND_${emailResponse.status}` })
      .eq('id', dispatchId);
    return json({ ok: false, code: 'DELIVERY_FAILED', message: 'Verification email could not be delivered.' }, 503);
  }

  await admin
    .from('buklod_email_verification_dispatches')
    .update({ delivery_status: 'SENT', completed_at: new Date().toISOString(), last_error: null })
    .eq('id', dispatchId);

  return json({ ok: true, sent: true, expiresInSeconds: 7 * 24 * 60 * 60 });
});
