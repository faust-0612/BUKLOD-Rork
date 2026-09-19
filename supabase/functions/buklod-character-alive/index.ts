const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function readJwtPayload(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();

  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  // Supabase gateway verifies the JWT signature (verify_jwt=true). This
  // additional role check prevents the public anon key from consuming the
  // paid avatar provider. Only a signed-in BUKLOD user session may continue.
  const jwt = readJwtPayload(req);
  if (!jwt || jwt.role !== 'authenticated' || !jwt.sub) {
    return json({ error: 'Authenticated BUKLOD user required.' }, 401);
  }

  const didKey = Deno.env.get('DID_API_KEY')?.trim();

  if (!didKey) {
    return json({ error: 'DID_API_KEY is not configured.' }, 503);
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const action = String(body.action ?? '');

  if (action === 'create') {
    const sourceUrl = String(body.source_url ?? '').trim();
    const text = String(body.text ?? '').trim();
    const voiceId = String(
      body.voice_id ?? 'en-US-JennyMultilingualV2Neural',
    ).trim();

    if (!/^https:\/\//i.test(sourceUrl)) {
      return json({ error: 'source_url must be a public HTTPS URL.' }, 400);
    }

    if (!text || text.length > 1200) {
      return json({ error: 'text must contain 1 to 1200 characters.' }, 400);
    }

    const didResponse = await fetch('https://api.d-id.com/talks', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${didKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_url: sourceUrl,
        // Strong motion while the approved artwork remains the identity anchor.
        driver_url: 'bank://lively/driver-06',
        script: {
          type: 'text',
          input: text,
          provider: {
            type: 'microsoft',
            voice_id: voiceId,
          },
        },
        config: {
          fluent: true,
          stitch: true,
        },
      }),
    });

    const payload = await didResponse.json().catch(() => ({}));

    if (!didResponse.ok) {
      console.error('D-ID create failed', didResponse.status, payload);
      return json(
        {
          error: String(payload?.description ?? payload?.message ?? 'Avatar provider rejected the request.'),
        },
        didResponse.status >= 500 ? 502 : 400,
      );
    }

    return json({
      id: payload.id,
      status: payload.status ?? 'created',
      resultUrl: payload.result_url ?? null,
    });
  }

  if (action === 'status') {
    const id = String(body.id ?? '').trim();

    if (!/^[a-zA-Z0-9_-]{4,160}$/.test(id)) {
      return json({ error: 'Invalid character animation job id.' }, 400);
    }

    const didResponse = await fetch(
      `https://api.d-id.com/talks/${encodeURIComponent(id)}`,
      {
        headers: {
          Authorization: `Basic ${didKey}`,
        },
      },
    );

    const payload = await didResponse.json().catch(() => ({}));

    if (!didResponse.ok) {
      console.error('D-ID status failed', didResponse.status, payload);
      return json(
        { error: String(payload?.description ?? payload?.message ?? 'Could not read avatar status.') },
        didResponse.status >= 500 ? 502 : 400,
      );
    }

    return json({
      id: payload.id ?? id,
      status: payload.status ?? 'unknown',
      resultUrl: payload.result_url ?? null,
      error: payload.error?.description ?? payload.error ?? null,
    });
  }

  return json({ error: 'Unknown action.' }, 400);
});
