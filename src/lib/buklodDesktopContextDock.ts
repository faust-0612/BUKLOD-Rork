/**
 * BUKLOD_DESKTOP_CONTEXT_DOCK_R1
 *
 * A mounted desktop workspace receives contextual detail requests without
 * replacing its active Home/Wall/Connect route. No second chat service or
 * copied message state; clients reuse BuklodConnectThread.
 *
 * The registration is ephemeral and exists only while the desktop shell is
 * mounted. On Android/phone web the caller falls back to normal Expo routing.
 */
export type BuklodDesktopDockRequest =
  | {
      kind: 'direct';
      threadId: string;
      otherUserName?: string;
      otherUserId?: string;
      targetUserId?: string;
    }
  | {
      kind: 'community';
      scopeId: string;
      scopeName?: string;
      scopeType?: string;
    }
  | {
      kind: 'profile';
      userId: string;
      displayName?: string;
    };

type DockOpener = (request: BuklodDesktopDockRequest) => void;
let activeDesktopOpener: DockOpener | null = null;

export function registerBuklodDesktopDockOpener(open: DockOpener): () => void {
  activeDesktopOpener = open;
  return () => {
    if (activeDesktopOpener === open) activeDesktopOpener = null;
  };
}

/** Return false when no eligible desktop shell is mounted, so normal routing
 * remains intact for native, phone web, and direct deep-links. */
export function tryOpenBuklodDesktopDock(request: BuklodDesktopDockRequest): boolean {
  if (!activeDesktopOpener) return false;
  if (request.kind === 'direct' && !request.threadId.trim()) return false;
  if (request.kind === 'community' && !request.scopeId.trim()) return false;
  if (request.kind === 'profile' && !request.userId.trim()) return false;
  activeDesktopOpener(request);
  return true;
}
