import { Redirect } from 'expo-router';

/** Compatibility: former IGPAT post deep links are now a retired product surface. */
export default function RetiredIgpatPostRoute() {
  return <Redirect href="/buklod" />;
}
