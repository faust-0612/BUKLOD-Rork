import React from 'react';
import { KingdomTreasuryGameV1 } from '@/features/games/angel/KingdomTreasuryGameV1';
import { NumberVaultGameV1 } from '@/features/games/angel/NumberVaultGameV1';
import {
  KingdomInteriorCenter, type KingdomInteriorOption,
} from '@/features/games/kingdom/platform/KingdomInteriorCenter';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'angel-kingdom-treasury';
const OPTIONS: readonly KingdomInteriorOption[] = [
  {
    id: 'angel-number-vault', title: 'Number Vault',
    descriptionEn: 'Three mathematical treasure vaults',
    descriptionTl: 'Tatlong vault na may mathematical puzzles',
    kind: 'pilot', render: finish => <NumberVaultGameV1 onFinish={finish} />,
  },
  {
    id: GAME_ID, title: 'Kingdom Treasury',
    descriptionEn: 'Original kingdom finance simulation',
    descriptionTl: 'Orihinal na laro sa yaman at badyet ng kaharian',
    kind: 'existing', render: (_finish, originalFinish) =>
      <KingdomTreasuryGameV1 onFinish={originalFinish} />,
  },
];

export default function AngelKingdomTreasuryScreen() {
  return <BuklodGameStage biome="treasury" gameId={GAME_ID}>
    <KingdomInteriorCenter character="Angel"
      subtitleEn="Balance the kingdom economy and unlock its number vaults."
      subtitleTl="Ingatan ang kabang-yaman at buksan ang mga number vault."
      options={OPTIONS} />
  </BuklodGameStage>;
}
