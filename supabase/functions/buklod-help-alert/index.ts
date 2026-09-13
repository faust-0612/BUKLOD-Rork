import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) throw new Error('AUTH_REQUIRED');

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) throw new Error('AUTH_REQUIRED');

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.request_id ?? '').trim();
    if (!requestId) throw new Error('REQUEST_ID_REQUIRED');

    const { data: alert, error: alertError } = await admin
      .from('buklod_help_requests')
      .select('id,creator_id,kind,category,message,status,latitude,longitude,radius_km,created_at,expires_at')
      .eq('id', requestId)
      .maybeSingle();
    if (alertError) throw alertError;
    if (!alert || alert.creator_id !== authData.user.id) throw new Error('REQUEST_NOT_OWNED');
    if (alert.kind !== 'EMERGENCY' || alert.status !== 'ACTIVE') throw new Error('NOT_ACTIVE_EMERGENCY');
    if (new Date(alert.expires_at).getTime() <= Date.now()) throw new Error('EMERGENCY_EXPIRED');

    const presenceCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: presences, error: presenceError } = await admin
      .from('buklod_help_presence')
      .select('user_id,latitude,longitude')
      .eq('safety_alerts_enabled', true)
      .gte('updated_at', presenceCutoff);
    if (presenceError) throw presenceError;

    const recipients = (presences ?? [])
      .filter((row: any) => row.user_id !== alert.creator_id)
      .map((row: any) => ({
        user_id: row.user_id as string,
        distance_km: distanceKm(
          Number(alert.latitude),
          Number(alert.longitude),
          Number(row.latitude),
          Number(row.longitude),
        ),
      }))
      .filter((row) => row.distance_km <= Number(alert.radius_km ?? 5))
      .sort((a, b) => a.distance_km - b.distance_km);

    const recipientIds = [...new Set(recipients.map((row) => row.user_id))];
    if (!recipientIds.length) {
      return new Response(JSON.stringify({ ok: true, recipients: 0, pushes: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const distanceByUser = new Map(recipients.map((row) => [row.user_id, row.distance_km]));
    const title = `EMERGENCY NEAR YOU · ${String(alert.category).replaceAll('_', ' ')}`;

    const notificationRows = recipientIds.map((userId) => {
      const distance = distanceByUser.get(userId) ?? 0;
      const bodyText = alert.message?.trim()
        ? `${Number(distance).toFixed(1)} km away · ${String(alert.message).slice(0, 160)}`
        : `A BUKLOD member approximately ${Number(distance).toFixed(1)} km away may need immediate help.`;
      return {
        user_id: userId,
        title,
        body: bodyText,
        kind: 'community_emergency',
        data: {
          kind: 'community_emergency',
          help_request_id: alert.id,
          category: alert.category,
          distance_km: Number(distance.toFixed(1)),
        },
      };
    });

    const { error: notificationError } = await admin.from('notifications').insert(notificationRows);
    if (notificationError) throw notificationError;

    const { data: tokens, error: tokenError } = await admin
      .from('device_tokens')
      .select('user_id,expo_push_token')
      .in('user_id', recipientIds);
    if (tokenError) throw tokenError;

    const pushMessages = (tokens ?? [])
      .filter((row: any) => typeof row.expo_push_token === 'string' && row.expo_push_token.startsWith('ExponentPushToken['))
      .map((row: any) => {
        const distance = distanceByUser.get(row.user_id) ?? 0;
        return {
          to: row.expo_push_token,
          sound: 'default',
          priority: 'high',
          channelId: 'buklod-emergency',
          title,
          body: alert.message?.trim()
            ? `${Number(distance).toFixed(1)} km away · ${String(alert.message).slice(0, 160)}`
            : `A BUKLOD member approximately ${Number(distance).toFixed(1)} km away may need immediate help.`,
          data: {
            kind: 'community_emergency',
            help_request_id: alert.id,
            category: alert.category,
            distance_km: Number(distance.toFixed(1)),
          },
        };
      });

    let sent = 0;
    const errors: string[] = [];
    for (const batch of chunks(pushMessages, 100)) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });
      if (!response.ok) {
        errors.push(`Expo push ${response.status}: ${await response.text()}`);
        continue;
      }
      sent += batch.length;
    }

    return new Response(
      JSON.stringify({ ok: errors.length === 0, recipients: recipientIds.length, pushes: sent, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: String((error as Error)?.message ?? error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
