import {
  StreamVideoClient,
  type Call,
} from '@stream-io/video-react-native-sdk';
import { supabase } from '@/lib/supabase';

export type BuklodPttScopeType =
  | 'ORGANIZATION'
  | 'CLUSTER'
  | 'LOCAL';

export type BuklodPttKind = 'NORMAL' | 'PRIORITY' | 'SOS';

export type BuklodPttScope = {
  id: string;
  name: string;
  scope_type: BuklodPttScopeType;
};

export type BuklodPttConnection = {
  client: StreamVideoClient;
  call: Call;
  scope: BuklodPttScope;
  channel: number;
  userId: string;
  callId: string;
  callType: string;
};

export type BuklodPttFloorGrant = {
  granted: boolean;
  reason?: string;
  transmission_id?: string;
  scope_id?: string;
  channel?: number;
  kind?: BuklodPttKind;
  priority?: number;
  call_id?: string;
  lease_expires_at?: string;
  holder_user_id?: string;
};

type SecurePttAccess = {
  token: string;
  api_key: string;
  user_id: string;
  call_type: string;
  call_id: string;
  expires_in: number;
  scope: BuklodPttScope;
};

export function buklodPttCallId(scopeId: string, channel: number) {
  return `ptt_${scopeId.replace(/-/g, '')}_ch${String(channel).padStart(2, '0')}`;
}

async function requireSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session?.user?.id) {
    throw new Error('BUKLOD session is not available.');
  }

  return session;
}

export async function loadBuklodPttScopes(): Promise<BuklodPttScope[]> {
  const session = await requireSession();

  const memberships = await supabase
    .from('buklod_scope_memberships')
    .select('scope_id,membership_status')
    .eq('user_id', session.user.id)
    .eq('membership_status', 'ACTIVE');

  if (memberships.error) throw memberships.error;

  const scopeIds = Array.from(
    new Set(
      (memberships.data ?? [])
        .map((row: any) => String(row.scope_id ?? '').trim())
        .filter(Boolean),
    ),
  );

  if (!scopeIds.length) return [];

  const scopes = await supabase
    .from('buklod_scopes')
    .select('id,name,scope_type,status')
    .in('id', scopeIds)
    .eq('status', 'ACTIVE');

  if (scopes.error) throw scopes.error;

  const priority: Record<string, number> = {
    ORGANIZATION: 0,
    CLUSTER: 1,
    LOCAL: 2,
  };

  return (scopes.data ?? [])
    .filter((row: any) =>
      ['ORGANIZATION', 'CLUSTER', 'LOCAL'].includes(String(row.scope_type)),
    )
    .map((row: any) => ({
      id: String(row.id),
      name: String(row.name || row.scope_type || 'BUKLOD'),
      scope_type: row.scope_type as BuklodPttScopeType,
    }))
    .sort(
      (a: BuklodPttScope, b: BuklodPttScope) =>
        (priority[a.scope_type] ?? 99) - (priority[b.scope_type] ?? 99) ||
        a.name.localeCompare(b.name),
    );
}

async function getSecurePttAccess(
  scope: BuklodPttScope,
  channel: number,
): Promise<{ session: Awaited<ReturnType<typeof requireSession>>; data: SecurePttAccess }> {
  const session = await requireSession();

  const result = await supabase.functions.invoke('buklod-ptt-access', {
    body: {
      scope_id: scope.id,
      channel,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (result.error) throw result.error;

  const data = result.data as SecurePttAccess | null;
  if (
    !data?.token ||
    !data?.api_key ||
    !data?.user_id ||
    data.call_type !== 'buklod_ptt' ||
    !data?.call_id ||
    data.scope?.id !== scope.id ||
    Number(channel) < 1 ||
    Number(channel) > 10
  ) {
    throw new Error('Secure BUKLOD PTT access was not granted.');
  }

  const expectedCallId = buklodPttCallId(scope.id, channel);
  if (data.call_id !== expectedCallId) {
    throw new Error('BUKLOD PTT call identity mismatch.');
  }

  return { session, data };
}

export async function connectBuklodPtt(
  scope: BuklodPttScope,
  channel: number,
): Promise<BuklodPttConnection> {
  if (!Number.isInteger(channel) || channel < 1 || channel > 10) {
    throw new Error('PTT channel must be between CH01 and CH10.');
  }

  const { session, data } = await getSecurePttAccess(scope, channel);

  const displayName = String(
    session.user.user_metadata?.full_name ||
      session.user.user_metadata?.name ||
      session.user.email ||
      'BUKLOD Member',
  );

  const options = {
    apiKey: data.api_key,
    user: {
      id: data.user_id,
      name: displayName,
    },
    token: data.token,
  };

  const staticFactory = (StreamVideoClient as any).getOrCreateInstance;
  const client: StreamVideoClient =
    typeof staticFactory === 'function'
      ? staticFactory(options)
      : new StreamVideoClient(options as any);

  const call = client.call(data.call_type, data.call_id);

  // The server already created the call and added this authenticated
  // ACTIVE BUKLOD scope member as a Stream call_member.
  // The client is intentionally not allowed to create arbitrary PTT calls.
  await call.get();
  // Mute before join. Stream publishes the mic on join, so a connect
  // was transmitting until the disable below finished.
  try {
    await call.camera.disable();
  } catch {}
  try {
    await call.microphone.disable();
  } catch {}
  try {
    await call.join();
    await call.camera.disable();
    await call.microphone.disable();
  } catch (error) {
    await call.microphone.disable().catch(() => undefined);
    await call.leave().catch(() => undefined);
    throw error;
  }

  return {
    client,
    call,
    scope,
    channel,
    userId: session.user.id,
    callId: data.call_id,
    callType: data.call_type,
  };
}

export async function disconnectBuklodPtt(
  connection: BuklodPttConnection | null,
) {
  if (!connection) return;

  try {
    await connection.call.microphone.disable();
  } catch {}

  try {
    await connection.call.leave();
  } catch {}
}

export async function setBuklodPttMonitor(
  scopeId: string,
  channel: number,
  enabled: boolean,
) {
  const { data, error } = await supabase.rpc('buklod_ptt_set_monitor', {
    p_scope_id: scopeId,
    p_channel: channel,
    p_enabled: enabled,
  });

  if (error) throw error;
  return Boolean(data);
}

export async function setBuklodPttPreferences(input: {
  backgroundReceiveEnabled: boolean;
  autoReceivePriority: boolean;
  respectPhoneSettings: boolean;
}) {
  const { data, error } = await supabase.rpc('buklod_ptt_set_preferences', {
    p_background_receive_enabled: input.backgroundReceiveEnabled,
    p_auto_receive_priority: input.autoReceivePriority,
    p_respect_phone_settings: input.respectPhoneSettings,
  });

  if (error) throw error;
  return data;
}

export async function claimBuklodPttFloor(
  scopeId: string,
  channel: number,
  kind: BuklodPttKind,
  callId: string,
): Promise<BuklodPttFloorGrant> {
  const { data, error } = await supabase.rpc('buklod_ptt_claim_floor', {
    p_scope_id: scopeId,
    p_channel: channel,
    p_kind: kind,
    p_call_id: callId,
    p_lease_seconds: 15,
  });

  if (error) throw error;
  return (data ?? { granted: false, reason: 'UNKNOWN' }) as BuklodPttFloorGrant;
}

export async function refreshBuklodPttFloor(
  transmissionId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('buklod_ptt_refresh_floor', {
    p_transmission_id: transmissionId,
    p_lease_seconds: 15,
  });

  if (error) throw error;
  return Boolean(data);
}

export async function releaseBuklodPttFloor(
  transmissionId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('buklod_ptt_release_floor', {
    p_transmission_id: transmissionId,
  });

  if (error) throw error;
  return Boolean(data);
}

export { supabase };