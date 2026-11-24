import { Redirect } from 'expo-router';

/** Compatibility for saved map links; normal Home retains the existing account gates. */
export default function RetiredEntryMap() {
  return <Redirect href="/(tabs)/hub" />;
}
