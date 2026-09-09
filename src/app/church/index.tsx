import { Redirect } from 'expo-router';

/**
 * Legacy compatibility route.
 * The former Church Life workspace was superseded by the current
 * church discovery/membership flow under /churches and the canonical
 * Organization / Sub-organization / Cluster workspace model.
 */
export default function LegacyChurchRedirect() {
  return <Redirect href="/churches" />;
}
