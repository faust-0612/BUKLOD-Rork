import React from 'react';
import { VillageBuilderGameV1 } from '@/features/games/elesur/VillageBuilderGameV1';
import { DominoVillageGameV1 } from '@/features/games/elesur/DominoVillageGameV1';
import {
  KingdomInteriorCenter, type KingdomInteriorOption,
} from '@/features/games/kingdom/platform/KingdomInteriorCenter';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'elesur-village-builder';
const OPTIONS: readonly KingdomInteriorOption[] = [
  {
    id: 'elesur-domino-village', title: 'Domino Village',
    descriptionEn: 'Complete three-round draw dominoes vs village AI',
    descriptionTl: 'Tatlong round ng domino laban sa village AI',
    kind: 'pilot', render: finish => <DominoVillageGameV1 onFinish={finish} />,
  },
  {
    id: GAME_ID, title: 'Village Builder',
    descriptionEn: 'Original community-building strategy game',
    descriptionTl: 'Orihinal na laro ng pagbuo ng pamayanan',
    kind: 'existing', render: (_finish, originalFinish) =>
      <VillageBuilderGameV1 onFinish={originalFinish} />,
  },
];

export default function ElesurVillageBuilderScreen() {
  return (
    <BuklodGameStage biome="highlands" gameId={GAME_ID}>
      <KingdomInteriorCenter character="ELESUR"
        subtitleEn="Build the highland village, then gather the community around a game of dominoes."
        subtitleTl="Buuin ang pamayanan at maglaro ng domino laban sa kapwa taga-bundok."
        options={OPTIONS} />
    </BuklodGameStage>
  );
}
