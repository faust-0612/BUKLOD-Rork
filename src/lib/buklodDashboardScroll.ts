/** Shared dashboard scroll state; transitions only after hysteresis thresholds. */
export type BuklodDashboardRoute = 'wall' | 'home' | 'connect' | 'profile' | 'scope';
type Listener = (route: BuklodDashboardRoute, compact: boolean) => void;
const compactByRoute: Partial<Record<BuklodDashboardRoute, boolean>> = {};
const listeners = new Set<Listener>();
export function buklodDashboardRoute(pathname: string): BuklodDashboardRoute {
  if (pathname === '/buklod' || pathname.startsWith('/buklod/')) return 'wall';
  if (pathname === '/messages' || pathname.startsWith('/messages/')) return 'connect';
  if (pathname === '/me' || pathname.startsWith('/me/') || pathname === '/profile' || pathname.startsWith('/profile/')) return 'profile';
  if (pathname === '/scope' || pathname.startsWith('/scope/')) return 'scope';
  return 'home';
}
export function isBuklodDashboardScrollCompact(route: BuklodDashboardRoute): boolean {
  return Boolean(compactByRoute[route]);
}
export function reportBuklodDashboardScroll(route: BuklodDashboardRoute, offset: number): void {
  if (!Number.isFinite(offset)) return;
  const current = Boolean(compactByRoute[route]);
  const next = current ? offset > 38 : offset > 112;
  if (current === next) return;
  compactByRoute[route] = next;
  listeners.forEach(listener => listener(route, next));
}
export function subscribeBuklodDashboardScroll(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Section switches open at the top; never inherit the previous section's compact header. */
export function resetBuklodDashboardScroll(route: BuklodDashboardRoute): void {
  if (!compactByRoute[route]) return;
  compactByRoute[route] = false;
  listeners.forEach(listener => listener(route, false));
}
