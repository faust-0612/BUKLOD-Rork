import React, { useEffect, useRef, useState } from 'react';

import BuklodCharacterDevPanel from '@/components/points/BuklodCharacterDevPanel';
import BuklodCharacterDialogue from '@/components/points/BuklodCharacterDialogue';
import BuklodCharacterStage from '@/components/points/BuklodCharacterStage';
import type { BuklodCharacterRendererRef } from '@/components/points/BuklodCharacterRenderer';
import { useBuklodCharacterEventsOptional } from '@/components/character/BuklodCharacterEventProvider';
import { useScreenFocused } from '@/hooks/useScreenFocused';
import { type BuklodCharacterState } from '@/lib/buklodCharacter';
import { type CharacterPoseState } from '@/lib/buklodCharacterEvents';

type Props = {
  character: BuklodCharacterState;
  claimableCount?: number;
  onCelebrationComplete?: () => void;
};

/**
 * Stage wiring only. Auto greeting/wave is disabled until the male
 * head/neck and joint proofs pass physical review.
 */
export default function BuklodCharacterEventController({
  character,
  claimableCount = 0,
  onCelebrationComplete,
}: Props) {
  const focused = useScreenFocused();
  const events = useBuklodCharacterEventsOptional();
  const characterRef = useRef<BuklodCharacterRendererRef>(null);
  const [debugSkeleton, setDebugSkeleton] = useState(false);

  const presentation = events?.presentation;
  const reactionId = presentation?.reactionId ?? 'neutral';
  const reactionKey = presentation?.reactionKey ?? 0;
  const pose: CharacterPoseState = presentation?.pose ?? 'IDLE';
  const celebrating = presentation?.celebrating ?? false;
  const talking = presentation?.talking ?? false;
  const pointPresent =
    presentation?.pointPresent ?? claimableCount > 0;

  useEffect(() => {
    events?.setPointPresent(claimableCount > 0);
  }, [claimableCount, events]);

  return (
    <>
      <BuklodCharacterStage
        characterRef={characterRef}
        body={character.body}
        equipment={character.equipment}
        reactionId={reactionId}
        reactionKey={reactionKey}
        pose={pose}
        celebrating={celebrating}
        onCelebrationComplete={onCelebrationComplete}
        visible={focused}
        pointPresent={pointPresent && reactionId === 'neutral'}
        entranceActive={false}
        reactionsMode={events?.reactionsMode ?? 'full'}
        talking={talking}
        debugSkeleton={debugSkeleton}
      />

      <BuklodCharacterDialogue
        text={presentation?.dialogue ?? null}
        onDismiss={events?.dismissDialogue}
        autoDismissMs={3600}
      />

      {__DEV__ ? (
        <BuklodCharacterDevPanel
          skeletonOn={debugSkeleton}
          onToggleSkeleton={() => setDebugSkeleton((v) => !v)}
        />
      ) : null}
    </>
  );
}
