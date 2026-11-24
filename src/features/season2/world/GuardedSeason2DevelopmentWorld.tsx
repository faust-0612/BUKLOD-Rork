import { Redirect } from 'expo-router';

/** Retired MAIN estate entry. Never mount the workshop or native world launcher.
 * Keep the old prop contract for callers. No estate records are deleted or changed.
 */
export default function GuardedSeason2DevelopmentWorld(_props: { world: 'home' | 'village' }) {
  return <Redirect href="/(tabs)/hub" />;
}
