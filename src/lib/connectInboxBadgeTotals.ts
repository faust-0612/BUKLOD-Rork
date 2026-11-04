/**
 * Conversation badges follow the authenticated room RPC's unread_count.
 * No online/presence indicator is inferred from a room existing.
 */
export type ConnectRoomUnread = {
  scope_type: string | null;
  unread_count: number | null;
};

export function communityUnreadTabCounts(
  rooms: readonly ConnectRoomUnread[],
): { cluster: number; org: number } {
  let cluster = 0;
  let org = 0;
  for (const room of rooms) {
    const raw = Number(room.unread_count ?? 0);
    const count = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    if (!count) continue;
    switch (String(room.scope_type ?? '').toUpperCase()) {
      case 'CLUSTER': cluster += count; break;
      case 'ORGANIZATION': org += count; break; // includes suborganizations
    }
  }
  return { cluster, org };
}
