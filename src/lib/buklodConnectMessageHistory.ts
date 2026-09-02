import {
  supabase,
} from '@/lib/supabase';
import {
  loadPersonDisplayNames,
  resolvePersonDisplayName,
} from '@/lib/buklodPersonDisplay';
import {
  SCALE_LIMITS,
} from '@/lib/performanceScale';

export type ConnectHistoryMessage = {
  id: string;
  sender_id: string;
  sender_name?: string | null;
  body: string;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  created_at: string;
  deleted_at?: string | null;
};

const DIRECT_MESSAGE_SELECT_WITH_DELETED =
  'id,sender_id,body,attachment_path,attachment_name,attachment_mime,attachment_size,created_at,deleted_at';

const DIRECT_MESSAGE_SELECT_LEGACY =
  'id,sender_id,body,attachment_path,attachment_name,attachment_mime,attachment_size,created_at';

const SCOPE_MESSAGE_SELECT_WITH_DELETED =
  'id,scope_id,sender_id,body,attachment_path,attachment_name,attachment_mime,attachment_size,created_at,deleted_at';

const SCOPE_MESSAGE_SELECT_LEGACY =
  'id,scope_id,sender_id,body,attachment_path,attachment_name,attachment_mime,attachment_size,created_at';

const HISTORY_LIMIT = SCALE_LIMITS.connectHistory;

function isMissingColumnError(
  message: string
) {
  return /deleted_at|column.*does not exist|schema cache/i.test(
    message
  );
}

function isMissingRpcError(
  message: string
) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

function mapDirectRows(
  rows: any[],
  names: Record<string, string> = {},
): ConnectHistoryMessage[] {
  return rows.map(row => {
    const senderId = String(row.sender_id);

    return {
      id: String(row.id),
      sender_id: senderId,
      sender_name: resolvePersonDisplayName(
        names[senderId],
        senderId,
      ),
      body: String(row.body ?? ''),
      attachment_path: row.attachment_path ?? null,
      attachment_name: row.attachment_name ?? null,
      attachment_mime: row.attachment_mime ?? null,
      attachment_size: row.attachment_size ?? null,
      created_at: String(row.created_at),
      deleted_at: row.deleted_at ?? null,
    };
  });
}

function normalizeScopeRows(
  rows: any[],
  names: Record<string, string>,
): ConnectHistoryMessage[] {
  return rows.map(row => {
    const senderId = String(row.sender_id);

    return {
      id: String(row.id),
      sender_id: senderId,
      sender_name: resolvePersonDisplayName(
        row.sender_name ?? names[senderId],
        senderId,
      ),
      body: String(row.body ?? ''),
      attachment_path: row.attachment_path ?? null,
      attachment_name: row.attachment_name ?? null,
      attachment_mime: row.attachment_mime ?? null,
      attachment_size: row.attachment_size ?? null,
      created_at: String(row.created_at),
      deleted_at: row.deleted_at ?? null,
    };
  });
}

async function fetchDirectConnectMessagesDirect(
  threadId: string,
  limit: number = HISTORY_LIMIT
): Promise<ConnectHistoryMessage[]> {
  const safeLimit = Math.min(
    Math.max(limit, 1),
    SCALE_LIMITS.connectHistory
  );

  const runQuery = (columns: string) =>
    (supabase as any)
      .from('buklod_connect_direct_messages')
      .select(columns)
      .eq('thread_id', threadId)
      .order('created_at', {
        ascending: true,
      })
      .limit(safeLimit);

  let result = await runQuery(
    DIRECT_MESSAGE_SELECT_WITH_DELETED
  );

  if (
    result.error &&
    isMissingColumnError(
      String(result.error.message ?? '')
    )
  ) {
    result = await runQuery(
      DIRECT_MESSAGE_SELECT_LEGACY
    );
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  const rows = result.data ?? [];
  const names = await loadPersonDisplayNames(
    rows.map((row: any) => row.sender_id),
  );

  return mapDirectRows(rows, names);
}

async function fetchScopeConnectMessagesDirect(
  scopeId: string,
  limit: number = HISTORY_LIMIT
): Promise<ConnectHistoryMessage[]> {
  const safeLimit = Math.min(
    Math.max(limit, 1),
    SCALE_LIMITS.connectHistory
  );

  const runQuery = (columns: string) =>
    (supabase as any)
      .from('buklod_connect_scope_messages')
      .select(columns)
      .eq('scope_id', scopeId)
      .order('created_at', {
        ascending: true,
      })
      .limit(safeLimit);

  let result = await runQuery(
    SCOPE_MESSAGE_SELECT_WITH_DELETED
  );

  if (
    result.error &&
    isMissingColumnError(
      String(result.error.message ?? '')
    )
  ) {
    result = await runQuery(
      SCOPE_MESSAGE_SELECT_LEGACY
    );
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  const rows = result.data ?? [];
  const names = await loadPersonDisplayNames(
    rows.map((row: any) => row.sender_id),
  );

  return normalizeScopeRows(rows, names);
}

export async function fetchDirectConnectMessages(
  threadId: string,
  limit = HISTORY_LIMIT
): Promise<ConnectHistoryMessage[]> {
  const safeLimit = Math.min(
    Math.max(limit, 1),
    SCALE_LIMITS.connectHistory
  );

  const rpcResult = await (supabase as any).rpc(
    'buklod_connect_direct_messages_v1',
    {
      _thread_id: threadId,
      _limit: safeLimit,
    }
  );

  if (!rpcResult.error) {
    const rows = rpcResult.data ?? [];
    const names = await loadPersonDisplayNames(
      rows.map((row: any) => row.sender_id),
    );

    return mapDirectRows(rows, names);
  }

  const message = String(
    rpcResult.error?.message ?? ''
  );

  if (!isMissingRpcError(message)) {
    try {
      return await fetchDirectConnectMessagesDirect(
        threadId,
        safeLimit
      );
    } catch (directError: any) {
      throw new Error(
        String(
          directError?.message ??
            message
        )
      );
    }
  }

  return fetchDirectConnectMessagesDirect(
    threadId,
    safeLimit
  );
}

export async function fetchScopeConnectMessages(
  scopeId: string,
  limit = HISTORY_LIMIT
): Promise<ConnectHistoryMessage[]> {
  const safeLimit = Math.min(
    Math.max(limit, 1),
    SCALE_LIMITS.connectHistory
  );

  const rpcResult = await (supabase as any).rpc(
    'buklod_connect_scope_messages_v1',
    {
      _scope_id: scopeId,
      _limit: safeLimit,
    }
  );

  if (!rpcResult.error) {
    const rows = rpcResult.data ?? [];
    const names = await loadPersonDisplayNames(
      rows.map((row: any) => row.sender_id),
    );

    return normalizeScopeRows(rows, names);
  }

  const message = String(
    rpcResult.error?.message ?? ''
  );

  if (!isMissingRpcError(message)) {
    try {
      return await fetchScopeConnectMessagesDirect(
        scopeId,
        safeLimit
      );
    } catch (directError: any) {
      throw new Error(
        String(
          directError?.message ??
            message
        )
      );
    }
  }

  return fetchScopeConnectMessagesDirect(
    scopeId,
    safeLimit
  );
}
