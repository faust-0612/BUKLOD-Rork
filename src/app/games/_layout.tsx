import { Redirect, Slot } from 'expo-router';
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';

/** Retire games in Genesis MAIN without altering the current Season 1 production experience. */
export default function RetiredGamesLayout() {
  if (isGenesisPreviewBuild()) return <Redirect href="/(tabs)/hub" />;
  return <Slot />;
}
