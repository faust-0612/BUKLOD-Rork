import {
  router,
} from 'expo-router';
import {
  tryOpenBuklodDesktopDock,
  type BuklodDesktopDockRequest,
} from '@/lib/buklodDesktopContextDock';

type RouterHref =
  Parameters<typeof router.replace>[0];

function readRouteValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }
  return '';
}

function decodeSegment(value: string): string {
  try { return decodeURIComponent(value); }
  catch { return value; }
}

/** Only opt eligible *secondary* destinations into desktop contextual viewing.
 * Immersive media, auth, scope changes, primary tabs and full-screen actions
 * are intentionally never intercepted.
 */
export function resolveBuklodContextualHref(href: RouterHref): BuklodDesktopDockRequest | null {
  const routeObject = typeof href === 'object' && href !== null
    ? href as { pathname?: unknown; params?: Record<string, unknown> }
    : null;
  const pathname = typeof href === 'string'
    ? href.split(/[?#]/)[0]
    : readRouteValue(routeObject?.pathname);
  const params = routeObject?.params ?? {};
  const name = readRouteValue(params.otherUserName) || readRouteValue(params.name);
  if (pathname === '/connect/personal/[threadId]') {
    const threadId = readRouteValue(params.threadId);
    return threadId ? {
      kind: 'direct', threadId,
      targetUserId: readRouteValue(params.targetUserId) || undefined,
      otherUserId: readRouteValue(params.otherUserId) || undefined,
      otherUserName: name || undefined,
    } : null;
  }
  const match = pathname.match(/^\/connect\/personal\/([^/]+)$/);
  if (match) {
    return {
      kind: 'direct',
      threadId: decodeSegment(match[1]),
      targetUserId: readRouteValue(params.targetUserId) || undefined,
      otherUserName: name || undefined,
    };
  }
  if (pathname === '/connect/community/[scopeId]') {
    const scopeId = readRouteValue(params.scopeId);
    return scopeId ? {
      kind: 'community', scopeId,
      scopeName: readRouteValue(params.scopeName) || undefined,
      scopeType: readRouteValue(params.scopeType) || undefined,
    } : null;
  }
  if (pathname === '/member/[id]' || pathname.startsWith('/member/')) {
    const id = pathname === '/member/[id]'
      ? readRouteValue(params.id)
      : decodeSegment(pathname.substring('/member/'.length));
    return id && id !== '[id]' ? {
      kind: 'profile', userId: id, displayName: name || undefined,
    } : null;
  }
  return null;
}

/** Instant stack swap — primary navigation always changes the selected route. */
export function buklodInstantReplace(href: RouterHref) {
  router.replace(href as any);
}

/** Contextual destinations stay within the desktop shell when one is mounted.
 * Mobile/native and explicit full-screen actions retain canonical Expo routing. */
export function buklodInstantPush(href: RouterHref) {
  const detail = resolveBuklodContextualHref(href);
  if (detail && tryOpenBuklodDesktopDock(detail)) return;
  router.push(href as any);
}
