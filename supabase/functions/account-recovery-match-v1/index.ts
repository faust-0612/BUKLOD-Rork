import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '3600',
};

const profileSelect =
  'id,username,full_name,first_name,middle_name,surname,suffix,birth_date,mobile,login_method,login_identifier,is_active';

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

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
    !value.endsWith('@buklod.invalid');
}

function validUsername(value: string) {
  return /^(?=.*[a-z])[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);
}

function loginIdentifier(profile: any) {
  const method = lower(profile?.login_method);
  const saved = text(profile?.login_identifier);
  const username = lower(profile?.username);
  const mobile = normalizePhone(profile?.mobile);

  if (method === 'email') return saved.toLowerCase();
  if (method === 'mobile') return normalizePhone(saved) || mobile || saved;
  if (method === 'username') return username || saved.toLowerCase();
  return username || mobile || saved;
}

function maskEmail(value: string) {
  const [local, domain] = value.split('@');
  if (!local || !domain) return 'Email account';
  return `${local.slice(0, Math.min(2, local.length))}${
    local.length > 2 ? '•••' : ''
  }@${domain}`;
}

function maskMobile(value: string) {
  const tail = value.replace(/\D/g, '').slice(-4);
  return tail ? `+63 ••• ••• ${tail}` : 'Mobile account';
}

function maskUsername(value: string) {
  if (!value) return 'Username account';
  return `@${value.slice(0, Math.min(2, value.length))}${
    value.length > 2 ? '••••' : '•'
  }`;
}

function loginHint(profile: any) {
  const method = lower(profile?.login_method);
  const value = loginIdentifier(profile);

  if (method === 'email') return maskEmail(value);
  if (method === 'mobile') return maskMobile(value);
  if (method === 'username') return maskUsername(value);
  if (normalizePhone(value)) return maskMobile(value);
  if (validEmail(value.toLowerCase())) return maskEmail(value.toLowerCase());
  return value ? maskUsername(value.toLowerCase()) : 'BUKLOD account';
}

function candidate(profile: any) {
  return {
    userId: profile.id,
    fullName: text(profile.full_name) ||
      [profile.first_name, profile.middle_name, profile.surname, profile.suffix]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim() ||
      'BUKLOD member',
    loginMethod: lower(profile.login_method) || 'account',
    loginHint: loginHint(profile),
    mobileHint: profile.mobile
      ? maskMobile(normalizePhone(profile.mobile) || text(profile.mobile))
      : null,
    birthDate: profile.birth_date ?? null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, message: 'Method not allowed.' }, 405);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    return json({ ok: false, message: 'Recovery service is not configured.' }, 500);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return json({ ok: false, message: 'System Admin access required.' }, 401);
  }

  const accessToken = authorization.slice(7).trim();
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: authData, error: authError } =
    await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return json({ ok: false, message: 'System Admin access required.' }, 401);
  }

  const actorId = authData.user.id;
  const [{ data: profileRole }, { data: roleRow }] = await Promise.all([
    admin.from('profiles').select('role').eq('id', actorId).maybeSingle(),
    admin
      .from('user_roles')
      .select('user_id')
      .eq('user_id', actorId)
      .eq('role', 'system_admin')
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  if (profileRole?.role !== 'system_admin' && !roleRow) {
    return json({ ok: false, message: 'System Admin access required.' }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, message: 'Invalid request.' }, 400);
  }

  const action = text(body?.action);
  const requestId = text(body?.requestId);
  if (!validUuid(requestId)) {
    return json({ ok: false, message: 'Invalid recovery request.' }, 400);
  }

  const { data: requestRow, error: requestError } = await admin
    .from('buklod_account_recovery_requests')
    .select(
      'id,user_id,status,match_status,submitted_identifier,submitted_first_name,submitted_middle_name,submitted_surname,submitted_birth_date,client_token_hash,client_token_expires_at'
    )
    .eq('id', requestId)
    .maybeSingle();

  if (requestError || !requestRow || requestRow.status !== 'pending') {
    return json({ ok: false, message: 'Pending recovery request not found.' }, 404);
  }

  const autoDeliveryReady =
    !!requestRow.client_token_hash &&
    !!requestRow.client_token_expires_at &&
    new Date(requestRow.client_token_expires_at).getTime() > Date.now();

  if (!autoDeliveryReady) {
    return json(
      {
        ok: false,
        code: 'RECOVERY_SESSION_EXPIRED',
        message:
          'The member recovery screen is no longer securely linked. Ask the member to submit a new Admin Help request.',
      },
      409
    );
  }

  const audit = async (
    eventType: string,
    outcome: string,
    userId: string | null = null
  ) => {
    const { error } = await admin.from('buklod_account_recovery_events').insert({
      event_type: eventType,
      outcome,
      user_id: userId,
      request_id: requestId,
      actor_id: actorId,
    });
    if (error) console.error('Recovery matching audit failed', error);
  };

  if (action === 'search_accounts') {
    if (requestRow.match_status !== 'needs_match' && requestRow.user_id) {
      return json({ ok: false, message: 'This request is already matched.' }, 409);
    }

    const rawQuery = text(body?.query);
    if (rawQuery.length < 3 || rawQuery.length > 120) {
      return json(
        {
          ok: false,
          message: 'Search using at least 3 characters from the registered login or exact name.',
        },
        400
      );
    }

    const results = new Map<string, any>();
    const addRows = (rows: any[] | null | undefined) => {
      for (const row of rows ?? []) {
        if (row?.id) results.set(row.id, row);
      }
    };

    const cleanLower = rawQuery.toLowerCase();
    const exactPhone = normalizePhone(rawQuery);

    if (validEmail(cleanLower)) {
      const { data, error } = await admin
        .from('profiles')
        .select(profileSelect)
        .eq('is_active', true)
        .eq('login_method', 'email')
        .ilike('login_identifier', cleanLower)
        .limit(8);
      if (error) return json({ ok: false, message: 'Could not search accounts.' }, 500);
      addRows(data);
    } else if (exactPhone) {
      const variants = mobileVariants(exactPhone);
      const [loginRows, mobileRows] = await Promise.all([
        admin
          .from('profiles')
          .select(profileSelect)
          .eq('is_active', true)
          .eq('login_method', 'mobile')
          .in('login_identifier', variants)
          .limit(8),
        admin
          .from('profiles')
          .select(profileSelect)
          .eq('is_active', true)
          .in('mobile', variants)
          .limit(8),
      ]);
      if (loginRows.error || mobileRows.error) {
        return json({ ok: false, message: 'Could not search accounts.' }, 500);
      }
      addRows(loginRows.data);
      addRows(mobileRows.data);
    } else if (validUsername(cleanLower)) {
      const { data, error } = await admin
        .from('profiles')
        .select(profileSelect)
        .eq('is_active', true)
        .or(`username.eq.${cleanLower},login_identifier.eq.${cleanLower}`)
        .limit(8);
      if (error) return json({ ok: false, message: 'Could not search accounts.' }, 500);
      addRows(data);
    }

    if (results.size === 0) {
      const safeName = rawQuery
        .replace(/[,%_()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (safeName.length >= 3) {
        let query = admin
          .from('profiles')
          .select(profileSelect)
          .eq('is_active', true)
          .or(
            `full_name.ilike.*${safeName}*,first_name.ilike.*${safeName}*,surname.ilike.*${safeName}*`
          )
          .limit(8);

        if (requestRow.submitted_birth_date) {
          query = query.eq('birth_date', requestRow.submitted_birth_date);
        }

        const { data, error } = await query;
        if (error) {
          return json({ ok: false, message: 'Could not search accounts.' }, 500);
        }
        addRows(data);
      }
    }

    await audit('admin_search_recovery_account_v1', 'success');
    return json({
      ok: true,
      candidates: Array.from(results.values()).slice(0, 8).map(candidate),
      submitted: {
        identifier: requestRow.submitted_identifier ?? null,
        name: [
          requestRow.submitted_first_name,
          requestRow.submitted_middle_name,
          requestRow.submitted_surname,
        ]
          .filter(Boolean)
          .join(' ')
          .trim() || null,
        birthDate: requestRow.submitted_birth_date ?? null,
      },
    });
  }

  if (action === 'match_request') {
    if (requestRow.match_status !== 'needs_match' || requestRow.user_id) {
      return json({ ok: false, message: 'This request is already matched.' }, 409);
    }

    const userId = text(body?.userId);
    if (!validUuid(userId)) {
      return json({ ok: false, message: 'Invalid member account.' }, 400);
    }

    const { data: member, error: memberError } = await admin
      .from('profiles')
      .select(profileSelect)
      .eq('id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (memberError || !member) {
      return json({ ok: false, message: 'Active member account not found.' }, 404);
    }

    const now = new Date().toISOString();
    const snapshot = lower(member.username) || loginIdentifier(member) || 'buklod-account';
    const { data: matched, error: matchError } = await admin
      .from('buklod_account_recovery_requests')
      .update({
        user_id: member.id,
        username: snapshot,
        match_status: 'matched',
        reviewed_by: actorId,
        reviewed_at: now,
      })
      .eq('id', requestId)
      .eq('status', 'pending')
      .eq('match_status', 'needs_match')
      .is('user_id', null)
      .select('id')
      .maybeSingle();

    if (matchError || !matched) {
      return json(
        {
          ok: false,
          message: 'The request changed before matching completed. Refresh and try again.',
        },
        409
      );
    }

    await audit('admin_match_recovery_request_v1', 'success', member.id);
    return json({
      ok: true,
      requestId,
      matched: candidate(member),
      message:
        'Account matched. Verify the member identity, then continue with automatic recovery-code delivery.',
    });
  }

  return json({ ok: false, message: 'Unknown recovery matching action.' }, 400);
});
