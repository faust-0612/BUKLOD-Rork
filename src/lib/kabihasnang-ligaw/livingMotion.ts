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
    | 'forbidden_layer'
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
        layers: ['lighting'],
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
  const allowed = input.depictsStory ? layers.filter((layer) => layer !== 'rain') : layers;
  if (input.depictsStory && allowed.length === 0) {
    return {
      animate: false,
      staticFallback: true,
      depictsStory: true,
      layers: [],
      reason: 'forbidden_layer',
    };
  }
  return {
    animate: true,
    staticFallback: false,
    depictsStory: true,
    layers: allowed,
    reason: 'approved_scene',
  };
}

export function visibleLivingLayers(input: {
  layers: readonly {
    layer: LivingLayerKind;
    activation: string;
    paragraphRange: { start: number; end: number } | null;
  }[];
  viewStart: number | null;
  viewEnd: number | null;
  revealParagraph: number | null;
}): LivingLayerKind[] {
  if (input.viewStart == null || input.viewEnd == null) return [];
  const visible: LivingLayerKind[] = [];
  for (const layer of input.layers) {
    if (layer.layer === 'rain' || layer.activation === 'FORBIDDEN_NOT_IN_CHAPTER_TEXT') continue;
    if (layer.activation === 'BLOCKED_ANCHOR_MISMATCH' || layer.paragraphRange == null) continue;
    if (
      layer.activation === 'CLOSING_REVEAL_ONLY' &&
      (input.revealParagraph == null || input.viewEnd < input.revealParagraph)
    ) {
      continue;
    }
    if (layer.paragraphRange.end < input.viewStart || layer.paragraphRange.start > input.viewEnd) continue;
    visible.push(layer.layer);
  }
  return visible;
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
