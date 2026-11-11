import { Redirect } from 'expo-router';

/**
 * Legacy compatibility route.
 * BUKLOD Reels and IGPAT are retired; preserve old links without opening a video feature.
 * Send legacy /reels deep links to the Community Wall.
 */
export default function LegacyReelsRedirect() {
  return <Redirect href="/buklod" />;
}
