import React from 'react';

import CharacterRigView from '@/components/character-rig/CharacterRigView';
import type {
  CharacterPoseState,
  CharacterReactionsMode,
} from '@/lib/buklodCharacterEvents';
import type { BodyId, Equipment } from '@/lib/character-lab-core/types';

type Props = {
  body: BodyId;
  equipment: Equipment;
  poseState?: CharacterPoseState;
  reactionKey?: number;
  talking?: boolean;
  alive?: boolean;
  reactionsMode?: CharacterReactionsMode;
  bustCrop?: boolean;
  debugSkeleton?: boolean;
};

/**
 * Legacy SVG rig entry — bypassed in Points while approved Rork PNGs are active.
 * Do not use for production rendering; see BuklodCharacterRenderer.
 */
export default function BuklodCharacterSvgRig({
  poseState,
  reactionKey,
  talking,
  alive,
  reactionsMode,
  bustCrop,
  debugSkeleton,
}: Props) {
  return (
    <CharacterRigView
      poseState={poseState}
      reactionKey={reactionKey}
      talking={talking}
      alive={alive}
      reactionsMode={reactionsMode}
      bustCrop={bustCrop}
      debugSkeleton={debugSkeleton}
    />
  );
}
