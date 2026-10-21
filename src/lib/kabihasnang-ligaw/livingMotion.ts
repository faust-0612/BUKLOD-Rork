import type { LivingLayerKind } from '@/lib/kabihasnang-ligaw/types';

export type LivingDecision = {
  animate: boolean;
  staticFallback: boolean;
  depictsStory: boolean;
  layers: LivingLayerKind[];
  reason:
    | 'paused'
    | 'reduced'
    | 'manuscript_unbound'
    | 'pending_owner'
    | 'provisional_fixture'
    | 'approved_scene';
};

export function resolveLivingMotion(input: {
  boundToManuscriptParagraph: boolean;
  manuscriptApprovedComplete: boolean;
  ownerApproved: boolean;
  depictsStory: boolean;
  technicalFixture: boolean;
  allowUnapprovedPreview: boolean;
  visible: boolean;
  appActive: boolean;
  reduceMotion: boolean;
  userMotionEnabled: boolean;
  batterySaver: boolean;
  lowBandwidth: boolean;
  layers?: LivingLayerKind[];
}): LivingDecision {
  const layers = input.layers ?? [];
  if (!input.visible || !input.appActive) {
    return { animate: false, staticFallback: true, depictsStory: input.depictsStory, layers, reason: 'paused' };
  }
  if (input.reduceMotion || !input.userMotionEnabled || input.batterySaver || input.lowBandwidth) {
    return { animate: false, staticFallback: true, depictsStory: input.depictsStory, layers, reason: 'reduced' };
  }
  if (!input.boundToManuscriptParagraph || !input.manuscriptApprovedComplete) {
    if (input.allowUnapprovedPreview && input.technicalFixture && !input.depictsStory) {
      return {
        animate: true,
        staticFallback: false,
        depictsStory: false,
        layers: ['rain'],
        reason: 'provisional_fixture',
      };
    }
    return {
      animate: false,
      staticFallback: true,
      depictsStory: false,
      layers: [],
      reason: 'manuscript_unbound',
    };
  }
  if (!input.ownerApproved) {
    return {
      animate: false,
      staticFallback: true,
      depictsStory: input.depictsStory,
      layers: [],
      reason: 'pending_owner',
    };
  }
  return {
    animate: true,
    staticFallback: false,
    depictsStory: true,
    layers,
    reason: 'approved_scene',
  };
}

export function isLowBandwidth(input: {
  online: boolean;
  connectionType: string;
  cellularGeneration?: string | null;
  userDataSaver: boolean;
}): boolean {
  if (input.userDataSaver || !input.online) return true;
  const generation = (input.cellularGeneration ?? '').toLowerCase();
  return generation === '2g' || generation === '3g';
}
