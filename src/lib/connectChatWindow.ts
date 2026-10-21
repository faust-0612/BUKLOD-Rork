import { parseConnectAlbumBody } from '@/lib/connectAlbumBody';
import { SCALE_LIMITS } from '@/lib/performanceScale';

export type ConnectHistoryCursor = {
  createdAt: string;
  id: string;
};

export type ConnectHistoryIdentity = {
  id: string;
  created_at: string;
};

export const CONNECT_NEAR_BOTTOM_PX = 96;
export const CONNECT_LOAD_OLDER_PX = 72;
export const CONNECT_GROUP_GAP_MS = 5 * 60 * 1000;
export const CONNECT_SIGNED_URL_TTL_SECONDS = 3600;
export const CONNECT_SIGNED_URL_REFRESH_LEAD_MS = 5 * 60 * 1000;
export const CONNECT_SEEN_AVATAR_LIMIT = 3;

const HISTORY_PAGE_PROBE = 1;

export function compareConnectHistory(
  a: ConnectHistoryIdentity,
  b: ConnectHistoryIdentity
) {
  const time = String(a.created_at).localeCompare(String(b.created_at));
  if (time !== 0) {
    return time;
  }

  return String(a.id).localeCompare(String(b.id));
}

export function orderConnectHistoryChronologically<
  T extends ConnectHistoryIdentity,
>(rows: T[]) {
  const byId = new Map<string, T>();

  for (const row of rows) {
    byId.set(String(row.id), row);
  }

  return [...byId.values()].sort(compareConnectHistory);
}

export function connectHistoryQueryPlan(
  limit: number,
  before?: ConnectHistoryCursor | null
) {
  const safeLimit = Math.min(
    Math.max(Math.floor(limit) || 1, 1),
    SCALE_LIMITS.connectHistory
  );

  return {
    order: [
      { column: 'created_at' as const, ascending: false },
      { column: 'id' as const, ascending: false },
    ],
    limit: safeLimit + HISTORY_PAGE_PROBE,
    pageSize: safeLimit,
    before: before ?? null,
  };
}

export function connectHistoryBeforeFilter(before: ConnectHistoryCursor) {
  const created = `"${String(before.createdAt).replace(/"/g, '')}"`;
  const id = `"${String(before.id).replace(/"/g, '')}"`;
  return `created_at.lt.${created},and(created_at.eq.${created},id.lt.${id})`;
}

export function applyConnectHistoryDirectQuery<T extends {
  or: (filters: string) => T;
  order: (column: string, options: { ascending: boolean }) => T;
  limit: (count: number) => T;
}>(
  query: T,
  plan: ReturnType<typeof connectHistoryQueryPlan>
) {
  let next = query;

  if (plan.before) {
    next = next.or(connectHistoryBeforeFilter(plan.before));
  }

  for (const item of plan.order) {
    next = next.order(item.column, { ascending: item.ascending });
  }

  return next.limit(plan.limit);
}

export function trimNewestConnectPage<T extends ConnectHistoryIdentity>(
  rows: T[],
  pageSize: number
) {
  const newestFirst = [...rows].sort(
    (a, b) => compareConnectHistory(b, a)
  );
  const hasOlder = newestFirst.length > pageSize;
  const messages = newestFirst.slice(0, pageSize).reverse();

  return {
    messages,
    hasOlder,
  };
}

export function oldestConnectCursor<T extends ConnectHistoryIdentity>(
  messages: T[]
): ConnectHistoryCursor | null {
  const oldest = messages[0];
  if (!oldest) {
    return null;
  }

  return {
    createdAt: String(oldest.created_at),
    id: String(oldest.id),
  };
}

/**
 * The legacy RPC may return the oldest N rows. The direct query is required
 * to use the newest-page plan. Prefer whichever page actually reaches the
 * later message. Sorting alone cannot invent rows a source never returned.
 */
export function chooseNewestHistoryPage<T extends ConnectHistoryIdentity>(args: {
  rpcRows: T[] | null;
  directRows: T[] | null;
  pageSize: number;
}) {
  const rpc = args.rpcRows
    ? trimNewestConnectPage(args.rpcRows, args.pageSize)
    : null;
  const direct = args.directRows
    ? trimNewestConnectPage(args.directRows, args.pageSize)
    : null;

  if (!rpc?.messages.length && !direct?.messages.length) {
    return {
      messages: [] as T[],
      hasOlder: false,
      source: 'empty' as const,
    };
  }

  if (!direct?.messages.length) {
    return {
      messages: rpc!.messages,
      hasOlder: (args.rpcRows?.length ?? 0) >= args.pageSize || rpc!.hasOlder,
      source: 'rpc' as const,
    };
  }

  if (!rpc?.messages.length) {
    return {
      messages: direct.messages,
      hasOlder: direct.hasOlder,
      source: 'direct' as const,
    };
  }

  const rpcNewest = rpc.messages[rpc.messages.length - 1];
  const directNewest = direct.messages[direct.messages.length - 1];
  const newestCmp = compareConnectHistory(directNewest, rpcNewest);

  if (newestCmp > 0) {
    return {
      messages: direct.messages,
      hasOlder: direct.hasOlder,
      source: 'direct' as const,
    };
  }

  if (newestCmp < 0) {
    return {
      messages: rpc.messages,
      hasOlder: (args.rpcRows?.length ?? 0) >= args.pageSize || rpc.hasOlder,
      source: 'rpc' as const,
    };
  }

  const rpcOldest = rpc.messages[0];
  const directOldest = direct.messages[0];

  if (compareConnectHistory(directOldest, rpcOldest) > 0) {
    return {
      messages: direct.messages,
      hasOlder: direct.hasOlder,
      source: 'direct' as const,
    };
  }

  return {
    messages: rpc.messages,
    hasOlder: (args.rpcRows?.length ?? 0) >= args.pageSize || rpc.hasOlder,
    source: 'rpc' as const,
  };
}

export function mergeConnectHistoryPages<T extends ConnectHistoryIdentity>(
  older: T[],
  current: T[]
) {
  return orderConnectHistoryChronologically([...older, ...current]);
}

type MergeableMessage = ConnectHistoryIdentity & {
  sender_id: string;
  body: string;
  attachment_path?: string | null;
  delivery_state?: 'pending' | 'sent' | 'not_sent';
  pending_album?: unknown[] | null;
};

export function mergeConnectServerMessages<T extends MergeableMessage>(
  server: T[],
  current: T[],
  mode: 'replace' | 'retain-older' = 'replace'
) {
  const locals = current.filter(item =>
    String(item.id).startsWith('local-')
  );

  const keptLocals = locals.filter(local => {
    if (local.delivery_state === 'not_sent') {
      return true;
    }

    if (local.delivery_state !== 'pending') {
      return false;
    }

    const localTime = new Date(local.created_at).getTime();
    const localCaption = parseConnectAlbumBody(local.body).caption;
    const localHasMedia = !!(
      local.attachment_path || local.pending_album?.length
    );

    return !server.some(row => {
      const rowCaption = parseConnectAlbumBody(row.body).caption;
      const rowHasMedia = !!row.attachment_path;

      return (
        row.sender_id === local.sender_id &&
        rowCaption === localCaption &&
        rowHasMedia === localHasMedia &&
        Math.abs(new Date(row.created_at).getTime() - localTime) < 120000
      );
    });
  });

  const byId = new Map<string, T>();

  if (mode === 'retain-older') {
    for (const row of current) {
      if (!String(row.id).startsWith('local-')) {
        byId.set(String(row.id), row);
      }
    }
  }

  for (const row of server) {
    byId.set(String(row.id), row);
  }

  for (const local of keptLocals) {
    byId.set(String(local.id), local);
  }

  return orderConnectHistoryChronologically([...byId.values()]);
}

export type ConnectScrollIntent =
  | 'open'
  | 'own-send'
  | 'content'
  | 'older-prepend'
  | 'incoming';

export function connectScrollAction(args: {
  intent: ConnectScrollIntent;
  nearBottom: boolean;
  initialSettled: boolean;
}) {
  if (args.intent === 'open') {
    return args.initialSettled ? ('anchor-end' as const) : ('wait' as const);
  }

  if (args.intent === 'own-send') {
    return 'stick-end' as const;
  }

  if (args.intent === 'older-prepend') {
    return 'preserve' as const;
  }

  if (args.nearBottom) {
    return 'stick-end' as const;
  }

  return 'none' as const;
}

export function connectThreadSessionKey(args: {
  profileId?: string | null;
  mode: string;
  containerId?: string | null;
}) {
  return `${args.profileId ?? ''}:${args.mode}:${args.containerId ?? ''}`;
}

export function connectBubbleGrouping(args: {
  senderId: string;
  createdAt: string;
  previous: { senderId: string; createdAt: string } | null;
  next: { senderId: string; createdAt: string } | null;
  gapMs?: number;
}) {
  const gap = args.gapMs ?? CONNECT_GROUP_GAP_MS;
  const close = (left: string, right: string) =>
    Math.abs(new Date(left).getTime() - new Date(right).getTime()) < gap;

  const startsGroup =
    !args.previous ||
    args.previous.senderId !== args.senderId ||
    !close(args.previous.createdAt, args.createdAt);
  const endsGroup =
    !args.next ||
    args.next.senderId !== args.senderId ||
    !close(args.createdAt, args.next.createdAt);

  return { startsGroup, endsGroup };
}

export function connectSinglePhotoFrame(
  chatWidth: number,
  aspect = 0.8
) {
  const width = Math.max(
    180,
    Math.round(Math.max(chatWidth, 240) * 0.76)
  );
  const safeAspect =
    aspect > 0.35 && aspect < 2.8 ? aspect : 0.8;
  const height = Math.round(
    Math.min(
      Math.max(width / safeAspect, Math.round(width * 0.62)),
      Math.round(Math.max(chatWidth, 240) * 0.95)
    )
  );

  return { width, height };
}

export type ConnectCollageTile = {
  width: number;
  height: number;
};

export function connectCollageTiles(
  count: number,
  collageWidth: number
): ConnectCollageTile[] {
  const gap = 2;
  const visible = Math.min(4, Math.max(2, count));
  const half = Math.floor((collageWidth - gap) / 2);

  if (visible === 2) {
    const height = Math.round(half * 1.25);
    return [
      { width: half, height },
      { width: collageWidth - half - gap, height },
    ];
  }

  if (visible === 3) {
    const topHeight = Math.round(collageWidth * 0.62);
    return [
      { width: collageWidth, height: topHeight },
      { width: half, height: half },
      { width: collageWidth - half - gap, height: half },
    ];
  }

  return [0, 1, 2, 3].map(index => ({
    width: index % 2 === 0 ? half : collageWidth - half - gap,
    height: half,
  }));
}

export function connectSignedUrlNeedsRefresh(
  signedAtMs: number,
  nowMs: number,
  ttlSeconds = CONNECT_SIGNED_URL_TTL_SECONDS,
  leadMs = CONNECT_SIGNED_URL_REFRESH_LEAD_MS
) {
  if (!Number.isFinite(signedAtMs) || signedAtMs <= 0) {
    return true;
  }

  const expiresAt = signedAtMs + ttlSeconds * 1000;
  return nowMs >= expiresAt - leadMs;
}

export type ConnectAlbumUploadPhoto = {
  id: string;
  storagePath?: string | null;
};

export function splitAlbumUpload(photos: ConnectAlbumUploadPhoto[]) {
  const ready = photos.filter(photo => !!photo.storagePath);
  const pending = photos.filter(photo => !photo.storagePath);

  return {
    ready,
    pending,
    readyToInsert:
      photos.length > 0 && pending.length === 0,
  };
}

export type ConnectScopeReader = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  lastReadAt: string;
};

export function readersForMessageWindow(args: {
  messageCreatedAt: string;
  nextMessageCreatedAt: string | null;
  readers: ConnectScopeReader[];
  selfUserId?: string | null;
}) {
  const start = new Date(args.messageCreatedAt).getTime();
  const end = args.nextMessageCreatedAt
    ? new Date(args.nextMessageCreatedAt).getTime()
    : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(start)) {
    return [];
  }

  return args.readers.filter(reader => {
    if (!reader.userId || reader.userId === args.selfUserId) {
      return false;
    }

    const readAt = new Date(reader.lastReadAt).getTime();
    return Number.isFinite(readAt) && readAt >= start && readAt < end;
  });
}

export function visibleReaderAvatars<T>(
  readers: T[],
  max = CONNECT_SEEN_AVATAR_LIMIT
) {
  return {
    shown: readers.slice(0, max),
    extra: Math.max(0, readers.length - max),
  };
}

export function connectPhotoSlots(args: {
  paths: string[];
  urls: Record<string, string | undefined>;
  failed?: Record<string, boolean | undefined>;
}) {
  return args.paths.map(path => {
    const direct = /^(file:|content:|ph:|http:|https:|data:)/i.test(path);
    return {
      key: path,
      uri: args.urls[path] ?? (direct ? path : null),
      failed: !!args.failed?.[path],
    };
  });
}
