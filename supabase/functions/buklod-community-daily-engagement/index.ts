import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const AI_TIMEOUT_MS = 6500;
const MAX_RECENT = 45;

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['item_type','title','body','options','category'],
        properties: {
          item_type: { type: 'string', enum: ['QUESTION','POLL','CHALLENGE','CONVERSATION_STARTER','TRIVIA','WOULD_YOU_RATHER'] },
          title: { type: 'string', maxLength: 120 },
          body: { type: 'string', maxLength: 700 },
          options: { type: 'array', maxItems: 4, items: { type: 'string', maxLength: 90 } },
          category: { type: 'string', enum: ['family','food','work','school','hobbies','relationships','pets','local_life','practical_life','aspirations','entertainment','community','light_humor','wellness','learning'] },
        },
      },
    },
    trending: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['source_post_id','title','body','category'],
          properties: {
            source_post_id: { type: 'string' },
            title: { type: 'string', maxLength: 120 },
            body: { type: 'string', maxLength: 700 },
            category: { type: 'string', enum: ['family','food','work','school','hobbies','relationships','pets','local_life','practical_life','aspirations','entertainment','community','light_humor','wellness','learning'] },
          },
        },
      ],
    },
  },
};

function cleanError(value: unknown) {
  return (value instanceof Error ? value.message : String(value ?? 'Daily engagement generation failed.'))
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted]')
    .slice(0, 700);
}
function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function similarity(a: string, b: string) {
  const aa = new Set(normalize(a).split(' ').filter(x => x.length > 3));
  const bb = new Set(normalize(b).split(' ').filter(x => x.length > 3));
  if (!aa.size || !bb.size) return 0;
  let common = 0;
  for (const token of aa) if (bb.has(token)) common += 1;
  return common / Math.max(aa.size, bb.size);
}
async function sha256(text: string) {
  const bytes = new TextEncoder().encode(normalize(text));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('');
}
async function callGemini(apiKey: string, model: string, prompt: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          maxOutputTokens: 900,
          thinkingConfig: { thinkingLevel: 'low' },
          temperature: 0.8,
        },
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    },
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(`${model} failed (${response.status}): ${raw}`);
  const outer = JSON.parse(raw);
  const text = (outer?.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => typeof p?.text === 'string' ? p.text : '')
    .join('')
    .trim();
  if (!text) throw new Error('AI returned no JSON.');
  return JSON.parse(text);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST required.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !serviceRole) return json({ error: 'Service configuration unavailable.' }, 503);
  if (!authHeader.toLowerCase().startsWith('bearer ')) return json({ error: 'Authentication required.' }, 401);

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const token = authHeader.replace(/^Bearer\s+/i,'').trim();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData?.user) return json({ error: 'Invalid or expired session.' }, 401);

  const actor = authData.user.id;
  let body: any = {};
  try { body = await req.json(); } catch {}
  const claimToken = String(body?.claim_token ?? '').trim();

  const now = new Date();
  const manilaDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);

  const { data: run } = await admin
    .schema('private')
    .from('buklod_daily_engagement_generation_runs')
    .select('publish_date,status,claim_token,claimed_by,attempts')
    .eq('publish_date', manilaDate)
    .maybeSingle();

  if (
    !run ||
    run.status !== 'CLAIMED' ||
    String(run.claim_token) !== claimToken ||
    String(run.claimed_by) !== actor
  ) {
    return json({ error: 'Generation claim is not valid.' }, 409);
  }

  try {
    const { data: cfg } = await admin
      .schema('private')
      .from('buklod_daily_engagement_config')
      .select('enabled,ai_enabled,cards_per_day,categories,min_trending_signal')
      .eq('singleton', true)
      .single();

    if (!cfg?.enabled || !cfg?.ai_enabled) throw new Error('Daily AI is disabled.');

    const { data: recent } = await admin
      .from('buklod_daily_engagement_items')
      .select('id,body,title,category,publish_date')
      .gte('publish_date', new Date(Date.now() - 30*86400000).toISOString().slice(0,10))
      .order('publish_date', { ascending: false })
      .limit(MAX_RECENT);

    const since = new Date(Date.now() - 24*60*60*1000).toISOString();
    const { data: posts } = await admin
      .from('community_posts')
      .select('id,body,created_at')
      .eq('audience','public')
      .eq('is_hidden',false)
      .is('deleted_at',null)
      .gte('created_at',since)
      .order('created_at',{ascending:false})
      .limit(20);

    const postIds = (posts ?? []).map((p: any) => p.id);
    let reactionRows: any[] = [];
    let commentRows: any[] = [];
    if (postIds.length) {
      const [reactions, comments] = await Promise.all([
        admin.from('reactions').select('post_id').in('post_id',postIds),
        admin.from('comments').select('post_id').in('post_id',postIds).eq('is_hidden',false).is('deleted_at',null),
      ]);
      reactionRows = reactions.data ?? [];
      commentRows = comments.data ?? [];
    }
    const score = new Map<string, number>();
    for (const row of reactionRows) score.set(row.post_id,(score.get(row.post_id) ?? 0)+1);
    for (const row of commentRows) score.set(row.post_id,(score.get(row.post_id) ?? 0)+2);
    const trending = [...(posts ?? [])]
      .map((p: any) => ({ id:p.id, text:String(p.body ?? '').slice(0,1200), signal:score.get(p.id) ?? 0 }))
      .filter((p: any) => p.signal >= Number(cfg.min_trending_signal ?? 3) && p.text.trim())
      .sort((a: any,b: any) => b.signal-a.signal)
      .slice(0,3);

    if (!geminiKey) throw new Error('Daily AI key unavailable.');
    const model = String(Deno.env.get('GEMINI_DAILY_ENGAGEMENT_MODEL') || 'gemini-3.5-flash').trim();
    const prompt = [
      'Create the shared BUKLOD TODAY daily engagement batch for ordinary public users.',
      'The output must be generic, friendly, concise, useful, non-deceptive, and suitable for Filipino/Taglish/English audiences.',
      'Never invent announcements, jobs, emergencies, lost-and-found, government notices, marketplace listings, user names, user activity, counts, testimonials, real opportunities, or real events.',
      'Generate only conversation starters, polls, challenges, trivia, would-you-rather, practical/reflection/fun questions.',
      'Use diverse categories and avoid near-duplicates of recent content.',
      'For trending: ONLY summarize one of REAL_TRENDING_INPUTS if supplied. source_post_id must exactly match one supplied id. If none qualify, set trending=null.',
      'Do not expose names or identifying details from real posts. Neutral summary only.',
      `Create exactly ${Math.max(1,Math.min(5,Number(cfg.cards_per_day ?? 3)))} generic cards.`,
      'RECENT_CONTENT_TO_AVOID=' + JSON.stringify((recent ?? []).map((x:any)=>({title:x.title,body:x.body,category:x.category}))),
      'ALLOWED_CATEGORIES=' + JSON.stringify(cfg.categories ?? []),
      'REAL_TRENDING_INPUTS=' + JSON.stringify(trending),
      'Return JSON only.',
    ].join('\n');

    const parsed = await callGemini(geminiKey, model, prompt);
    const cards = Array.isArray(parsed?.cards) ? parsed.cards : [];
    const accepted: any[] = [];
    for (const card of cards) {
      const bodyText = String(card?.body ?? '').trim();
      const title = String(card?.title ?? '').trim();
      if (!bodyText || !title) continue;
      const tooSimilar = (recent ?? []).some((x:any) =>
        similarity(bodyText, String(x.body ?? '')) >= 0.72 ||
        similarity(title, String(x.title ?? '')) >= 0.8
      ) || accepted.some((x:any) => similarity(bodyText,x.body) >= 0.72);
      if (tooSimilar) continue;
      accepted.push({
        item_type:String(card.item_type ?? 'CONVERSATION_STARTER'),
        title:title.slice(0,120),
        body:bodyText.slice(0,700),
        options:Array.isArray(card.options) ? card.options.slice(0,4).map((x:any)=>String(x).slice(0,90)) : [],
        category:String(card.category ?? 'community'),
      });
    }
    if (!accepted.length) throw new Error('AI batch rejected by anti-repetition validation.');

    const rows:any[] = [];
    let slot=1;
    for (const card of accepted.slice(0,Number(cfg.cards_per_day ?? 3))) {
      rows.push({
        publish_date:manilaDate,slot:slot++,item_type:card.item_type,title:card.title,body:card.body,
        options:card.options,category:card.category,source_kind:'AI_GENERIC',source_post_ids:[],
        ai_model:model,ai_version:'daily-engagement-r1',status:'ACTIVE',
        similarity_hash:await sha256(card.title+' '+card.body),
        metadata:{shared_daily_batch:true},
      });
    }

    const trend = parsed?.trending;
    const realSource = trend?.source_post_id
      ? trending.find((x:any)=>x.id===String(trend.source_post_id))
      : null;
    if (realSource && slot <= 8) {
      rows.push({
        publish_date:manilaDate,slot,item_type:'TRENDING_SUMMARY',
        title:String(trend.title ?? 'Usapang Ngayon').slice(0,120),
        body:String(trend.body ?? '').slice(0,700),
        options:[],category:String(trend.category ?? 'community'),source_kind:'REAL_TRENDING',
        source_post_ids:[realSource.id],ai_model:model,ai_version:'daily-engagement-r1',status:'ACTIVE',
        similarity_hash:await sha256(String(trend.title ?? '')+' '+String(trend.body ?? '')),
        metadata:{real_signal:Number(realSource.signal ?? 0)},
      });
    }

    const { error: insertError } = await admin
      .from('buklod_daily_engagement_items')
      .upsert(rows,{onConflict:'publish_date,slot'});
    if (insertError) throw insertError;

    await admin.schema('private')
      .from('buklod_daily_engagement_generation_runs')
      .update({status:'COMPLETE',ai_model:model,completed_at:new Date().toISOString(),updated_at:new Date().toISOString(),error_summary:null})
      .eq('publish_date',manilaDate)
      .eq('claim_token',claimToken);

    return json({ ok:true,publish_date:manilaDate,count:rows.length,model });
  } catch (error) {
    const message=cleanError(error);
    await admin.schema('private')
      .from('buklod_daily_engagement_generation_runs')
      .update({status:'FAILED',error_summary:message,updated_at:new Date().toISOString()})
      .eq('publish_date',manilaDate)
      .eq('claim_token',claimToken);
    console.error('[BUKLOD_DAILY_ENGAGEMENT_ERROR]',message);
    return json({ error:'Daily content is temporarily using the safe fallback.' },503);
  }
});
