/** Kabihasnang Ligaw R5 shared types. Creative rows stay unapproved in this build. */

export const KL_TIME_ZONE = 'Asia/Manila' as const;
export const KL_RELEASE_HOUR = 6 as const;

export const KL_EPISODE_RULE = 'kl_episode_completion' as const;
export const KL_SEASON_RULE = 'kl_season_completion' as const;

export const KL_POINT_DEFAULTS = {
  [KL_EPISODE_RULE]: 2,
  [KL_SEASON_RULE]: 10,
} as const;

export type AssetClass = 'APPROVED' | 'PROVISIONAL' | 'MISSING' | 'REJECTED';

export type ManuscriptStatus =
  | 'content_blocked'
  | 'outline_only'
  | 'approved_complete';

export type EpisodeWorkflowStatus =
  | 'draft'
  | 'needs_revision'
  | 'outline_only'
  | 'approved'
  | 'scheduled'
  | 'live'
  | 'paused';

export type MediaGate = 'missing' | 'provisional' | 'unapproved' | 'clear';

export type StoryKind = 'panimula' | 'episode';

export type LivingLayerKind =
  | 'rain'
  | 'fog'
  | 'wind_foliage'
  | 'fireflies'
  | 'water_ripples'
  | 'lighting'
  | 'magical_glow';

export type PointRule = {
  activityType: string;
  basePoints: number;
  maxPointsPerEvent: number;
  isActive: boolean;
};

export type AssetRow = {
  id: string;
  kind: 'illustration' | 'music' | 'ambient' | 'font' | 'layout' | 'document';
  episodeId: string | null;
  sceneId: string | null;
  path: string | null;
  classification: AssetClass;
  required: boolean;
  approved: boolean;
  reason: string;
};

export type StoryboardRow = {
  episodeId: string;
  sceneId: string;
  episodeNumber: number;
  paragraphRange: null;
  paragraphRangeStatus: 'BLOCKED_NO_APPROVED_MANUSCRIPT' | 'OUTLINE_ONLY';
  editorialIntent: string | null;
  status: string;
  artworkStatus: 'NO_ARTWORK';
  approvalStatus: 'pending';
  approved: false;
  required: true;
  livingLayers: [];
};

export type LivingScopeRow = {
  episodeId: string;
  layer: LivingLayerKind;
  activation: 'BLOCKED_UNTIL_WORD_FOR_WORD_MANUSCRIPT';
  paragraphRange: null;
  approved: false;
  note: string;
};

export type CatalogEpisode = {
  id: string;
  seasonId: string;
  kind: StoryKind;
  episodeNumber: number;
  title: string;
  titleMode: 'canon_title' | 'outline_label';
  status: EpisodeWorkflowStatus;
  manuscriptStatus: ManuscriptStatus;
  prose: string | null;
  proseComplete: boolean;
  mediaGate: MediaGate;
  approvedAt: string | null;
  approvedBy: string | null;
  releaseAt: string;
  paused: boolean;
  seasonPaused: boolean;
  seasonEmergencyStop: boolean;
};

export type CompletionPlan = {
  writeProgress: boolean;
  writeLedger: boolean;
  points: number | null;
  sourceKey: string;
  claimState: 'pending' | null;
  alreadyCompleted: boolean;
  error: string | null;
};
