import React from 'react';
import { View } from 'react-native';
import { ForestEnvironment } from '@/features/games/jawo/ForestEnvironment';
import { ForestTrailGameV2 } from '@/features/games/jawo/ForestTrailGameV2';
import { TrailMazeGameV1 } from '@/features/games/jawo/TrailMazeGameV1';
import {
  KingdomInteriorCenter, type KingdomInteriorOption,
} from '@/features/games/kingdom/platform/KingdomInteriorCenter';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'jawo-forest-trail';
const OPTIONS: readonly KingdomInteriorOption[] = [
  {
    id: 'jawo-trail-maze', title: 'Trail Maze',
    descriptionEn: 'Three forest mazes with hidden relics',
    descriptionTl: 'Tatlong maze at nakatagong relikya sa kagubatan',
    kind: 'pilot', render: finish => <TrailMazeGameV1 onFinish={finish} />,
  },
  {
    id: GAME_ID, title: 'Forest Trail',
    descriptionEn: 'Original forest-running challenge',
    descriptionTl: 'Orihinal na hamon sa landas ng kagubatan',
    kind: 'existing', render: (_finish, originalFinish) => (
      <View style={{ minHeight: 680, width: '100%' }}>
        <ForestEnvironment intensity={1} progress={0} />
        <ForestTrailGameV2 onFinish={originalFinish} />
      </View>
    ),
  },
];

export default function JawoForestTrailScreen() {
  return <BuklodGameStage biome="forest" gameId={GAME_ID}>
    <KingdomInteriorCenter character="Jawo"
      subtitleEn="Run through the forest or solve ancient trails."
      subtitleTl="Tumakbo sa gubat o tuklasin ang lihim ng mga landas."
      options={OPTIONS} />
  </BuklodGameStage>;
}
