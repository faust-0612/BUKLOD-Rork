import React from 'react';
import { TradeMasterGameV1 } from '@/features/games/phan/TradeMasterGameV1';
import { EnterpriseBuilderGameV1 } from '@/features/games/phan/EnterpriseBuilderGameV1';
import { MatchThreeGameV1 } from '@/features/games/kingdom/platform/MatchThreeGameV1';
import {
  KingdomInteriorCenter, type KingdomInteriorOption,
} from '@/features/games/kingdom/platform/KingdomInteriorCenter';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'phan-enterprise-builder';
const OPTIONS: readonly KingdomInteriorOption[] = [
  { id: 'phan-trade-master', title: 'Trade Master',
    descriptionEn: 'Buy, sell and fulfill contracts across three market seasons',
    descriptionTl: 'Bumili, magbenta at tumupad sa kontrata sa tatlong season',
    kind: 'pilot', render: finish => <TradeMasterGameV1 onFinish={finish} /> },
  {
    id: 'phan-market-match', title: 'Market Match',
    descriptionEn: 'Fulfill customer orders in three match-three market days',
    descriptionTl: 'Kumpletuhin ang mga order sa tatlong araw sa palengke',
    kind: 'pilot', render: finish =>
      <MatchThreeGameV1 gameId="phan-market-match" onFinish={finish} />,
  },
  {
    id: GAME_ID, title: 'Enterprise Builder',
    descriptionEn: 'Original sustainable enterprise strategy game',
    descriptionTl: 'Orihinal na laro sa pagtatayo ng maunlad na negosyo',
    kind: 'existing', render: (_finish, originalFinish) =>
      <EnterpriseBuilderGameV1 onFinish={originalFinish} />,
  },
];
export default function PhanEnterpriseBuilderScreen() {
  return <BuklodGameStage biome="farm" gameId={GAME_ID}>
    <KingdomInteriorCenter character="Phan"
      subtitleEn="Build a thriving enterprise or deliver market orders."
      subtitleTl="Bumuo ng matagumpay na negosyo o magdala ng mga order sa palengke."
      options={OPTIONS} />
  </BuklodGameStage>;
}
