import React from 'react';
import { EvidenceGameV1 } from '@/features/games/kingdom/platform/EvidenceGameV1';
import { CodeBreakerGameV1 } from '@/features/games/quin/CodeBreakerGameV1';
import { DiscoveryExpeditionGameV1 } from '@/features/games/quin/DiscoveryExpeditionGameV1';
import {
  KingdomInteriorCenter, type KingdomInteriorOption,
} from '@/features/games/kingdom/platform/KingdomInteriorCenter';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID = 'quin-discovery-expedition';
const OPTIONS: readonly KingdomInteriorOption[] = [
  {
    id: 'quin-guessing-quest', title: 'Guessing Quest',
    descriptionEn: 'Nine evidence-based discovery mysteries',
    descriptionTl: 'Siyam na misteryo at clues sa pagtuklas',
    kind: 'pilot', render: finish => <EvidenceGameV1 gameId="quin-guessing-quest" onFinish={finish} />,
  },

  {
    id: 'quin-code-breaker', title: 'Code Breaker',
    descriptionEn: 'Three deduction chambers with clues',
    descriptionTl: 'Tatlong misteryosong silid at clues',
    kind: 'pilot', render: (finish) => <CodeBreakerGameV1 onFinish={finish} />,
  },
  {
    id: GAME_ID, title: 'Discovery Expedition',
    descriptionEn: 'Original exploration and hidden relic quest',
    descriptionTl: 'Orihinal na ekspedisyon at paghahanap ng relikya',
    kind: 'existing', render: (_finish, originalFinish) =>
      <DiscoveryExpeditionGameV1 onFinish={originalFinish} />,
  },
];

export default function QuinDiscoveryExpeditionScreen() {
  return (
    <BuklodGameStage biome="discovery" gameId={GAME_ID}>
      <KingdomInteriorCenter character="Quin"
        subtitleEn="Explore the world or decode the secret symbols hidden behind its relic chambers."
        subtitleTl="Galugarin ang mundo o tuklasin ang mga lihim na code sa mga silid ng relikya."
        options={OPTIONS} />
    </BuklodGameStage>
  );
}
