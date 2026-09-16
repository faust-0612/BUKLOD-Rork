import { Redirect } from 'expo-router';

/**
 * Compatibility alias for old BUKLOD City links.
 * The city/map navigation now lives directly in front of Community Wall.
 */
export default function BuklodCityRedirect() {
  return <Redirect href="/(tabs)/buklod" />;
}
