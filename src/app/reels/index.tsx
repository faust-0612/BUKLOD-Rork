import { Redirect } from 'expo-router';

/**
 * Legacy compatibility route.
 * BUKLOD Reels has been replaced by BUKLOD IGPAT.
 * Keep /reels working for old deep links without shipping a second video system.
 */
export default function LegacyReelsRedirect() {
  return <Redirect href="/igpat" />;
}
