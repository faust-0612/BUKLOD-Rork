import {
  router,
} from 'expo-router';

type RouterHref =
  Parameters<typeof router.replace>[0];

/** Instant stack swap — same path as bottom nav / Notif → Community. */
export function buklodInstantReplace(
  href: RouterHref
) {
  router.replace(href as any);
}

/** Instant stack push (animation handled by root Stack screenOptions). */
export function buklodInstantPush(
  href: RouterHref
) {
  router.push(href as any);
}
