import { Redirect } from 'expo-router';

/** BUKLOD V25: IGPAT feed temporarily paused at owner request. No data deleted. */
export default function BuklodIgpatFeedPaused() {
  return <Redirect href={'/buklod' as any} />;
}
