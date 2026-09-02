import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function cleanUsername(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function validUsername(value: string) {
  return /^(?=.*[a-z])[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);
}

function validPassword(value: string) {
  return value.length >= 8 && value.length <= 128;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return response({ ok: false, message: 'Method not allowed.' }, 405);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !anonKey || !serviceRoleKey) {
    return response({ ok: false, message: 'Recovery service is not configured.' }, 500);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let payload: any = {};
  try {
    payload = await request.json();
  } catch {
    return response({ ok: false, message: 'Invalid request.' }, 400);
  }

  const action = String(payload?.action ?? '');

  async function getUserFromAuthorization() {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    const token = authorization.slice('Bearer '.length).trim();

    const userClient = createClient(url!, anonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  }

  async function isSystemAdmin(userId: string) {
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.role === 'system_admin') {
      return true;
    }

    const { data: roleRow } = await admin
      .from('user_roles')
      .select('user_id')
      .eq('user_id', userId)
      .eq('role', 'system_admin')
      .eq('is_active', true)
      .maybeSingle();

    return !!roleRow;
  }

  async function findProfileByUsername(username: string) {
    const { data, error } = await admin
      .from('profiles')
      .select('id,username,full_name,is_active')
      .ilike('username', username)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async function pinHash(userId: string, pin: string) {
    return await sha256(`buklod-pin-v1:${userId}:${pin}:${serviceRoleKey}`);
  }

  async function codeHash(userId: string, code: string) {
    return await sha256(`buklod-admin-code-v1:${userId}:${code.toUpperCase()}:${serviceRoleKey}`);
  }

  if (action === 'set_pin') {
    const user = await getUserFromAuthorization();

    if (!user) {
      return response({ ok: false, message: 'Sign in first.' }, 401);
    }

    const pin = String(payload?.pin ?? '');

    if (!/^\d{6}$/.test(pin)) {
      return response({ ok: false, message: 'Recovery PIN must contain exactly 6 digits.' }, 400);
    }

    if (/^(\d)\1{5}$/.test(pin) || ['123456', '654321', '000000'].includes(pin)) {
      return response({ ok: false, message: 'Choose a less predictable Recovery PIN.' }, 400);
    }

    const hash = await pinHash(user.id, pin);

    const { error } = await admin
      .from('buklod_recovery_credentials')
      .upsert(
        {
          user_id: user.id,
          pin_hash: hash,
          pin_set_at: new Date().toISOString(),
          failed_attempts: 0,
          locked_until: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      return response({ ok: false, message: 'Could not save Recovery PIN.' }, 500);
    }

    return response({ ok: true });
  }

  if (action === 'request_admin_recovery') {
    const username = cleanUsername(payload?.username);

    if (!validUsername(username)) {
      return response({
        ok: true,
        message: 'If the username exists, the recovery request is now available to a BUKLOD System Admin.',
      });
    }

    const profile = await findProfileByUsername(username);

    if (profile?.id && profile.is_active !== false) {
      const now = new Date().toISOString();

      const { data: pendingRequest, error: lookupError } = await admin
        .from('buklod_account_recovery_requests')
        .select('id')
        .eq('user_id', profile.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (lookupError) {
        console.error('Could not look up a pending recovery request.', lookupError);
        return response({
          ok: false,
          message: 'Could not submit the recovery request right now. Please try again.',
        }, 500);
      }

      let writeError: any = null;

      if (pendingRequest?.id) {
        const { error } = await admin
          .from('buklod_account_recovery_requests')
          .update({
            username,
            requested_at: now,
            created_at: now,
            reviewed_by: null,
            reviewed_at: null,
            completed_at: null,
          })
          .eq('id', pendingRequest.id)
          .eq('status', 'pending');

        writeError = error;
      } else {
        const { error } = await admin
          .from('buklod_account_recovery_requests')
          .insert({
            user_id: profile.id,
            username,
            status: 'pending',
            requested_at: now,
            created_at: now,
            reviewed_by: null,
            reviewed_at: null,
            completed_at: null,
          });

        writeError = error;

        // Two near-simultaneous taps can race on the pending-only unique index.
        // Treat that as an existing request instead of showing a false failure.
        if (writeError?.code === '23505') {
          const { error: retryError } = await admin
            .from('buklod_account_recovery_requests')
            .update({
              username,
              requested_at: now,
              created_at: now,
              reviewed_by: null,
              reviewed_at: null,
              completed_at: null,
            })
            .eq('user_id', profile.id)
            .eq('status', 'pending');

          writeError = retryError;
        }
      }

      if (writeError) {
        console.error('Could not save an account recovery request.', writeError);
        return response({
          ok: false,
          message: 'Could not submit the recovery request right now. Please try again.',
        }, 500);
      }
    }

    return response({
      ok: true,
      message: 'If the username exists, the recovery request is now available to a BUKLOD System Admin.',
    });
  }

  if (action === 'recover_with_pin') {
    const username = cleanUsername(payload?.username);
    const pin = String(payload?.pin ?? '');
    const newPassword = String(payload?.newPassword ?? '');

    if (!validUsername(username) || !/^\d{6}$/.test(pin) || !validPassword(newPassword)) {
      return response({ ok: false, message: 'Invalid username, Recovery PIN, or new password.' }, 400);
    }

    const profile = await findProfileByUsername(username);

    if (!profile?.id || profile.is_active === false) {
      return response({ ok: false, message: 'Invalid username or Recovery PIN.' }, 400);
    }

    const { data: credential } = await admin
      .from('buklod_recovery_credentials')
      .select('pin_hash,failed_attempts,locked_until')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (!credential?.pin_hash) {
      return response({
        ok: false,
        message: 'No Recovery PIN is set for this account. Use Admin Assistance.',
      }, 400);
    }

    if (
      credential.locked_until &&
      new Date(credential.locked_until).getTime() > Date.now()
    ) {
      return response({
        ok: false,
        message: 'Recovery PIN is temporarily locked after repeated failed attempts. Use Admin Assistance or try again later.',
      }, 429);
    }

    const incoming = await pinHash(profile.id, pin);

    if (!safeEqual(incoming, String(credential.pin_hash))) {
      const failed = Number(credential.failed_attempts ?? 0) + 1;
      const lockedUntil =
        failed >= 5 ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null;

      await admin
        .from('buklod_recovery_credentials')
        .update({
          failed_attempts: failed >= 5 ? 0 : failed,
          locked_until: lockedUntil,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', profile.id);

      return response({
        ok: false,
        message:
          failed >= 5
            ? 'Too many failed attempts. Recovery PIN is locked for 30 minutes.'
            : 'Invalid username or Recovery PIN.',
      }, failed >= 5 ? 429 : 400);
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (passwordError) {
      return response({ ok: false, message: 'Password reset could not be completed.' }, 500);
    }

    await admin
      .from('buklod_recovery_credentials')
      .update({
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', profile.id);

    await admin
      .from('buklod_account_recovery_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('user_id', profile.id)
      .in('status', ['pending', 'code_issued']);

    return response({ ok: true });
  }

  if (action === 'admin_list_requests') {
    const user = await getUserFromAuthorization();

    if (!user || !(await isSystemAdmin(user.id))) {
      return response({ ok: false, message: 'System Admin access required.' }, 403);
    }

    const { data: requests, error } = await admin
      .from('buklod_account_recovery_requests')
      .select('id,user_id,username,status,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      return response({ ok: false, message: 'Could not load recovery requests.' }, 500);
    }

    const userIds = [...new Set((requests ?? []).map((r: any) => r.user_id))];

    const { data: profiles } = userIds.length
      ? await admin.from('profiles').select('id,full_name').in('id', userIds)
      : { data: [] as any[] };

    const names = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

    return response({
      ok: true,
      requests: (requests ?? []).map((row: any) => ({
        ...row,
        full_name: names.get(row.user_id) ?? null,
      })),
    });
  }

  if (action === 'admin_issue_code') {
    const user = await getUserFromAuthorization();

    if (!user || !(await isSystemAdmin(user.id))) {
      return response({ ok: false, message: 'System Admin access required.' }, 403);
    }

    const requestId = String(payload?.requestId ?? '');

    const { data: recoveryRequest, error: requestError } = await admin
      .from('buklod_account_recovery_requests')
      .select('id,user_id,status')
      .eq('id', requestId)
      .maybeSingle();

    if (requestError || !recoveryRequest || recoveryRequest.status !== 'pending') {
      return response({ ok: false, message: 'Pending recovery request not found.' }, 404);
    }

    const code = randomCode();
    const hash = await codeHash(recoveryRequest.user_id, code);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await admin
      .from('buklod_admin_recovery_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', recoveryRequest.user_id)
      .is('used_at', null);

    const { error: insertError } = await admin
      .from('buklod_admin_recovery_codes')
      .insert({
        request_id: recoveryRequest.id,
        user_id: recoveryRequest.user_id,
        code_hash: hash,
        expires_at: expiresAt,
        created_by: user.id,
      });

    if (insertError) {
      return response({ ok: false, message: 'Could not issue recovery code.' }, 500);
    }

    await admin
      .from('buklod_account_recovery_requests')
      .update({
        status: 'code_issued',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', recoveryRequest.id);

    return response({
      ok: true,
      code,
      expiresAt,
    });
  }

  if (action === 'recover_with_admin_code') {
    const username = cleanUsername(payload?.username);
    const code = String(payload?.code ?? '').trim().toUpperCase();
    const newPassword = String(payload?.newPassword ?? '');

    if (!validUsername(username) || code.length < 6 || !validPassword(newPassword)) {
      return response({ ok: false, message: 'Invalid username, recovery code, or new password.' }, 400);
    }

    const profile = await findProfileByUsername(username);

    if (!profile?.id || profile.is_active === false) {
      return response({ ok: false, message: 'Invalid username or recovery code.' }, 400);
    }

    const { data: codes } = await admin
      .from('buklod_admin_recovery_codes')
      .select('id,request_id,code_hash,expires_at,used_at')
      .eq('user_id', profile.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    const incoming = await codeHash(profile.id, code);
    const match = (codes ?? []).find((row: any) =>
      safeEqual(incoming, String(row.code_hash))
    );

    if (!match) {
      return response({ ok: false, message: 'Invalid or expired recovery code.' }, 400);
    }

    const claimedAt = new Date().toISOString();

    const { data: claimed, error: claimError } = await admin
      .from('buklod_admin_recovery_codes')
      .update({ used_at: claimedAt })
      .eq('id', match.id)
      .is('used_at', null)
      .select('id')
      .maybeSingle();

    if (claimError || !claimed) {
      return response({ ok: false, message: 'Recovery code has already been used.' }, 400);
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (passwordError) {
      await admin
        .from('buklod_admin_recovery_codes')
        .update({ used_at: null })
        .eq('id', match.id);

      return response({ ok: false, message: 'Password reset could not be completed.' }, 500);
    }

    await admin
      .from('buklod_account_recovery_requests')
      .update({
        status: 'completed',
        completed_at: claimedAt,
      })
      .eq('id', match.request_id);

    return response({ ok: true });
  }

  return response({ ok: false, message: 'Unknown recovery action.' }, 400);
});