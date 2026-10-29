/**
 * Background photo fetching must not compete with already-visible Android
 * photo tiles on weak connections. Visible images handle their own secured
 * signing, disk caching and bounded error state.
 */
export function allowBackgroundCommunityPhotoPrefetch(
  platform: string,
  quality: 'normal' | 'degraded' | 'offline',
): boolean {
  // Android prioritizes visible photos. Avoid signing and downloading a
  // potentially redundant set of offscreen photos before first paint.
  if (platform === 'android') return false;
  // Offline must not attempt to sign URLs on any platform.
  return quality !== 'offline';
}
