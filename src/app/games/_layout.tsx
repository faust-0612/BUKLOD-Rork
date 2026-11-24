import { Redirect } from 'expo-router';

/** MAIN only: all legacy Kingdom/Arena routes are retired. Empire is a separate app. */
export default function RetiredGamesLayout() {
  return <Redirect href="/(tabs)/hub" />;
}
