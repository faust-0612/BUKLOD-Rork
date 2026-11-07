import React from 'react';
import { FarmToMarketGameV1 } from '@/features/games/vhen/FarmToMarketGameV1';
import { MatchThreeGameV1 } from '@/features/games/kingdom/platform/MatchThreeGameV1';
import {
  KingdomInteriorCenter, type KingdomInteriorOption,
} from '@/features/games/kingdom/platform/KingdomInteriorCenter';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'vhen-farm-to-market';
const OPTIONS: readonly KingdomInteriorOption[] = [
  {
    id: 'vhen-harvest-match', title: 'Harvest Match',
    descriptionEn: 'Harvest crops and deliver market produce orders',
    descriptionTl: 'Mag-ani at ihatid ang mga order ng pananim',
    kind: 'pilot', render: finish =>
      <MatchThreeGameV1 gameId="vhen-harvest-match" onFinish={finish} />,
  },
  {
    id: GAME_ID, title: 'Farm to Market',
    descriptionEn: 'Original crop-planning strategy game',
    descriptionTl: 'Orihinal na laro sa pagplano ng taniman at palengke',
    kind: 'existing', render: (_finish, originalFinish) =>
      <FarmToMarketGameV1 onFinish={originalFinish} />,
  },
];
export default function VhenFarmToMarketScreen() {
  return <BuklodGameStage biome="agriculture" gameId={GAME_ID}>
    <KingdomInteriorCenter character="Vhen"
      subtitleEn="Plan a sustainable farm or fulfill harvest matches."
      subtitleTl="Planuhin ang bukirin at kumpletuhin ang mga ani."
      options={OPTIONS} />
  </BuklodGameStage>;
}
