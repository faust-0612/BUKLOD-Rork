import { Redirect } from 'expo-router';

/**
 * Compatibility alias for old web BUKLOD City links.
 * The city/map navigation now lives directly in front of Community Wall.
 */
export default function BuklodCityWebRedirect() {
  return <Redirect href="/(tabs)/buklod" />;
}
