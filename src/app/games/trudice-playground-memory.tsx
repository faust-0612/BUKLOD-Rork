import React from 'react';
import { WordTrailGameV1 } from '@/features/games/kingdom/platform/WordTrailGameV1';
import { PlaygroundPathGameV2 } from '@/features/games/trudice/PlaygroundPathGameV2';
import { PicturePairsGameV1 } from '@/features/games/trudice/PicturePairsGameV1';
import {
  KingdomInteriorCenter, type KingdomInteriorOption,
} from '@/features/games/kingdom/platform/KingdomInteriorCenter';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'trudice-playground-memory';
const OPTIONS: readonly KingdomInteriorOption[] = [
  {
    id: 'trudice-word-garden', title: 'Word Garden',
    descriptionEn: 'Connect letters to bloom new word paths',
    descriptionTl: 'Pagdugtungin ang mga letra para sa mga bagong salita',
    kind: 'pilot', render: finish => <WordTrailGameV1 gameId="trudice-word-garden" onFinish={finish} />,
  },
  {
    id: 'trudice-picture-pairs', title: 'Picture Pairs',
    descriptionEn: 'Find matching pictures across three gardens',
    descriptionTl: 'Hanapin ang magkapares na larawan sa tatlong garden',
    kind: 'pilot', render: finish => <PicturePairsGameV1 onFinish={finish} />,
  },
  {
    id: GAME_ID, title: 'Wonder Path',
    descriptionEn: 'Five-stage playable playground adventure with changing puzzles', 
    descriptionTl: 'Limang hamon sa playground na may iba-ibang puzzle',
    kind: 'existing', render: (_finish, originalFinish) => (
      <PlaygroundPathGameV2 onFinish={originalFinish} />
    ),
  },
];

export default function TrudicePlaygroundMemoryScreen() {
  return <BuklodGameStage biome="playground" gameId={GAME_ID}>
    <KingdomInteriorCenter character="Trudice"
      subtitleEn="Restore the Wonder Path, play Picture Pairs, or explore Word Garden."
      subtitleTl="Ibalik ang Wonder Path, maglaro ng Picture Pairs, o tuklasin ang Word Garden."
      options={OPTIONS} />
  </BuklodGameStage>;
}
