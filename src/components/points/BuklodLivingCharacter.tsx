import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';

import BuklodCharacterRenderer, {
  type BuklodCharacterRendererRef,
} from '@/components/points/BuklodCharacterRenderer';
import BuklodCharacterStage from '@/components/points/BuklodCharacterStage';
import type { BuklodCharacterState } from '@/lib/buklodCharacter';

export type BuklodLivingCharacterRef = {
  triggerCelebration: () => void;
};

type Props = {
  config: BuklodCharacterState;
  size?: number;
  happy?: boolean;
  celebrating?: boolean;
  onCelebrationComplete?: () => void;
  animateEntrance?: boolean;
  useFullStage?: boolean;
  /** Optional BUKLOD-owned muted looping scene video. */
  backdropVideoUrl?: string | null;
  /** Optional decorative Rive scene layered behind the local character. */
  riveOverlayUrl?: string | null;
  /** 0..1.35; visual-only atmosphere strength. */
  liveMotionIntensity?: number;
};

/**
 * Living Character entry — local stylized figure driven by catalog unlocks.
 * Live video/Rive layers are presentation-only and never become progression state.
 */
const BuklodLivingCharacter = forwardRef<
  BuklodLivingCharacterRef,
  Props
>(function BuklodLivingCharacter(
  {
    config,
    size = 172,
    happy = false,
    celebrating = false,
    onCelebrationComplete,
    animateEntrance = true,
    useFullStage = false,
    backdropVideoUrl = null,
    riveOverlayUrl = null,
    liveMotionIntensity = 1,
  },
  ref
) {
  const rendererRef = useRef<BuklodCharacterRendererRef>(null);

  useImperativeHandle(ref, () => ({
    triggerCelebration: () => {
      rendererRef.current?.triggerCelebration();
    },
  }));

  if (useFullStage) {
    return (
      <BuklodCharacterStage
        characterRef={rendererRef}
        body={config.body}
        equipment={config.equipment}
        reactionId={happy ? 'happy' : 'neutral'}
        celebrating={celebrating}
        onCelebrationComplete={onCelebrationComplete}
        compact
        showStageLabel={false}
        backdropVideoUrl={backdropVideoUrl}
        riveOverlayUrl={riveOverlayUrl}
        liveMotionIntensity={liveMotionIntensity}
      />
    );
  }

  return (
    <BuklodCharacterRenderer
      ref={rendererRef}
      body={config.body}
      equipment={config.equipment}
      width={size}
      reactionId={happy ? 'happy' : 'neutral'}
      entrance={animateEntrance}
      alive
    />
  );
});

export default BuklodLivingCharacter;
