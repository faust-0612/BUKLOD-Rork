/* BUKLOD_PERMISSION_SNAPSHOT_R1
 *
 * Presentation permission checks used by the Foundation resolver can fan out
 * into dozens of POST /rest/v1/rpc/buklod_has_permission requests during one
 * login. This wrapper preserves the exact permission semantics but serves
 * those current-user checks from one short-lived, authenticated server-side
 * permission snapshot.
 *
 * Security boundaries:
 * - the snapshot RPC derives the user from auth.uid();
 * - requests that explicitly target p_user_id bypass this optimization;
 * - failures fall back to the original authoritative RPC;
 * - no mutation/write endpoint is cached or synthesized;
 * - actual protected operations remain enforced by Supabase RLS/RPC rules.
 */

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

type PermissionSnapshotRow = {
  permission_key?: string | null;
  scope_type?: string | null;
  scope_id?: string | null;
};

type PermissionRequest = {
  p_permission_key?: string | null;
  p_scope_type?: string | null;
  p_scope_id?: string | null;
  p_user_id?: string | null;
};

type SnapshotCacheEntry = {
  expiresAt: number;
  rows: PermissionSnapshotRow[];
};

type PermissionSnapshotState = {
  cache: Map<string, SnapshotCacheEntry>;
  inFlight: Map<string, Promise<PermissionSnapshotRow[]>>;
};

const SNAPSHOT_TTL_MS = 10_000;
const GLOBAL_STATE_KEY = '__BUKLOD_PERMISSION_SNAPSHOT_R1__';

function state(): PermissionSnapshotState {
  const root = globalThis as any;
  const existing = root[GLOBAL_STATE_KEY] as
    | PermissionSnapshotState
    | undefined;

  if (existing?.cache && existing?.inFlight) {
    return existing;
  }

  const created: PermissionSnapshotState = {
    cache: new Map(),
    inFlight: new Map(),
  };

  root[GLOBAL_STATE_KEY] = created;
  return created;
}

const sharedState = state();

function rawUrlOf(input: FetchInput): string {
  if (typeof input === 'string') return input;

  try {
    if (typeof URL !== 'undefined' && input instanceof URL) {
      return input.toString();
    }
  } catch {}

  const maybeUrl = (input as any)?.url;
  return typeof maybeUrl === 'string' ? maybeUrl : String(input);
}

function methodOf(input: FetchInput, init?: FetchInit): string {
  return String(
    (init as any)?.method ??
      (input as any)?.method ??
      'GET'
  ).toUpperCase();
}

function isPermissionRpc(rawUrl: string, method: string): boolean {
  return (
    method === 'POST' &&
    /\/rest\/v1\/rpc\/buklod_has_permission(?:[?#]|$)/i.test(rawUrl)
  );
}

async function bodyTextOf(
  input: FetchInput,
  init?: FetchInit
): Promise<string> {
  const initBody = (init as any)?.body;

  if (initBody != null) {
    return typeof initBody === 'string'
      ? initBody
      : String(initBody);
  }

  try {
    const request = input as any;
    if (request && typeof request.clone === 'function') {
      return await request.clone().text();
    }
  } catch {}

  return '';
}

function sourceHeaders(input: FetchInput, init?: FetchInit): Headers {
  try {
    return new Headers(
      (init as any)?.headers ??
        (input as any)?.headers ??
        undefined
    );
  } catch {
    return new Headers();
  }
}

function stableRuntimeHash(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function snapshotCacheKey(
  rawUrl: string,
  headers: Headers
): string {
  let origin = rawUrl;

  try {
    origin = new URL(rawUrl).origin;
  } catch {}

  const sessionMaterial = [
    headers.get('authorization') ?? '',
    headers.get('apikey') ?? '',
  ].join('|');

  return `${origin}::${stableRuntimeHash(sessionMaterial)}`;
}

function snapshotUrlFor(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.pathname = url.pathname.replace(
      /\/rest\/v1\/rpc\/buklod_has_permission$/i,
      '/rest/v1/rpc/buklod_my_permission_snapshot_v1'
    );
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return rawUrl.replace(
      /\/rest\/v1\/rpc\/buklod_has_permission(?:[?#].*)?$/i,
      '/rest/v1/rpc/buklod_my_permission_snapshot_v1'
    );
  }
}

function normalizeScopeType(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeScopeId(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized || null;
}

function snapshotAllows(
  rows: PermissionSnapshotRow[],
  request: PermissionRequest
): boolean {
  const permissionKey = String(
    request.p_permission_key ?? ''
  );
  const requestedScopeType = normalizeScopeType(
    request.p_scope_type
  );
  const requestedScopeId = normalizeScopeId(
    request.p_scope_id
  );

  if (!permissionKey) return false;

  return rows.some((row) => {
    const rowPermission = String(row.permission_key ?? '');
    const rowScopeType = normalizeScopeType(row.scope_type);

    if (
      rowPermission === '*' &&
      rowScopeType === 'GLOBAL'
    ) {
      return true;
    }

    if (rowPermission !== permissionKey) {
      return false;
    }

    if (rowScopeType === 'GLOBAL') {
      return true;
    }

    if (!requestedScopeType) {
      return false;
    }

    return (
      rowScopeType === requestedScopeType &&
      normalizeScopeId(row.scope_id) === requestedScopeId
    );
  });
}

function booleanRpcResponse(value: boolean): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-buklod-permission-snapshot': '1',
    },
  });
}

async function fetchSnapshot(
  baseFetch: typeof fetch,
  rawUrl: string,
  input: FetchInput,
  init?: FetchInit
): Promise<PermissionSnapshotRow[]> {
  const headers = sourceHeaders(input, init);
  headers.set('content-type', 'application/json');

  const key = snapshotCacheKey(rawUrl, headers);
  const now = Date.now();
  const cached = sharedState.cache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.rows;
  }

  if (cached) {
    sharedState.cache.delete(key);
  }

  const pending = sharedState.inFlight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const response = await baseFetch(
      snapshotUrlFor(rawUrl),
      {
        ...(init as any),
        method: 'POST',
        headers,
        body: '{}',
      }
    );

    if (!response.ok) {
      throw new Error(
        `BUKLOD permission snapshot failed (${response.status}).`
      );
    }

    const raw = await response.text();
    const parsed = raw ? JSON.parse(raw) : [];
    const rows = Array.isArray(parsed)
      ? (parsed as PermissionSnapshotRow[])
      : [];

    sharedState.cache.set(key, {
      expiresAt: Date.now() + SNAPSHOT_TTL_MS,
      rows,
    });

    return rows;
  })();

  sharedState.inFlight.set(key, task);

  try {
    return await task;
  } finally {
    sharedState.inFlight.delete(key);
  }
}

export function clearBuklodPermissionSnapshotCache() {
  sharedState.cache.clear();
  sharedState.inFlight.clear();
}

export function createBuklodPermissionSnapshotFetch(
  baseFetch: typeof fetch
): typeof fetch {
  const wrapped = async (
    input: FetchInput,
    init?: FetchInit
  ): Promise<Response> => {
    const rawUrl = rawUrlOf(input);
    const method = methodOf(input, init);

    if (!isPermissionRpc(rawUrl, method)) {
      return baseFetch(input, init);
    }

    try {
      const bodyText = await bodyTextOf(input, init);
      const request = JSON.parse(bodyText || '{}') as PermissionRequest;

      /*
       * Explicit target-user checks may be privileged/admin workflows.
       * Never substitute the current-user snapshot for those requests.
       */
      if (request.p_user_id != null) {
        return baseFetch(input, init);
      }

      if (!request.p_permission_key) {
        return baseFetch(input, init);
      }

      const rows = await fetchSnapshot(
        baseFetch,
        rawUrl,
        input,
        init
      );

      return booleanRpcResponse(snapshotAllows(rows, request));
    } catch {
      /*
       * Fail open to the original authoritative RPC behavior, not to access.
       * If the optimization is unavailable, Supabase decides as before.
       */
      return baseFetch(input, init);
    }
  };

  return wrapped as typeof fetch;
}
