import { Redirect } from 'expo-router';

/** Compatibility for saved village/estate map links. */
export default function CommunityVillageScreen() {
  return <Redirect href="/(tabs)/hub" />;
}
