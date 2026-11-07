import { supabase } from '@/lib/supabase';
import {
  loadPersonDisplayNames,
  resolvePersonDisplayName,
} from '@/lib/buklodPersonDisplay';
import { SCALE_LIMITS } from '@/lib/performanceScale';
import {
  applyConnectHistoryDirectQuery,
  connectHistoryQueryPlan,
  type ConnectHistoryCursor,
} from '@/lib/connectChatWindow';
import {
  createConnectHistoryAvailability,
  selectConnectHistoryRows,
  type ConnectHistoryAvailability,
  type ConnectHistoryGateway,
} from '@/lib/connectHistoryLoader';

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

export type ConnectHistoryPage = {
  messages: ConnectHistoryMessage[];
  hasOlder: boolean;
  oldestCursor: ConnectHistoryCursor | null;
};

const DIRECT_MESSAGE_SELECT_WITH_DELETED =
  'id,sender_id,body,attachment_path,attachment_name,attachment_mime,attachment_size,created_at,deleted_at';

const DIRECT_MESSAGE_SELECT_LEGACY =
  'id,sender_id,body,attachment_path,attachment_name,attachment_mime,attachment_size,created_at';

const SCOPE_MESSAGE_SELECT_WITH_DELETED =
  'id,scope_id,sender_id,body,attachment_path,attachment_name,attachment_mime,attachment_size,created_at,deleted_at';

const SCOPE_MESSAGE_SELECT_LEGACY =
  'id,scope_id,sender_id,body,attachment_path,attachment_name,attachment_mime,attachment_size,created_at';

const historyAvailability: ConnectHistoryAvailability =
  createConnectHistoryAvailability();

function isMissingColumnError(message: string) {
  return /deleted_at|column.*does not exist|schema cache/i.test(message);
}

function mapDirectRows(
  rows: any[],
  names: Record<string, string> = {}
): ConnectHistoryMessage[] {
  return rows.map(row => {
    const senderId = String(row.sender_id);

    return {
      id: String(row.id),
      sender_id: senderId,
      sender_name: resolvePersonDisplayName(names[senderId], senderId),
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
  names: Record<string, string>
): ConnectHistoryMessage[] {
  return rows.map(row => {
    const senderId = String(row.sender_id);

    return {
      id: String(row.id),
      sender_id: senderId,
      sender_name: resolvePersonDisplayName(
        row.sender_name ?? names[senderId],
        senderId
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

async function queryMessageTable(args: {
  table: string;
  columnsWithDeleted: string;
  columnsLegacy: string;
  idColumn: 'thread_id' | 'scope_id';
  containerId: string;
  plan: ReturnType<typeof connectHistoryQueryPlan>;
}) {
  const run = async (columns: string) => {
    const query = (supabase as any)
      .from(args.table)
      .select(columns)
      .eq(args.idColumn, args.containerId);

    return applyConnectHistoryDirectQuery(query, args.plan);
  };

  let result = await run(args.columnsWithDeleted);

  if (
    result.error &&
    isMissingColumnError(String(result.error.message ?? ''))
  ) {
    result = await run(args.columnsLegacy);
  }

  return {
    data: (result.data ?? null) as ConnectHistoryMessage[] | null,
    error: result.error
      ? { message: String(result.error.message ?? '') }
      : null,
  };
}

function createGateway(): ConnectHistoryGateway<any> {
  return {
    pageV2: async ({ kind, containerId, plan }) => {
      const rpcName =
        kind === 'direct'
          ? 'buklod_connect_direct_messages_page_v2'
          : 'buklod_connect_scope_messages_page_v2';
      const idArg =
        kind === 'direct'
          ? { _thread_id: containerId }
          : { _scope_id: containerId };

      const result = await (supabase as any).rpc(rpcName, {
        ...idArg,
        _limit: plan.limit,
        _before: plan.before?.createdAt ?? null,
        _before_id: plan.before?.id ?? null,
      });

      return {
        data: result.data ?? null,
        error: result.error
          ? { message: String(result.error.message ?? '') }
          : null,
      };
    },
    legacyRpc: async ({ kind, containerId, pageSize }) => {
      const rpcName =
        kind === 'direct'
          ? 'buklod_connect_direct_messages_v1'
          : 'buklod_connect_scope_messages_v1';
      const args =
        kind === 'direct'
          ? { _thread_id: containerId, _limit: pageSize }
          : { _scope_id: containerId, _limit: pageSize };
      const result = await (supabase as any).rpc(rpcName, args);

      return {
        data: result.data ?? null,
        error: result.error
          ? { message: String(result.error.message ?? '') }
          : null,
      };
    },
    direct: async ({ kind, containerId, plan }) =>
      queryMessageTable({
        table:
          kind === 'direct'
            ? 'buklod_connect_direct_messages'
            : 'buklod_connect_scope_messages',
        columnsWithDeleted:
          kind === 'direct'
            ? DIRECT_MESSAGE_SELECT_WITH_DELETED
            : SCOPE_MESSAGE_SELECT_WITH_DELETED,
        columnsLegacy:
          kind === 'direct'
            ? DIRECT_MESSAGE_SELECT_LEGACY
            : SCOPE_MESSAGE_SELECT_LEGACY,
        idColumn: kind === 'direct' ? 'thread_id' : 'scope_id',
        containerId,
        plan,
      }),
  };
}

async function hydrate(
  kind: 'direct' | 'scope',
  rows: any[]
) {
  const names = await loadPersonDisplayNames(
    rows.map(row => row.sender_id)
  );

  return kind === 'direct'
    ? mapDirectRows(rows, names)
    : normalizeScopeRows(rows, names);
}

export async function fetchConnectHistoryPage(args: {
  kind: 'direct' | 'scope';
  containerId: string;
  limit?: number;
  before?: ConnectHistoryCursor | null;
}): Promise<ConnectHistoryPage> {
  const selected = await selectConnectHistoryRows({
    gateway: createGateway(),
    kind: args.kind,
    containerId: args.containerId,
    limit: args.limit ?? SCALE_LIMITS.connectHistory,
    before: args.before,
    availability: historyAvailability,
  });
  const messages = await hydrate(args.kind, selected.rows);

  return {
    messages,
    hasOlder: selected.hasOlder,
    oldestCursor: selected.oldestCursor,
  };
}

export async function fetchDirectConnectMessages(
  threadId: string,
  limit: number = SCALE_LIMITS.connectHistory
) {
  const page = await fetchConnectHistoryPage({
    kind: 'direct',
    containerId: threadId,
    limit,
  });
  return page.messages;
}

export async function fetchScopeConnectMessages(
  scopeId: string,
  limit: number = SCALE_LIMITS.connectHistory
) {
  const page = await fetchConnectHistoryPage({
    kind: 'scope',
    containerId: scopeId,
    limit,
  });
  return page.messages;
}

export async function fetchDirectConnectHistoryPage(
  threadId: string,
  limit: number = SCALE_LIMITS.connectHistory,
  before?: ConnectHistoryCursor | null
) {
  return fetchConnectHistoryPage({
    kind: 'direct',
    containerId: threadId,
    limit,
    before,
  });
}

export async function fetchScopeConnectHistoryPage(
  scopeId: string,
  limit: number = SCALE_LIMITS.connectHistory,
  before?: ConnectHistoryCursor | null
) {
  return fetchConnectHistoryPage({
    kind: 'scope',
    containerId: scopeId,
    limit,
    before,
  });
}
