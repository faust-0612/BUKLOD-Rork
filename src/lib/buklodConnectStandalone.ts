/**
 * Connect's native build target. Neither navigation nor a user preference may
 * enable standalone mode in the normal BUKLOD binary.
 */
export const isBuklodConnectStandalone =
  process.env.EXPO_PUBLIC_BUKLOD_APP_TARGET === 'connect';

export const BUKLOD_CONNECT_ROUTE = '/connect' as const;
export const BUKLOD_PTT_ROUTE = '/personal-home/ptt' as const;

export function isBuklodConnectAllowedPath(pathname: string): boolean {
  const path = String(pathname || '/');
  return path === '/' ||
    /^\/connect(\/|$)/.test(path) ||
    /^\/personal-home\/ptt\/?$/.test(path) ||
    /^\/(login|register|forgot-password|onboarding|privacy|account|system|help|support|notifications|moderation|delete-account|settings)(\/|$)/.test(path) ||
    /^\/\(auth\)(\/|$)/.test(path);
}

export function isBuklodConnectPublicPath(pathname: string): boolean {
  const path = String(pathname || '/');
  return /^\/(login|register|forgot-password|privacy|help|support|delete-account)(\/|$)/.test(path)
    || /^\/\(auth\)(\/|$)/.test(path);
}
