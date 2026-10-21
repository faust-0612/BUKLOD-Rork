import {
  chooseNewestHistoryPage,
  connectHistoryQueryPlan,
  oldestConnectCursor,
  trimNewestConnectPage,
  type ConnectHistoryCursor,
  type ConnectHistoryIdentity,
} from '@/lib/connectChatWindow';

export type ConnectHistoryQueryPlan = ReturnType<typeof connectHistoryQueryPlan>;

export type ConnectHistoryGatewayResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

export type ConnectHistoryGateway<T extends ConnectHistoryIdentity> = {
  pageV2: (args: {
    kind: 'direct' | 'scope';
    containerId: string;
    plan: ConnectHistoryQueryPlan;
  }) => Promise<ConnectHistoryGatewayResult<T>>;
  legacyRpc: (args: {
    kind: 'direct' | 'scope';
    containerId: string;
    pageSize: number;
  }) => Promise<ConnectHistoryGatewayResult<T>>;
  direct: (args: {
    kind: 'direct' | 'scope';
    containerId: string;
    plan: ConnectHistoryQueryPlan;
  }) => Promise<ConnectHistoryGatewayResult<T>>;
};

export type ConnectHistoryAvailability = {
  directV2: boolean | null;
  scopeV2: boolean | null;
};

export function createConnectHistoryAvailability(): ConnectHistoryAvailability {
  return {
    directV2: null,
    scopeV2: null,
  };
}

export function isMissingConnectHistoryRpc(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

export type ConnectHistorySelection<T extends ConnectHistoryIdentity> = {
  rows: T[];
  hasOlder: boolean;
  oldestCursor: ConnectHistoryCursor | null;
  source: 'v2' | 'rpc' | 'direct' | 'empty';
};

function pageFromRows<T extends ConnectHistoryIdentity>(
  rows: T[],
  pageSize: number,
  source: ConnectHistorySelection<T>['source']
): ConnectHistorySelection<T> {
  const trimmed = trimNewestConnectPage(rows, pageSize);
  return {
    rows: trimmed.messages,
    hasOlder: trimmed.hasOlder,
    oldestCursor: oldestConnectCursor(trimmed.messages),
    source,
  };
}

export async function selectConnectHistoryRows<
  T extends ConnectHistoryIdentity,
>(args: {
  gateway: ConnectHistoryGateway<T>;
  kind: 'direct' | 'scope';
  containerId: string;
  limit?: number;
  before?: ConnectHistoryCursor | null;
  availability?: ConnectHistoryAvailability;
}): Promise<ConnectHistorySelection<T>> {
  const availability =
    args.availability ?? createConnectHistoryAvailability();
  const plan = connectHistoryQueryPlan(
    args.limit ?? 120,
    args.before
  );
  const v2Key = args.kind === 'direct' ? 'directV2' : 'scopeV2';

  if (availability[v2Key] !== false) {
    const v2 = await args.gateway.pageV2({
      kind: args.kind,
      containerId: args.containerId,
      plan,
    });

    if (!v2.error) {
      availability[v2Key] = true;
      return pageFromRows(v2.data ?? [], plan.pageSize, 'v2');
    }

    if (isMissingConnectHistoryRpc(String(v2.error.message ?? ''))) {
      availability[v2Key] = false;
    } else if (!args.before) {
      availability[v2Key] = false;
    } else {
      throw new Error(String(v2.error.message ?? 'Could not load older messages.'));
    }
  }

  if (args.before) {
    const direct = await args.gateway.direct({
      kind: args.kind,
      containerId: args.containerId,
      plan,
    });

    if (direct.error) {
      throw new Error(
        String(direct.error.message ?? 'Could not load older messages.')
      );
    }

    return pageFromRows(direct.data ?? [], plan.pageSize, 'direct');
  }

  const [legacy, direct] = await Promise.all([
    args.gateway.legacyRpc({
      kind: args.kind,
      containerId: args.containerId,
      pageSize: plan.pageSize,
    }),
    args.gateway.direct({
      kind: args.kind,
      containerId: args.containerId,
      plan,
    }),
  ]);

  if (legacy.error && direct.error) {
    throw new Error(
      String(legacy.error.message ?? direct.error.message ?? 'Could not load messages.')
    );
  }

  const chosen = chooseNewestHistoryPage({
    rpcRows: legacy.error ? null : (legacy.data ?? []),
    directRows: direct.error ? null : (direct.data ?? []),
    pageSize: plan.pageSize,
  });

  return {
    rows: chosen.messages,
    hasOlder: chosen.hasOlder,
    oldestCursor: oldestConnectCursor(chosen.messages),
    source: chosen.source === 'empty' ? 'empty' : chosen.source,
  };
}
