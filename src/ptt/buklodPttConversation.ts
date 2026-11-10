import { supabase, type BuklodPttConnection } from './buklodPttCore';

export type BuklodPttMessage = {
  id: string;
  scope_id: string;
  channel: number;
  sender_user_id: string;
  sender_name: string;
  kind: 'TEXT' | 'CAPTION';
  body: string;
  provider_event_id: string | null;
  transmission_id: string | null;
  created_at: string;
};

const TABLE = 'buklod_ptt_channel_messages';
const MAX_BODY = 4000;

function cleanText(value: unknown) {
  return String(value ?? '').trim().slice(0, MAX_BODY);
}

export async function listBuklodPttMessages(
  scopeId: string,
  channel: number,
  before?: string,
): Promise<BuklodPttMessage[]> {
  let query = supabase
    .from(TABLE)
    .select('id,scope_id,channel,sender_user_id,sender_name,kind,body,provider_event_id,transmission_id,created_at')
    .eq('scope_id', scopeId)
    .eq('channel', channel)
    .order('created_at', { ascending: false })
    .limit(50);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as BuklodPttMessage[]).reverse();
}

export async function sendBuklodPttText(scopeId: string, channel: number, text: string) {
  const body = cleanText(text);
  if (!body) throw new Error('Write a message first.');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Sign in to send a PTT message.');
  const senderName = String(user.user_metadata?.full_name || user.user_metadata?.name || 'BUKLOD Member').slice(0, 120);
  const { error } = await supabase.from(TABLE).insert({
    scope_id: scopeId,
    channel,
    sender_user_id: user.id,
    sender_name: senderName,
    kind: 'TEXT',
    body,
  });
  if (error) throw error;
}

type CaptionPayload = {
  id?: string;
  text?: string;
  speaker_id?: string;
  user?: { id?: string; name?: string };
  start_time?: string;
  translated?: boolean;
};

export async function persistOwnBuklodPttCaption(
  connection: BuklodPttConnection,
  caption: CaptionPayload,
  transmissionId: string,
) {
  if (caption.translated || !transmissionId) return;
  const speaker = String(caption.speaker_id || caption.user?.id || '');
  if (speaker !== connection.userId) return; // Never attribute another member's voice to ourselves.
  const body = cleanText(caption.text);
  if (!body) return;
  const eventIdentity = String(caption.id || caption.start_time || '').slice(0, 180);
  if (!eventIdentity) return; // Stable identity is required for deduplication on reconnect.
  const { error } = await supabase.from(TABLE).insert({
    scope_id: connection.scope.id,
    channel: connection.channel,
    sender_user_id: connection.userId,
    sender_name: String(caption.user?.name || 'BUKLOD Member').slice(0, 120),
    kind: 'CAPTION',
    body,
    transmission_id: transmissionId,
    provider_event_id: eventIdentity,
  });
  // Multiple devices can receive the same caption; retry-safe unique key.
  if (error && error.code !== '23505') throw error;
}

export async function setBuklodPttCaptions(
  scopeId: string,
  channel: number,
  enabled: boolean,
  language: 'tl' | 'en' = 'tl',
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('BUKLOD session expired. Sign in again.');
  const { data, error } = await supabase.functions.invoke('buklod-ptt-captions', {
    body: { scope_id: scopeId, channel, action: enabled ? 'start' : 'stop', language },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}
