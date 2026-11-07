/**
 * TypeScript / non-native fallback. Metro prefers .native on Android/iOS and
 * .web on the web. No platform notification import is required in the shared
 * emergency host.
 */
export default function BuklodEmergencyPushBridge() {
  return null;
}
