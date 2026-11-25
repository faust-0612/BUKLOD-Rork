import { Redirect, Slot, usePathname } from 'expo-router';
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';
import { isGenesisKingdomRoute } from '@/lib/buklodKingdomRoutePolicy';

/** Genesis MAIN restores only the Kingdom routes; Arena stays retired. */
export default function KingdomGamesLayout() {
  const pathname = usePathname();
  if (isGenesisPreviewBuild() && !isGenesisKingdomRoute(pathname)) return <Redirect href="/(tabs)/hub" />;
  return <Slot />;
}
