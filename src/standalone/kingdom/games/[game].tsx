import { Redirect, useLocalSearchParams } from 'expo-router';

import AceRescueGrid from '@/app/games/ace-rescue-grid';
import AngelKingdomTreasury from '@/app/games/angel-kingdom-treasury';
import ChristianCivicLeadership from '@/app/games/christian-civic-leadership';
import ElesurVillageBuilder from '@/app/games/elesur-village-builder';
import JawoForestTrail from '@/app/games/jawo-forest-trail';
import LhenRhythmJourney from '@/app/games/lhen-rhythm-journey';
import MitchRestoreMural from '@/app/games/mitch-restore-mural';
import NielMissionTrail from '@/app/games/niel-mission-trail';
import PhanEnterpriseBuilder from '@/app/games/phan-enterprise-builder';
import QuinDiscoveryExpedition from '@/app/games/quin-discovery-expedition';
import TrudicePlaygroundMemory from '@/app/games/trudice-playground-memory';
import VanLivingCityDispatch from '@/app/games/van-living-city-dispatch';
import VhenFarmToMarket from '@/app/games/vhen-farm-to-market';

const GAMES = {
  'ace-rescue-grid': AceRescueGrid,
  'angel-kingdom-treasury': AngelKingdomTreasury,
  'christian-civic-leadership': ChristianCivicLeadership,
  'elesur-village-builder': ElesurVillageBuilder,
  'jawo-forest-trail': JawoForestTrail,
  'lhen-rhythm-journey': LhenRhythmJourney,
  'mitch-restore-mural': MitchRestoreMural,
  'niel-mission-trail': NielMissionTrail,
  'phan-enterprise-builder': PhanEnterpriseBuilder,
  'quin-discovery-expedition': QuinDiscoveryExpedition,
  'trudice-playground-memory': TrudicePlaygroundMemory,
  'van-living-city-dispatch': VanLivingCityDispatch,
  'vhen-farm-to-market': VhenFarmToMarket,
} as const;

export default function KingdomGameRoute() {
  const params = useLocalSearchParams<{ game?: string | string[] }>();
  const raw = Array.isArray(params.game) ? params.game[0] : params.game;
  const Game = raw ? GAMES[raw as keyof typeof GAMES] : undefined;

  if (!Game) {
    return <Redirect href="/" />;
  }

  return <Game />;
}
