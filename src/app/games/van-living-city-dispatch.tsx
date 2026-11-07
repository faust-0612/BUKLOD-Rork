import React from 'react';
import { EvidenceGameV1 } from '@/features/games/kingdom/platform/EvidenceGameV1';
import { SudokuMasterGameV1 } from '@/features/games/van/SudokuMasterGameV1';
import { LivingCityDispatchGameV1 } from '@/features/games/van/LivingCityDispatchGameV1';
import {
  KingdomInteriorCenter, type KingdomInteriorOption,
} from '@/features/games/kingdom/platform/KingdomInteriorCenter';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'van-living-city-dispatch';
const OPTIONS: readonly KingdomInteriorOption[] = [
  {
    id: 'van-mind-challenge', title: 'Mind Challenge',
    descriptionEn: 'Nine logic, sequence and spatial challenges',
    descriptionTl: 'Siyam na hamon sa logic, sequence at espasyo',
    kind: 'pilot', render: finish => <EvidenceGameV1 gameId="van-mind-challenge" onFinish={finish} />,
  },

  {
    id: 'van-sudoku-master', title: 'Sudoku Master',
    descriptionEn: 'Three uniquely solvable number puzzles',
    descriptionTl: 'Tatlong puzzle na may iisang solusyon',
    kind: 'pilot', render: (finish) => <SudokuMasterGameV1 onFinish={finish} />,
  },
  {
    id: GAME_ID, title: 'City Dispatch',
    descriptionEn: 'Original city service strategy game',
    descriptionTl: 'Orihinal na laro sa pag-aayos ng lungsod',
    kind: 'existing', render: (_finish, originalFinish) =>
      <LivingCityDispatchGameV1 onFinish={originalFinish} />,
  },
];

export default function VanLivingCityDispatchScreen() {
  return (
    <BuklodGameStage biome="city" gameId={GAME_ID}>
      <KingdomInteriorCenter character="Van"
        subtitleEn="The Living City and Mind City share Van's strategy and logical planning."
        subtitleTl="Mula lungsod hanggang logic puzzle, parehong ginagamit ang talino at pagplano ni Van."
        options={OPTIONS} />
    </BuklodGameStage>
  );
}
