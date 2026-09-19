export type BuklodAiCharacterCreateInput = {
  sourceUrl: string;
  text: string;
  accessToken: string;
  voiceId?: string;
};

export type BuklodAiCharacterJob = {
  id: string;
  status: string;
  resultUrl?: string | null;
  error?: string | null;
};

const supabaseUrl = String(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
).replace(/\/$/, '');

const publishableKey = String(
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
);

function functionUrl() {
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Supabase public environment is not configured.');
  }

  return `${supabaseUrl}/functions/v1/buklod-character-alive`;
}

async function callFunction(
  body: Record<string, unknown>,
  accessToken: string,
) {
  const response = await fetch(functionUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      String(payload?.error ?? payload?.message ?? `Character AI request failed (${response.status}).`),
    );
  }

  return payload as BuklodAiCharacterJob;
}

export async function createBuklodTalkingCharacter({
  sourceUrl,
  text,
  accessToken,
  voiceId = 'en-US-JennyMultilingualV2Neural',
}: BuklodAiCharacterCreateInput) {
  const trimmed = text.trim();

  if (!/^https:\/\//i.test(sourceUrl)) {
    throw new Error('Character AI requires a public HTTPS character image URL.');
  }

  if (!trimmed) {
    throw new Error('Character speech text is empty.');
  }

  if (trimmed.length > 1200) {
    throw new Error('Character speech is too long.');
  }

  return callFunction(
    {
      action: 'create',
      source_url: sourceUrl,
      text: trimmed,
      voice_id: voiceId,
    },
    accessToken,
  );
}

export async function getBuklodTalkingCharacterStatus(
  id: string,
  accessToken: string,
) {
  return callFunction(
    {
      action: 'status',
      id,
    },
    accessToken,
  );
}

export async function waitForBuklodTalkingCharacter(
  id: string,
  accessToken: string,
  options?: {
    timeoutMs?: number;
    pollMs?: number;
  },
) {
  const timeoutMs = options?.timeoutMs ?? 45_000;
  const pollMs = options?.pollMs ?? 1_200;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = await getBuklodTalkingCharacterStatus(id, accessToken);

    if (job.status === 'done' && job.resultUrl) {
      return job;
    }

    if (job.status === 'error' || job.status === 'failed') {
      throw new Error(job.error || 'Character animation generation failed.');
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error('Character animation timed out.');
}
